# Buddy 插件项目启动器

这是一个 [Buddy](https://github.com/CofficLab/buddy) 插件，旨在聚合并快速搜索、打开你最近在多种 IDE（如 VSCode、Cursor 等）中使用过的项目。

## 功能特点

- **多 IDE 支持**：聚合 VSCode、Cursor 等主流 IDE 的历史项目记录，统一展示。
- **关键词搜索**：通过关键词快速查找并定位历史项目。
- **一键打开项目**：支持用 VSCode、Cursor、Xcode 等多种 IDE 快速打开项目。
- **路径归一化与去重**：自动去除重复、无效项目路径，提升搜索体验。
- **架构可扩展**：采用 Provider 接口+聚合管理器架构，便于未来扩展更多 IDE。
- **CLI 测试入口**：内置命令行测试工具，便于开发调试和功能验证。

## 安装与开发

```bash
# 安装依赖
pnpm install

# 编译
pnpm build

# 运行 CLI 测试
pnpm test:cli <关键词>
```

## 使用方法

1. 安装插件后，Buddy 会自动聚合你在 VSCode、Cursor 等 IDE 的历史项目。
2. 通过插件界面或 CLI 工具输入关键词，快速查找并打开目标项目。
3. 支持多种 IDE 打开方式，未来可扩展更多 IDE。

## 架构说明

- **Provider 接口**：每种 IDE 实现独立 Provider，负责解析各自历史项目。
- **聚合管理器**：统一聚合、去重、归一化所有 Provider 的项目数据。
- **可扩展性**：新增 IDE 只需实现 Provider 并注册到管理器。

## 许可证

MIT
