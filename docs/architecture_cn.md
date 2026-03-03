# 架构

Claude-Recap 使用两个 Claude Code Hook 和一组 Shell 脚本，实现跨 Session 的自动话题级记忆。

## 核心流程

```
┌─────────────────────────────────────────────────────────────┐
│                     Session 生命周期                          │
│                                                             │
│  SessionStart hook                    Stop hook             │
│       │                                   │                 │
│       ▼                                   ▼                 │
│  1. 注入到上下文：                  1. 从 LLM 回复中提取       │
│     • REMEMBER.md（偏好）             话题标签                │
│     • 话题历史列表                 2. 与 .current_topic       │
│     • Topic Tag Rule                 比对                    │
│  2. 后台启动                              │                 │
│     archive-pending               ┌──────┴──────┐          │
│                                   │             │          │
│                              话题相同      话题变化          │
│                              → 放行        → exit 2         │
│                                            → stderr 输出：  │
│                                              bash 命令      │
│                                              + 摘要模板      │
│                                                  │          │
│                                                  ▼          │
│                                          LLM 执行           │
│                                          set-topic.sh       │
│                                          → 归档旧话题        │
│                                            写入 .md          │
│                                          → 更新              │
│                                            .current_topic    │
└─────────────────────────────────────────────────────────────┘
```

## Topic Tag 系统

每条 LLM 回复以话题标签开头：

```
› `fix-login-bug`

下面是我对登录问题的分析...
```

Stop hook 提取此标签并与 `.current_topic` 比对。如果话题发生变化，hook 以 exit code 2 退出，并向 LLM 提供一条完整的 bash 命令来归档旧话题并注册新话题。

**为什么是 exit code 2？** Claude Code 将 exit 2 视为"hook 需要注入后续提示"。stderr 输出成为 LLM 的下一条指令 — 归档旧话题并运行 `set-topic.sh`。

## Compaction 恢复

当 Claude Code 压缩上下文（截断旧消息以节省 Token）时，LLM 会丢失完整对话历史。此时它的摘要是不准确的。

Claude-Recap 通过 `.compacted` 标记文件检测此情况：

```
正常路径：  LLM 写摘要 → set-topic.sh 保存
压缩路径：  .compacted 存在 → set-topic.sh 忽略 LLM 摘要
                             → extract-topic.js 读取 JSONL 会话记录
                             → cold-summarize.sh (claude -p) 从完整
                               记录生成准确摘要
```

冷读路径使用 `claude -p`（无头 Claude）作为独立进程，拥有完整文件系统访问权限。

## 延迟归档（archive-pending）

并非每个话题都会在 Session 内被归档（例如退出前的最后一个话题）。`archive-pending.sh` 在每次 SessionStart 时后台运行，补充归档遗漏的话题：

```
SessionStart
  → archive-pending.sh（后台）
    → 扫描所有 JSONL 文件，找出有未归档话题的 Session
    → 对每个未归档话题：
      → extract-topic.js 提取对话
      → cold-summarize.sh 生成摘要
      → 写入话题 .md 文件
```

## 关键脚本

| 脚本 | 用途 |
|------|------|
| `hooks/session-start.sh` | 注入记忆 + 启动 archive-pending |
| `hooks/stop.sh` | 检测话题变化，触发归档 |
| `scripts/set-topic.sh` | 归档旧话题，更新 .current_topic |
| `scripts/save-topic.sh` | 手动话题检查点（通过 /save-topic） |
| `scripts/extract-topic.js` | 从 JSONL 按话题提取对话 |
| `scripts/cold-summarize.sh` | 通过无头 Claude 生成摘要 |
| `scripts/archive-pending.sh` | 后台扫描 + 归档未归档话题 |
| `scripts/remember.sh` | 写入 REMEMBER.md（通过 /remember） |

## 文件系统布局

```
~/.memory/
  REMEMBER.md                          # 全局偏好（/remember global）
  projects/
    {项目路径编码}/                      # 如 -Users-you-my-app
      REMEMBER.md                      # 项目偏好（/remember project）
      {session-uuid}/
        .current_topic                 # 当前话题 slug
        .compacted                     # 标记：上下文已被压缩
        01-setup-auth.md               # 话题摘要（按出现顺序编号）
        02-fix-login-bug.md
```

**路径编码：** 完整项目路径将 `/` 替换为 `-`。这防止了跨项目污染 — 每个项目有独立的记忆命名空间。

## 设计原则

1. **LLM 只输出文本，脚本处理文件。** LLM 负责输出话题标签和摘要。所有文件系统操作（mkdir、write、archive）由 Shell 脚本完成。这避免了幻觉路径、部分写入和权限问题。

2. **亲历者 > 冷读者。** 主 LLM 拥有完整对话上下文 — 它的摘要质量远高于事后从 JSONL 重建。冷读仅作为压缩 Session 的兜底方案。

3. **特权操作走独立进程。** `~/.memory/` 在项目目录之外。Shell 脚本和 `claude -p` 作为独立进程运行，拥有完整文件系统访问权限，绕过 Claude Code 的项目级权限模型。

4. **零共享状态。** 每个 Session 有独立目录。无锁、无协调、无竞态条件。
