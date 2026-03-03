# FAQ 与排障

## 常见问题

### Context Compaction 时会丢数据吗？

不会。当 Compaction 截断对话历史时，Claude-Recap 检测 `.compacted` 标记并切换到冷读模式。它从 JSONL 会话记录中提取完整对话，用独立 Claude 进程生成准确摘要。参见[架构：Compaction 恢复](architecture_cn.md#compaction-恢复)。

### 数据存在哪里？

所有数据在 `~/.memory/`（或 `MEMORY_HOME` 指向的位置）。纯 Markdown — 你可以用任何文本编辑器查看、编辑或删除。

```bash
# 查看所有内容
find ~/.memory -name "*.md" | head -20

# 读取特定话题
cat ~/.memory/projects/-Users-you-my-app/{session-id}/01-setup-auth.md
```

### 可以在多个项目间使用吗？

可以。每个项目在 `~/.memory/projects/` 下有独立的命名空间，以完整项目路径编码为键。不会跨项目污染。

### 在 VS Code 中的 Claude Code 能用吗？

可以。Hooks 在终端和 VS Code 扩展模式下工作方式完全相同。

## 安装

### 安装后 Hooks 不生效

安装插件后需要**重启 Claude Code**。Hooks 在启动时加载，不是动态加载的。

`/remember` 安装后立即可用（它是 Skill），但话题功能（`/save-topic`、`/list-topics`、自动归档）需要 SessionStart hook 注入 Topic Tag Rule。重启即可激活。

### 写入 `~/.memory/` 时弹权限提示

Claude Code 在 LLM 写入项目目录外的文件时可能弹出权限提示。这是正常行为。允许写入 `~/.memory/` — 那是你的记忆数据所在位置。

要避免反复弹出提示，可以在 Claude Code 设置中将 `~/.memory/` 添加到允许路径。

### 如何更新到新版本？

```bash
# 方式一：Marketplace 更新
/plugin marketplace update claude-recap-marketplace

# 方式二：开启自动更新
# 进入 /plugin → Marketplaces → "Enable auto-update"
```

### 如何完全卸载？

```bash
/plugin uninstall claude-recap@claude-recap-marketplace
```

这会停止所有 hooks。`~/.memory/` 中的数据会保留。如果也想删除记忆数据：

```bash
rm -rf ~/.memory
```

## 话题

### 为什么每条回复开头都有 `› \`slug\``？

那是话题标签。它是 Claude-Recap 追踪当前讨论话题的方式。Stop hook 读取这个标签来检测话题变化。只占一行，不影响功能。

### 话题没有被归档

检查：
1. Hooks 已加载：安装后重启了 Claude Code
2. LLM 在输出话题标签（你应该在回复开头看到 `› \`slug\``）
3. 你确实切换了话题 — 归档发生在话题*变化*时，不是每条回复都触发

### 能不切换话题直接保存吗？

可以，使用 `/save-topic`。这会在不等话题变化的情况下保存当前话题的摘要检查点。

## 排障

### `archive-pending` 后台报错

`archive-pending.sh` 在每次 SessionStart 时后台运行。如果遇到错误（如旧 Session 的 JSONL 文件缺失），会写入 `.archive-skipped` 标记并继续。这些错误不影响当前 Session。

### macOS `/tmp` 路径不匹配

在 macOS 上，`/tmp` 是 `/private/tmp` 的符号链接。Claude-Recap 通过在所有地方使用 `pwd -P`（POSIX 物理路径）自动处理。如果在自定义脚本中遇到路径不匹配，确保也解析了符号链接。

### 冷读摘要为空

可能原因是 JSONL 会话记录格式异常或无头 Claude 进程失败。检查：
- JSONL 文件存在于 `~/.claude/projects/{project-id}/{session-id}.jsonl`
- Node.js 可用（`extract-topic.js` 需要）
- `claude` CLI 在 shell 中可访问
