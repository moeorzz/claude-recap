# 设计决策

Claude-Recap 为什么这样设计。

## 为什么按话题，而不是按 Session？

大多数记忆工具把整个 Session 导出为一个文件。这有两个问题：

1. **多话题 Session 无法检索。** 一个 2 小时的 Session 涉及认证、数据库迁移和 CSS 修复，产生一个巨大文件。找"认证流程我们怎么决定的？"需要通读全文。
2. **摘要失去精度。** 把多话题 Session 压缩成一段话，关键细节就丢了。

Claude-Recap 在 Session 内追踪话题。每个话题有独立的摘要文件和描述性 slug（`01-setup-auth.md`、`02-fix-login-bug.md`）。你可以精确 grep 到你需要的内容。

## 为什么用 Markdown 文件，而不是数据库？

三个原因：

1. **透明。** `cat ~/.memory/projects/.../01-setup-auth.md` 直接看到 Agent 记住了什么。不需要查询语言、不需要 schema、不需要工具来检查。
2. **LLM 兼容。** Claude Code 天生会读 Markdown 文件。无需自定义工具、无需 MCP 包装、无需 JSON 序列化开销。
3. **规模验证。** 向量数据库用于 LLM 记忆有已知问题：规模扩大后 OOM、跨项目污染、有损压缩放大幻觉。纯文件避免了所有这些问题。

## 为什么用 Hooks，而不是 MCP 工具？

MCP 工具需要 LLM *主动选择*调用。实践中，LLM 不会自发保存自己的上下文 — 需要被提示。三个独立生态（claude-mem、OpenClaw、社区插件）都证实了这一点：LLM 不能可靠地自主调用记忆工具。

Hooks 通过自动运行解决了这个问题。LLM 不决定是否保存 — Stop hook 在每条回复后自动触发。LLM 唯一的任务是输出话题标签（一行）并在被要求时写摘要。

## 为什么用 exit code 2 而不是 Skill？

早期版本使用 `/set-topic` Skill：Stop hook 提示"请调用 /set-topic"，然后 LLM 应该记住并执行。这不可靠 — LLM 有时会忘记，尤其是长对话之后。

Claude Code 中 exit code 2 表示"将 stderr 内容作为后续提示注入"。Stop hook 输出一条完整的 `bash set-topic.sh ...` 命令。LLM 直接执行 — 不需要 Skill 查找，不需要指望它记得。

## 为什么从 JSONL 冷读？

当 Claude Code 压缩上下文时，LLM 对早期对话的记忆被截断。如果让它摘要一个已经看不到的话题，摘要会不完整或产生幻觉。

`set-topic.sh` 检测 `.compacted` 标记后切换到冷读模式：从 JSONL 会话记录文件中提取完整对话，然后用独立的 `claude -p` 进程从完整数据生成准确摘要。

这更慢、更贵，但准确。亲历者路径（LLM 从自身上下文摘要）在可用时优先使用。

## 为什么用独立进程，而不是 SubAgent？

Claude Code 的 SubAgent 不继承父 Agent 的权限。写入 `~/.memory/`（项目目录外）会被阻止。这是 Anthropic 的有意设计，不是 bug。

Shell 脚本作为独立进程运行，拥有完整文件系统访问权限。`claude -p`（无头模式）同样独立运行。无权限问题，无需变通方案。

## 为什么是 `~/.memory/` 而不是放在项目内？

记忆应该在 git 分支切换、git clean、项目重建后都能保留。存在项目内有意外删除和 git 污染的风险。`~/.memory/` 是用户级的、持久的、对 git 不可见的。

路径可通过 `MEMORY_HOME` 环境变量配置，用户可以选择其他位置。
