#!/usr/bin/env node
// extract-topic.js — Extract conversation for a specific topic from a JSONL session file.
//
// Usage: node extract-topic.js <jsonl-path> <topic-slug>
//
// Reads the JSONL line by line, tracks topic boundaries via `› \`slug\`` tags
// in assistant messages, and outputs clean markdown for the target topic.
//
// If topic-slug is omitted or empty, extracts the LAST topic found.
// If topic-slug is "__all__", lists all topic slugs found (one per line).

"use strict";

const fs = require("fs");
const readline = require("readline");

const jsonlPath = process.argv[2];
const targetSlug = process.argv[3] || "";

if (!jsonlPath) {
  process.stderr.write("Usage: node extract-topic.js <jsonl-path> [topic-slug]\n");
  process.exit(1);
}

if (!fs.existsSync(jsonlPath)) {
  process.stderr.write(`File not found: ${jsonlPath}\n`);
  process.exit(1);
}

// Topic tag regex: › `slug` at the start of text (possibly after whitespace/newlines)
const TOPIC_TAG_RE = /^\s*›\s*`([^`]+)`/;

function extractTopicTag(textBlocks) {
  for (const text of textBlocks) {
    const match = text.match(TOPIC_TAG_RE);
    if (match) return match[1];
  }
  return null;
}

function getTextBlocks(entry) {
  const content = entry.message?.content;
  if (!content) return [];
  if (typeof content === "string") return [content];
  if (Array.isArray(content)) {
    return content.filter(c => c.type === "text" && c.text).map(c => c.text);
  }
  return [];
}

function stripTopicTag(text) {
  return text.replace(/^\s*›\s*`[^`]+`\s*\n?/, "");
}

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  // Collect messages grouped by topic
  // Each topic segment: { slug, messages: [{role, texts}], startTime, endTime }
  //
  // Lookahead strategy: user messages are not immediately assigned to a segment.
  // They are held in pendingMessages until the next assistant message arrives,
  // whose topic tag determines which segment the pending messages belong to.
  // This fixes the one-turn lag where user messages that initiate a topic switch
  // would be incorrectly assigned to the previous topic.
  let currentSlug = "__untagged__";
  const segments = new Map(); // slug -> { messages: [{role, texts}], startTime, endTime }
  let pendingMessages = []; // [{role, texts, ts}] — user messages awaiting classification

  function flushPending(slug) {
    if (pendingMessages.length === 0) return;
    if (!segments.has(slug)) {
      segments.set(slug, { messages: [], startTime: null, endTime: null });
    }
    const seg = segments.get(slug);
    for (const pm of pendingMessages) {
      if (pm.ts && !seg.startTime) seg.startTime = pm.ts;
      if (pm.ts) seg.endTime = pm.ts;
      seg.messages.push({ role: pm.role, texts: pm.texts });
    }
    pendingMessages = [];
  }

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const type = entry.type;
    if (type !== "user" && type !== "assistant") continue;

    const textBlocks = getTextBlocks(entry);
    if (textBlocks.length === 0) continue;

    const ts = entry.timestamp || null;

    // User messages with text: hold in pending for lookahead classification
    if (type === "user") {
      pendingMessages.push({ role: type, texts: textBlocks, ts });
      continue;
    }

    // Assistant message: check for topic tag, then flush pending + add self
    if (type === "assistant") {
      const tag = extractTopicTag(textBlocks);
      if (tag) currentSlug = tag;

      // Flush pending user messages into the (possibly updated) currentSlug
      flushPending(currentSlug);

      if (!segments.has(currentSlug)) {
        segments.set(currentSlug, { messages: [], startTime: null, endTime: null });
      }

      const seg = segments.get(currentSlug);
      if (ts && !seg.startTime) seg.startTime = ts;
      if (ts) seg.endTime = ts;

      seg.messages.push({
        role: type,
        texts: textBlocks,
      });
    }
  }

  // Flush any remaining pending messages (e.g., user messages at end of session)
  flushPending(currentSlug);

  // Mode: list all topics
  if (targetSlug === "__all__") {
    for (const slug of segments.keys()) {
      process.stdout.write(slug + "\n");
    }
    return;
  }

  // Determine which slug to extract
  let slug = targetSlug;
  if (!slug) {
    // Extract the last topic (last key in insertion order)
    const keys = [...segments.keys()];
    slug = keys[keys.length - 1];
  }

  const seg = segments.get(slug);
  if (!seg || seg.messages.length === 0) {
    process.stderr.write(`No messages found for topic: ${slug}\n`);
    process.exit(2);
  }

  // Format timestamp to local YYYY-MM-DD HH:MM
  function formatTimestamp(isoStr) {
    if (!isoStr) return "unknown";
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Output clean markdown with metadata header
  const output = [];
  output.push(`<!-- topic_start: ${formatTimestamp(seg.startTime)} -->`);
  output.push(`<!-- topic_end: ${formatTimestamp(seg.endTime)} -->`);
  output.push("");

  for (const msg of seg.messages) {
    const heading = msg.role === "user" ? "【U】" : "【A】";
    output.push(heading);
    for (let text of msg.texts) {
      if (msg.role === "assistant") {
        text = stripTopicTag(text);
      }
      text = text.trim();
      if (text) output.push(text);
    }
    output.push("");
  }

  process.stdout.write(output.join("\n"));
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
