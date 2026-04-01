<h1 align="center">Claude-Recap</h1>

<p align="center">
  <em>Topic-based automatic memory for Claude Code — never lose context across sessions or compactions.</em>
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
  <strong>English</strong> | <a href="README_CN.md">中文</a>
</p>

<p align="center">
  <img src="demo.gif" alt="Claude-Recap demo: automatic topic archival and cross-session memory" width="800" />
</p>

---

## The Problem

Claude Code forgets everything between sessions. You spend 10 minutes explaining your project architecture. Claude suggests changes. You switch to a different bug. When you return to the architecture discussion next session, you start from zero again.

Switch topics mid-conversation and the previous context is gone. Hit a context compaction and your working state evaporates.

## What Claude-Recap Does

Two shell hooks that run automatically — zero manual effort:

- **Automatic topic archival** — Every response gets a topic tag. When the topic changes, the previous one is summarized and saved to a Markdown file.
- **Context injection** — Each new session starts with your topic history and remembered preferences injected automatically.
- **Compaction recovery** — When Claude Code compacts your context, Claude-Recap cold-reads from the JSONL transcript to rebuild accurate summaries. Nothing is lost.
- **`/remember` skill** — Tell Claude to remember preferences across sessions: "always use bun", "never auto-commit". Stored in plain Markdown.

Everything is stored locally as Markdown files in `~/.memory/`. No database, no cloud, no dependencies beyond bash and Node.js.

## Quick Start

### Plugin install (recommended)

```bash
# 1. Register the marketplace
/plugin marketplace add hatawong/claude-recap

# 2. Install the plugin (choose User scope for all projects)
/plugin install claude-recap@claude-recap-marketplace

# 3. Restart Claude Code to activate hooks
```

> **Note:** After install, restart Claude Code for hooks to take effect. `/remember` works immediately, but topic features (`/save-topic`, `/list-topics`, auto-archival) require the restart to inject the Topic Tag Rule.

### Verify Installation

After restart, start a new chat session. You should see:

```
[SessionStart] session=abc123... source=startup
Your persistent memory is stored at ~/.memory/projects/...

=== Topic Tag Rule ===
At the START of every reply, output a topic tag in this exact format:
› `your-topic-slug`
...
```

If you see the Topic Tag Rule injected, installation succeeded.

### Your First Session

1. **Try /remember:**
   ```
   You: remember I prefer TypeScript over JavaScript
   Claude: Which scope? Global or Project?
   You: global
   ```

2. **Have a conversation** — Claude will automatically tag responses with `› topic-slug`. This is normal.

3. **Switch topics** — Start discussing something different. Claude detects the change and archives the previous topic automatically.

4. **Check your memory** — Look in `~/.memory/projects/{your-project}/` to see the archived `.md` file.

5. **Start a new session** — Your previous topics and `/remember` preferences are automatically loaded.

### Manual install (without plugin system)

```bash
git clone https://github.com/hatawong/claude-recap.git
cd claude-recap
./scripts/dev-register.sh /path/to/your/project
```

This writes hook entries directly into your project's `.claude/settings.json`.

## How It Works

```
SessionStart hook                          Stop hook
     │                                         │
     ▼                                         ▼
  Inject into session:                   Compare topic tag
  • REMEMBER.md (preferences)            with .current_topic
  • Topic history                              │
  • Topic Tag Rule                    ┌────────┴────────┐
     │                                │                 │
     ▼                             Same topic      Topic changed
  Claude responds with              → pass            → exit 2
  topic tag: › `slug`                              → LLM writes summary
     │                                             → script archives to
     ▼                                               ~/.memory/
  Every response tagged
  automatically                 ┌─────────────────────────┐
                                │  Compaction recovery:    │
                                │  .compacted detected →   │
                                │  cold-read from JSONL →  │
                                │  accurate summary saved  │
                                └─────────────────────────┘
```

**From your perspective:**
- You chat normally
- Topics are tracked automatically
- Summaries are saved when you switch topics
- Next session, everything is remembered
- Zero manual effort required

## Features

| Feature | How |
|---------|-----|
| Topic-based archival | Stop hook detects topic changes, archives with summaries |
| Cross-session memory | SessionStart hook injects previous topics + preferences |
| Compaction recovery | Cold-reads JSONL transcripts when context is truncated |
| `/remember` | Persist preferences globally or per-project |
| `/save-topic` | Manually checkpoint current topic progress |
| `/list-topics` | View all topics discussed in current session |
| Delayed archival | Background process archives topics from past sessions |
| 100% local | Plain Markdown in `~/.memory/`, no cloud, no database |

### Skills Reference

| Skill | When to Use | Example |
|-------|-------------|---------|
| `/remember` | Persist preferences across all sessions | "remember I use bun not npm" |
| `/save-topic` | Checkpoint current topic without switching | After completing a milestone |
| `/list-topics` | See topics discussed in current session | "what have we covered today?" |
| `/ignore-topic` | Exclude meta/debugging topics from archival | After troubleshooting the plugin itself |
| `/search-project-topics` | Find archived topics by keywords | "search for authentication work" |
| `/search-project-sessions` | Find full sessions by context | "find the session where we refactored routing" |
| `/restore-project-context` | One-step recovery of previous work | "continue the payment integration" |

**Automatic vs Manual:**
- Topic archival: **Automatic** (happens on topic change)
- Topic tagging: **Automatic** (Claude adds `› slug` to every response)
- Context injection: **Automatic** (happens at SessionStart)
- Checkpointing: **Manual** (use `/save-topic` when needed)
- Preferences: **Manual** (use `/remember` when you want something persisted)

