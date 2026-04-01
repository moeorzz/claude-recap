---
name: search-project-sessions
description: Use when the user remembers a previous work direction or coding thread and wants to identify the most relevant historical session to resume from before reading topic handoffs.
---

# search-project-sessions

## Overview

Searches session-level history for the current project and returns ranked candidates with:

- session title
- session intro
- branch
- topics in that session
- latest handoff summary
- exact session id and handoff file path

Use this before topic-level recovery when the user remembers the work thread but not the exact topic slug.

## When to Use

- User remembers a previous debugging or implementation thread, but not the topic name
- User asks to continue "that previous session about ..."
- User wants session-level recovery before reading a topic handoff
- The workflow is iterative development on the same area across multiple sessions

## Instructions

1. Get the **project memory directory** from the SessionStart injection in your context:
   `Your persistent memory is stored at /path/to/.memory/projects/PROJECT_ID`

2. Distill the user's request into a concise search query:
   - Preserve their wording
   - Add short technical hints if useful
   - Keep it compact

3. Get the **plugin scripts path** from the SessionStart injection:
   `Plugin scripts path: /path/to/scripts`

4. Run:

```bash
node "<plugin_scripts_path>/search-project-sessions.js" "<project_memory_dir>" "<query>" --compact --save "<project_memory_dir>/.search-project-sessions-last.md"
```

5. Review the compact output and, when needed, read the saved full report at:

```bash
<project_memory_dir>/.search-project-sessions-last.md
```

6. Respond based on match quality:
   - If there is one clear best match, say which session is the best candidate and offer to read its latest handoff file before continuing
   - If there are 2-3 plausible matches, show the candidates and ask the user which one to continue
   - If there is no strong match, say so and report the nearest sessions returned by the script

7. If the user chooses a candidate and it has a `Handoff File`, read that file before continuing:

```bash
cat "<handoff_file_path>"
```

8. After reading the handoff, inspect the real repo state before coding. The handoff is not the source of truth.

## Rules

- Prefer this skill over `/search-project-topics` when the user remembers a session/thread rather than a specific topic
- Meta sessions are filtered by default; only include them if the user is explicitly asking about hooks/plugins/history tooling
- Always use exact full file paths when reading handoff files
- Session handoff is a navigation aid, not a replacement for checking the current codebase

## Output Format

```text
Candidate Sessions:
1. <session title>
   Branch: <branch>
   Topics: <topic list>
   Latest Topic: <slug>
   Latest Handoff: <one-line summary>
2. <session title>
   Branch: <branch>
   Topics: <topic list>
   Latest Topic: <slug>
   Latest Handoff: <one-line summary>
```
