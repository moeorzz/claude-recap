# Architecture

claude-recap uses two Claude Code hooks and a set of shell scripts to provide automatic, topic-based memory across sessions.

## Core Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Session Lifecycle                        │
│                                                             │
│  SessionStart hook                    Stop hook             │
│       │                                   │                 │
│       ▼                                   ▼                 │
│  1. Inject into context:           1. Extract topic tag     │
│     • REMEMBER.md (preferences)       from LLM response     │
│     • Topic history list           2. Compare with           │
│     • Topic Tag Rule                  .current_topic         │
│  2. Launch archive-pending                │                 │
│     in background                  ┌──────┴──────┐          │
│                                    │             │          │
│                               Same topic    Different       │
│                               → pass        → exit 2        │
│                                             → stderr:       │
│                                               bash command  │
│                                               + summary     │
│                                               template      │
│                                                  │          │
│                                                  ▼          │
│                                          LLM executes       │
│                                          set-topic.sh       │
│                                          → archives old     │
│                                            topic to .md     │
│                                          → updates          │
│                                            .current_topic   │
└─────────────────────────────────────────────────────────────┘
```

## Topic Tag System

Every LLM response begins with a topic tag:

```
› `fix-login-bug`

Here's how I'd approach the login issue...
```

The Stop hook extracts this tag and compares it with `.current_topic`. If the topic changed, the hook exits with code 2 and provides the LLM a complete bash command to archive the old topic and register the new one.

**Why exit code 2?** Claude Code treats exit 2 as "hook wants to inject a follow-up prompt." The stderr output becomes the LLM's next instruction — archive the old topic by running `set-topic.sh`.

## Compaction Recovery

When Claude Code compacts context (truncates older messages to save tokens), the LLM loses the full conversation history. Its summary would be inaccurate.

claude-recap detects this via a `.compacted` marker file:

```
Normal path:    LLM writes summary  → set-topic.sh saves it
Compacted path: .compacted exists   → set-topic.sh ignores LLM summary
                                    → extract-topic.js reads JSONL transcript
                                    → cold-summarize.sh (claude -p) generates
                                      accurate summary from full transcript
```

The cold-read path uses `claude -p` (headless Claude) as an independent process with full file system access.

## Delayed Archival (archive-pending)

Not every topic gets archived during the session (e.g., the last topic before exit). `archive-pending.sh` runs in the background at each SessionStart to catch these:

```
SessionStart
  → archive-pending.sh (background)
    → Scan all JSONL files for sessions with unarchived topics
    → For each unarchived topic:
      → extract-topic.js extracts conversation
      → cold-summarize.sh generates summary
      → Write topic .md file
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `hooks/session-start.sh` | Inject memory + launch archive-pending |
| `hooks/stop.sh` | Detect topic changes, trigger archival |
| `scripts/set-topic.sh` | Archive old topic, update .current_topic |
| `scripts/save-topic.sh` | Manual topic checkpoint (via /save-topic) |
| `scripts/extract-topic.js` | Extract conversation by topic from JSONL |
| `scripts/cold-summarize.sh` | Generate summary via headless Claude |
| `scripts/archive-pending.sh` | Background scan + archive unarchived topics |
| `scripts/remember.sh` | Write to REMEMBER.md (via /remember) |

## File System Layout

```
~/.memory/
  REMEMBER.md                          # Global preferences (/remember global)
  projects/
    {project-path-encoded}/            # e.g. -Users-you-my-app
      REMEMBER.md                      # Project preferences (/remember project)
      {session-uuid}/
        .current_topic                 # Active topic slug
        .compacted                     # Marker: context was compacted
        01-setup-auth.md               # Topic summary (numbered by order)
        02-fix-login-bug.md
```

**Path encoding:** The full project path is encoded by replacing `/` with `-`. This prevents cross-project contamination — each project has its own isolated memory namespace.

## Design Principles

1. **LLM only outputs text, scripts handle files.** The LLM writes topic tags and summaries. All file system operations (mkdir, write, archive) are done by shell scripts. This prevents hallucinated paths, partial writes, and permission issues.

2. **Eyewitness > Cold reader.** The main LLM has full conversation context — its summary is higher quality than reconstructing from JSONL after the fact. Cold-read is only a fallback for compacted sessions.

3. **Independent processes for privileged operations.** `~/.memory/` is outside the project directory. Shell scripts and `claude -p` run as independent processes with full file system access, bypassing Claude Code's project-scoped permission model.

4. **Zero shared state.** Each session has its own directory. No locks, no coordination, no race conditions.
