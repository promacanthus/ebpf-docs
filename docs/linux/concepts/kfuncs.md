# KFuncs

从 Linux 内核版本 v5.13 开始，KFunc 也被称为内核函数，是内核内经过注解并明确指定为可以从 eBPF 程序调用的函数。KFuncs 是**帮助函数**的替代品，是一种提供类似功能的新方法。

官方上，KFuncs 是不稳定的，与帮助函数不同，kfuncs 没有 UAPI 保证。实际上，这可能意味着 kfuncs 在不同内核版本之间可能会改变或被移除。尽管和所有特性一样，内核社区将尽量避免破坏性变更，并在可能时提供弃用警告。使用 kfuncs 的用户可能需要更加警惕内核的变化，并准备更频繁地更新他们的程序或编写更复杂的代码来处理不同内核版本。

## 使用方法

使用 KFuncs 相对直接。

- 第一步是复制我们想要调用的 kfunc 的函数签名（返回类型、名称和参数）。这些函数签名通常可以在内核源代码或 KFunc 页面中找到。
- 第二步是添加 `extern` 关键字，这告诉编译器该函数没有在我们的编译单元中定义。最后我们添加 `__ksym` 属性，这告诉加载器应该使用内核符号（内核函数）的地址来解析对该函数的引用。

完成这些后，我们可以像调用普通函数一样调用 kfunc。

```c
#include <vmlinux.h>
#include <bpf/bpf_helpers.h>

extern struct task_struct *bpf_task_acquire(struct task_struct *p) __ksym;

extern void bpf_task_release(struct task_struct *p) __ksym;

SEC("tp_btf/task_newtask")
int BPF_PROG(task_acquire_release_example, struct task_struct *task, u64 clone_flags)
{
    struct task_struct *acquired;

    acquired = bpf_task_acquire(task);
    if (acquired)
        /*
         * 在典型的程序中，您可能会执行诸如将任务存储在映射中之类的操作，
         * 映射将自动稍后释放它。在这里，我们手动释放它。
         */
        bpf_task_release(acquired);
    return 0;
}

char _license[] SEC("license") = "GPL";
```

!!! 注意
    `__ksym` 的定义是 `#define __ksym __attribute__((section(".ksyms")))`

### 内核模块

[KFunc索引](../kfuncs/index.md)包括在 Linux 内核源代码中定义的所有 KFunc。根据编译内核时使用的 KConfig，这些可能并非全部可用，或者可能通过内核模块提供。

KFuncs 可以通过内核模块动态添加到内核中，因此内置和第三方模块都可以添加 KFuncs。使用机制相同，但您可能需要处理模块未加载的情况。

## 参数注解

KFunc 的参数/参数可以使用许多后缀进行注解。这些表示它们的使用方式。[验证器](verifier.md)知道这些注解并将执行它们暗示的规则。

### `__sz`注解

带有 `__sz` 后缀的参数用来指示指针的大小。

以下面的例子为例：

```c
void bpf_memzero(void *mem, int mem__sz)
```

在这个例子中，`mem__sz` 指示 `mem` 指向的内存的大小。验证器将强制 `mem` 是一个有效的指针，并且 `mem__sz` 的大小不会导致越界访问。

### `__szk`注解

带有 `__szk` 后缀的参数类似于 `__sz`，但其值必须是编译时的常量。这通常用于参数之前是指向可能在不同内核版本之间改变大小的内核结构的指针。在这种情况下，应使用该结构的 `sizeof()`。

### `__k`注解

带有 `__k` 后缀的参数用来指示它的值必须是标量值（只是一个数字）和众所周知的常量。这通常用于BTF ID。

例如：

```c
void *bpf_obj_new_impl(u64 local_type_id__k, void *meta__ign)
```

`bpf_obj_new_impl` KFunc 使用给定的 BTF 类型创建一个新对象，例如结构体。由于返回的对象的大小取决于 `local_type_id__k`，验证器将强制 `local_type_id__k` 是有效的 BTF ID，并且它知道将返回的对象的大小。

对于其他函数，可能会使用不同类型的常量。

### `__ign`注解

带有 `__ign` 后缀的参数用来指示在类型检查期间将忽略此参数。因此，任何类型都可以传递给它，没有限制。

### `__uninit`注解

带有 `__uninit` 后缀的参数用来指示该参数将被视为未初始化。通常，如果没有此注解，验证器将强制所有参数在使用前都已初始化。

因此，它通常用于 KFunc 为您初始化对象的情况。

### `__alloc`注解

带有 `__alloc` 后缀的参数用来指示参数是由 KFunc 在某个时间点分配的内存区域的指针。

这通常用于如 `bpf_obj_drop_impl` 这样的 KFunc，它释放了 `bpf_obj_new_impl` 分配的内存。在这里，我们希望防止将指向栈或映射值的指针传递进来。

### `__opt`注解

带有 `__opt` 后缀的参数用来指示与 `__sz` 或 `__szk` 相关联的参数是可选的。这意味着参数可以是 `NULL`。

```c
void *bpf_dynptr_slice(..., void *buffer__opt, u32 buffer__szk)
```

可以这样调用：

```c
bpf_dynptr_slice(..., NULL, buffer__szk);
```

### `__refcounted_kptr`注解

带有 `__refcounted_kptr` 后缀的参数用来指示传递给此参数的值必须是引用计数的内核指针。

