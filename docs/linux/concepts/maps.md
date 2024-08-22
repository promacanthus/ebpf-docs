# 映射

映射为 eBPF 程序提供了一种相互通信（内核空间）以及与用户空间通信的方式。

当内核和用户空间都访问相同的映射时，它们将需要对内存中的键和值结构有共同的理解。如果两个程序都是用 C 语言编写的，并且它们共享一个头文件，则可以工作。否则，用户空间语言和内核空间结构都必须逐字节理解 k/v 结构。

映射有多种类型，每种[类型](../map-type/index.md)的工作方式略有不同，例如不同的数据结构。

## 在 eBPF 程序中定义映射

开始在 eBPF 程序中使用映射之前，我们必须定义它们。

### 传统映射

定义映射的传统方法是使用 `libbpf` 的 eBPF 库或 `linux uapi` 中的 `struct bpf_map_def` 类型。这些映射声明应位于 `maps` ELF 部分中。**这种方法的主要缺点是键和值类型信息会丢失，这就是它被 BTF 映射替换的原因**。

```c
struct bpf_map_def my_map = {
    .type = BPF_MAP_TYPE_HASH,
    .key_size = sizeof(int),
    .value_size = sizeof(int),
    .max_entries = 100,
    .map_flags = BPF_F_NO_PREALLOC,
} SEC("maps");
```

### BTF 映射

