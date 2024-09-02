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

#### 作为 `BPF_SK_SKB_STREAM_PARSER` 程序

当使用`BPF_SK_SKB_STREAM_PARSER`程序类型时，该程序充当[流解析器](https://www.kernel.org/doc/Documentation/networking/strparser.txt)。流解析器背后的思想是解析基于数据流（如 TCP）实现的应用层协议（OSI 第7层）。

程序的任务是解析 L7 数据/数据包，并告诉内核 L7 消息的长度。这将允许内核合并多个数据流数据包，并为每个[`recv`](https://man7.org/linux/man-pages/man2/recv.2.html)返回完整的 L7 消息，而不是返回可能只包含 L7 消息部分的 TCP 消息。

返回值的解释如下：

- `>0` - 表示成功解析的消息长度
- `0` - 表示必须接收更多数据才能解析消息
- `-ESTRPIPE` - 当前消息不应由内核处理，将套接字的控制权返回给用户空间，用户空间可以继续自己读取消息
- `other < 0` - 解析错误，假设同步已丢失且流不可恢复，将控制权交回给用户空间（应用程序预期将关闭 TCP 套接字）

> !!! 注意
> 在[v5.10](https://github.com/torvalds/linux/commit/ef5659280eb13e8ac31c296f58cfdfa1684ac06b)之前，如果你想使用流判决，需要将流解析器附加到`BPF_MAP_TYPE_SOCKMAP`。在更新的版本中，这不再需要。
>
> 在旧的内核上，可以使用一个无操作程序来返回当前 skb 的长度，以保持默认行为，并通过每个 TCP 数据包传递判决。
>
> ```c
> SEC("sk_skb/stream_parser")
> int noop_parser(struct __sk_buff *skb)
> {
>     return skb->len;
> }
> ```

#### 作为 `BPF_SK_SKB_STREAM_VERDICT` 程序

当使用此附加类型时，该程序充当过滤器，类似于[TC](../program-type/BPF_PROG_TYPE_SCHED_CLS.md)或[XDP](../program-type/BPF_PROG_TYPE_XDP.md)程序。程序被调用以处理由解析器（或如果没有指定解析器，则为 TCP 数据包）指示的每个消息，并返回一个判决。

返回值的解释如下：

- `SK_PASS` - 消息可以传递到套接字，或者已经通过帮助函数重定向。
- `SK_DROP` - 应丢弃该消息。

与 TC 或 XDP 程序不同，没有特殊的重定向返回代码，像 `bpf_sk_redirect_map` 这样的帮助函数在成功时将返回`SK_PASS`。

#### 作为`BPF_SK_SKB_VERDICT`程序

[v5.13](https://github.com/torvalds/linux/commit/a7ba4558e69a3c2ae4ca521f015832ef44799538)

非流判决附加类型是`BPF_SK_SKB_STREAM_VERDICT`附加类型的替代。程序类型具有相同的工作和使用相同的返回值。不同之处在于，流判决变体仅支持TCP数据流，而`BPF_SK_SKB_VERDICT`也支持UDP。

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

套接字查找程序允许一个 eBPF 程序选择发送流量的套接字，而不管该目标套接字是如何绑定的。

这种程序类型的主要用例是允许单个程序处理无法用正常绑定系统调用表达的网络模式的流量。例如，单个套接字可以绑定到整个 /24 网络 CIDR（绑定只允许单个 IP，或者你必须将其设置为 0.0.0.0，如果另一个应用程序应该响应不同的 IP 范围，则这不是理想的选择）。或者，单个套接字可以监听给定 IP 的任何端口。

### 用法

套接字查找程序通常被放置在一个以 `sk_lookup` 为前缀的 [ELF](../../concepts/elf.md) 节中。当传输层在面向连接的协议中查找新连接请求的监听套接字，或者在无连接协议中查找数据包的未连接套接字时，会调用套接字查找程序。

套接字查找程序充当过滤器，如果它返回 `SK_DROP`（`0`），则连接或数据包会被丢弃。如果它返回 `SK_PASS`（`1`）而没有设置套接字，就会使用正常的解析行为。然而，程序也可以选择使用 `bpf_sk_assign` 帮助函数分配一个特定的套接字。

### 上下文

套接字查找程序使用结构体 `bpf_sk_lookup` 作为上下文被调用。

```c
union {
    __bpf_md_ptr(struct bpf_sock *, sk); /* Selected socket */
    __u64 cookie; /* Non-zero if socket was selected in PROG_TEST_RUN */
};

__u32 family;           /* Protocol family (AF_INET, AF_INET6) */
__u32 protocol;         /* IP protocol (IPPROTO_TCP, IPPROTO_UDP) */
__u32 remote_ip4;       /* Network byte order */
__u32 remote_ip6[4];    /* Network byte order */
__be16 remote_port;     /* Network byte order */
__u16 :16;              /* Zero padding */
__u32 local_ip4;        /* Network byte order */
__u32 local_ip6[4];     /* Network byte order */
__u32 local_port;       /* Host byte order */
__u32 ingress_ifindex;  /* The arriving interface. Determined by inet_iif. */
```

| 字段 | 描述 |
|------|------|
| `sk` | 这个字段是指向所选套接字的指针，该字段是只读的，但可以通过 [`bpf_sk_assign`](../helper-function/bpf_sk_assign.md) 辅助函数进行更新。 |
| `cookie` | 如果程序在 [`PROG_TEST_RUN`](../syscall/BPF_PROG_TEST_RUN.md) 期间分配了一个套接字，这个字段会被设置为分配的套接字的 cookie。 |
| `family` | 程序被调用时的连接/数据包的地址族。可以是 [`AF_INET`](https://elixir.bootlin.com/linux/v6.2.8/source/include/linux/socket.h#L191) 或 [`AF_INET6`](https://elixir.bootlin.com/linux/v6.2.8/source/include/linux/socket.h#L199)。 |
| `protocol` | 程序被调用时的连接/数据包的传输层协议。可以是 [`IPPROTO_TCP`](https://elixir.bootlin.com/linux/v6.2.8/source/include/uapi/linux/in.h#L38) 或 [`IPPROTO_UDP`](https://elixir.bootlin.com/linux/v6.2.8/source/include/uapi/linux/in.h#L44)。 |
| `remote_ip4` | 程序被调用时的连接/数据包的远程 IPv4 地址。 |
| `remote_ip6` | 程序被调用时的连接/数据包的远程 IPv6 地址。 |
| `remote_port` | 程序被调用时的连接/数据包的远程端口。 |
| `local_ip4` | 程序被调用时的连接/数据包的本地 IPv4 地址。 |
| `local_ip6` | 程序被调用时的连接/数据包的本地 IPv6 地址。 |
| `local_port` | 程序被调用时的连接/数据包的本地端口。 |
| `ingress_ifindex` | 数据包到达的网络接口的网络接口索引。 |

### 附加

这种程序类型必须始终使用 `BPF_SK_LOOKUP` 的 [`expected_attach_type`](../syscall/BPF_PROG_LOAD.md#expected_attach_type) 加载。

套接字查找程序通过链接附加到一个网络命名空间。当[创建链接](../syscall/BPF_LINK_CREATE.md)时，`prog_fd` 应设置为程序的文件描述符，`target_fd` 应设置为网络命名空间的文件描述符，而 `attach_type` 应设置为 `BPF_SK_LOOKUP`。

### 示例

```c
// Copyright (c) 2020 Cloudflare
struct {
    __uint(type, BPF_MAP_TYPE_SOCKMAP);
    __uint(max_entries, 32);
    __type(key, __u32);
    __type(value, __u64);
} redir_map SEC(".maps");

static const __u16 DST_PORT = 7007; /* Host byte order */
static const __u32 DST_IP4 = IP4(127, 0, 0, 1);
static const __u32 KEY_SERVER_A = 0;

/* Redirect packets destined for DST_IP4 address to socket at redir_map[0]. */
SEC("sk_lookup")
int redir_ip4(struct bpf_sk_lookup *ctx)
{
    struct bpf_sock *sk;
    int err;

    if (ctx->family != AF_INET)
        return SK_PASS;
    if (ctx->local_port != DST_PORT)
        return SK_PASS;
    if (ctx->local_ip4 != DST_IP4)
        return SK_PASS;

    sk = bpf_map_lookup_elem(&redir_map, &KEY_SERVER_A);
    if (!sk)
        return SK_PASS;

    err = bpf_sk_assign(ctx, sk, 0);
    bpf_sk_release(sk);
    return err ? SK_DROP : SK_PASS;
}
```

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_LOOKUP/#helper-functions)

## BPF_PROG_TYPE_SK_REUSEPORT

套接字重用端口程序可以附加到一个 `SO_REUSEPORT` 套接字组，以替代默认的套接字选择机制。

### 用法

在 Linux 内核版本 3.9 中，引入了 [`SO_REUSEPORT`](https://lwn.net/Articles/542629/) 套接字选项，它允许多个套接字监听同一主机上的同一端口。这个特性的最初目的是为了高效地在线程间分配流量，这在用户空间中完成会导致不必要的延迟。

默认情况下，传入的连接和数据报文是使用基于连接的 4-元组（即对等 IP 地址和端口加上本地 IP 地址和端口）的哈希来分配给服务器套接字的。

随着 `BPF_PROG_TYPE_SK_REUSEPORT` 程序类型、`BPF_MAP_TYPE_REUSEPORT_SOCKARRAY` 映射类型和 `bpf_sk_select_reuseport` 助手函数的引入，我们可以用 BPF 程序替换默认的分配行为。

一个关键特性是套接字不必属于同一个进程。这意味着你可以在两个进程之间引导流量，以进行 A/B 测试或软件更新，而不会丢失连接。对于后者的场景，典型的用例是使用带有 `BPF_MAP_TYPE_REUSEPORT_SOCKARRAY` 作为内部映射的映射中映射（map-in-map），允许用户空间一次性切换所有套接字。在这种情况下，任何现有的 TCP 连接仍将由旧套接字/进程处理，但新连接将被路由到新进程。

请注意，我无法访问外部链接，包括你提供的 GitHub 提交和 LWN 文章链接。如果你需要这些网页的具体内容，可能需要检查链接的合法性并适当重试。如果你有特定的问题或需要进一步的帮助，请告诉我，我会尽力提供支持。

### 上下文

这种程序类型的上下文是结构体 `sk_reuseport_md`。此上下文类型的所有字段都是只读的，程序不能直接修改它们。

```c
struct sk_reuseport_md {
    /*
    * Start of directly accessible data. It begins from
    * the tcp/udp header.
    */
    __bpf_md_ptr(void *, data);
    /* End of directly accessible data */
    __bpf_md_ptr(void *, data_end);
    /*
    * Total length of packet (starting from the tcp/udp header).
    * Note that the directly accessible bytes (data_end - data)
    * could be less than this "len".  Those bytes could be
    * indirectly read by a helper "bpf_skb_load_bytes()".
    */
    __u32 len;
    /*
    * Eth protocol in the mac header (network byte order). e.g.
    * ETH_P_IP(0x0800) and ETH_P_IPV6(0x86DD)
    */
    __u32 eth_protocol;
    __u32 ip_protocol;  /* IP protocol. e.g. IPPROTO_TCP, IPPROTO_UDP */
    __u32 bind_inany;   /* Is sock bound to an INANY address? */
    __u32 hash;     /* A hash of the packet 4 tuples */
    /* When reuse->migrating_sk is NULL, it is selecting a sk for the
    * new incoming connection request (e.g. selecting a listen sk for
    * the received SYN in the TCP case).  reuse->sk is one of the sk
    * in the reuseport group. The bpf prog can use reuse->sk to learn
    * the local listening ip/port without looking into the skb.
    *
    * When reuse->migrating_sk is not NULL, reuse->sk is closed and
    * reuse->migrating_sk is the socket that needs to be migrated
    * to another listening socket.  migrating_sk could be a fullsock
    * sk that is fully established or a reqsk that is in-the-middle
    * of 3-way handshake.
    */
    __bpf_md_ptr(struct bpf_sock *, sk);
    __bpf_md_ptr(struct bpf_sock *, migrating_sk);
};
```

| 字段 | 描述 |
|------|------|
| `data` | 这个字段包含一个指向直接可访问数据起始位置的指针。它从 TCP/UDP 头部开始。<br><br>**注意**：这种程序类型只有读取权限，不能修改数据包数据。 |
| `data_end` | 这个字段包含一个指向直接可访问数据结束位置的指针。 |
| `len` | 这个字段包含数据包的总长度（从 TCP/UDP 头部开始）。<br><br>**注意**：直接可访问的字节数（data_end - data）可能少于这个 `len`。这些字节可以通过辅助函数 `bpf_skb_load_bytes` 间接读取。 |
| `eth_protocol` | 这个字段包含 MAC 头部中的以太网协议（网络字节序）。例如 `ETH_P_IP`（`0x0800`）和 `ETH_P_IPV6`（`0x86DD`）。 |
| `ip_protocol` | 这个字段包含 IP 协议。例如 `IPPROTO_TCP`，`IPPROTO_UDP`。 |
| `bind_inany` | 如果套接字组绑定到 INANY 地址，这个字段为 `true`。 |
| `hash` | 这个字段是数据包 4 元组的哈希值。 |
| `sk` 和 `migrating_sk` | [v5.14](https://github.com/torvalds/linux/commit/e061047684af63f2d4f1338ec73140f6e29eb59f) 和 [v5.14](https://github.com/torvalds/linux/commit/d5e4ddaeb6ab2c3c7fbb7b247a6d34bb0b18d87e)<br><br>这些字段一起用于处理套接字迁移。如果两者都为 `NULL`，我们正在进行初始选择。<br><br>当 `migrating_sk` 为 `NULL` 时，它正在为新的传入连接请求选择一个 sk（例如，在 TCP 情况下为接收到的 SYN 选择一个监听 sk）。`sk` 是重用端口组中的一个 sk。BPF 程序可以使用 reuse->sk 来了解本地监听 IP/端口，而无需查看 skb。<br><br>当 `migrating_sk` 不为 NULL 时，`sk` 已关闭，`migrating_sk` 是需要迁移到另一个监听套接字的套接字。migrating_sk 可以是完全建立的 fullsock sk，也可以是处于三次握手中间的 reqsk。 |

### 附加

这种程序类型可以通过在组中的一个套接字上使用 `setsockopt` 系统调用，并使用 `SOL_SOCKET` 套接字级别和 `SO_ATTACH_BPF` 套接字选项来附加到一个重用端口套接字组。

这个程序应该使用 `BPF_SK_REUSEPORT_SELECT` `expected_attach_type` 来加载，以便仅用于选择逻辑，或者如果程序还应该处理[套接字迁移](#套接字迁移)逻辑，则使用 `BPF_SK_REUSEPORT_SELECT_OR_MIGRATE`。

关于 `setsockopt` 和 `socket` 选项的更多信息，通常可以在 Linux 手册页中找到。如果你需要访问这些手册页，但由于网络原因无法访问，这可能是由于链接的问题或网络连接问题。请检查链接的合法性并适当重试。如果你有其他问题或需要进一步的帮助，请告诉我。

## 套接字迁移

在 Linux 内核版本 5.14 之前，重用端口功能在其逻辑中存在一个缺陷。当收到一个 SYN 数据包时，连接会被绑定到一个监听套接字上。因此，当监听器关闭时，即使其他监听器可以接受这样的连接，正在进行的三次握手请求和 accept 队列中的子套接字也会被丢弃。

这种情况可能发生在各种服务器管理工具重启服务器进程时（例如 nginx）。例如，当我们更改 nginx 配置并重启它时，它会启动新的工作进程来遵循新配置，并关闭旧工作进程上的所有监听器，导致正在进行的三次握手的 ACK 被 RST 响应。

为了修复这个缺陷，引入了套接字迁移的概念，它将重复套接字选择逻辑以选择一个新的套接字。如果不使用 eBPF，将使用相同的哈希逻辑，但前提是必须启用了 `net.ipv4.tcp_migrate_req` 系统控制（sysctl）设置。当使用 eBPF 并使用 `BPF_SK_REUSEPORT_SELECT_OR_MIGRATE` 附加类型加载程序时，表示该程序还覆盖了迁移逻辑。在这种情况下，不需要设置 sysctl 选项。这意味着程序可以被调用用于初始选择以及迁移。`sk` 和 `sk_migration` 上下文字段表明程序被调用的目的。

当用于迁移时，可以采取以下操作：

- 使用 [bpf_sk_select_reuseport](../helper-function/bpf_sk_select_reuseport.md) 选择一个套接字后返回 `SK_PASS`，将其选为新的监听器。
- 没有调用 [bpf_sk_select_reuseport](../helper-function/bpf_sk_select_reuseport.md) 就返回 `SK_PASS`，回落到随机选择。
- 返回 `SK_DROP`，取消迁移。

!!! 注意
    内核在三个地方选择一个监听套接字，但在关闭监听器或重传 SYN+ACK 时没有 `struct skb`。另一方面，一些助手函数不期望 skb 为 NULL（例如 BPF_FUNC_skb_load_bytes() 中的 skb_header_pointer()，BPF_FUNC_skb_load_bytes_relative() 中的 skb_tail_pointer()）。因此，内核在运行 eBPF 程序之前会临时分配一个空的 skb。

如果你需要访问特定的内核提交或文档，但遇到了网络问题，这可能是由于链接的问题或网络连接问题。请检查链接的合法性并适当重试。如果你有其他问题或需要进一步的帮助，请告诉我。

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_SK_REUSEPORT/#helper-functions)

## BPF_PROG_TYPE_FLOW_DISSECTOR

Flow dissector 是一种程序类型，用于从数据包中解析元数据。

### 用法

BPF flow dissectors 可以被附加到每个网络命名空间。这些程序接收一个数据包，程序应该填写 `__sk_buff->flow_keys` 中的 `struct bpf_flow_keys` 字段的其余部分。

网络子系统中的各个地方使用这些流键来聚合相同“流”的数据包，这是这些字段的组合。通过在 BPF 中实现这个逻辑，可以为新协议或自定义协议添加流解析。

BPF 程序的返回码要么是 `BPF_OK` 表示成功解析，要么是 `BPF_DROP` 表示解析错误。

### [上下文](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_FLOW_DISSECTOR/#context)

BPF flow dissector 程序在 [`__sk_buff`](../program-context/__sk_buff.md) 上操作。然而，只允许使用一组有限的字段：`data`、`data_end` 和 `flow_keys`。

`flow_keys` 是 `struct bpf_flow_keys` 结构体，包含流解构器的输入和输出参数。输入参数 `nhoff`（网络头偏移）、`thoff`（传输头偏移）和 `n_proto`（网络协议）也应该相应地进行调整。

`bpf_flow_keys` 结构体通常包含以下字段：

- `input_iface`：输入接口的索引。
- `output_iface`：输出接口的索引。
- `ip_proto`：IP 协议类型，例如 TCP、UDP 等。
- `nhoff`：网络层头部在数据包中的偏移量。
- `thoff`：传输层头部在数据包中的偏移量。
- `src`：源 IP 地址。
- `dst`：目的 IP 地址。
- `sport`：源端口号。
- `dport`：目的端口号。
- `ifindex`：数据包经过的网络接口索引。

在编写 BPF flow dissector 程序时，你需要根据数据包的内容来填充这些字段，以便内核能够识别和处理流。例如，如果你正在解析一个自定义协议，你需要从数据包中提取相应的信息，并设置 `flow_keys` 结构体中的字段，以便内核可以使用这些信息来正确地处理流。

```c
struct bpf_flow_keys {
    __u16   nhoff;
    __u16   thoff;
    __u16   addr_proto;         /* ETH_P_* of valid addrs */
    __u8    is_frag;
    __u8    is_first_frag;
    __u8    is_encap;
    __u8    ip_proto;
    __be16  n_proto;
    __be16  sport;
    __be16  dport;
    union {
        struct {
            __be32  ipv4_src;
            __be32  ipv4_dst;
        };
        struct {
            __u32   ipv6_src[4];    /* in6_addr; network order */
            __u32   ipv6_dst[4];    /* in6_addr; network order */
        };
    };
    __u32   flags;
    __be32  flow_label;
};
```

BPF flow dissector 程序处理数据包时，输入值的初始状态可能会根据处理的数据包类型和解构器的状态而有所不同。以下是一些示例：

**无 VLAN 的情况：**

```
+------+------+------------+-----------+
| DMAC | SMAC | ETHER_TYPE | L3_HEADER |
+------+------+------------+-----------+
                            ^
                            |
                            +-- flow dissector starts here
```

```
skb->data + flow_keys->nhoff 指向 L3_HEADER 的第一个字节
flow_keys->thoff = nhoff
flow_keys->n_proto = ETHER_TYPE
```

**有 VLAN 的情况：**

**VLAN 解析前：**

```
+------+------+------+-----+-----------+-----------+
| DMAC | SMAC | TPID | TCI | ETHER_TYPE | L3_HEADER |
+------+------+------+-----+-----------+-----------+
                      ^
                      |
                      +-- flow dissector starts here
```

```
skb->data + flow_keys->nhoff 指向 TCI 的第一个字节
flow_keys->thoff = nhoff
flow_keys->n_proto = TPID
```

请注意，TPID 可以是 802.1AD，因此 BPF 程序可能需要为双标记的数据包解析 VLAN 信息两次。

**VLAN 解析后：**

```
+------+------+------+-----+-----------+-----------+
| DMAC | SMAC | TPID | TCI | ETHER_TYPE | L3_HEADER |
+------+------+------+-----+-----------+-----------+
                                        ^
                                        |
                                        +-- flow dissector starts here
```

```
skb->data + flow_keys->nhoff 指向 L3_HEADER 的第一个字节
flow_keys->thoff = nhoff
flow_keys->n_proto = ETHER_TYPE
```

在这种情况下，VLAN 信息已经在 flow dissector 之前处理过，BPF flow dissector 不需要处理它。

关键点如下：BPF flow dissector 程序可以被调用，并且可以选择性地处理 VLAN 头部，应该能够优雅地处理两种情况：当存在单个或双 VLAN 时，以及当它不存在时。相同的程序可以被调用用于这两种情况，并且需要仔细编写以处理这两种情况。

### 附加

Flow dissector 程序可以通过 `BPF_PROG_ATTACH` 系统调用或 `BPF link` 附加到网络命名空间。

这种程序类型必须始终使用 `BPF_FLOW_DISSECTOR` 的 `expected_attach_type` 来加载。

!!! warning
    `BPF_PROG_ATTACH` 和链接不能同时结合/使用。

!!! note
    当向根网络命名空间添加流解构器时，它会覆盖所有其他流解构器。

### `BPF_PROG_ATTACH`

通过 `BPF_PROG_ATTACH` 附加流解构器程序时，程序将附加到当前进程所属的网络命名空间。指定的目标文件描述符应为 `0`。

### BPF 链接

使用链接将流解构器程序附加到网络命名空间。在创建链接时，`prog_fd` 应设置为程序的文件描述符，`target_fd` 应设置为网络命名空间的文件描述符，`attach_type` 应设置为 `BPF_FLOW_DISSECTOR`。

这些方法允许你将 BPF 流解构器程序集成到网络堆栈中，以便根据自定义或特定的协议需求来解析和处理网络流量。通过这种方式，可以提高网络流量处理的灵活性和效率。如果你有更具体的问题或需要进一步的帮助，请告诉我。

### 示例

[bpf_flow.c](https://elixir.bootlin.com/linux/v6.3/source/tools/testing/selftests/bpf/progs/bpf_flow.c)

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_FLOW_DISSECTOR/#helper-functions)

## BPF_PROG_TYPE_NETFILTER

### 用法

这种程序类型用于在 eBPF 中实现 netfilter（即 `iptables` / `nftables`）钩子。

钩子可以通过返回 `NF_DROP`（0）或 `NF_ACCEPT`（1）来分别决定丢弃或接受数据包。

### 上下文

在 eBPF 中实现 netfilter 钩子的程序类型接收一个特定的上下文结构 `bpf_nf_ctx`，它包含指向钩子状态和完整的 `sk_buff` 的指针，而不是我们在其他程序类型中通常看到的 `__sk_buff`。整个上下文是只读的。

```c
struct bpf_nf_ctx {
    const struct nf_hook_state *state; // 指向当前网络钩子状态的结构体
    struct sk_buff *skb;              // 指向包含数据包信息的 sk_buff 结构体
};
```

`ctx->skb` 指针可以与 `bpf_dynptr_from_skb` 内核函数结合使用，以访问数据包数据。返回的动态指针是只读的。

钩子状态包含了关于当前钩子和数据包状态的大量信息。

```c
struct nf_hook_state {
    u8 hook;              // 钩子编号
    u8 pf;                 // 协议族（如 AF_INET, AF_INET6 等）
    struct net_device *in; // 数据包进入的网络设备
    struct net_device *out; // 数据包离开的网络设备
    struct sock *sk;       // 套接字
    struct net *net;       // 网络命名空间
    int (*okfn)(struct net *, struct sock *, struct sk_buff *); // 钩子处理函数
};
```

在编写 eBPF 程序处理 netfilter 钩子时，你可以使用这些结构体来获取有关数据包的详细信息，并根据这些信息来做出决策。例如，你可以检查数据包的源地址、目的地址、传输层端口号等，以及它进入和离开的网络设备。

这种程序类型通常用于实现自定义的网络过滤逻辑，可以与 `iptables` 或 `nftables` 结合使用，以提供更灵活的网络流量控制。通过 eBPF，你可以在内核空间中以更高效的方式执行这些操作，同时减少对用户空间程序的依赖。

### 附加

在 eBPF 中，通过链接 API 附加 netfilter 钩子程序。创建链接时，netlink 部分的属性如下：

```c
struct {
    __u32  pf;
    __u32  hooknum;
    __s32  priority;
    __u32  flags;
} netfilter;
```

- `pf` 是协议族，支持的值有 `NFPROTO_IPV4` (2) 和 `NFPROTO_IPV6` (10)。

- `hooknum` 是钩子编号，支持的值有 `NF_INET_PRE_ROUTING` (0)、`NF_INET_LOCAL_IN` (1)、`NF_INET_FORWARD` (2)、`NF_INET_LOCAL_OUT` (3) 和 `NF_INET_POST_ROUTING` (4)。

- `priority` 是钩子的优先级，较低的值会先被调用。不允许使用 `NF_IP_PRI_FIRST` (-2147483648) 和 `NF_IP_PRI_LAST` (2147483647)。如果设置了 `BPF_F_NETFILTER_IP_DEFRAG` 标志，优先级必须高于 `NF_IP_PRI_CONNTRACK_DEFRAG` (-400)。

- `flags` 是标志位的掩码。支持的标志有：

  - `NF_IP_PRI_CONNTRACK_DEFRAG` - 启用 IP 分段的重组，此钩子将仅看到重组后的包。

这些程序通常用于在网络数据包处理的不同阶段实现自定义的过滤逻辑。通过设置不同的 `hooknum` 和 `priority`，可以控制程序在数据包处理流程中的位置和顺序。使用 `flags`，可以进一步定制程序的行为，例如启用 IP 分段的重组处理。

如果你需要进一步的帮助或有具体的问题，请告诉我，我会尽力提供支持。

### 示例

```c
// SPDX-License-Identifier: GPL-2.0-only
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>
#include "bpf_tracing_net.h"

#define NF_DROP         0
#define NF_ACCEPT       1
#define ETH_P_IP        0x0800
#define ETH_P_IPV6      0x86DD
#define IP_MF           0x2000
#define IP_OFFSET       0x1FFF
#define NEXTHDR_FRAGMENT    44

extern int bpf_dynptr_from_skb(struct __sk_buff *skb, __u64 flags,
                  struct bpf_dynptr *ptr__uninit) __ksym;
extern void *bpf_dynptr_slice(const struct bpf_dynptr *ptr, uint32_t offset,
                  void *buffer, uint32_t buffer__sz) __ksym;

volatile int shootdowns = 0;

static bool is_frag_v4(struct iphdr *iph)
{
    int offset;
    int flags;

    offset = bpf_ntohs(iph->frag_off);
    flags = offset & ~IP_OFFSET;
    offset &= IP_OFFSET;
    offset <<= 3;

    return (flags & IP_MF) || offset;
}

static bool is_frag_v6(struct ipv6hdr *ip6h)
{
    /* Simplifying assumption that there are no extension headers
     * between fixed header and fragmentation header. This assumption
     * is only valid in this test case. It saves us the hassle of
     * searching all potential extension headers.
     */
    return ip6h->nexthdr == NEXTHDR_FRAGMENT;
}

static int handle_v4(struct __sk_buff *skb)
{
    struct bpf_dynptr ptr;
    u8 iph_buf[20] = {};
    struct iphdr *iph;

    if (bpf_dynptr_from_skb(skb, 0, &ptr))
        return NF_DROP;

    iph = bpf_dynptr_slice(&ptr, 0, iph_buf, sizeof(iph_buf));
    if (!iph)
        return NF_DROP;

    /* Shootdown any frags */
    if (is_frag_v4(iph)) {
        shootdowns++;
        return NF_DROP;
    }

    return NF_ACCEPT;
}

static int handle_v6(struct __sk_buff *skb)
{
    struct bpf_dynptr ptr;
    struct ipv6hdr *ip6h;
    u8 ip6h_buf[40] = {};

    if (bpf_dynptr_from_skb(skb, 0, &ptr))
        return NF_DROP;

    ip6h = bpf_dynptr_slice(&ptr, 0, ip6h_buf, sizeof(ip6h_buf));
    if (!ip6h)
        return NF_DROP;

    /* Shootdown any frags */
    if (is_frag_v6(ip6h)) {
        shootdowns++;
        return NF_DROP;
    }

    return NF_ACCEPT;
}

SEC("netfilter")
int defrag(struct bpf_nf_ctx *ctx)
{
    struct __sk_buff *skb = (struct __sk_buff *)ctx->skb;

    switch (bpf_ntohs(ctx->skb->protocol)) {
    case ETH_P_IP:
        return handle_v4(skb);
    case ETH_P_IPV6:
        return handle_v6(skb);
    default:
        return NF_ACCEPT;
    }
}

char _license[] SEC("license") = "GPL";
```

### [帮助函数](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_NETFILTER/#helper-functions)

### [KFuncs](https://ebpf-docs.dylanreimerink.nl/linux/program-type/BPF_PROG_TYPE_NETFILTER/#kfuncs)
