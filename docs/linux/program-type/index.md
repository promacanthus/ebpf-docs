# 程序类型（Linux）

eBPF 程序可用于多种不同目的的广泛且不断增长的用途。存在不同类型的 eBPF 程序以适应这些不同的用例。Linux 内核可能会根据程序类型限制或允许某些功能，并非所有类型的程序都可以执行相同的事情，因为它们在内核中的执行位置不同。验证器将强制执行这些限制。

## 网络程序类型

这些程序类型由网络事件触发

* `BPF_PROG_TYPE_SOCKET_FILTER`
* `BPF_PROG_TYPE_SCHED_CLS`
* `BPF_PROG_TYPE_SCHED_ACT`
* `BPF_PROG_TYPE_XDP`
* `BPF_PROG_TYPE_SOCK_OPS`
* `BPF_PROG_TYPE_SK_MSG`
* `BPF_PROG_TYPE_SK_LOOKUP`
* `BPF_PROG_TYPE_SK_REUSEPORT`
* `BPF_PROG_TYPE_FLOW_DISSECTOR`

### 轻量级隧道程序类型

这些程序类型用于实现自定义的轻量级隧道协议

* `BPF_PROG_TYPE_LWT_IN`
* `BPF_PROG_TYPE_LWT_OUT`
* `BPF_PROG_TYPE_LWT_XMIT`
* `BPF_PROG_TYPE_LWT_SEG6LOCAL`

## cGroup程序类型

这些程序类型由程序附加的 `cGroup` 的事件触发

* `BPF_PROG_TYPE_CGROUP_SKB`
* `BPF_PROG_TYPE_CGROUP_SOCK`
* `BPF_PROG_TYPE_CGROUP_DEVICE`
* `BPF_PROG_TYPE_CGROUP_SOCK_ADDR`
* `BPF_PROG_TYPE_CGROUP_SOCKOPT`
* `BPF_PROG_TYPE_CGROUP_SYSCTL`

## 跟踪程序类型

这些程序类型由来自内核或用户空间的跟踪事件触发

* `BPF_PROG_TYPE_KPROBE`
* `BPF_PROG_TYPE_TRACEPOINT`
* `BPF_PROG_TYPE_PERF_EVENT`
* `BPF_PROG_TYPE_RAW_TRACEPOINT`
* `BPF_PROG_TYPE_RAW_TRACEPOINT_WRITABLE`
* `BPF_PROG_TYPE_TRACING`

## 杂项

这些程序类型具有独特的目的，不适合归入任何较大的类别

* `BPF_PROG_TYPE_LIRC_MODE2`
* `BPF_PROG_TYPE_LSM`
* `BPF_PROG_TYPE_EXT`
* `BPF_PROG_TYPE_STRUCT_OPS`
* `BPF_PROG_TYPE_SYSCALL`

## ELF部分

程序类型的概念仅存在于内核/系统调用级别。没有标准化的方法来标记 ELF 中的特定程序属于哪种程序类型。大多数[加载器](../../concepts/loader.md)遵循 `Libbpf` 所设立的示例，即通过 [ELF](../../concepts/elf.md) 部分名称中的模式来传达程序类型。

## 部分名称索引

!!! 示例 "文档可以改进"
    这部分文档是不完整的，非常欢迎贡献
