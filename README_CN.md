<h1 align="center">Claude-Recap</h1>

<p align="center">
  <em>Claude Code 的话题级自动记忆 — 跨 Session、抗 Compaction，永不丢失上下文。</em>
</p>

<p align="center">
  <a href="https://github.com/hatawong/claude-recap/releases"><img src="https://img.shields.io/github/v/release/hatawong/claude-recap?label=version" alt="Version" /></a>
  <a href="https://github.com/hatawong/claude-recap/blob/main/LICENSE"><img src="https://img.shields.io/github/license/hatawong/claude-recap" alt="License" /></a>
  <a href="https://github.com/hatawong/claude-recap/stargazers"><img src="https://img.shields.io/github/stars/hatawong/claude-recap" alt="Stars" /></a>
  <a href="https://github.com/hatawong/claude-recap/issues"><img src="https://img.shields.io/github/issues/hatawong/claude-recap" alt="Issues" /></a>
  <a href="https://github.com/hatawong/claude-recap/commits/main"><img src="https://img.shields.io/github/last-commit/hatawong/claude-recap" alt="Last Commit" /></a>
  <img src="https://img.shields.io/badge/shell-bash-green" alt="Shell" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933" alt="Node.js" />
  <img src="https://img.shields.io/badge/Claude_Code-plugin-D97757" alt="Claude Code Plugin" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

<p align="center">
  <img src="demo.gif" alt="Claude-Recap 演示：自动话题归档与跨 Session 记忆" width="800" />
</p>

---

## 痛点

Claude Code 每次开新 Session 都从零开始。对话中切换话题，之前的上下文就没了。触发 Context Compaction，工作状态直接蒸发。开新 Session 还得把项目背景再解释一遍。

## Claude-Recap 做了什么

两个 Shell Hook，全自动运行，零手动操作：

- **自动话题归档** — 每条回复自动标记话题标签。话题切换时，旧话题被摘要并保存为 Markdown 文件。
- **上下文注入** — 每个新 Session 启动时，自动注入话题历史和用户偏好。
- **Compaction 恢复** — 当 Claude Code 压缩上下文时，Claude-Recap 从 JSONL 会话记录中冷读重建准确摘要。不丢任何信息。
- **`/remember` 技能** — 告诉 Claude 记住跨 Session 的偏好："始终用 bun"、"不要自动 commit"。存储为纯 Markdown。

所有数据以 Markdown 文件形式存储在 `~/.memory/`。无数据库、无云服务、除 bash 和 Node.js 外无依赖。

## 快速开始

### 插件安装（推荐）

```bash
# 1. 注册 marketplace
/plugin marketplace add hatawong/claude-recap

# 2. 安装插件（选择 User scope 全项目生效）
/plugin install claude-recap@claude-recap-marketplace

# 3. 重启 Claude Code 激活 hooks
```

> **注意：** 安装后需重启 Claude Code 使 hooks 生效。`/remember` 安装即可用（它是 Skill），但话题功能（`/save-topic`、`/list-topics`、自动归档）需要 SessionStart hook 注入 Topic Tag Rule，必须重启。

### 手动安装（不使用插件系统）

```bash
git clone https://github.com/hatawong/claude-recap.git
cd claude-recap
./scripts/dev-register.sh /path/to/your/project
```

这会将 hook 条目直接写入你项目的 `.claude/settings.json`。

## 工作原理

```
SessionStart hook                          Stop hook
     │                                         │
     ▼                                         ▼
  注入到 Session：                        比对话题标签
  • REMEMBER.md（偏好）                   与 .current_topic
  • 话题历史                                    │
  • Topic Tag Rule                    ┌────────┴────────┐
     │                                │                 │
     ▼                             话题相同        话题变化
  Claude 每条回复                   → 放行            → exit 2
  输出话题标签 › `slug`                            → LLM 写摘要
     │                                             → 脚本归档到
     ▼                                               ~/.memory/
  每条回复自动标记
                                ┌─────────────────────────┐
                                │  Compaction 恢复：        │
                                │  检测 .compacted →       │
                                │  从 JSONL 冷读 →         │
                                │  生成准确摘要             │
                                └─────────────────────────┘
```

## 功能列表

| 功能 | 实现方式 |
|------|----------|
| 话题级归档 | Stop hook 检测话题变化，带摘要归档 |
| 跨 Session 记忆 | SessionStart hook 注入历史话题 + 偏好 |
| Compaction 恢复 | 从 JSONL 会话记录冷读重建 |
| `/remember` | 全局或项目级持久化偏好 |
| `/save-topic` | 手动保存当前话题进度 |
| `/list-topics` | 查看当前 Session 所有话题 |
| 延迟归档 | 后台进程补充归档历史 Session 的话题 |
| 100% 本地 | 纯 Markdown 存储在 `~/.memory/`，无云、无数据库 |

## 存储结构

所有数据在 `~/.memory/`（可通过 `MEMORY_HOME` 环境变量配置）：

```
~/.memory/
  REMEMBER.md                          # 全局偏好
  projects/
    {项目路径编码}/                      # 如 -Users-you-my-app
      REMEMBER.md                      # 项目级偏好
      {session-id}/
        .current_topic                 # 当前话题 slug
        01-setup-auth.md               # 话题摘要（按顺序编号）
        02-fix-login-bug.md
```

## 对比

| | Claude-Recap | claude-mem | 手动 CLAUDE.md |
|---|---|---|---|
| 粒度 | 按话题 | 按 Session 整体 | 手动 |
| 自动化 | 全自动 | 自动 | 手动 |
| 抗 Compaction | 是（冷读恢复） | 否 | 不适用 |
| 存储 | 本地 Markdown | ChromaDB | 本地 Markdown |
| 依赖 | bash, Node.js | Python, ChromaDB | 无 |
| 话题分离 | 自动 | 无 | 手动 |

## 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MEMORY_HOME` | `~/.memory` | 所有记忆数据的根目录 |

## 卸载

```bash
/plugin uninstall claude-recap@claude-recap-marketplace
```

`~/.memory/` 中的数据会保留 — 卸载不会删除记忆文件。重新安装后立即恢复全部功能。

## 更新

```bash
# 拉取最新版并更新插件缓存
/plugin marketplace update claude-recap-marketplace
```

或通过 `/plugin` → Marketplaces → "Enable auto-update" 开启自动更新。

## 文档

- [架构](docs/architecture_cn.md) — Hooks、脚本和冷读管线的工作原理
- [设计决策](docs/design-decisions_cn.md) — 为什么按话题、为什么用 Markdown、为什么用 Hooks
- [FAQ 与排障](docs/faq_cn.md) — 常见问题与解决方案
- [高级用法](docs/advanced-usage_cn.md) — 自定义存储、开发模式、手动配置

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
