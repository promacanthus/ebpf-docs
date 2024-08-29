# 网络程序类型

## BPF_PROG_TYPE_SOCKET_FILTER

Socket filter 程序可以挂钩到网络套接字上，旨在过滤或修改该套接字接收的数据包（程序不会对出站/传出的数据包进行调用）。

这种程序类型的一个显著用例是 [`tcpdump`](https://www.tcpdump.org/)，它使用 [原始套接字](https://man7.org/linux/man-pages/man7/raw.7.html) 结合由过滤器查询生成的套接字过滤器，以高效地过滤数据包，并且只对感兴趣的数据包支付内核-用户空间屏障成本。

### 用法

套接字过滤器程序通常放置在以 `socket` 为前缀的 [ELF](../../concepts/elf.md) 部分中。套接字过滤器由内核使用 [`__sk_buff`](../program-context/__sk_buff.md) 上下文调用。返回值指示应**保留**消息的多少字节。返回小于数据包大小的值将截断它，返回 `0` 将丢弃数据包。

### [上下文](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCKET_FILTER/#context)

由于这样做可能会破坏内核中的假设，或者因为在程序挂接到内核的点上数据不可用，所以这种程序类型不允许对上下文的所有字段进行读取和写入。

### 附加

这种程序类型可以使用 `setsockopt` 系统调用，使用 `SOL_SOCKET` 套接字级别和 `SO_ATTACH_BPF` [套接字选项](https://man7.org/linux/man-pages/man7/socket.7.html) 附加到网络套接字上。

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCKET_FILTER/#helper-functions)

并非所有辅助函数在所有程序类型中都可用。以下是套接字过滤器程序可用的辅助调用：

### [KFuncs](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCKET_FILTER/#kfuncs)

### 历史

套接字过滤器早于 eBPF 本身，套接字过滤器是原始 BPF 实现中的第一个原型，现在称为 cBPF（经典 BPF）。实际上，使用这种程序类型是发明整个系统的原因。

## BPF_PROG_TYPE_SCHED_CLS

这种程序类型允许在 eBPF 中实现流量控制（TC）分类器（又名过滤器）。TC 可用于多种用例，所有这些用例都与流量的操纵有关。例如，TC 用于实现 QoS（服务质量），允许像 VoIP（IP 语音）这样对延迟敏感的流量在比如网络流量之前得到处理。它还可以丢弃数据包以模拟数据包丢失，增加延迟以模拟远距离客户端，或者为应用程序或用户应用带宽限制，仅举几例。TC 允许管理员使用 qdiscs（排队规则）的分层模型来过滤流量。根 qdisc 以某些操作连接到网络接口。如果其子 qdisc 的过滤器与流量匹配，则该 qdisc 还可以具有将在根之上使用的子 qdisc。这种程序类型允许我们在 eBPF 中实现这样的过滤器。

### 用法

TC 分类器程序通常被放入以 [ELF](../../concepts/elf.md) 为前缀的部分，前缀为 `tc/` 或 `classifier/`。内核使用 [`__sk_buff`](../program-context/__sk_buff.md) 上下文调用 TC 分类器程序。返回值指示内核应如何处理数据包，以下值是允许的：

#### 常规分类器

默认情况下，当 BPF 分类器附加到排队规则时，它的行为与其他任何分类器相同。它不能采取诸如丢弃或重定向数据包之类的操作，相反，其返回值用于根据数据包的内容选择类别。

- 返回值 `-1` 表示应选择默认类别，
- 返回值 `0` 意味着过滤器不匹配，应尝试下一个过滤器，
- 任何正数表示类的 ID。

虽然可能，但这是很少使用的用例，eBPF 程序通常用于直接操作。

#### 直接操作

当以直接操作模式附加时，eBPF 程序将同时充当分类器和操作。这种模式简化了最常见用例的设置，在这些用例中，我们只是希望始终执行一个操作。在直接操作模式下，返回值可以是以下之一：

- `TC_ACT_UNSPEC`（-1）：表示应采取默认配置的操作。
- `TC_ACT_OK`（0）：表示数据包应继续。
- `TC_ACT_RECLASSIFY`（1）：表示数据包必须从根排队规则重新开始分类。这通常在修改数据包后使用，因此其分类可能会有不同的结果。
- `TC_ACT_SHOT`（2）：表示数据包应被丢弃，不应进行其他 TC 处理。
- `TC_ACT_PIPE`（3）：虽然已定义，但此操作不应使用，对于 eBPF 分类器没有特定意义。
- `TC_ACT_STOLEN`（4）：虽然已定义，但此操作不应使用，对于 eBPF 分类器没有特定意义。
- `TC_ACT_QUEUED`（5）：虽然已定义，但此操作不应使用，对于 eBPF 分类器没有特定意义。
- `TC_ACT_REPEAT`（6）：虽然已定义，但此操作不应使用，对于 eBPF 分类器没有特定意义。
- `TC_ACT_REDIRECT`（7）：表示数据包应被重定向，如何以及重定向到何处的细节通过[帮助函数](../helper-function/index.md)设置为副作用。

直接操作模式下的分类器仍然可以通过设置 `tc_classid` 字段来设置类别 ID。

### [上下文](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SCHED_CLS/#context)

这种程序类型不允许从上下文的所有字段读取和写入，因为这样做可能会破坏内核中的假设，或者因为在程序挂钩到内核的点上数据不可用。

### 附加

截至内核版本 v6.2，将 eBPF 程序附加到 TC 的唯一方法是通过[网络链接套接字](https://man7.org/linux/man-pages/man7/netlink.7.html)，其细节较为复杂。如果您希望通过 API 管理附加操作，建议使用网络链接库。然而，最常见的方法是通过 iproute2 `tc` 命令行工具，这是使用网络链接协议的网络实用程序的标准实现。

附加 TC 分类器的最基本示例是：

```bash
# Add a qdisc of type `clsact` to device `eth1`
$ tc qdisc add dev eth1 clsact
# Load the `program.o` ELF file, and attach the `my_func` section to the qdisc of eth1 on the ingress side.
$ tc filter add dev eth1 ingress bpf obj program.o sec my_func
```

有关 `tc` 命令的更多详细信息，请参阅[常规手册页](https://man7.org/linux/man-pages/man8/tc.8.html)。

有关 bpf 过滤器选项的更多详细信息，请参阅 [`tc-bpf` 手册页](https://man7.org/linux/man-pages/man8/tc-bpf.8.html)。

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SCHED_CLS/#helper-functions)

并非所有帮助函数在所有程序类型中都可用。以下是适用于 TC 分类器程序的辅助调用。

### [KFuncs](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SCHED_CLS/#kfuncs)

## BPF_PROG_TYPE_SCHED_ACT

> TODO

## BPF_PROG_TYPE_XDP

XDP（Express Data Path）程序能够附加到网络设备上，并针对每个接收到的传入（ingress）数据包进行调用。XDP 程序可以执行许多操作，其中最突出的包括数据包的操控、丢弃数据包、重定向以及允许数据包传递到网络栈。

XDP 程序的显著用例包括 DDoS 保护、负载均衡和高吞吐量的数据包过滤。如果加载了原生驱动程序支持，XDP 程序将在接收数据包之后但在为套接字缓冲区分配内存之前被调用。这个调用点使得 XDP 程序在性能上极为出色，特别是在与其它 eBPF 程序类型或技术相比，这些程序或技术通常在相对昂贵的套接字缓冲区分配过程发生后运行，只是为了丢弃数据包。

### 用法

XDP 程序通常放置在以 `xdp` 为前缀的 [ELF](../../concepts/elf.md) 部分中。XDP 程序通过内核使用 `xdp_md` 上下文被调用。返回值指示内核应对数据包采取的操作，允许使用以下值：

- `XDP_ABORTED`：表示发生了无法恢复的错误。返回此操作将导致内核触发 `xdp_exception` 跟踪点并打印一行到跟踪日志。这允许对此类事件进行调试。这也是昂贵的，因此不应在生产中不加考虑地使用。
- `XDP_DROP`：丢弃数据包。值得注意的是，由于我们很早就丢弃了数据包，它对像 `tcpdump` 这样的工具是不可见的。考虑使用自定义反馈机制记录丢弃情况，以保持可见性。
- `XDP_PASS`：将数据包传递给网络栈。数据包可以在之前被操作。
- `XDP_TX`：将数据包发送回它到达的同一网络端口。数据包可以在之前被操作。
- `XDP_REDIRECT`：将数据包重定向到多个位置之一。数据包可以在之前被操作。

`XDP_REDIRECT` 不应单独返回，应始终与辅助函数调用结合使用。可以使用许多辅助函数来重定向当前数据包。这些在上下文中注释隐藏的值，以通知内核在程序退出后应采取实际的重定向操作。

数据包可以以以下方式重定向：

- 数据包可以被重定向到不同于它进入的接口的出口（像 `XDP_TX` 但对于不同的接口）。这可以使用 `bpf_redirect` 辅助函数（不推荐）或与 `BPF_MAP_TYPE_DEVMAP` 或 `BPF_MAP_TYPE_DEVMAP_HASH` 映射结合使用的 `bpf_redirect_map` 辅助函数来完成。
- 数据包可以被重定向到另一个 CPU 进行进一步处理，使用与 `BPF_MAP_TYPE_CPUMAP` 映射结合使用的 `bpf_redirect_map` 辅助函数。
- 数据包可以被重定向到用户空间，绕过内核网络栈，使用与 `BPF_MAP_TYPE_XSKMAP` 映射结合使用的 `bpf_redirect_map` 辅助函数。

### 上下文

XDP 程序使用 `struct xdp_md` 上下文被调用。这是一个非常简单的上下文，代表单个数据包。

| 名字 | 版本 | 描述 |
|------|------|------|
| `data` | v4.8 | 此字段包含指向数据包数据开头的指针。XDP程序可以在始终执行边界检查的情况下，从 `data` 到 `data_end` 之间的区域读取。 |
| `data_end` | v4.8 | 此字段包含指向数据包数据结尾的指针。验证器将强制执行任何XDP程序在尝试从中读取之前，检查来自 `data` 的偏移量是否小于 `data_end`。 |
| `data_meta` | v4.15 | 此字段包含指向数据包内存中元数据区域开头的指针。默认情况下，没有元数据空间可用，所以 `data_meta` 和 `data` 的值将是相同的。XDP程序可以使用 `bpf_xdp_adjust_meta` 辅助函数请求元数据，成功后 `data_meta` 是更新的，以便它不小于 `data`。`data_meta` 和 `data` 之间的空间可以由XDP程序自由使用。 |
| `ingress_ifindex` | v4.16 | 此字段包含数据包到达的网络接口索引。 |
| `rx_queue_index` | v4.16 | 此字段包含NIC上接收数据包的队列索引。 |
| `egress_ifindex` | v5.8 | 此字段为只读，并包含数据包已被重定向出的网络接口索引。此字段仅在初始XDP程序使用 `BPF_MAP_TYPE_DEVMAP` 将数据包重定向到另一个设备，并且映射的值包含辅助XDP程序的文件描述符后设置。这个辅助程序将被调用，上下文将设置 `egress_ifindex`、`rx_queue_index` 和 `ingress_ifindex`，以便它可以修改数据包中的字段以匹配重定向。 |

#### XDP片段

v5.18

使用更大的数据包和批量处理它们的性能优化技术越来越普遍（巨帧、GRO、BIG-TCP）。因此，可能会发生数据包变大超出单个内存页，或者我们想要将多个已经分配的数据包粘合在一起。这打破了XDP程序对所有数据包数据都位于 `data` 和 `data_end` 之间的线性区域的现有假设。

为了提供支持且不破坏现有程序，引入了 “XDP 片段感知” 程序的概念。编写此类程序的 XDP 程序作者可以比较 `data` 和 `data_end` `指针之间的长度以及bpf_xdp_get_buff_len` 的输出。如果 XDP 程序需要处理超出线性部分的数据，则应使用 `bpf_xdp_load_bytes` 和 `bpf_xdp_store_bytes` 辅助函数。

要表明一个程序是 “XDP 片段感知” 的，应使用 `BPF_F_XDP_HAS_FRAGS` 标志加载该程序。程序作者可以通过将其程序放在 `xdp.frags/` ELF 节而不`xdp/` 节中来表明他们希望像 `libbpf` 这样的库使用此标志加载程序。

!!! note
    如果程序既是“XDP片段感知”的，也应该附加到 `BPF_MAP_TYPE_CPUMAP` 或 `BPF_MAP_TYPE_DEVMAP`，那么两个ELF命名约定是结合的：`xdp.frags/cpumap/` 或 `xdp.frags/devmap`。

!!! warning
    并非所有网络驱动程序都支持 XDP 片段，请检查[驱动程序支持](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_XDP/#driver-support)表。

### 附加

将 XDP 程序附加到网络设备有两种方式，传统方式是通过 [netlink](https://man7.org/linux/man-pages/man7/netlink.7.html) 套接字完成，其细节复杂。实现netlink XDP 附加的库示例包括 [`vishvananda/netlink`](https://github.com/vishvananda/netlink/blob/afa2eb2a66aac1f8f370287f236ba93d4c078dd6/link_linux.go#L934) 和 [libbpf](https://github.com/libbpf/libbpf/blob/ea284299025bf85b85b4923191de6463cd43ccd6/src/netlink.c#L321)。

现代且推荐的方式是使用 BPF 链接。这样做就像调用 `BPF_LINK_CREATE` 一样简单，将 `target_ifindex` 设置为目标网络接口，`attach_type` 设置为 `BPF_LINK_TYPE_XDP`，以及与 netlink 方法相同的 `flags`。

有一些微妙的差异。netlink 方法将为网络接口提供对程序的引用，这意味着附加后，程序将保持附加状态，直到被程序分离，即使原始加载器存在。这与 `kprobes` 形成对比，例如，一旦加载器存在，`kprobes` 就会停止（假设我们没有固定程序）。然而，使用链接时，这种引用不会发生，链接的创建返回一个文件描述符，用于管理生命周期，如果链接文件描述符关闭或加载器存在而没有固定它，程序将从网络接口分离。

!!! warning
    硬件卸载的 GRO 和 LSO 与 XDP 不兼容，必须禁用它们才能使用 XDP。不这样做将在附加时导致 `-EINVAL` 错误。
    可以使用以下命令禁用GRO和LSO：`ethtool -K {ifname} lro off gro off`

!!! warning
    对于不支持片段的 XDP 程序，存在最大 MTU 限制在 1500 到 4096 字节之间，确切的限制取决于驱动程序。如果设备上配置的 MTU 设置高于限制，XDP 程序将无法附加。

#### 标志

#### `XDP_FLAGS_UPDATE_IF_NOEXIST`

如果设置，内核只有在网络接口尚未附加 XDP 程序时才会附加 XDP 程序。

!!! note
    此标志仅在 netlink 附加方法中使用，链接附加方法更通用地处理此行为。

#### `XDP_FLAGS_SKB_MODE`

如果设置，内核将以 SKB（套接字缓冲区）模式附加程序。这种模式也称为“通用模式”。这总是有效的，无论驱动程序支持如何。它通过在已经分配套接字缓冲区的更高堆栈上调用XDP 程序来工作，这通常比 XDP 程序被调用的位置更高。这抵消了 XDP 程序的速度优势。这种模式也缺乏完整的功能支持，因为有些操作不能再在网络堆栈的这么高的位置执行。

如果驱动程序支持不可用，建议使用 `BPF_PROG_TYPE_SCHED_CLS` 程序类型，因为它提供了更多的功能，性能大致相同。

此标志与 `XDP_FLAGS_DRV_MODE` 和 `XDP_FLAGS_HW_MODE` 互斥

#### `XDP_FLAGS_DRV_MODE`

如果设置，内核将以驱动程序模式附加程序。这需要网络驱动程序的支持，但大多数主要的网络卡供应商在最新内核中都有支持。

此标志与 `XDP_FLAGS_SKB_MODE` 和 `XDP_FLAGS_HW_MODE` 互斥

#### `XDP_FLAGS_HW_MODE`

如果设置，内核将以硬件卸载模式附加程序。这需要驱动程序和硬件对XDP卸载的支持。目前，只有选定的 Netronome 设备 [支持卸载](https://www.netronome.com/media/documents/eBPF_HW_OFFLOAD_HNiMne8_2_.pdf)。然而，值得注意的是，只有正常功能的子集受到支持。

#### `XDP_FLAGS_REPLACE`

如果设置，内核将原子替换现有程序为这个新程序。您还必须通过 netlink 请求传递旧程序的文件描述符。

!!! note
    此标志仅在 netlink 附加方法中使用，链接附加方法更通用地处理此行为。

### 设备映射程序

v5.8

XDP 程序可以附加到 `BPF_MAP_TYPE_DEVMAP` 映射的值。一旦附加，这个程序将在第一个程序结束后但在数据包发送到新网络设备之前运行。这些程序被调用时带有额外的上下文，见 `egress_ifindex`。

只有使用 `BPF_XDP_DEVMAP` 值在 `expected_attach_type` 中加载的 XDP 程序才允许以这种方式附加。

程序作者可以向加载器（如 `libbpf`）表明应该使用此预期附加类型加载程序，方法是将程序放置在 `xdp/devmap/` ELF 部分。

### CPU映射程序

v5.9

XDP程序可以附加到 `BPF_MAP_TYPE_CPUMAP` 映射的值。一旦附加，这个程序将在新的逻辑CPU上运行。其思想是，您将在第一个XDP程序中花费最少的时间，并且只安排它并在此第二个程序中执行更CPU密集的任务。

只有使用 `BPF_XDP_CPUMAP` 值在 `expected_attach_type` 中加载的XDP程序才允许以这种方式附加。

程序作者可以向加载器（如 `libbpf` ）表明应该使用此预期附加类型加载程序，方法是将程序放置在 `xdp/cpumap/` ELF部分。

### [驱动程序支持](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_XDP/#driver-support)

#### [最大MTU](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_XDP/#max-mtu)

### [支持的函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_XDP/#helper-functions)

### [KFuncs](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_XDP/#kfuncs)

## BPF_PROG_TYPE_SOCK_OPS

套接字操作程序与 cGroups 相关联，并在套接字的多个生命周期事件中被调用，为程序提供了按连接更改设置或记录套接字存在的机会。

### 用法

套接字操作（Socket ops）程序可以在同一个套接字的不同生命周期阶段多次被调用，以执行不同的操作。有些操作会查询程序以获取特定参数，而其他操作则仅通知程序某些事件，以便程序可以在那时执行操作。

无论操作类型如何，程序在成功时应该始终返回 `1`。返回负整数表示不支持该操作。对于查询信息的操作，上下文中的 `reply` 字段用于“回复”查询，程序预期将该字段设置为请求的值。

这种程序类型的一些预期用例包括：

1. 根据特定设置如 RTO（重传超时）、RTT（往返时间）和 ECN（显式拥塞通知）回复，或使用 `bpf_setsockopt` 辅助函数来调整每个连接的设置/选项（见 ops 部分的详细信息）。

    > 例如，使用 Facebook 的内部 IPv6 地址很容易判断连接的两个主机是否在同一数据中心。因此，可以轻松编写一个 BPF 程序，当两个主机都在同一数据中心时选择较小的SYN RTO 值 。

2. 套接字操作程序非常适合收集有关连接的详细指标，尤其是在内核版本 4.16 之后。

3. 套接字操作程序可以用来实现内核不知道的TCP选项，无论是发送端还是接收端。见 `BPF_SOCK_OPS_PARSE_HDR_OPT_CB` 和 `BPF_SOCK_OPS_WRITE_HDR_OPT_CB`。

4. 最后，但同样重要的是，套接字操作程序可以动态地将套接字添加到 `BPF_MAP_TYPE_SOCKMAP` 或 `BPF_MAP_TYPE_SOCKHASH` 映射中。由于套接字操作程序在套接字连接或监听时会收到通知，这允许我们在任何实际消息流量发生之前将套接字添加到这些映射中。这允许 `BPF_PROG_TYPE_SK_MSG` 和 `BPF_PROG_TYPE_SK_SKB` 在用户空间无需将套接字添加到 sock 映射中即可操作。`bpf_sock_map_update` 和 `bpf_sock_hash_update` 辅助函数正是为此目的而存在的。

请注意，提供的链接无法解析，可能是因为链接错误或网络问题。如果需要链接中的特定信息，请检查链接的有效性或稍后重试。如果链接与问题无关，我可以继续回答您的问题。

### 操作

在附加程序后，它将针对多个套接字和多个操作被调用。上下文中的 op 字段指示程序针对哪个操作被调用。上下文中字段的可用性和返回值的含义因操作而异。

以 `_CB` 结尾的操作是回调，只是为了通知程序一个事件。这些操作的返回值被忽略。其中一些回调除非通过在套接字上设置标志来激活，否则不会触发。设置这些标志由程序本身使用 `bpf_sock_ops_cb_flags_set` 助手来完成，该助手既可以设置也可以取消标志。

| 名称 | 版本 | 描述 |
|------|------|------|
| BPF_SOCK_OPS_TIMEOUT_INIT | v4.13 | 当使用此操作调用时,程序可以覆盖SYN或SYN-ACK的默认RTO(重传超时)。如果应使用默认值,可以返回-1。 |
| BPF_SOCK_OPS_RWND_INIT | v4.13 | 当使用此操作调用时,程序可以覆盖默认的初始通告窗口(以数据包为单位),或者如果应使用默认值则返回-1。 |
| BPF_SOCK_OPS_TCP_CONNECT_CB | v4.13 | 当套接字处于'connect'状态,已发送SYN消息但尚未建立连接时,程序会被调用此操作。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB | v4.13 | 当主动套接字转换为已建立连接状态时,程序会被调用此操作。这发生在出站连接建立时。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB | v4.13 | 当被动套接字转换为已建立连接状态时,程序会被调用此操作。这发生在入站连接建立时。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_NEEDS_ECN | v4.13 | 当使用此操作调用时,程序被询问是否应为给定连接启用ECN(显式拥塞通知)。程序应返回0或1。 |
| BPF_SOCK_OPS_BASE_RTT | v4.15 | 当使用此操作调用时,程序被询问给定连接的基本RTT(往返时间)。如果测量的RTT超过此值,则表示连接拥塞,拥塞控制算法将采取措施。 |
| BPF_SOCK_OPS_RTO_CB | v4.16 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_RTO_CB_FLAG时,可能会使用此操作调用程序以指示RTO(重传超时)已触发。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_RETRANS_CB | v4.16 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_RETRANS_CB_FLAG标志时,当skb中的数据包被重传时,程序会被调用此操作。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_STATE_CB | v4.16 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_STATE_CB_FLAG标志时,当套接字的TCP状态发生变化时,程序会被调用此操作。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_TCP_LISTEN_CB | v4.19 | 当在套接字上使用listen系统调用,使其转换到LISTEN状态时,程序会被调用此操作。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_RTT_CB | v5.3 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_RTT_CB_FLAG标志时,程序会在每次往返时被调用此操作。这只是一个通知,返回值会被丢弃。 |
| BPF_SOCK_OPS_PARSE_HDR_OPT_CB | v5.10 | 程序被调用此操作以解析TCP头。如果设置了BPF_SOCK_OPS_PARSE_ALL_HDR_OPT_CB_FLAG,程序将被调用解析所有TCP头;如果设置了BPF_SOCK_OPS_PARSE_UNKNOWN_HDR_OPT_CB_FLAG,程序仅被调用解析未知的TCP头。 |
| BPF_SOCK_OPS_HDR_OPT_LEN_CB | v5.10 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_WRITE_HDR_OPT_CB_FLAG标志时,程序会被调用此操作以为TCP选项保留空间,这些选项将在程序被调用BPF_SOCK_OPS_WRITE_HDR_OPT_CB操作时写入数据包。 |
| BPF_SOCK_OPS_WRITE_HDR_OPT_CB | v5.10 | 当通过bpf_sock_ops_cb_flags_set设置BPF_SOCK_OPS_WRITE_HDR_OPT_CB_FLAG标志时,程序会被调用此操作以将TCP选项写入数据包,这些选项的空间已在之前调用BPF_SOCK_OPS_HDR_OPT_LEN_CB操作时保留。 |

### 上下文

[`struct bfp_sock_ops`](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCK_OPS/#context)

| 名称 | 版本 | 描述 |
|------|------|------|
| op | v4.13 | 此字段表示当前操作,请参阅ops部分了解可能的值和含义。 |
| args | v4.16 | 此字段是一个包含4个__u32值的数组,某些操作使用它来提供额外信息。参数的含义取决于op。 |
| reply | v4.13 | 此字段用作需要返回值的操作的返回值。这是BPF程序允许修改的唯一字段。 |
| replylong | v4.13 | 此字段原本设想用于不适合单个__u32的回复,但截至v6.3,实际上并未使用。 |
| family | v4.13 | 调用程序的套接字的地址族。是AF_*枚举之一。 |
| remote_ip4 | v4.13 | 如果family == AF_INET,则为网络字节序的远程IPv4地址。 |
| local_ip4 | v4.13 | 如果family == AF_INET,则为网络字节序的本地IPv4地址。 |
| remote_ip6 | v4.13 | 如果family == AF_INET6,则为网络字节序的远程IPv6地址。 |
| local_ip6 | v4.13 | 如果family == AF_INET6,则为网络字节序的本地IPv6地址。 |
| remote_port | v4.13 | 网络字节序的远程数据链路/第4层端口。 |
| local_port | v4.13 | 网络字节序的本地数据链路/第4层端口。 |
| is_fullsock | v4.16 | 某些TCP字段仅在存在完整套接字时有效。如果不存在,这些字段读取为零。 |
| snd_cwnd | v4.16 | 发送拥塞窗口 |
| srtt_us | v4.16 | 平均/平滑的RTT(往返时间),以微秒为单位存储,左移3位。实际srtt(微秒) = ctx->srtt_us >> 3 |
| bpf_sock_ops_cb_flags | v4.16 | 此字段包含指示哪些可选操作已启用或未启用的标志。可能的值列在include/uapi/linux/bpf.h中。要更改字段内容,必须使用bpf_sock_ops_cb_flags_set辅助函数。 |
| state | v4.16 | 此字段包含套接字的连接状态。 |
| rtt_min | v4.16 | 观察到的最小RTT(往返时间) |
| snd_ssthresh | v4.16 | 慢启动大小阈值 |
| rcv_nxt | v4.16 | 我们希望接收的下一个TCP序列号 |
| snd_nxt | v4.16 | 我们将要发送的下一个TCP序列号 |
| snd_una | v4.16 | 我们想要确认的第一个字节 |
| mss_cache | v4.16 | 缓存的有效MSS(最大段大小),不包括SACK |
| ecn_flags | v4.16 | ECN(显式拥塞通知)状态位 |
| rate_delivered | v4.16 | 保存的速率样本:已传递的数据包 |
| rate_interval_us | v4.16 | 保存的速率样本:经过的时间 |
| packets_out | v4.16 | "在途"的数据包数量 |
| retrans_out | v4.16 | 重新传输的数据包数量 |
| total_retrans | v4.16 | 整个连接的数据包重传总数 |
| segs_in | v4.16 | RFC4898 tcpEStatsPerfSegsIn 输入段总数 |
| data_segs_in | v4.16 | RFC4898 tcpEStatsPerfDataSegsIn 输入数据段总数 |
| segs_out | v4.16 | RFC4898 tcpEStatsPerfSegsOut 发送段总数 |
| data_segs_out | v4.16 | RFC4898 tcpEStatsPerfDataSegsOut 发送数据段总数 |
| lost_out | v4.16 | 丢失的数据包数量 |
| sacked_out | v4.16 | SACK'd数据包数量 |
| sk_txhash | v4.16 | 用于传输的计算流哈希 |
| bytes_received | v4.16 | RFC4898 tcpEStatsAppHCThruOctetsReceived sum(delta(rcv_nxt)),或已确认的字节数 |
| bytes_acked | v4.16 | RFC4898 tcpEStatsAppHCThruOctetsAcked sum(delta(snd_una)),或已确认的字节数 |
| sk | v5.3 | 指向struct bpf_sock的指针 |
| skb_data | v5.10 | skb_data到skb_data_end覆盖整个TCP头 |
| skb_data_end | v5.10 | TCP头的结束指针 |
| skb_len | v5.10 | 数据包的总长度。包括头部、选项和有效载荷。 |
| skb_tcp_flags | v5.10 | 头部的tcp_flags。提供了一种检查tcp_flags的简便方法,无需解析skb_data。 |
| skb_hwtstamp | v6.2 | 硬件/NIC报告的数据包接收时间戳 |

### 附加

套接字操作程序通过 `BPF_PROG_ATTACH` 系统调用或 `BPF 链接` 附加到 cGroups 。

### [示例](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCK_OPS/#examples)

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SOCK_OPS/#helper-functions)

## BPF_PROG_TYPE_SK_SKB

Socket SKB 程序在 L4 数据流上被调用，其目的是解析 L7 消息，以及确定 L4/L7 消息是否应被允许、阻止或重定向。

> 更细致的解释：这里提到的 Socket SKB 程序是在网络通信的 L4 层（传输层）的数据流动过程中被触发运行的。它承担着两项重要任务，一是对 L7 层（应用层）的消息进行解析，二是判断这些 L4/L7 消息的处理方式，即决定是允许其通过、阻止其传输还是将其重定向到其他位置。

### 用法

套接字 SKB 程序被附加到 `BPF_MAP_TYPE_SOCKMAP` 或 `BPF_MAP_TYPE_SOCKHASH` 映射，并且当在作为程序所附加映射一部分的套接字上接收到消息时将被调用。程序的确切用途取决于其附加类型。

#### 作为 BPF_SK_SKB_STREAM_PARSER 程序

#### 作为 BPF_SK_SKB_STREAM_VERDICT 程序

#### 作为 BPF_SK_SKB_VERDICT 程序

### [上下文](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_SKB/#context)

套接字 SKB 程序由内核使用 `__sk_buff` 上下文调用。

由于这样做可能会破坏内核中的假设，或者因为在程序挂钩到内核的点上数据不可用，所以这种程序类型不允许读取和写入上下文的所有字段。

### 附加

套接字 SKB 程序通过 `BPF_PROG_ATTACH` 系统调用（bpf_prog_attach libbpf 函数）附加到 `BPF_MAP_TYPE_SOCKMAP` 或 `BPF_MAP_TYPE_SOCKHASH`。

这些程序应以与附加期间使用的相同预期附加类型进行加载。

> 注意:
> 在 `BPF_SK_SKB_STREAM_VERDICT` 和 `BPF_SK_SKB_VERDICT` 在每个映射中相互排斥之前，只能使用其中一种程序类型。

### [示例](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_SKB/#example)

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_SKB/#helper-functions)

### [KFuncs](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_SKB/#kfuncs)

## BPF_PROG_TYPE_SK_MSG

套接字消息程序会针对每个 `sendmsg` 或 `sendfile` 系统调用被调用。这种程序类型可以对单个数据包或通过多个系统调用分块的较大 L7 消息做出裁决。

### 用法

Socket MSG 程序附加到`BPF_MAP_TYPE_SOCKMAP`或`BPF_MAP_TYPE_SOCKHASH`映射，并且当在作为程序所附加映射一部分的套接字上执行`sendmsg`或`sendfile`系统调用时，会被调用。

- 该程序会对进程要发送的数据的处理方式返回一个裁决。

  - `SK_PASS`：消息可以传递到套接字，或者已通过辅助程序重定向。
  - `SK_DROP`：消息应被丢弃。

- `bpf_msg_apply_bytes`辅助函数可用于指示裁决适用于哪些字节。这有两种情况：
  - 第一种情况，BPF 程序对少于当前`sendmsg/sendfile`中的字节应用裁决，这将把裁决应用于消息的前 N 个字节，然后使用重新计算到第 N + 1 个字节的数据指针再次运行 BPF 程序。
  - 第二种情况，BPF 程序对多于当前`sendmsg`或`sendfile`系统调用的字节应用裁决。在这种情况下，基础架构将缓存裁决，并将其应用于未来的`sendmsg/sendfile`调用，直到达到字节限制。这避免了在大有效负载上运行 BPF 程序的开销。

- `bpf_msg_cork_bytes`辅助函数处理不同的情况，即 BPF 程序在收到更多字节之前无法对消息做出裁决，并且程序在已知消息为“良好”之前不想转发数据包。例如，一个用户（可能是一个愚蠢的用户）以 1B 系统调用发送消息。BPF 程序可以使用所需的字节限制调用`bpf_msg_cork_bytes`以做出裁决，然后只有在收到 N 个字节后才会再次调用该程序。

### 上下文

套接字消息程序通过一个`struct sk_msg_md`上下文被调用。所有字段都是可读的，没有一个是可写的。

```c
struct sk_msg_md {
    __bpf_md_ptr(void *, data);
    __bpf_md_ptr(void *, data_end);

    __u32 family;
    __u32 remote_ip4;   /* Stored in network byte order */
    __u32 local_ip4;    /* Stored in network byte order */
    __u32 remote_ip6[4];    /* Stored in network byte order */
    __u32 local_ip6[4]; /* Stored in network byte order */
    __u32 remote_port;  /* Stored in network byte order */
    __u32 local_port;   /* stored in host byte order */
    __u32 size;     /* Total size of sk_msg */

    __bpf_md_ptr(struct bpf_sock *, sk); /* current socket */
};
```

### 附加

这种程序类型必须始终以预期的附加类型`BPF_SK_MSG_VERDICT`进行加载。

套接字消息程序使用`BPF_PROG_ATTACH`系统调用（`bpf_prog_attach`库函数）附加到`BPF_MAP_TYPE_SOCKMAP`或`BPF_MAP_TYPE_SOCKHASH`。

### [示例](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_MSG/#example)

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_MSG/#helper-functions)

## BPF_PROG_TYPE_SK_LOOKUP

### 用法

### 上下文

### 附加

### 示例

### 帮助函数

### KFuncs

## BPF_PROG_TYPE_SK_REUSEPORT

### 用法

### 上下文

### 附加

### 示例

### 帮助函数

### KFuncs

## BPF_PROG_TYPE_FLOW_DISSECTOR

### 用法

### 上下文

### 附加

### 示例

### 帮助函数

### KFuncs
