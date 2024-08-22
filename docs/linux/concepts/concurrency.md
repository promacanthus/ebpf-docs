# 并发

在编写 BPF 程序时，BPF 世界中的并发性是需要注意的事情。BPF 程序可以看作是内核调用的函数，因此理论上每个内核线程都可以同时调用同一程序。内核给出的唯一保证是相同的程序调用始终在相同的逻辑 CPU 上运行。

这在访问多个程序之间共享的内存或调用同一程序（例如非每个 CPU 映射和内核内存）时尤为重要。对此类内存的访问和修改受[竞争条件](https://en.wikipedia.org/wiki/Race_condition)的约束。程序和用户空间同时访问相同的映射值也是如此。

有以下几种方法可以避免争用条件。

## 原子操作

原子操作是指原子 CPU 指令。正常的 `i += 1` 操作将在某种程度上分解为：

1. `i` 读入某个 CPU 寄存器
2. 将 CPU 寄存器增加 1
3. 将寄存器值写回 `i`

由于这是分多个步骤进行的，因此即使是如此简单的操作也受竞争条件的影响。

有一类 CPU 指令可以在单个 CPU 指令中执行特定任务，该指令在硬件级别进行序列化。这些在 BPF 中也可用。使用 Clang/LLVM 编译时，可以通过一系列特殊的内置函数来访问这些特殊指令：

- `__sync_fetch_and_add(*a, b)`：在 a 处读取值，加 b 并写回，返回新值
- `__sync_fetch_and_sub(*a, b)`：在 a 处读取值，减 b 并写回，返回新值
- `__sync_fetch_and_or(*a, b)`：在 a 处读取值，与 b 或操作并写回，返回新值
- `__sync_fetch_and_xor(*a, b)`：在 a 处读取值，与 b 异或操作并写回来，返回新值
- `__sync_val_compare_and_swap(*a, b, c)`：在 a 处读取值，检查是否等于 b，如果为真，则将 c 写入 a 并返回 a 的原始值。失败时，离开 a 并返回 c。
- `__sync_lock_test_and_set(*a, b)`：在 a 处读取值，将 b 写入 a，返回 a 的原始值

如果要对变量执行上述序列之一，可以使用原子内置函数来实现。一个常见的示例是使用 `__sync_fetch_and_add` 递增共享计数器。

原子指令处理 1、2、4 或 8 个字节的变量。任何大于此值的变量（例如多个结构字段）都需要多个原子指令或其他同步机制。

如下是一个使用原子指令来计算 `sys_enter` 跟踪点被调用的次数的简单示例。

```c
int counter = 0;

SEC("tp_btf/sys_enter")
int sys_enter_count(void *ctx) {
    __sync_fetch_and_add(&counter, 1);
    return 0;
}
```

> 注意： 原子指令仍然在硬件级别同步，因此与其非原子变体相比，使用原子指令仍会降低性能。

## 自旋锁

内核中用于同步的常用技术是自旋锁。eBPF 还为映射值提供了[自旋锁](https://en.wikipedia.org/wiki/Spinlock)功能。与原子指令相比，自旋锁的主要优点是它保证了多个字段一起更新。

要使用自旋锁，首先必须在映射值的顶部包含一个 `struct bpf_spin_lock`。

```c
struct concurrent_element {
    struct bpf_spin_lock semaphore;
    int count;
}

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __type(key, int);
    __type(value, struct concurrent_element);
    __uint(max_entries, 100);
} concurrent_map SEC(".maps");
```

然后在你的代码中，你可以带着 `bpf_spin_lock`，做任何你需要做的事情，然后用 `bpf_spin_unlock` 释放锁。在此示例中，我们只需增加调用 `sys_enter` 跟踪点的次数。

```c
SEC("tp_btf/sys_enter")
int sys_enter_count(void *ctx) {
    int key = 0;
    struct concurrent_element init_value = {};
    struct concurrent_element *read_value;
    bpf_map_update_elem(&concurrent_map, &key, &init_value, BPF_NOEXIST);

    read_value = bpf_map_lookup_elem(&concurrent_map, &key);
    if(!read_value)
    {
        return 0;
    }

    bpf_spin_lock(&read_value->semaphore);
    read_value->count += 1;
    bpf_spin_unlock(&read_value->semaphore);
    return 0;
}
```

> 警告：
>
> 如果存在一个代码路径，获取了锁但是没有释放，那么验证器将会返回失败。您也不应一次使用多个锁，因为这可能会导致[死锁](https://en.wikipedia.org/wiki/Deadlock)情况。
>
> 并非所有 BPF 程序类型都支持 `bpf_spin_lock`，因此请务必检查支持的程序类型列表。

在用户空间方面，我们还可以请求在使用 `BPF_F_LOCK` 标志执行查找或更新时获取值中的旋转锁。

## Pre-CPU 映射

Per-CPU 映射类型，每个逻辑 CPU 都有一个映射副本。通过为每个 CPU 提供自己的内存，我们避免了同步内存访问的问题，因为没有共享访问。这是处理写入密集型任务的争用条件的最高效的 CPU 方法。但是，它确实是以内存为代价的，因为根据逻辑 CPU 数量，您需要更多内存。

这种方案还增加了用户空间方面的复杂性，因为需要读取更多数据，并且需要合并各个CPU的值。

## 映射 RCU

在利基用例中，有可能摆脱内置 RCU 逻辑的辅助函数。此方法的工作原理是永远不要直接通过 `bpf_map_lookup_elem` 帮助函数获取的指针修改映射值。而是将映射值复制到 BPF 堆栈，在那里修改其值，然后在修改后的副本上调用 `bpf_map_update_elem`。辅助函数将保证我们从初始状态干净地过渡到更新状态。如果映射值中的字段之间存在关系，则此属性可能很重要。如果同时发生多个更新，则此技术映射会导致丢失更新，但值永远不会“混合”。

在性能方面，需要权衡取舍。此技术确实执行额外的内存复制，但也不会阻止或同步。因此，这可能比自旋锁快，也可能比自旋锁慢，具体取决于值的大小。

应该注意的是，通过用户空间进行更新始终遵循此原则，只有对于 BPF 程序，这种区别才有意义。

## Map in Map 交换

在大多数情况下，用户空间不可能一次读取映射的所有内容。用户空间需要遍历所有键并执行查找。这意味着，在迭代和读取期间，映射中的值可能会发生变化。对于需要在给定时间获得映射快照的用例来说，这可能会有问题，例如对于统计数据，值和时间之间的关系需要非常准确。

Map-in-maps 可用于获取此快照行为。BPF 程序首先在外部映射中执行查找，该查找提供指向内部映射的指针。当用户空间想要收集快照时，它可以交换内部映射。从原则上讲，这就像在图形中看到的[多重缓冲](https://en.wikipedia.org/wiki/Multiple_buffering)。
