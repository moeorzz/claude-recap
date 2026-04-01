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

Claude Code 每次开新 Session 都从零开始。你花 10 分钟解释项目架构，Claude 给出建议。然后你切换去修另一个 bug。下次回到架构讨论时，又得从零开始。

对话中切换话题，之前的上下文就没了。触发 Context Compaction，工作状态直接蒸发。

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

### 验证安装

重启后，开启新的聊天 Session。你应该看到：

```
[SessionStart] session=abc123... source=startup
Your persistent memory is stored at ~/.memory/projects/...

=== Topic Tag Rule ===
At the START of every reply, output a topic tag in this exact format:
› `your-topic-slug`
...
```

如果看到 Topic Tag Rule 被注入，说明安装成功。

### 第一次使用

1. **尝试 /remember：**
   ```
   你：记住我更喜欢用 TypeScript 而不是 JavaScript
   Claude：哪个范围？全局还是项目？
   你：全局
   ```

2. **开始对话** — Claude 会自动在回复中标记 `› topic-slug`。这是正常的。

3. **切换话题** — 开始讨论别的内容。Claude 会检测到变化并自动归档之前的话题。

4. **查看记忆** — 在 `~/.memory/projects/{你的项目}/` 中查看归档的 `.md` 文件。

5. **开启新 Session** — 你之前的话题和 `/remember` 偏好会自动加载。

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

**从你的角度看：**
- 正常聊天即可
- 话题自动跟踪
- 切换话题时自动保存摘要
- 下次 Session 自动记住一切
- 零手动操作

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

### 技能参考

| 技能 | 使用场景 | 示例 |
|------|----------|------|
| `/remember` | 跨 Session 持久化偏好 | "记住我用 bun 不用 npm" |
| `/save-topic` | 不切换话题的情况下保存检查点 | 完成重要里程碑后 |
| `/list-topics` | 查看当前 Session 讨论的所有话题 | "今天我们讨论了什么？" |
| `/ignore-topic` | 排除元话题/调试话题不归档 | 调试插件本身后 |
| `/search-project-topics` | 按关键词搜索归档话题 | "搜索认证相关的工作" |
| `/search-project-sessions` | 按上下文搜索完整 Session | "找到我们重构路由的那次 Session" |
| `/restore-project-context` | 一步恢复之前的工作 | "继续支付集成的工作" |

**自动 vs 手动：**
- 话题归档：**自动**（话题切换时发生）
- 话题标记：**自动**（Claude 每条回复都加 `› slug`）
- 上下文注入：**自动**（SessionStart 时发生）
- 检查点保存：**手动**（需要时使用 `/save-topic`）
- 偏好设置：**手动**（想持久化时使用 `/remember`）

## 最佳实践

### 终端工作流（claude CLI）

**开始 Session：**
1. 查看 Session 启动时注入的话题历史
2. 使用 `/restore-project-context` 恢复之前的工作
3. 让 Claude 自动标记话题 `› slug`

**工作期间：**
- 话题标签自动出现——无需操作
- 仅在重要检查点使用 `/save-topic`
- 使用 `/remember` 设置持久化偏好（如"始终用 bun"）

**查找过往工作：**
- `/search-project-topics "认证 bug"` — 搜索归档话题
- `/search-project-sessions "重构"` — 搜索完整 Session
- `/restore-project-context` — 一步恢复并检查仓库状态

**终端 Session 示例：**
```bash
$ claude chat
# Session 启动，看到："Previous topics: 01-setup-auth, 02-login-bug"
你：继续修复登录 bug
# Claude 自动使用 /restore-project-context
# 读取 02-login-bug.md，检查 git 状态，继续工作
```

### VS Code 工作流（Claude Code 扩展）

**设置：**
- 插件安装后，完全重启 VS Code
- 提示时允许 `~/.memory/` 写入权限
- 聊天中出现话题标签——这是正常行为

**多项目使用：**
- 每个工作区获得独立的记忆
- 全局偏好（通过 `/remember` → 全局）适用于所有项目
- 项目偏好（通过 `/remember` → 项目）仅限本地

**权限管理：**
- 在设置中将 `~/.memory/` 添加到允许路径以避免重复提示
- 记忆文件是纯 Markdown——可以安全允许

### 通用技巧

**话题命名：**
- Claude 根据对话自动生成描述性 slug
- 话题在你切换主题时自动切换
- 无需手动管理话题

**何时使用 /save-topic：**
- 工作长时间中断前
- 完成重要里程碑后
- 想要保存检查点但不切换话题时

**何时使用 /remember：**
- 持久化偏好："始终使用 TypeScript strict 模式"
- 项目约束："API 端点是 https://api.example.com"
- 身份信息："我叫 Alex"
- 不用于临时 Session 信息

**与 git 结合：**
- 话题切换不需要切换分支
- 一个分支上可以有多个话题
- 使用 `/restore-project-context` 将记忆与仓库状态对齐

**搜索策略：**
- 只记得关键词？使用 `/search-project-topics`
- 记得 Session 上下文？使用 `/search-project-sessions`
- 想要一步恢复？使用 `/restore-project-context`

## 常见工作流

### 继续昨天的工作

**终端：**
```bash
$ claude chat
# 在 Session 启动时看到话题历史
你：恢复支付集成的上下文
# Claude 运行 /restore-project-context，找到相关 Session/话题
# 读取交接文档，检查 git 状态，继续工作
```

**VS Code：**
- 打开项目
- 启动 Claude Code 聊天
- 说"继续支付集成的工作"
- Claude 自动搜索并恢复

### 多 Session 功能开发

**第 1 天：** 设计阶段
- 讨论架构
- 话题自动标记：`› design-payment-flow`
- 切换话题时归档

**第 2 天：** 实现
- 说"继续支付流程设计"
- Claude 注入之前的话题摘要
- 开始编码，新话题：`› implement-payment-api`

**第 3 天：** Bug 修复
- 遇到 bug，新话题：`› fix-payment-timeout`
- 原始设计和实现话题保留
- 使用 `/search-project-topics "payment"` 查看所有相关工作

### 处理 Context Compaction

**发生的事情：**
- Claude Code 压缩对话历史
- claude-recap 检测到 `.compacted` 标记
- 自动从 JSONL 会话记录冷读
- 使用独立的 Claude 进程生成准确摘要
- 不丢失任何信息

**你无需做任何事**——完全自动。

### 跨项目偏好

**全局偏好：**
```bash
你：记住我始终用 bun 而不是 npm
Claude：哪个范围？全局还是项目？
你：全局
# 现在适用于所有项目
```

**项目特定：**
```bash
你：记住这个项目始终用 --verbose 运行测试
Claude：哪个范围？全局还是项目？
你：项目
# 仅适用于当前项目
```

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