!!! 示例 "文档可以改进"
    这部分文档不完整，非常欢迎贡献

### `__nullable`注解

带有 `__nullable` 后缀的参数用来指示该参数可以是 `NULL`。通常，类型化的指针必须非 `NULL`，但有了这个注解，验证器将允许传递 `NULL`。

例如：

```c
int bpf_iter_task_new(struct bpf_iter_task *it, struct task_struct *task__nullable, unsigned int flags)
```

### `__str`注解

带有 `__str` 后缀的参数用来指示该参数是常量字符串。

例如

```c
bpf_get_file_xattr(..., const char *name__str, ...)
```

可以这样调用：

```c
bpf_get_file_xattr(..., "xattr_name", ...);
```

或者

```c
const char name[] = "xattr_name";  /* 这需要是全局的 */
int BPF_PROG(...)
{
        ...
        bpf_get_file_xattr(..., name, ...);
        ...
}
```

但不能使用编译时未知的字符串。

## KFunc标志

KFuncs 可以有与之相关联的标志。这些在函数签名中不可见，但用来指示函数的某些属性。每当一个标志对函数的行为有重大影响时，它将记录在 KFunc 页面上。

一个函数可以同时有多个标志，它们在大多数情况下不是互斥的。

为了完整性，本节将记录可用的标志。

### `KF_ACQUIRE`

`KF_ACQUIRE` 标志用来指示 KFunc 返回对内核对象的引用。这意味着调用者在使用完毕后负责释放该引用。

通常，一个 `KF_ACQUIRE` KFunc 将有一个对应的 `KF_RELEASE` KFunc，这样的一对很容易发现。

### `KF_RELEASE`

`KF_RELEASE` 标志用来指示 KFunc 接收对内核对象的引用并释放它。

通常，一个 `KF_ACQUIRE` KFunc 将有一个对应的 `KF_RELEASE` KFunc，这样的一对很容易发现。

### `KF_RET_NULL`

`KF_RET_NULL` 标志用来指示 KFunc 可以返回 `NULL`。验证器将强制在将返回值传递给不接受可空值或将被解引用的其他 KFunc 之前检查返回值是否为`NULL`。

### `KF_TRUSTED_ARGS`

`KF_TRUSTED_ARGS` 标志用来指示传递给此 KFunc 的内核对象指针必须是“有效的”。并且所有指向 BTF 对象的指针必须在其未修改的形态。

作为“有效的”内核指针意味着以下之一：

- 作为 `tracepoint` 或 `struct_ops` 回调参数传递的指针。
- 从 `KF_ACQUIRE` kfunc 返回的指针。

!!! 示例 "文档可以改进"
    这部分文档不完整，非常欢迎贡献

### `KF_SLEEPABLE`

`KF_SLEEPABLE` 标志用来指示 KFunc 可以睡眠。这意味着此 KFunc 只能从已加载为可睡眠的程序中调用（在加载期间设置了 `BPF_F_SLEEPABLE` 标志）。

### `KF_DESTRUCTIVE`

`KF_DESTRUCTIVE` 标志用来指示 KFunc 对系统具有破坏性。一个调用可能会导致内核崩溃或重启。由于风险，只有加载了 `CAP_SYS_BOOT` 的用户才能调用这样的 KFuncs。

### `KF_RCU`

`KF_RCU` 标志用来指示传递给此 KFunc 的参数必须受到 RCU 保护。

!!! 示例 "文档可以改进"
    这部分文档不完整，非常欢迎贡献

### `KF_ITER_NEW`

`KF_ITER_NEW` 标志用来指示 KFunc 用于初始化迭代器。这意味着 KFunc 将返回一个指向可以用于遍历一组对象的迭代器的指针。

验证器将保证迭代器由带有 `KF_ITER_DESTROY` 标志的函数销毁。通常，一个 `KF_ITER_NEW` KFunc 将有一个对应的 `KF_ITER_DESTROY` KFunc，这样的一对很容易发现。

### `KF_ITER_NEXT`

`KF_ITER_NEXT` 标志用来指示 KFunc 用于推进迭代器。这意味着 KFunc 将接受一个迭代器的指针并将其推进到下一个对象。

验证器将强制 `KF_ITER_NEXT` KFunc 只被调用与由 `KF_ITER_NEW` KFunc 创建的迭代器。通常，一个 `KF_ITER_NEW` KFunc 将有一个对应的 `KF_ITER_NEXT` KFunc，这样的一对很容易发现。

### `KF_ITER_DESTROY`

`KF_ITER_DESTROY` 标志用来指示 KFunc 用于销毁迭代器。这意味着 KFunc 将接受一个迭代器的指针并销毁它。

验证器将保证迭代器由带有 `KF_ITER_DESTROY` 标志的函数销毁。通常，一个 `KF_ITER_NEW` KFunc 将有一个对应的 `KF_ITER_DESTROY` KFunc，这样的一对很容易发现。

### `KF_RCU_PROTECTED`

`KF_RCU_PROTECTED` 标志用来指示 KFunc 只能在 RCU 关键部分内使用。这意味着可睡眠程序必须显式使用 `bpf_rcu_read_lock` 和 `bpf_rcu_read_unlock` 来保护对此类 KFuncs 的调用。在 RCU 关键部分上下文中运行的程序可以无需任何额外保护即可调用这些 KFuncs。
