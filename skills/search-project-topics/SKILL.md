---
name: search-project-topics
description: Use when the user remembers only a direction, feature area, or rough keywords and wants to find relevant archived topics across sessions in the current project.
---

# search-project-topics

## Overview

Searches archived topic files in the current project's persistent memory and returns ranked candidates with:

- topic slug
- session title
- topic preview
- time range
- exact file path

Use this to identify the right historical context before continuing work in a new session.
Meta topics such as `/list-topics`, `/search-project-topics`, hook/debug archive sessions, and similar tooling conversations are filtered out by default.

## When to Use

- User remembers only a direction, business area, or vague phrase
- User says "find the previous discussion about ..."
- User wants to continue work from a past session but does not know the topic slug
- User needs cross-session recovery, not current-session `/list-topics`

## Instructions

1. Get the **project memory directory** from the SessionStart injection in your context:
   `Your persistent memory is stored at /path/to/.memory/projects/PROJECT_ID`

2. Distill the user's request into a **single search query string**:
   - Preserve the user's own words
   - Add short English technical hints if useful (for example: "web 架构 路由 状态管理 router state")
   - Keep it concise

3. Get the **plugin scripts path** from the SessionStart injection:
   `Plugin scripts path: /path/to/scripts`

4. Run the search script:

```bash
node "<plugin_scripts_path>/search-project-topics.js" "<project_memory_dir>" "<query>" --compact --save "<project_memory_dir>/.search-project-topics-last.md"
```

5. Review the ranked candidates:
   - The Bash output is intentionally compact for IDE readability.
   - The full report is saved to:

```bash
<project_memory_dir>/.search-project-topics-last.md
```

   - If there is **one clear best match**, read that file and continue from it:

```bash
cat "<full_topic_file_path>"
```

   - If there are **2-3 plausible matches**, present the candidates and ask the user which one to continue.
   - If there is **no strong match**, say so and report the nearest candidates returned by the script.

## Rules

- Do NOT use `/list-topics` for this task; it only searches the current session JSONL.
- Search the project's `.memory` archive, not the current session transcript.
- Do NOT use `/list-topics` for this task; it only searches the current session JSONL.
- Always use the exact full topic file path when reading files.
- Read at most 3 candidate files before asking the user to choose.
- Favor archived topic files (`01-*.md`, `02-*.md`, etc.) over `REMEMBER.md`.
- Prefer the saved full report when the Bash OUT pane is visually truncated in the IDE.
- Meta topics are filtered by default. Only include them if the user is explicitly asking about the recap/plugin/hook system itself.

## Output Format

When showing candidates, use:

```text
Candidate Topics:
1. <topic-slug>
   Session Title: <session title>
   Topic Preview: <summary snippet>
   Time: <time range>
2. <topic-slug>
   Session Title: <session title>
   Topic Preview: <summary snippet>
   Time: <time range>
```
