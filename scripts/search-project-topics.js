#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function printUsage() {
  process.stderr.write(
    "Usage: node search-project-topics.js <project-memory-dir> <query> [--limit N] [--json] [--compact] [--save FILE] [--include-meta]\n"
  );
}

function normalizeInputPath(inputPath) {
  if (!inputPath) return inputPath;
  if (process.platform === "win32" && /^\/[a-zA-Z]\//.test(inputPath)) {
    return `${inputPath[1].toUpperCase()}:${inputPath.slice(2)}`.replace(/\//g, "\\");
  }
  return inputPath;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTerms(query) {
  const tokens = query
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) || [];

  const terms = new Set();
  for (const token of tokens) {
    const cleaned = token.replace(/^[-_]+|[-_]+$/g, "");
    if (cleaned) terms.add(cleaned);
    for (const part of cleaned.split(/[-_]/)) {
      if (part) terms.add(part);
    }
  }

  const normalizedQuery = normalizeText(query);
  if (normalizedQuery && normalizedQuery.includes(" ")) {
    terms.add(normalizedQuery);
  }

  return [...terms];
}

function walkMarkdownFiles(rootDir) {
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name === "REMEMBER.md" || entry.name.startsWith(".")) continue;
      files.push(fullPath);
    }
  }

  walk(rootDir);
  return files;
}

function parseTopicFile(filePath, rawContent) {
  const lines = rawContent.split(/\r?\n/);
  let slug = path.basename(filePath, ".md");
  let timeRange = "";
  let currentSection = "";
  const sections = new Map();
  const bodyLines = [];

  for (const line of lines) {
    const topicMatch = line.match(/^# Topic:\s*(.+)$/);
    if (topicMatch) {
      slug = topicMatch[1].trim();
      continue;
    }

    const timeMatch = line.match(/^>\s*(.+)$/);
    if (timeMatch) {
      timeRange = timeMatch[1].trim();
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }

    bodyLines.push(line);
    if (!currentSection) continue;
    sections.get(currentSection).push(line);
  }

  function firstMeaningfulLine(linesToCheck) {
    for (const line of linesToCheck) {
      const cleaned = line.replace(/^[-*]\s+/, "").trim();
      if (cleaned) return cleaned;
    }
    return "";
  }

  const preview =
    firstMeaningfulLine(sections.get("Status") || []) ||
    firstMeaningfulLine(sections.get("Resume From") || []) ||
    firstMeaningfulLine(sections.get("Open Issues") || []) ||
    firstMeaningfulLine(sections.get("Decisions") || []) ||
    firstMeaningfulLine(sections.get("Validation") || []) ||
    firstMeaningfulLine(sections.get("Files Touched") || []) ||
    firstMeaningfulLine(bodyLines) ||
    slug;

  return {
    slug,
    timeRange,
    preview,
    resumeFrom: firstMeaningfulLine(sections.get("Resume From") || []),
    validation: firstMeaningfulLine(sections.get("Validation") || []),
    filesTouched: firstMeaningfulLine(sections.get("Files Touched") || []),
    openIssues: firstMeaningfulLine(sections.get("Open Issues") || []),
  };
}

function getTextBlocks(entry) {
  const content = entry?.message?.content;
  if (!content) return [];
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];

  return content
    .filter((item) => item.type === "text" && item.text)
    .map((item) => item.text);
}

function stripIdeTag(text) {
  return text.replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, " ").trim();
}

