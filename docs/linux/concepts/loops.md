# BPF中的循环

循环在编程中是一个常见的概念，然而，在 BPF 中，它们可能比大多数环境中更复杂一些。这是因为验证器和 BPF 程序保证的“安全”特性。

## 展开循环

在 [v5.3](https://github.com/torvalds/linux/commit/2589726d12a1b12eaaa93c7f1ea64287e383c7a5) 之前，BPF 字节码中的循环是不允许的，因为验证器不够智能，无法确定循环是否会总是终止。长期以来的解决方法是在编译器中展开循环。展开循环会增加程序的大小，并且只能在编译时知道迭代次数时才能进行。要展开循环，可以使用 `#pragma unroll` 指令，如下所示：

```c
#pragma unroll
for (int i = 0; i < 10; i++) {
    // 做一些事情
}
```

## 有界循环

从 v5.3 开始，验证器已经足够智能，能够确定循环是否会停止。这些被称为“有界循环”。然而，使用此功能的使用者仍然需要小心，因为很容易写出一个循环，使得程序对于验证器来说太复杂了。验证器将检查循环的每一种可能的排列，所以如果你有一个循环，它执行 100 次，每次循环体有 20 条指令和几个分支，那么这个循环将对复杂性限制计数几千条指令。

一个常见的错误是使用具有巨大范围的变量作为循环的界限。例如：

```c
void *data = ctx->data;
void *data_end = ctx->data_end;
struct iphdr *ip = data + sizeof(struct ethhdr);
if (ip + sizeof(struct iphdr) > data_end)
    return XDP_DROP;

for (int i = 0; i < ip->tot_len; i++) {
    // 扫描IP体以查找某些内容
}
```

由于 `ip->tot_len` 是一个 16 位整数，验证器将检查 `i` 的每一个可能值，直到 65535。根据循环体内的指令和分支，你很快就会耗尽复杂性。大多数时候，扫描体的前 X 个字节就足够了，所以可以限制循环：

```c
void *data = ctx->data;
void *data_end = ctx->data_end;
struct iphdr *ip = data + sizeof(struct ethhdr);
if (ip + sizeof(struct iphdr) > data_end)
    return XDP_DROP;

int max = ip->tot_len;
if (max > 100)
    max = 100;

for (int i = 0; i < max; i++) {
    // 扫描IP体以查找某些内容
}
```

## 映射迭代辅助函数

从 [v5.13](https://github.com/torvalds/linux/commit/69c087ba6225b574afb6e505b72cb75242a3d844) 开始，可以使用 `bpf_for_each_map_elem` 辅助函数迭代映射，所以你不必为此使用循环（如果映射类型支持的话）。该辅助函数使用指向映射的指针和一个回调函数进行调用。对于映射中的每个元素，都会调用回调函数。回调函数传递了映射、键、值和一个上下文指针。上下文指针可以用来从主程序传递信息到回调函数并返回。回调函数的返回值可以用来提前退出循环。

## 循环辅助函数

有时你真的需要在一个巨大的范围内迭代。对于那些导致复杂性问题的上述解决方案，`bpf_loop` 辅助函数在 [v5.17](https://github.com/torvalds/linux/commit/e6f2dd0f80674e9d5960337b3e9c2a242441b326) 中引入。该辅助函数允许进行多达 `1 << 23`（约800万）次迭代的循环。该辅助函数保证循环将终止，而无需验证器检查每次迭代。函数体是一个回调函数，带有一个 `index` 和 `ctx` 参数。上下文可以是任何类型，从主程序传入并在迭代之间共享，可以用作循环的输入和输出。回调函数的返回值可以用来继续或提前退出循环。

## 数字开放编码迭代器

在 [v6.4](https://github.com/torvalds/linux/commit/06accc8779c1d558a5b5a21f2ac82b0c95827ddd) 中引入了开放编码迭代器。它们允许程序迭代遍历内核对象。数字迭代器允许我们在一个数字范围内迭代，允许我们进行 for 循环。

这种方法的优点是，与有界循环相比，验证器只需要检查两种状态，而不需要像循环辅助那样需要回调函数。

每种迭代器类型都有一个 `bpf_iter_<type>_new` 函数来初始化迭代器，一个 `bpf_iter_<type>_next` 函数来获取下一个元素，以及一个 `bpf_iter_<type>_destroy` 函数来清理迭代器。在数字迭代器的情况下，使用 `bpf_iter_num_new`、`bpf_iter_num_next` 和 `bpf_iter_num_destroy` 函数。

数字迭代器的最基本示例是：

```c
struct bpf_iter_num it;
int *v;

bpf_iter_num_new(&it, 2, 5);
while ((v = bpf_iter_num_next(&it))) {
    bpf_printk("X = %d", *v);
}
bpf_iter_num_destroy(&it);
```

上述代码片段应该输出 `"X = 2"、"X = 3"、"X = 4"`。注意 5 是排除的，不返回。这与实现元素范围的类似 API（例如 Go 或 Rust 中的切片）匹配，其中结束索引是非包含性的。

`Libbpf` 还提供了宏，以更自然的方式编写上述代码：

```c
int v;

bpf_for(v, start, end) {
    bpf_printk("X = %d", v);
}
```

还有一个重复宏：

```c
int i = 0;
bpf_repeat(5) {
    bpf_printk("X = %d", i);
    i++;
}
```

从宏观角度看，这是因为 `next` 方法是验证状态分叉的点，这在概念上类似于验证器在验证条件跳转时所做的事情。我们在 `call bpf_iter_<type>_next` 指令处分叉，并模拟两个结果：`NULL`（迭代完成）和非 `NULL`（返回新元素）。

首先模拟 `NULL`，并应该在不循环的情况下到达出口。之后，非 `NULL` 案例被验证，它要么到达出口（对于没有真正循环的简单示例），要么到达另一个 `call bpf_iter_<type>_next` 指令，状态等同于已经（部分）验证的。在这一点上，状态等价意味着我们技术上将无限循环，而没有“突破”已建立的“状态信封”（即，后续迭代不会向验证器状态添加任何新知识或约束，所以运行 1、2、10 或一百万次并不重要）。

但考虑到迭代器下一个方法*必须*最终返回 `NULL` 的约定，我们可以得出结论，循环体是安全的，并且最终将终止。考虑到我们已经验证了循环外的逻辑（`NULL` 案例），并得出循环体是安全的结论（尽管可能循环多次），验证器可以声称整体程序逻辑的安全性。
