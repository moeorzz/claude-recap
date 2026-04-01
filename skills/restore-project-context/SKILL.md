---
name: restore-project-context
description: Use when the user wants one-step recovery of a previous work thread in the current project. Search relevant historical sessions first, fall back to topic handoffs if needed, ask for confirmation only when multiple plausible candidates exist, then restore context and inspect the current repo state.
---

# restore-project-context

## Overview

One-command recovery workflow for iterative development in the current project.

It does four things:

1. Search the most relevant past session(s)
2. If needed, fall back to topic-level handoffs
3. If multiple plausible matches exist, ask the user to pick one by number
4. Read the chosen handoff and inspect the real repo state before continuing

## When to Use

- User says "恢复现场", "接上次那个", "继续之前那次", "restore context", "continue that previous thread"
- User remembers a work direction, bug, feature, or module, but not the exact session/topic slug
- The goal is to resume productive work quickly, not just browse history

## Instructions

1. Get the **project memory directory** from the SessionStart injection:
   `Your persistent memory is stored at /path/to/.memory/projects/PROJECT_ID`

2. Get the **plugin scripts path** from the SessionStart injection:
   `Plugin scripts path: /path/to/scripts`

3. Distill the user's request into one concise search query.

4. Search sessions first:

```bash
node "<plugin_scripts_path>/search-project-sessions.js" "<project_memory_dir>" "<query>" --json --save "<project_memory_dir>/.restore-project-context-sessions.json"
```

5. Decide from session results:
   - If there is exactly **1 clear candidate**, use it directly
   - If there are **2 or more plausible candidates**, show the top 3 and ask the user to choose by number
   - Do NOT auto-pick when multiple plausible candidates exist

6. If session search returns nothing useful, search topics:

```bash
node "<plugin_scripts_path>/search-project-topics.js" "<project_memory_dir>" "<query>" --json --save "<project_memory_dir>/.restore-project-context-topics.json"
```

7. Decide from topic results:
   - If there is exactly **1 clear candidate**, use it directly
   - If there are **2 or more plausible candidates**, show the top 3 and ask the user to choose by number
   - Do NOT auto-pick when multiple plausible candidates exist

8. Once a session or topic is chosen:
   - If a handoff file path exists, read it:

```bash
cat "<handoff_file_path>"
```

   - Then inspect current repo state before continuing:

```bash
git branch --show-current
git status --short
git diff --stat
```

9. After that, summarize the restored context in 3 parts:
   - Chosen source: which session/topic was selected
   - Handoff state: latest known progress, open issues, resume point
   - Current repo state: branch, dirty files, whether the repo state seems aligned or has diverged

10. Then continue the user's requested work.

## Rules

- Prefer session-level recovery over topic-level recovery
- Ask the user to choose only when multiple plausible candidates exist
- If exactly one strong candidate exists, continue automatically
- Reading the handoff is not enough; always inspect the current repo state before coding
- Meta sessions/topics are already filtered by the search scripts; do not bring them back unless the user is explicitly asking about recap/history tooling

## Candidate Format

When asking the user to choose, use:

```text
Candidate Recoveries:
1. <session title or topic slug>
   Branch: <branch or n/a>
   Latest Handoff: <one-line summary>
2. <session title or topic slug>
   Branch: <branch or n/a>
   Latest Handoff: <one-line summary>
3. <session title or topic slug>
   Branch: <branch or n/a>
   Latest Handoff: <one-line summary>
```
