const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PLUGIN_DIR = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(PLUGIN_DIR, "scripts", "search-project-topics.js");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function createTempDir() {
  const id = crypto.randomBytes(4).toString("hex");
  const dir = path.join(os.tmpdir(), `recap-search-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJsonl(filePath, firstPrompt) {
  const entries = [
    {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: "<ide_opened_file>ignore me</ide_opened_file>" },
          { type: "text", text: firstPrompt },
        ],
      },
      timestamp: "2026-04-01T02:36:30.000Z",
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "› `sample-topic`\n\nWorking on it." }],
      },
      timestamp: "2026-04-01T02:36:40.000Z",
    },
    {
      type: "last-prompt",
      lastPrompt: firstPrompt,
      sessionId: path.basename(filePath, ".jsonl"),
    },
  ];

  fs.writeFileSync(filePath, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function writeTopic(filePath, slug, preview) {
  const content = [
    `# Topic: ${slug}`,
    "",
    "> 2026-04-01 10:36 — 2026-04-01 10:37",
    "",
    "## Status",
    preview,
    "",
    "## Next Steps",
    "- Continue if needed.",
    "",
  ].join("\n");

  fs.writeFileSync(filePath, content);
}

console.log("Test: search-project-topics.js");

(function run() {
  const tmpDir = createTempDir();

  try {
    const projectId = "c--pj-ADS";
    const memoryProjectDir = path.join(tmpDir, "memory", "projects", projectId);
    const claudeProjectsDir = path.join(tmpDir, "claude-projects");
    const reportPath = path.join(memoryProjectDir, ".search-project-topics-last.md");
    const session1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const session2 = "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee";

    fs.mkdirSync(path.join(memoryProjectDir, session1), { recursive: true });
    fs.mkdirSync(path.join(memoryProjectDir, session2), { recursive: true });
    fs.mkdirSync(claudeProjectsDir, { recursive: true });

    writeTopic(
      path.join(memoryProjectDir, session1, "01-web-architecture-analysis.md"),
      "web-architecture-analysis",
      "分析了 web 项目的技术架构，包含 router、state 和模块组织。"
    );
    writeTopic(
      path.join(memoryProjectDir, session2, "01-mobile-design-review.md"),
      "mobile-design-review",
      "评审了 mobile 原型的界面布局和交互表现。"
    );

    const metaSession = "11111111-bbbb-cccc-dddd-eeeeeeeeeeee";
    fs.mkdirSync(path.join(memoryProjectDir, metaSession), { recursive: true });
    writeTopic(
      path.join(memoryProjectDir, metaSession, "01-search-project-topics.md"),
      "search-project-topics",
      "使用 search-project-topics 检索历史 topic，并比较候选项。"
    );

    writeJsonl(
      path.join(claudeProjectsDir, `${session1}.jsonl`),
      "web的技术架构是怎么样的"
    );
    writeJsonl(
      path.join(claudeProjectsDir, `${session2}.jsonl`),
      "请评审 mobile 原型页面"
    );
    writeJsonl(
      path.join(claudeProjectsDir, `${metaSession}.jsonl`),
      "/search-project-topics web 架构"
    );

    const result = spawnSync(
      "node",
      [SCRIPT_PATH, memoryProjectDir, "web 架构 router state", "--json"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CLAUDE_PROJECTS_DIR: claudeProjectsDir,
        },
      }
    );

    assert(result.status === 0, "script exits successfully");

    const payload = JSON.parse(result.stdout);
    assert(Array.isArray(payload.results), "json output contains results");
    assert(payload.results.length >= 1, "at least one result returned");
    assert(
      payload.results[0].slug === "web-architecture-analysis",
      "web architecture topic ranks first"
    );
    assert(
      payload.results[0].sessionTitle.includes("web的技术架构"),
      "session title is extracted from JSONL"
    );
    assert(
      payload.results[0].topicPreview.includes("技术架构"),
      "topic preview is extracted from markdown summary"
    );
    assert(
      payload.results[0].filePath.endsWith("01-web-architecture-analysis.md"),
      "file path points to the matching topic file"
    );
    assert(
      payload.results.every((result) => result.slug !== "search-project-topics"),
      "meta topics are filtered by default"
    );

    const compactResult = spawnSync(
      "node",
      [
        SCRIPT_PATH,
        memoryProjectDir,
        "web 架构 router state",
        "--compact",
        "--save",
        reportPath,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CLAUDE_PROJECTS_DIR: claudeProjectsDir,
        },
      }
    );

    assert(compactResult.status === 0, "compact mode exits successfully");
    assert(compactResult.stdout.includes("Candidates:"), "compact mode prints candidate count");
    assert(compactResult.stdout.includes("Full Report:"), "compact mode prints saved report path");
    assert(fs.existsSync(reportPath), "compact mode saves full report");
    assert(
      fs.readFileSync(reportPath, "utf8").includes("Session Title: web的技术架构是怎么样的"),
      "saved report contains detailed session title"
    );

    const includeMetaResult = spawnSync(
      "node",
      [SCRIPT_PATH, memoryProjectDir, "search project topics", "--json", "--include-meta"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CLAUDE_PROJECTS_DIR: claudeProjectsDir,
        },
      }
    );

    assert(includeMetaResult.status === 0, "include-meta mode exits successfully");
    const includeMetaPayload = JSON.parse(includeMetaResult.stdout);
    assert(
      includeMetaPayload.results.some((result) => result.slug === "search-project-topics"),
      "include-meta mode returns meta topics"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
