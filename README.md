# ebpf-docs

这是一个使用 VitePress 构建的 eBPF 指南文档仓库。

## 项目设置

要创建和运行这个项目，请按照以下步骤操作：

```sh
# 1. 初始化项目
npm init

# 2. 安装 VitePress
npm install -D vitepress

# 3. 创建文档结构

# 4. 启动开发服务器
npm run docs:dev

```

## 项目结构

docs/: 包含所有 Markdown 文件
docs/.vitepress/: VitePress 配置文件夹
docs/.vitepress/config.js: 主要配置文件

自定义主题
在 docs/.vitepress/config.js 中配置主题：

export default {
  themeConfig: {
    // 自定义主题配置
  }
}

部署
构建生产版本：

```sh
npm run docs:build
```

将 `docs/.vitepress/dist` 文件夹部署到您的托管服务。

## 贡献

欢迎提交 Pull Requests 来改进文档。

## 许可证

MIT License
