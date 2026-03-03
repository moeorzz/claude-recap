# Contributing to claude-recap

Thanks for your interest in contributing! This project is simple by design — shell scripts, a Node.js extractor, and Markdown files. Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/hatawong/claude-recap.git
cd claude-recap

# Register hooks for development (points to source, not plugin cache)
./scripts/dev-register.sh /path/to/your/test-project

# Unregister when done
./scripts/dev-unregister.sh /path/to/your/test-project
```

This writes hook entries into the test project's `.claude/settings.json` pointing directly at your source files. Changes take effect immediately — no reinstall needed.

## Running Tests

```bash
# Script-level tests (fast, no Claude CLI needed)
node tests/test-scripts.js
```

All tests must pass before submitting a PR.

## Project Structure

```
hooks/           # SessionStart + Stop hooks (entry points)
scripts/         # All file operations (set-topic, save-topic, etc.)
skills/          # Slash commands (/remember, /save-topic, /list-topics)
tests/           # Test suites
.claude-plugin/  # Plugin metadata
```

**Key principle:** LLM only outputs structured text and topic tags. All file operations are done by scripts.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `node tests/test-scripts.js` — all tests must pass
4. Submit a PR with a clear description of what changed and why

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Your OS and Claude Code version
- Relevant log output (if any)

## Code Style

- Shell scripts: `#!/usr/bin/env bash`, `set -euo pipefail`
- ShellCheck clean (no warnings)
- POSIX-compatible where possible (`pwd -P`, not platform-specific flags)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
