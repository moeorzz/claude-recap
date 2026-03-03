# Design Decisions

Why claude-recap works the way it does.

## Why topic-based, not session-based?

Most memory tools dump the entire session into one file. This creates two problems:

1. **Multi-topic sessions become unsearchable.** A 2-hour session touching auth, database migration, and CSS fixes produces one giant file. Finding "what did we decide about the auth flow?" requires reading the whole thing.
2. **Summaries lose specificity.** Summarizing a multi-topic session into one paragraph destroys the details that matter.

claude-recap tracks topics within a session. Each topic gets its own summary file with a descriptive slug (`01-setup-auth.md`, `02-fix-login-bug.md`). You can grep for exactly what you need.

## Why Markdown files, not a database?

Three reasons:

1. **Transparency.** `cat ~/.memory/projects/.../01-setup-auth.md` shows you exactly what the agent remembers. No query language, no schema, no tools needed to inspect.
2. **LLM compatibility.** Claude Code already knows how to read Markdown files. No custom tools, no MCP wrappers, no JSON serialization overhead.
3. **Proven at scale.** Vector databases for LLM memory have known issues: OOM at scale, cross-project contamination, hallucination amplification from lossy compression. Plain files avoid all of these.

## Why hooks, not MCP tools?

MCP tools require the LLM to *choose* to call them. In practice, LLMs don't spontaneously save their own context — they need to be prompted. Three independent ecosystems (claude-mem, OpenClaw, community plugins) all confirmed this: LLMs don't self-invoke memory tools reliably.

Hooks solve this by running automatically. The LLM doesn't decide whether to save — the Stop hook fires on every response. The LLM's only job is outputting a topic tag (one line) and writing a summary when asked.

## Why exit code 2 instead of a Skill?

Earlier versions used a `/set-topic` Skill: the Stop hook would prompt "please call /set-topic", and the LLM was supposed to remember and invoke it. This was unreliable — the LLM sometimes forgot, especially after long conversations.

Exit code 2 in Claude Code means "inject this stderr as a follow-up prompt." The Stop hook outputs a complete `bash set-topic.sh ...` command. The LLM executes it directly — no Skill lookup, no hoping it remembers.

## Why cold-read from JSONL?

When Claude Code compacts context, the LLM's memory of earlier conversation is truncated. If we asked it to summarize a topic it can no longer see, the summary would be incomplete or hallucinated.

Instead, `set-topic.sh` detects the `.compacted` marker and switches to cold-read mode: extract the full conversation from the JSONL transcript file, then use a separate `claude -p` process to generate an accurate summary from the complete data.

This is slower and more expensive, but accurate. The eyewitness path (LLM summarizes from its own context) is preferred when available.

## Why independent processes, not SubAgents?

Claude Code SubAgents don't inherit permissions from the parent agent. Writing to `~/.memory/` (outside the project directory) gets blocked. This is an intentional design decision by Anthropic, not a bug.

Shell scripts run as independent processes with full file system access. `claude -p` (headless mode) also runs independently. No permission issues, no workarounds needed.

## Why `~/.memory/` and not inside the project?

Memory should persist across git branches, git cleans, and project rebuilds. Storing it inside the project risks accidental deletion and git pollution. `~/.memory/` is user-scoped, persistent, and invisible to git.

The path is configurable via `MEMORY_HOME` for users who prefer a different location.
