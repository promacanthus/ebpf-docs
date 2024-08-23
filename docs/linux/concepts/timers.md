# eBPF 定时器

从 Linux 内核版本 [v5.15](https://github.com/torvalds/linux/commit/b00628b1c7d595ae5b544e059c27b1f5828314b4) 开始，eBPF 程序可以安排在以后的时间执行一个 eBPF 函数。这个特性的用例包括对映射值的垃圾收集或执行周期性检查。例如，我们可能想要从 LRU 映射中修剪 DNS 记录，如果它们的 TTL 已过期，以主动腾出空间，而不是冒着由于不活动而修剪具有有效 TTL 的条目的风险。

定时器存储在映射值中的 `struct bpf_timer` 字段里。例如：

```c
struct map_elem {
    int counter;
    struct bpf_timer timer;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1000);
    __type(key, int);
    __type(value, struct map_elem);
} hmap SEC(".maps");
```

这样一个定时器的定义是：`#!c struct bpf_timer { __u64 :64; __u64 :64; };`。

!!! 注意
    只有具有 `CAP_BPF` 权限的程序才能使用 `bpf_timer`。

定时器附加到映射的生命周期上，如果映射被释放/删除，该映射中的所有待处理定时器将被取消。

待处理的定时器将保持对包含回调的程序的引用，因此即使没有其他引用存在，程序也会保持加载状态，直到所有定时器触发或被取消。

- 必须使用 `bpf_timer_init` 辅助函数初始化定时器。
- 初始化后，使用 `bpf_timer_set_callback` 辅助函数为定时器分配回调。
- 最后，使用 `bpf_timer_start` 辅助函数启动定时器。
- 也可以使用 `bpf_timer_cancel` 辅助函数取消待处理的定时器。

这三个辅助函数不一定必须在同一程序中同时发生。以下用例是有效的：

- `map1` 由 `prog1`、`prog2`、`prog3` 共享。
- `prog1` 为一些 `map1` 元素调用 `bpf_timer_init`。
- `prog2` 为一些 `map1` 元素调用 `bpf_timer_set_callback`。
  - 那些没有 `bpf_timer_init` -ed的将返回 `-EINVAL`。
- `prog3` 为一些 `map1` 元素调用 `bpf_timer_start`。
  - 那些既没有 `bpf_timer_init` -ed也没有 `bpf_timer_set_callback` -ed的将返回 `-EINVAL`。

如果映射没有用户引用（即没有被用户空间的打开文件描述符持有，也没有在 `bpffs` 中被固定），`bpf_timer_init` 和 `bpf_timer_set_callback` 将返回 `-EPERM`。

传递给定时器的回调具有以下签名 `#!c static int callback_fn(void *map, {map key type} *key, {map value type} *value)`。
回调以指向映射、映射键和与定时器相关联的映射值的指针被调用。它与正常的 eBPF 程序执行不同，没有上下文，因此无法执行需要在上下文上操作或辅助副作用的工作。它的唯一输入和输出是映射。

!!! 注意
    回调函数*必须*总是返回 `0`，否则验证器将拒绝该程序。

回调可以选择通过在 `value->timer` 上调用 `bpf_timer_start` 重新安排自己的定时器。这使得不仅可以从给定的 eBPF 程序运行中获得一次性延迟，还可以在仅通过单个触发事件后，使周期性函数无限期地运行。
