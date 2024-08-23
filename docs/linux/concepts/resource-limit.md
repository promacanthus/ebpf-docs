# eBPF中的资源限制

Linux 内核拥有保护机制，防止进程占用过多内存。由于 BPF 映射可能会占用大量空间，它们也通过这些机制受到限制。

## Rlimit

`rlimit` 或“资源限制”是一种系统，用于跟踪和限制您允许使用的某些资源的数量。它限制的其中一项是“ [锁定内存](https://man7.org/linux/man-pages/man2/getrlimit.2.html)”的数量。

直到内核版本 v5.11，这种机制被用来跟踪和限制 BPF 映射的内存使用量，这些映射计入锁定内存限制，因此通常需要增加或禁用此 `rlimit`，这需要额外的权限 `CAP_SYS_RESOURCE`。

## cGroup 内存限制

在 v5.11 内核更新中，[this patch set](https://lore.kernel.org/bpf/20201201215900.3569844-1-guro@fb.com/) 将内存核算和限制从 `rlimit` 切换到了 `cGroups`。这意味着所有使用的内存都会增加到创建它的进程所属的 `cGroup` 的“已使用内存”数字中。这消除了授予加载器 `CAP_SYS_RESOURCE` 权限的需要。如果需要提高资源限制，应在 `cGroup` 的 `memory.max` 设置中进行。

!!! 注意
    通过在内核编译期间禁用 `MEMCG_KMEM` kconfig，可以禁用按 `cGroup` 的内核内存核算和限制，该选项默认设置为 `y`。

!!! 注意
    [v6.3](https://github.com/torvalds/linux/commit/b6c1a8af5b1eec42aabc13376f94aa90c3d765f1) 添加了一个新的内核参数 `cgroup.memory=nobpf`，用于禁用 BPF 的内存核算和限制。
