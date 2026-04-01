#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function usage() {
  process.stderr.write(
    "Usage: node search-project-sessions.js <project-memory-dir> <query> [--limit N] [--json] [--compact] [--save FILE] [--include-meta]\n"
  );
}

function normalizeInputPath(inputPath) {
  if (!inputPath) return inputPath;
  if (process.platform === "win32" && /^\/[a-zA-Z]\//.test(inputPath)) {
    return `${inputPath[1].toUpperCase()}:${inputPath.slice(2)}`.replace(/\//g, "\\");
  }
  return inputPath;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value, limit) {
  if (!value) return "";
  const compact = String(value).replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1).trim()}…`;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const META_TOPIC_EXACT = new Set([
  "list topics",
  "search project topics",
  "search project sessions",
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
  "search",
  "resume",
]);

function isMetaText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (META_TOPIC_EXACT.has(normalized)) return true;
  const tokens = normalized.split(" ").filter(Boolean);
  let metaCount = 0;
  for (const token of tokens) {
    if (META_TOPIC_TOKENS.has(token)) metaCount += 1;
  }
  return metaCount >= 2;
}

function isMetaSession(sessionInfo) {
  const title = normalizeText(sessionInfo.sessionTitle);
  if (/^(\/?\s*)?(list-topics|search-project-topics|search-project-sessions|save-topic|remember|ignore-topic)\b/.test(title)) {
    return true;
  }

  const topics = sessionInfo.topics || [];
  if (topics.length > 0 && topics.every((topic) => isMetaText(topic))) {
    return true;
  }

  return false;
}

function getClaudeProjectsDir(projectId) {
  const override = process.env.CLAUDE_PROJECTS_DIR;
  if (override) return normalizeInputPath(override);
  return path.join(os.homedir(), ".claude", "projects", projectId);
}

function readTail(filePath, bytes) {
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - bytes);
    const length = Math.min(bytes, stat.size);
    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function stripTags(text) {
  return String(text || "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTextBlocks(content) {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter((item) => item && typeof item === "object" && item.type === "text" && typeof item.text === "string")
    .map((item) => item.text);
}

function extractCustomTitle(filePath) {
  const tail = readTail(filePath, 2 * 1024 * 1024);
  let title = "";
  for (const line of tail.split(/\r?\n/)) {
    if (!line.includes("custom-title")) continue;
    try {
      const data = JSON.parse(line);
      if (data.type === "custom-title" && typeof data.customTitle === "string") {
        title = data.customTitle.trim();
      }
    } catch {
      // ignore malformed lines
    }
  }
  return title;
}

function readTopicFileMeta(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  let slug = path.basename(filePath, ".md");
  let timeRange = "";
  let currentSection = "";
  const sections = new Map();

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
    if (!currentSection) continue;
    sections.get(currentSection).push(line);
  }

  function firstMeaningful(sectionName) {
    const linesToCheck = sections.get(sectionName) || [];
    for (const line of linesToCheck) {
      const cleaned = line.replace(/^[-*]\s+/, "").trim();
      if (cleaned) return cleaned;
    }
    return "";
  }

  return {
    slug,
    timeRange,
    preview:
      firstMeaningful("Status") ||
      firstMeaningful("Resume From") ||
      firstMeaningful("Open Issues") ||
      firstMeaningful("Decisions") ||
      firstMeaningful("Next Steps") ||
      slug,
    handoffPath: filePath,
  };
}

function parseSessionJsonl(filePath) {
  const sessionId = path.basename(filePath, ".jsonl");
  const stat = fs.statSync(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).slice(0, 120);

  let cwd = "";
  let gitBranch = "";
  let timestamp = "";
  let sessionTitle = "";
  const userMsgs = [];
  let lastPrompt = "";

  for (const line of lines) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (!cwd && typeof entry.cwd === "string") cwd = entry.cwd;
    if (!gitBranch && typeof entry.gitBranch === "string") gitBranch = entry.gitBranch;
    if (!timestamp && typeof entry.timestamp === "string") timestamp = entry.timestamp;

    if (entry.type === "last-prompt" && typeof entry.lastPrompt === "string") {
      lastPrompt = stripTags(entry.lastPrompt);
      continue;
    }

    if (entry.type !== "user") continue;
    const texts = getTextBlocks(entry.message?.content).map(stripTags).filter(Boolean);
    if (texts.length === 0) continue;

    const combined = texts.join(" ").trim();
    if (!combined) continue;
    if (!sessionTitle) sessionTitle = shorten(combined, 80);
    if (userMsgs.length < 5) userMsgs.push(shorten(combined, 140));
  }

  const customTitle = extractCustomTitle(filePath);
  if (customTitle) sessionTitle = shorten(customTitle, 80);
  if (!sessionTitle && lastPrompt) sessionTitle = shorten(lastPrompt, 80);
  if (!timestamp) timestamp = new Date(stat.mtimeMs).toISOString();

  return {
    sessionId,
    jsonlPath: filePath,
    cwd,
    gitBranch,
    timestamp,
    mtimeMs: stat.mtimeMs,
    sessionTitle,
    userMsgs,
  };
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
  if (normalizedQuery && normalizedQuery.includes(" ")) terms.add(normalizedQuery);
  return [...terms];
}

function scoreSession(sessionInfo, query, terms) {
  const reasons = [];
  let score = 0;

  const title = normalizeText(sessionInfo.sessionTitle);
  const intro = normalizeText(sessionInfo.sessionIntro);
  const branch = normalizeText(sessionInfo.gitBranch);
  const topics = normalizeText((sessionInfo.topics || []).join(" "));
  const preview = normalizeText(sessionInfo.latestTopicPreview);
  const queryNorm = normalizeText(query);

  if (queryNorm && title.includes(queryNorm)) {
    score += 90;
    reasons.push("session title phrase");
  }
  if (queryNorm && intro.includes(queryNorm)) {
    score += 55;
    reasons.push("session intro phrase");
  }
  if (queryNorm && topics.includes(queryNorm)) {
    score += 65;
    reasons.push("topic phrase");
  }
  if (queryNorm && preview.includes(queryNorm)) {
    score += 45;
    reasons.push("handoff phrase");
  }

  for (const term of terms) {
    const termNorm = normalizeText(term);
    if (!termNorm) continue;
    if (title.includes(termNorm)) {
      score += 28;
      reasons.push(`title:${term}`);
    }
    if (intro.includes(termNorm)) {
      score += 16;
      reasons.push(`intro:${term}`);
    }
    if (topics.includes(termNorm)) {
      score += 22;
      reasons.push(`topic:${term}`);
    }
    if (preview.includes(termNorm)) {
      score += 14;
      reasons.push(`handoff:${term}`);
    }
    if (branch.includes(termNorm)) {
      score += 8;
      reasons.push(`branch:${term}`);
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
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
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    process.stderr.write(`Project memory directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const projectId = path.basename(projectDir);
  const claudeProjectsDir = getClaudeProjectsDir(projectId);
  if (!fs.existsSync(claudeProjectsDir) || !fs.statSync(claudeProjectsDir).isDirectory()) {
    process.stderr.write(`Claude projects directory not found: ${claudeProjectsDir}\n`);
    process.exit(1);
  }

  const jsonlFiles = fs
    .readdirSync(claudeProjectsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => path.join(claudeProjectsDir, entry.name));

  const terms = buildTerms(query);
  const sessions = [];

  for (const jsonlPath of jsonlFiles) {
    let info;
    try {
      info = parseSessionJsonl(jsonlPath);
    } catch {
      continue;
    }

    const sessionMemoryDir = path.join(projectDir, info.sessionId);
    let topicFiles = [];
    if (fs.existsSync(sessionMemoryDir) && fs.statSync(sessionMemoryDir).isDirectory()) {
      topicFiles = fs
        .readdirSync(sessionMemoryDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "REMEMBER.md" && !entry.name.startsWith("."))
        .map((entry) => path.join(sessionMemoryDir, entry.name))
        .sort();
    }

    const topicMetas = topicFiles.map(readTopicFileMeta);
    const latestTopic = topicMetas[topicMetas.length - 1] || null;
    const sessionInfo = {
      ...info,
      sessionIntro: info.userMsgs.join(" / "),
      topics: topicMetas.map((meta) => meta.slug),
      latestTopic: latestTopic?.slug || "",
      latestTopicPreview: latestTopic?.preview || "",
      latestTopicTime: latestTopic?.timeRange || "",
      latestHandoffPath: latestTopic?.handoffPath || "",
    };

    if (!includeMeta && isMetaSession(sessionInfo)) continue;

    const { score, reasons } = scoreSession(sessionInfo, query, terms);
    if (score <= 0) continue;

    sessions.push({
      ...sessionInfo,
      score,
      reasons,
    });
  }

  sessions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.mtimeMs - a.mtimeMs;
  });

  const results = sessions.slice(0, limit).map((session, index) => ({
    rank: index + 1,
    sessionTitle: session.sessionTitle,
    sessionIntro: session.sessionIntro,
    time: session.timestamp,
    gitBranch: session.gitBranch,
    topics: session.topics,
    latestTopic: session.latestTopic,
    latestTopicPreview: session.latestTopicPreview,
    latestTopicTime: session.latestTopicTime,
    latestHandoffPath: session.latestHandoffPath,
    sessionId: session.sessionId,
    jsonlPath: session.jsonlPath,
    cwd: session.cwd,
    score: session.score,
    reasons: session.reasons,
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
    const noMatchText = `No project sessions matched: ${query}\n`;
    if (savePath) {
      ensureParentDir(savePath);
      fs.writeFileSync(savePath, noMatchText);
    }
    process.stdout.write(noMatchText);
    return;
  }

  const lines = [`Search Query: ${query}`, "", "Candidate Sessions:"];
  for (const result of results) {
    lines.push(`${result.rank}. ${result.sessionTitle || result.sessionId}`);
    if (result.sessionIntro && result.sessionIntro !== result.sessionTitle) {
      lines.push(`   Session Intro: ${result.sessionIntro}`);
    }
    if (result.gitBranch) lines.push(`   Branch: ${result.gitBranch}`);
    if (result.topics.length > 0) lines.push(`   Topics: ${result.topics.join(", ")}`);
    if (result.latestTopic) lines.push(`   Latest Topic: ${result.latestTopic}`);
    if (result.latestTopicPreview) lines.push(`   Latest Handoff: ${result.latestTopicPreview}`);
    if (result.latestTopicTime) lines.push(`   Handoff Time: ${result.latestTopicTime}`);
    lines.push(`   Session: ${result.sessionId}`);
    if (result.reasons.length > 0) lines.push(`   Match: ${result.reasons.join(", ")}`);
    if (result.latestHandoffPath) lines.push(`   Handoff File: ${result.latestHandoffPath}`);
    lines.push(`   JSONL: ${result.jsonlPath}`);
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
        `${result.rank}. ${shorten(result.sessionTitle || result.sessionId, 34)} | ${shorten(result.latestTopic || "(no topic)", 28)} | ${shorten(result.latestTopicPreview || result.sessionIntro || "", 56)}`
      );
    }
    process.stdout.write(compactLines.join("\n") + "\n");
    return;
  }

  process.stdout.write(fullText);
}

main();
