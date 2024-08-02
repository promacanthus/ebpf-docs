---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "eBPF 指南"
  text: "关于 eBPF 的百科全书"
  tagline: 包括 eBPF 的理论和实战两部分内容。
  image: 
    src: /home_ebpf.webp
    alt: eBPF
  actions:
    - theme: brand
      text: eBPF 概览
      link: /overview/
    - theme: alt
      text: libbpf
      link: https://github.com/libbpf/libbpf
    - theme: alt
      text: aya-rs
      link: https://github.com/aya-rs/aya
    - theme: alt
      text: cilium/ebpf
      link: github.com/cilium/ebpf

features:
  - title: 内核可编程性
    icon: 🛠️
    details: 允许用户在 Linux 内核中运行自定义程序。
  - title: 安全性
    icon: 🛠️
    details: eBPF 程序在执行前会进行验证,确保不会崩溃或损害内核。
  - title: 高性能
    icon: 🛠️
    details: eBPF 程序直接在内核空间运行,提供卓越的性能。
  - title: 可观察性
    icon: 🛠️
    details: 提供强大的跟踪和监控功能。
  - title: 网络功能
    icon: 🛠️
    details: 可用于自定义数据包处理和网络功能。
  - title: 安全增强
    icon: 🛠️
    details: 支持细粒度的安全策略和监控。
  - title: 可扩展性
    icon: 🛠️
    details: 允许扩展内核功能而无需修改内核源代码。
  - title: JIT 编译
    icon: 🛠️
    details: eBPF 程序可以进行即时编译以获得原生性能。
---

## 快速开始

点击 `eBPF 概览`，快速了解 eBPF 的基本概念。

## 参考文档

### eBPF

1. <https://ebpf-docs.dylanreimerink.nl/>
2. <https://ebpf.io/zh-hans/what-is-ebpf/>
3. <https://docs.cilium.io/en/stable/bpf/>
4. <https://docs.cilium.io/en/stable/network/ebpf/>
