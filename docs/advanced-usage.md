# Advanced Usage

## Custom Storage Location

By default, all memory data is stored in `~/.memory/`. Override this with the `MEMORY_HOME` environment variable:

```bash
export MEMORY_HOME="$HOME/my-agent-memory"
```

Add this to your shell profile (`.zshrc`, `.bashrc`) to make it permanent.

## Development Mode (without plugin system)

For local development or quick setup without the plugin system:

```bash
# Register hooks directly in a project's settings.json
./scripts/dev-register.sh /path/to/your/project

# Unregister
./scripts/dev-unregister.sh /path/to/your/project
```

This writes hook entries into `.claude/settings.json` pointing directly at the source files. Changes to scripts take effect immediately — no reinstall needed.

**Difference from plugin install:** Plugin install copies files to a cache directory (`~/.claude/plugins/cache/`). Changes to the source repo don't take effect until you run `/plugin marketplace update`. Dev mode points directly at the source, so edits are live.

## Manual Hook Registration

If you prefer full control, add hooks directly to your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [{ "type": "command", "command": "/path/to/claude-recap/hooks/session-start.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "/path/to/claude-recap/hooks/stop.sh" }]
      }
    ]
  }
}
```

**Note:** Manual registration doesn't load Skills (`/remember`, `/save-topic`, `/list-topics`). For Skills, either use the plugin system or create symlinks:

```bash
mkdir -p .claude/skills
ln -sf /path/to/claude-recap/skills/remember .claude/skills/remember
ln -sf /path/to/claude-recap/skills/save-topic .claude/skills/save-topic
ln -sf /path/to/claude-recap/skills/list-topics .claude/skills/list-topics
```

## Inspecting Memory Data

### List all topics for a project

```bash
find ~/.memory/projects/-Users-you-my-app -name "*.md" -not -name "REMEMBER.md" | sort
```

### Read a specific topic summary

```bash
cat ~/.memory/projects/-Users-you-my-app/{session-id}/01-setup-auth.md
```

### See what the agent remembers globally

```bash
cat ~/.memory/REMEMBER.md
```

### See project-specific preferences

```bash
cat ~/.memory/projects/-Users-you-my-app/REMEMBER.md
```

### Check current topic for a session

```bash
cat ~/.memory/projects/-Users-you-my-app/{session-id}/.current_topic
```

## Editing Memory

Memory files are plain Markdown. You can edit them directly:

- **Delete a topic:** Remove the `.md` file
- **Edit a summary:** Open and modify the topic `.md` file
- **Remove a preference:** Edit `REMEMBER.md` and delete the line
- **Reset all memory for a project:** `rm -rf ~/.memory/projects/{project-id}`
- **Reset all memory:** `rm -rf ~/.memory`

Changes take effect on the next SessionStart (when memory is re-injected).

## Running Tests

```bash
# Script-level tests (fast, no Claude CLI needed)
node tests/test-scripts.js

# E2E tests (requires Claude CLI, costs tokens)
node tests/test-e2e.js

# Run a specific E2E test
node tests/test-e2e.js --test "cold"

# List E2E tests without running
node tests/test-e2e.js --dry-run
```
