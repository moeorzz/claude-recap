#!/usr/bin/env bash
# session-end.sh — SessionEnd hook: queue archival work when the session closes.
#
# Claude Code gives SessionEnd hooks a short global timeout, so this hook must
# return quickly. Instead of summarizing inline, it starts archive-pending.sh in
# the background. The background worker reuses the existing cold-read pipeline.

set -euo pipefail

INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')

if [ -z "$CWD" ] || [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Normalize Windows paths to match Claude Code's project ID format
# c:\pj\ADS or c:/pj/ADS → c--pj-ADS (colon→dash, slash→dash, no leading dash)
PROJECT_ID=$(echo "$CWD" | sed 's_\\_/_g; s_:_-_; s_/_-_g')

MEMORY_ROOT="${MEMORY_HOME:-$HOME/.memory}"
PROJECT_DIR="$MEMORY_ROOT/projects/$PROJECT_ID"
SESSION_DIR="$PROJECT_DIR/$SESSION_ID"
TOPIC_FILE="$SESSION_DIR/.current_topic"

# No tracked topic in this session — nothing to queue.
if [ ! -f "$TOPIC_FILE" ]; then
  exit 0
fi

CURRENT_SLUG=$(cat "$TOPIC_FILE")
if [ -z "$CURRENT_SLUG" ] || [ "$CURRENT_SLUG" = "none" ]; then
  exit 0
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ARCHIVE_PENDING="$PLUGIN_ROOT/scripts/archive-pending.sh"
JSONL_PATH="$HOME/.claude/projects/$PROJECT_ID/${SESSION_ID}.jsonl"

if [ ! -f "$ARCHIVE_PENDING" ] || [ ! -f "$JSONL_PATH" ]; then
  exit 0
fi

# Load .ignore matching
source "$PLUGIN_ROOT/scripts/ignore-topic-utils.sh"
if topic_is_ignored "$CURRENT_SLUG" "$MEMORY_ROOT" "$PROJECT_DIR"; then
  exit 0
fi

# Touch a marker so the current session sorts to the front on the next scan.
mkdir -p "$SESSION_DIR"
MARKER_FILE="$SESSION_DIR/.session-end-pending"
date +"%Y-%m-%dT%H:%M:%S%z" > "$MARKER_FILE"

LOG_FILE="$SESSION_DIR/.session-end-archive.log"

start_background_archive() {
  if command -v nohup >/dev/null 2>&1; then
    nohup bash "$ARCHIVE_PENDING" "$PROJECT_DIR" "__session_end__" "$PLUGIN_ROOT" \
      >>"$LOG_FILE" 2>&1 < /dev/null &
  else
    bash "$ARCHIVE_PENDING" "$PROJECT_DIR" "__session_end__" "$PLUGIN_ROOT" \
      >>"$LOG_FILE" 2>&1 < /dev/null &
    disown 2>/dev/null || true
  fi
}

start_background_archive || true
echo "SessionEnd queued archival for $SESSION_ID ($CURRENT_SLUG)" >&2