function shorten(value, limit) {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1).trim()}…`;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const META_TOPIC_EXACT = new Set([
  "list topics",
  "search project topics",
  "save topic",
  "remember",
  "ignore topic",
]);

const META_TOPIC_TOKENS = new Set([
  "hook",
  "hooks",
  "topic",
  "topics",
  "archival",
  "archive",
  "plugin",
  "plugins",
  "memory",
  "session",
  "sessions",
  "claude",
  "skill",
  "skills",
]);

function isMetaTopic(candidate) {
  const slugNorm = normalizeText(candidate.slug);
  if (META_TOPIC_EXACT.has(slugNorm)) return true;

  const slugTokens = slugNorm.split(" ").filter(Boolean);
  let metaTokenCount = 0;
  for (const token of slugTokens) {
    if (META_TOPIC_TOKENS.has(token)) metaTokenCount += 1;
  }
  if (metaTokenCount >= 2) return true;

  const sessionTitle = normalizeText(candidate.sessionTitle);
  if (/^(\/?\s*)?(list-topics|search-project-topics|save-topic|remember|ignore-topic)\b/.test(sessionTitle)) {
    return true;
  }

  return false;
}

function getClaudeProjectsDir(projectId) {
  const override = process.env.CLAUDE_PROJECTS_DIR;
  if (override) return normalizeInputPath(override);
  return path.join(os.homedir(), ".claude", "projects", projectId);
}

function buildSessionMetaLoader(projectId) {
  const cache = new Map();
  const claudeProjectsDir = getClaudeProjectsDir(projectId);

  return function getSessionMeta(sessionId) {
    if (cache.has(sessionId)) return cache.get(sessionId);

    const fallback = {
      sessionTitle: "",
      sessionIntro: "",
    };

    const jsonlPath = path.join(claudeProjectsDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) {
      cache.set(sessionId, fallback);
      return fallback;
    }

    let sessionTitle = "";
    let sessionIntro = "";
    let lastPrompt = "";

    const lines = fs.readFileSync(jsonlPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;

      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (entry.type === "last-prompt" && typeof entry.lastPrompt === "string") {
        lastPrompt = entry.lastPrompt.trim();
        continue;
      }

      if (entry.type !== "user") continue;

      const texts = getTextBlocks(entry)
        .map(stripIdeTag)
        .map((text) => text.trim())
        .filter(Boolean);

      if (texts.length === 0) continue;

      const combined = texts.join(" ");
      if (!sessionTitle) sessionTitle = shorten(combined, 60);
      if (!sessionIntro) sessionIntro = shorten(combined, 120);

      if (sessionTitle && sessionIntro) break;
    }

    if (!sessionTitle && lastPrompt) sessionTitle = shorten(lastPrompt, 60);
    if (!sessionIntro && lastPrompt) sessionIntro = shorten(lastPrompt, 120);

    const meta = { sessionTitle, sessionIntro };
    cache.set(sessionId, meta);
    return meta;
  };
}

function scoreCandidate(candidate, query, terms) {
  const reasons = [];
  let score = 0;

  const fileName = normalizeText(path.basename(candidate.filePath, ".md"));
  const slug = normalizeText(candidate.slug);
  const preview = normalizeText(candidate.preview);
  const resumeFrom = normalizeText(candidate.resumeFrom);
  const sessionTitle = normalizeText(candidate.sessionTitle);
  const queryNorm = normalizeText(query);

  if (queryNorm && fileName.includes(queryNorm)) {
    score += 90;
    reasons.push("filename phrase");
  }
  if (queryNorm && slug.includes(queryNorm)) {
    score += 80;
    reasons.push("topic phrase");
  }
  if (queryNorm && preview.includes(queryNorm)) {
    score += 45;
    reasons.push("summary phrase");
  }
  if (queryNorm && resumeFrom.includes(queryNorm)) {
    score += 40;
    reasons.push("resume phrase");
  }
  if (queryNorm && sessionTitle.includes(queryNorm)) {
    score += 35;
    reasons.push("session title phrase");
  }

  for (const term of terms) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;

    if (fileName.includes(termNorm)) {
      score += 35;
      reasons.push(`filename:${term}`);
    }
    if (slug.includes(termNorm)) {
      score += 30;
      reasons.push(`topic:${term}`);
    }
    if (preview.includes(termNorm)) {
      score += 18;
      reasons.push(`summary:${term}`);
    }
    if (resumeFrom.includes(termNorm)) {
      score += 16;
      reasons.push(`resume:${term}`);
    }
    if (sessionTitle.includes(termNorm)) {
      score += 12;
      reasons.push(`session:${term}`);
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const projectDir = normalizeInputPath(args[0]);
  let limit = 5;
  let jsonMode = false;
  let compactMode = false;
  let savePath = "";
  let includeMeta = false;
  const queryParts = [];

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit") {
      const next = Number.parseInt(args[i + 1], 10);
      if (!Number.isFinite(next) || next <= 0) {
        process.stderr.write("Invalid --limit value\n");
        process.exit(1);
      }
      limit = next;
      i += 1;
      continue;
    }
    if (arg === "--json") {
      jsonMode = true;
      continue;
    }
    if (arg === "--compact") {
      compactMode = true;
      continue;
    }
    if (arg === "--save") {
      const next = args[i + 1];
      if (!next) {
        process.stderr.write("Missing --save value\n");
        process.exit(1);
      }
      savePath = normalizeInputPath(next);
      i += 1;
      continue;
    }
    if (arg === "--include-meta") {
      includeMeta = true;
      continue;
    }
    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    process.stderr.write(`Project memory directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const projectId = path.basename(projectDir);
  const getSessionMeta = buildSessionMetaLoader(projectId);
  const files = walkMarkdownFiles(projectDir);
  const terms = buildTerms(query);

  const candidates = [];
  for (const filePath of files) {
    const rawContent = fs.readFileSync(filePath, "utf8");
    const { slug, timeRange, preview, resumeFrom, validation, filesTouched, openIssues } = parseTopicFile(filePath, rawContent);
    const sessionId = path.basename(path.dirname(filePath));
    const { sessionTitle, sessionIntro } = getSessionMeta(sessionId);

    const candidate = {
      slug,
      timeRange,
      preview,
      resumeFrom,
      validation,
      filesTouched,
      openIssues,
      sessionId,
      sessionTitle,
      sessionIntro,
      filePath,
      updatedAt: fs.statSync(filePath).mtimeMs,
    };

    if (!includeMeta && isMetaTopic(candidate)) continue;

    const { score, reasons } = scoreCandidate(candidate, query, terms);
    if (score <= 0) continue;

    candidates.push({
      ...candidate,
      score,
      reasons,
    });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return a.slug.localeCompare(b.slug);
  });

  const results = candidates.slice(0, limit).map((candidate, index) => ({
    rank: index + 1,
    slug: candidate.slug,
    sessionTitle: candidate.sessionTitle,
    sessionIntro: candidate.sessionIntro,
    topicPreview: candidate.preview,
    resumeFrom: candidate.resumeFrom,
    validation: candidate.validation,
    filesTouched: candidate.filesTouched,
    openIssues: candidate.openIssues,
    timeRange: candidate.timeRange,
    sessionId: candidate.sessionId,
    filePath: candidate.filePath,
    score: candidate.score,
    reasons: candidate.reasons,
  }));

  if (jsonMode) {
    const payload = JSON.stringify({ query, terms, results }, null, 2);
    if (savePath) {
      ensureParentDir(savePath);
      fs.writeFileSync(savePath, payload);
    }
    process.stdout.write(payload);
    return;
  }

  if (results.length === 0) {
    const noMatchText = `No archived topics matched: ${query}\n`;
    if (savePath) {
      ensureParentDir(savePath);
      fs.writeFileSync(savePath, noMatchText);
    }
    process.stdout.write(noMatchText);
    return;
  }

  const lines = [`Search Query: ${query}`, "", "Candidate Topics:"];
  for (const result of results) {
    lines.push(`${result.rank}. ${result.slug}`);
    if (result.sessionTitle) lines.push(`   Session Title: ${result.sessionTitle}`);
    if (result.sessionIntro && result.sessionIntro !== result.sessionTitle) {
      lines.push(`   Session Intro: ${result.sessionIntro}`);
    }
    if (result.topicPreview) lines.push(`   Topic Preview: ${result.topicPreview}`);
    if (result.resumeFrom) lines.push(`   Resume From: ${result.resumeFrom}`);
    if (result.validation) lines.push(`   Validation: ${result.validation}`);
    if (result.filesTouched) lines.push(`   Files Touched: ${result.filesTouched}`);
    if (result.openIssues) lines.push(`   Open Issues: ${result.openIssues}`);
    if (result.timeRange) lines.push(`   Time: ${result.timeRange}`);
    lines.push(`   Session: ${result.sessionId}`);
    if (result.reasons.length > 0) lines.push(`   Match: ${result.reasons.join(", ")}`);
    lines.push(`   File: ${result.filePath}`);
    lines.push("");
  }

  const fullText = lines.join("\n").trimEnd() + "\n";
  if (savePath) {
    ensureParentDir(savePath);
    fs.writeFileSync(savePath, fullText);
  }

  if (compactMode) {
    const compactLines = [`Search Query: ${query}`, `Candidates: ${results.length}`];
    if (savePath) compactLines.push(`Full Report: ${savePath}`);
    for (const result of results) {
      compactLines.push(
        `${result.rank}. ${shorten(result.slug, 32)} | ${shorten(result.sessionTitle || "(no title)", 36)} | ${shorten(result.resumeFrom || result.topicPreview || "", 56)} | ${shorten(result.timeRange || "", 32)}`
      );
    }
    process.stdout.write(compactLines.join("\n") + "\n");
    return;
  }

  process.stdout.write(fullText);
}

main();
