# FAQ & Troubleshooting

## General

### What happens when Claude Code compacts my context?

Nothing is lost. When compaction truncates your conversation history, claude-recap detects the `.compacted` marker and switches to cold-read mode. It extracts the full conversation from the JSONL transcript file and generates an accurate summary using a separate Claude process. See [Architecture: Compaction Recovery](architecture.md#compaction-recovery).

### Where is my data stored?

All data is in `~/.memory/` (or wherever `MEMORY_HOME` points). It's plain Markdown — you can read, edit, or delete it with any text editor.

```bash
# See everything
find ~/.memory -name "*.md" | head -20

# Read a specific topic
cat ~/.memory/projects/-Users-you-my-app/{session-id}/01-setup-auth.md
```

### Can I use this across multiple projects?

Yes. Each project gets its own isolated namespace under `~/.memory/projects/`, keyed by the full project path. No cross-project contamination.

### Does this work with Claude Code in VS Code?

Yes. The hooks work the same way in both terminal and VS Code extension modes.

## Installation

### Hooks don't activate after install

You need to **restart Claude Code** after installing the plugin. Hooks are loaded at startup, not dynamically.

`/remember` works immediately after install (it's a Skill, not a hook), but topic features (`/save-topic`, `/list-topics`, auto-archival) require the SessionStart hook to inject the Topic Tag Rule. Restart to activate.

### Permission prompts when writing to `~/.memory/`

Claude Code may prompt for permission when the LLM writes files outside the project directory. This is expected behavior. Allow the write to `~/.memory/` — it's where your memory data lives.

To avoid repeated prompts, you can add `~/.memory/` to your allowed paths in Claude Code settings.

### How do I update to a new version?

```bash
# Option 1: Marketplace update
/plugin marketplace update claude-recap-marketplace

# Option 2: Enable auto-update
# Go to /plugin → Marketplaces → "Enable auto-update"
```

### How do I completely uninstall?

```bash
/plugin uninstall claude-recap@claude-recap-marketplace
```

This stops all hooks. Your data in `~/.memory/` is preserved. To also delete your memory data:

```bash
rm -rf ~/.memory
```

## Topics

### Why do I see `› \`slug\`` at the start of every response?

That's the topic tag. It's how claude-recap tracks which topic you're discussing. The Stop hook reads this tag to detect topic changes. It's a single line and doesn't affect functionality.

### Topics aren't being archived

Check that:
1. Hooks are loaded: restart Claude Code after install
2. The LLM is outputting topic tags (you should see `› \`slug\`` at the start of responses)
3. You've actually switched topics — archival happens on topic *change*, not on every response

### Can I manually save a topic without switching?

Yes, use `/save-topic`. This checkpoints the current topic's summary without waiting for a topic change.

## Troubleshooting

### `archive-pending` errors in the background

`archive-pending.sh` runs in the background at each SessionStart. If it encounters errors (e.g., missing JSONL files for old sessions), it writes a `.archive-skipped` marker and moves on. These errors don't affect your current session.

### macOS `/tmp` path mismatch

On macOS, `/tmp` is a symlink to `/private/tmp`. claude-recap handles this automatically by using `pwd -P` (POSIX physical path) everywhere. If you see path mismatches in custom scripts, ensure you're also resolving symlinks.

### Cold-read summary is empty

This can happen if the JSONL transcript is malformed or the headless Claude process fails. Check:
- The JSONL file exists at `~/.claude/projects/{project-id}/{session-id}.jsonl`
- Node.js is available (needed for `extract-topic.js`)
- The `claude` CLI is accessible from the shell