定义利用 BTF 类型信息的 eBPF 映射的新方法。有关实施详细信息，请参阅[邮件列表链接](https://lwn.net/ml/netdev/20190531202132.379386-7-andriin@fb.com/)。

这些映射应位于 `.maps` 部分，以便加载者正确获取它们。

```c
struct my_value { int x, y, z; };

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __type(key, int);
    __type(value, struct my_value);
    __uint(max_entries, 16);
} icmpcnt SEC(".maps");
```

上述示例中使用的 `__uint` 和 `__type` 宏通常用于使类型定义更易于阅读。它们在 [`tools/lib/bpf/bpf_helpers.h`](https://elixir.bootlin.com/linux/v6.2.2/source/tools/lib/bpf/bpf_helpers.h) 中定义。

```c
#define __uint(name, val) int (*name)[val]
#define __type(name, val) typeof(val) *name
#define __array(name, val) typeof(val) *name[]
```

这些宏 `name` 部分是指要创建的结构的字段名称。并非所有名称都能被 `libbpf` 和兼容的库识别。但是，以下是：

- `type` `(__uint)`：枚举，请参阅所有有效选项的[映射类型](../map-type/index.md)索引。
- `max_entries` `(__uint)` ：int 表示最大条目量。
- `map_flags` `(__uint)` ：标志的位字段，有关有效选项，请参阅 `map load syscall` 命令中的 `flags` 部分。
- `numa_node` `(__uint)` ：放置映射的 `NUMA` 节点的 ID。
- `key_size` `(__uint)` ：键的大小（以字节为单位）。此字段与 `key` 字段互斥。
- `key` `(__type)` ：键的类型。此字段与 key_size 字段互斥。
- `value_size` `(__uint)` ：值的大小（以字节为单位）。此字段与 `value` 和 `values` 字段互斥。
- `value` `(__type)` ：值的类型。此字段与 `value` 和 `value_size` 字段互斥。
- `values` `(__array)` ：请参阅[静态值](#静态值)部分。此字段与 `value` 和 `value_size` 字段互斥。
- `pinning` `(__uint)` ：`LIBBPF_PIN_BY_NAME` 或 `LIBBPF_PIN_NONE` 有关详细信息 `LIBBPF_PIN_NONE` 请参阅 [pinning](pinning.md) 页面。
- `map_extra` `(__uint)` ：加法设置，目前仅由布隆过滤器使用，该过滤器使用最低的 4 位来指示布隆过滤器中使用的哈希量。

通常，只有 `type`、`key/key_size`、`value/values/value_size` 和 `max_entries` 字段是必需的。

### 静态值

`values` 映射字段在使用时具有语法，它是唯一使用 `__array` 宏的字段，并且需要我们使用值初始化映射常量。其目的是在加载过程中填充映射的内容，而无需通过用户空间应用程序手动执行此操作。这对于使用 `ip`、`tc` 或 `bpftool` 加载程序的用户来说尤其方便。

`__array` 参数的 `val` 部分应包含描述各个数组元素的类型。我们想要预填充的值应该进入结构初始化的值部分。

以下示例演示如何预填充 map-in-map：

```c
struct inner_map {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, INNER_MAX_ENTRIES);
    __type(key, __u32);
    __type(value, __u32);
} inner_map SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY_OF_MAPS);
    __uint(max_entries, MAX_ENTRIES);
    __type(key, __u32);
    __type(value, __u32);
    __array(values, struct {
        __uint(type, BPF_MAP_TYPE_ARRAY);
        __uint(max_entries, INNER_MAX_ENTRIES);
        __type(key, __u32);
        __type(value, __u32);
    });
} m_array_of_maps SEC(".maps") = {
    .values = { (void *)&inner_map, 0, 0, 0, 0, 0, 0, 0, 0 },
};
```

另一个常见用途是预填充尾部调用映射：

```c
struct {
    __uint(type, BPF_MAP_TYPE_PROG_ARRAY);
    __uint(max_entries, 2);
    __uint(key_size, sizeof(__u32));
    __array(values, int (void *));
} prog_array_init SEC(".maps") = {
    .values = {
        [1] = (void *)&tailcall_1,
    },
};
```

### 创建 BPF 映射

在 eBPF 程序中声明映射是很常见的，但映射最终是从用户空间创建的。大多数加载器库从编译的 ELF 文件中获取映射声明，并自动为用户创建它们。

但是，用户也可以使用 BPF syscall 的 `BPF_MAP_CREATE` 命令手动创建映射，或者使用具有此类功能的加载器库。

### Libbpf

Libbpf 库提供了 `bpf_map_create` 功能，允许手动创建映射。

[`/tools/lib/bpf/bpf.h`](https://elixir.bootlin.com/linux/v6.2.2/source/tools/lib/bpf/bpf.h#L40)

```c
LIBBPF_API int bpf_map_create(enum bpf_map_type map_type,
                  const char *map_name,
                  __u32 key_size,
                  __u32 value_size,
                  __u32 max_entries,
                  const struct bpf_map_create_opts *opts);                                                                                                                                                                                                   

struct bpf_map_create_opts {
    size_t sz; /* size of this struct for forward/backward compatibility */

    __u32 btf_fd;
    __u32 btf_key_type_id;
    __u32 btf_value_type_id;
    __u32 btf_vmlinux_value_type_id;

    __u32 inner_map_fd;
    __u32 map_flags;
    __u64 map_extra;

    __u32 numa_node;
    __u32 map_ifindex;
};
```

`libbpf` 中的 `bpf_map_create` 函数可用于在运行时创建映射。

### 使用映射

在内核空间和用户空间操作映射的区别比较大。

#### 从内核空间使用

在内核空间，eBPF 程序可以通过[帮助函数](../helper-function/index.md)与映射进行交互，这些函数在 `tools/lib/bpf/bpf_helpers.h` 中定义。可用于与映射交互的帮助程序函数取决于[映射的类型](../map-type/index.md)，可以在给定映射类型的页面上找到支持的帮助程序调用列表。

可以使用 `bpf_map_lookup_elem` 帮助函数读取通用映射的元素，使用 `bpf_map_update_elem` 进行更新，并使用 `bpf_map_delete_elem` 删除。

可以使用 `bpf_for_each_map_elem` 帮助函数来迭代其中一些通用映射类型。

特殊的映射类型需要专用的帮助函数，如 `bpf_redirect_map` 根据映射的内容执行数据包重定向。或者 `bpf_perf_event_output` `通过BPF_MAP_TYPE_PERF_EVENT_ARRAY` 映射发送消息。

#### 从用户空间使用

在用户空间中， eBPF程序可以通过多种方式使用映射。大多数映射类型支持通过 `BPF_MAP_LOOKUP_ELEM` syscall 命令读取，使用 `BPF_MAP_UPDATE_ELEM` syscall 命令写入或更新，以及使用 `BPF_MAP_DELETE_ELEM` syscall 命令删除。但是，这并不适用于所有映射类型，请检查特定映射类型的页面以查看它支持哪些 syscall 命令。

除了单键版本外，这些 syscall 命令还有批处理变体：`BPF_MAP_LOOKUP_BATCH`、`BPF_MAP_UPDATE_BATCH` 和 `BPF_MAP_DELETE_BATCH`。这些适用于较小的映射子集，同样，请检查特定映射类型的兼容性。

大多数映射类型都支持使用 `BPF_MAP_GET_NEXT_KEY` syscall 命令迭代键。

某些映射类型（如 `BPF_MAP_TYPE_PERF_EVENT_ARRAY`）需要使用其他机制（如 `perf_event` 和环形缓冲区）来从内核端读取通过 `bpf_perf_event_output` 帮助程序发送的实际数据。