## Best Practices

### Terminal Workflow (claude CLI)

**Starting a session:**
1. Check injected topic history at session start
2. Use `/restore-project-context` to resume previous work
3. Let Claude tag topics automatically with `› slug`

**During work:**
- Topic tags appear automatically—no action needed
- Use `/save-topic` only for important checkpoints
- Use `/remember` for persistent preferences (e.g., "always use bun")

**Finding past work:**
- `/search-project-topics "auth bug"` — search archived topics
- `/search-project-sessions "refactor"` — search full sessions
- `/restore-project-context` — one-step recovery with repo inspection

**Example terminal session:**
```bash
$ claude chat
# Session starts, sees: "Previous topics: 01-setup-auth, 02-login-bug"
You: continue the login bug fix
# Claude uses /restore-project-context automatically
# Reads 02-login-bug.md, checks git status, continues work
```

### VS Code Workflow (Claude Code Extension)

**Setup:**
- After plugin install, restart VS Code completely
- Allow `~/.memory/` write permissions when prompted
- Topic tags appear in chat—this is normal behavior

**Multi-project usage:**
- Each workspace gets isolated memory
- Global preferences (via `/remember` → global) apply everywhere
- Project preferences (via `/remember` → project) stay local

**Permission management:**
- Add `~/.memory/` to allowed paths in settings to avoid repeated prompts
- Memory files are plain Markdown—safe to allow

### General Tips

**Topic naming:**
- Claude auto-generates descriptive slugs from conversation
- Topics switch automatically when you change subjects
- No manual topic management needed

**When to use /save-topic:**
- Before long breaks in work
- After completing a major milestone
- When you want to checkpoint without switching topics

**When to use /remember:**
- Persistent preferences: "always use TypeScript strict mode"
- Project constraints: "API endpoint is https://api.example.com"
- Identity info: "my name is Alex"
- NOT for temporary session info

**Combining with git:**
- Topic changes don't require branch changes
- Multiple topics can happen on one branch
- Use `/restore-project-context` to align memory with repo state

**Search strategy:**
- Remember only keywords? Use `/search-project-topics`
- Remember the session context? Use `/search-project-sessions`
- Want one-step recovery? Use `/restore-project-context`

## Common Workflows

### Continuing Yesterday's Work

**Terminal:**
```bash
$ claude chat
# See topic history in session start
You: restore context for the payment integration
# Claude runs /restore-project-context, finds relevant session/topic
# Reads handoff, checks git status, continues
```

**VS Code:**
- Open project
- Start Claude Code chat
- Say "continue the payment integration work"
- Claude searches and restores automatically

### Multi-Session Feature Development

**Day 1:** Design phase
- Discuss architecture
- Topic auto-tagged: `› design-payment-flow`
- Archived when you switch topics

**Day 2:** Implementation
- Say "continue payment flow design"
- Claude injects previous topic summary
- Start coding, new topic: `› implement-payment-api`

**Day 3:** Bug fix
- Hit a bug, new topic: `› fix-payment-timeout`
- Original design and implementation topics preserved
- Use `/search-project-topics "payment"` to see all related work

### Handling Context Compaction

**What happens:**
- Claude Code compacts conversation history
- claude-recap detects `.compacted` marker
- Automatically cold-reads from JSONL transcript
- Generates accurate summary using separate Claude process
- Nothing is lost

**You don't need to do anything**—it's fully automatic.

### Cross-Project Preferences

**Global preferences:**
```bash
You: remember I always use bun instead of npm
Claude: Which scope? Global or Project?
You: global
# Now applies to all projects
```

**Project-specific:**
```bash
You: remember for this project, always run tests with --verbose
Claude: Which scope? Global or Project?
You: project
# Only applies to current project
```

## Storage

All data lives in `~/.memory/` (configurable via `MEMORY_HOME` env var):

```
~/.memory/
  REMEMBER.md                          # Global preferences
  projects/
    {project-path-encoded}/            # e.g. -Users-you-my-app
      REMEMBER.md                      # Project preferences
      {session-id}/
        .current_topic                 # Active topic slug
        01-setup-auth.md               # Topic summary (auto-numbered)
        02-fix-login-bug.md
```

## Comparison

| | Claude-Recap | claude-mem | Manual CLAUDE.md |
|---|---|---|---|
| Granularity | Per-topic | Per-session dump | Manual |
| Automation | Fully automatic | Automatic | Manual |
| Compaction survival | Yes (cold-read recovery) | No | N/A |
| Storage | Local Markdown | ChromaDB | Local Markdown |
| Dependencies | bash, Node.js | Python, ChromaDB | None |
| Topic separation | Automatic | None | Manual |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_HOME` | `~/.memory` | Root directory for all memory data |

## Uninstall

```bash
/plugin uninstall claude-recap@claude-recap-marketplace
```

Your data in `~/.memory/` is preserved — uninstalling does not delete memory files. Reinstalling restores full functionality with existing data.

## Update

```bash
# Pull latest and update plugin cache
/plugin marketplace update claude-recap-marketplace
```

Or enable auto-update via `/plugin` → Marketplaces → "Enable auto-update".

## Documentation

- [Architecture](docs/architecture.md) — How the hooks, scripts, and cold-read pipeline work
- [Design Decisions](docs/design-decisions.md) — Why topic-based, why Markdown, why hooks
- [FAQ & Troubleshooting](docs/faq.md) — Common questions and solutions
- [Advanced Usage](docs/advanced-usage.md) — Custom storage, dev mode, manual setup

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
