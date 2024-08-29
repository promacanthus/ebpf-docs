import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/ebpf-docs/',
  title: "eBPF 指南",
  lang: 'zh-CN',
  head: [
    ['link', { rel: 'icon', href: '/ebpf-docs/favicon-32x32.png' }]
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.png',

    nav: [
      { text: '主页', link: '/' },
      { text: 'eBPF 理论', link: '/linux/' },
      { text: 'FQAs', link: '/fqa/' },
      { text: 'Awesome eBPF', link: 'https://github.com/zoidyzoidzoid/awesome-ebpf' },
    ],

    sidebar: [
      { text: 'eBPF 概览', link: '/overview/', },
      {
        text: 'eBPF 理论',
        collapsed: false,
        items: [
          {
            text: '核心概念', link: '/linux/concepts',
            collapsed: true,
            items: [
              { text: 'Maps', link: '/linux/concepts/maps' },
              { text: 'Verifier', link: '/linux/concepts/verifier' },
              { text: 'Concurrency', link: '/linux/concepts/concurrency' },
              { text: 'Pinning', link: '/linux/concepts/pinning' },
              { text: 'Tail calls', link: '/linux/concepts/tail-calls' },
              { text: 'Loops', link: '/linux/concepts/loops' },
              { text: 'Timers', link: '/linux/concepts/timers' },
              { text: 'Resource Limit', link: '/linux/concepts/resource-limit' },
              { text: 'AF_XDP', link: '/linux/concepts/af_xdp' },
              { text: 'Kfuncs', link: '/linux/concepts/kfuncs' },
            ]
          },
          {
            text: '程序类型', link: '/linux/program-type', collapsed: true,
            items: [
              { text: '网络程序类型', link: '/linux/program-type/network-program-types' },
              { text: 'cGroup程序类型', link: '/linux/program-type/cgroup-program-types' },
              { text: '跟踪程序类型', link: '/linux/program-type/tracing-program-types' },
              { text: '其他程序类型', link: '/linux/program-type/misc-program-types' },
            ]
          },
          { text: 'Map 类型', link: '/linux/map-type' },
          { text: '帮助函数', link: '/linux/helper-function' },
          { text: '系统调用', link: '/linux/syscall' },
          { text: '内核函数', link: '/linux/kfuncs' },
        ]
      },
      {
        text: 'eBPF 库',
        collapsed: true,
        items: [
          { text: 'RUST', link: '/ebpf-library/rust' },
          { text: 'Go', link: '/ebpf-library/go' },
          { text: 'C', link: '/ebpf-library/c' },
        ]
      },

      {
        text: '相关概念', link: '/concepts/',
        collapsed: true,
        items: [
          { text: 'BTF', link: '/concepts/btf' },
          { text: 'core', link: '/concepts/core' },
          { text: 'ELF', link: '/concepts/elf' },
          { text: 'instruction-set', link: '/concepts/instruction-set' },
          { text: 'loader', link: '/concepts/loader' },
        ]
      },

      { text: 'FQAs', link: '/fqa/' },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/promacanthus/ebpf-docs' }
    ],

    footer: {
      message: 'Released under the <a href="https://github.com/promacanthus/ebpf-docs/blob/main/LICENSE">MIT License</a>.',
      copyright: 'Copyright © 2024-至今 <a href="https://github.com/promacanthus">Promanthus</a>'
    },

    editLink: {
      pattern: 'https://github.com/promacanthus/ebpf-docs/edit/main/docs/:path',
      text: '在 GitHub 编辑此页面'
    },

    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    },

    carbonAds: {
      code: '',
      placement: ''
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    externalLinkIcon: true,

    search: {
      provider: 'local'
    }
  }
})
