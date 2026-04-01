const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PLUGIN_DIR = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(PLUGIN_DIR, "scripts", "search-project-sessions.js");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function createTempDir() {
  const id = crypto.randomBytes(4).toString("hex");
  const dir = path.join(os.tmpdir(), `recap-session-search-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJsonl(filePath, options) {
  const entries = [
    {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: options.firstPrompt },
        ],
      },
      timestamp: options.timestamp || "2026-04-01T02:36:30.000Z",
      cwd: options.cwd || "c:\\pj\\ADS",
      gitBranch: options.gitBranch || "feature/demo",
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: `› \`${options.slug || "sample-topic"}\`\n\nWorking on it.` }],
      },
      timestamp: "2026-04-01T02:36:40.000Z",
      cwd: options.cwd || "c:\\pj\\ADS",
      gitBranch: options.gitBranch || "feature/demo",
    },
    {
      type: "last-prompt",
      lastPrompt: options.firstPrompt,
      sessionId: path.basename(filePath, ".jsonl"),
    },
  ];

  if (options.customTitle) {
    entries.push({
      type: "custom-title",
      customTitle: options.customTitle,
    });
  }

  fs.writeFileSync(filePath, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function writeTopic(filePath, slug, status, resumeFrom) {
  const content = [
    `# Topic: ${slug}`,
    "",
    "> 2026-04-01 10:36 — 2026-04-01 10:37",
    "",
    "## Status",
    status,
    "",
    "## Resume From",
    resumeFrom,
    "",
  ].join("\n");
  fs.writeFileSync(filePath, content);
}

console.log("Test: search-project-sessions.js");

(function run() {
  const tmpDir = createTempDir();
  try {
    const projectId = "c--pj-ADS";
    const memoryProjectDir = path.join(tmpDir, "memory", "projects", projectId);
    const claudeProjectsDir = path.join(tmpDir, "claude-projects");
    const reportPath = path.join(memoryProjectDir, ".search-project-sessions-last.md");

    const session1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const session2 = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee";
    const metaSession = "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee";

    fs.mkdirSync(path.join(memoryProjectDir, session1), { recursive: true });
    fs.mkdirSync(path.join(memoryProjectDir, session2), { recursive: true });
    fs.mkdirSync(path.join(memoryProjectDir, metaSession), { recursive: true });
    fs.mkdirSync(claudeProjectsDir, { recursive: true });

    writeJsonl(path.join(claudeProjectsDir, `${session1}.jsonl`), {
      firstPrompt: "修 report preview 的导出问题",
      customTitle: "report preview export fix",
      gitBranch: "feature/report-preview",
      slug: "report-preview-fix",
    });
    writeJsonl(path.join(claudeProjectsDir, `${session2}.jsonl`), {
      firstPrompt: "分析 web 架构和权限路由",
      gitBranch: "master",
      slug: "web-architecture-analysis",
    });
    writeJsonl(path.join(claudeProjectsDir, `${metaSession}.jsonl`), {
      firstPrompt: "/search-project-sessions report preview",
      gitBranch: "master",
      slug: "search-project-sessions",
    });

    writeTopic(
      path.join(memoryProjectDir, session1, "01-report-preview-fix.md"),
      "report-preview-fix",
      "定位并修正了 report preview 导出问题，已调整导出入口。",
      "检查当前 diff 和导出测试，再确认 preview 页面行为。"
    );
    writeTopic(
      path.join(memoryProjectDir, session2, "01-web-architecture-analysis.md"),
      "web-architecture-analysis",
      "分析了 web 架构和权限路由。",
      "继续查看 router 和 access-guard 的实现。"
    );
    writeTopic(
      path.join(memoryProjectDir, metaSession, "01-search-project-sessions.md"),
      "search-project-sessions",
      "使用 search-project-sessions 检索历史会话。",
      "继续调试检索脚本。"
    );

    const jsonResult = spawnSync(
      "node",
      [SCRIPT_PATH, memoryProjectDir, "report preview export", "--json"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CLAUDE_PROJECTS_DIR: claudeProjectsDir,
        },
      }
    );

    assert(jsonResult.status === 0, "script exits successfully");
    const payload = JSON.parse(jsonResult.stdout);
    assert(payload.results.length >= 1, "returns at least one session");
    assert(payload.results[0].sessionTitle.includes("report preview"), "best match is the report preview session");
    assert(payload.results[0].gitBranch === "feature/report-preview", "branch is preserved");
    assert(payload.results[0].latestTopic === "report-preview-fix", "latest topic is returned");
    assert(payload.results[0].latestHandoffPath.endsWith("01-report-preview-fix.md"), "latest handoff path is returned");
    assert(
      payload.results.every((result) => result.latestTopic !== "search-project-sessions"),
      "meta sessions are filtered by default"
    );

    const compactResult = spawnSync(
      "node",
      [
        SCRIPT_PATH,
        memoryProjectDir,
        "report preview export",
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
    assert(fs.existsSync(reportPath), "compact mode saves a report");
    assert(
      fs.readFileSync(reportPath, "utf8").includes("Latest Topic: report-preview-fix"),
      "saved report includes latest topic"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
