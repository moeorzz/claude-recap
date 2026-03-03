# 高级用法

## 自定义存储位置

默认所有记忆数据存储在 `~/.memory/`。通过 `MEMORY_HOME` 环境变量覆盖：

```bash
export MEMORY_HOME="$HOME/my-agent-memory"
```

将此行添加到 shell 配置文件（`.zshrc`、`.bashrc`）使其永久生效。

## 开发模式（不使用插件系统）

用于本地开发或不使用插件系统的快速配置：

```bash
# 将 hooks 直接注册到项目的 settings.json
./scripts/dev-register.sh /path/to/your/project

# 取消注册
./scripts/dev-unregister.sh /path/to/your/project
```

这会在 `.claude/settings.json` 中写入直接指向源文件的 hook 条目。对脚本的修改立即生效 — 无需重新安装。

**与插件安装的区别：** 插件安装会将文件复制到缓存目录（`~/.claude/plugins/cache/`）。对源仓库的修改在执行 `/plugin marketplace update` 之前不会生效。开发模式直接指向源文件，编辑即时生效。

## 手动 Hook 注册

如果你想完全自主控制，直接在项目的 `.claude/settings.json` 中添加 hooks：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [{ "type": "command", "command": "/path/to/claude-recap/hooks/session-start.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "/path/to/claude-recap/hooks/stop.sh" }]
      }
    ]
  }
}
```

**注意：** 手动注册不会加载 Skills（`/remember`、`/save-topic`、`/list-topics`）。如需 Skills，使用插件系统或创建符号链接：

```bash
mkdir -p .claude/skills
ln -sf /path/to/claude-recap/skills/remember .claude/skills/remember
ln -sf /path/to/claude-recap/skills/save-topic .claude/skills/save-topic
ln -sf /path/to/claude-recap/skills/list-topics .claude/skills/list-topics
```

## 查看记忆数据

### 列出项目的所有话题

```bash
find ~/.memory/projects/-Users-you-my-app -name "*.md" -not -name "REMEMBER.md" | sort
```

### 读取特定话题摘要

```bash
cat ~/.memory/projects/-Users-you-my-app/{session-id}/01-setup-auth.md
```

### 查看全局偏好

```bash
cat ~/.memory/REMEMBER.md
```

### 查看项目级偏好

```bash
cat ~/.memory/projects/-Users-you-my-app/REMEMBER.md
```

### 查看 Session 当前话题

```bash
cat ~/.memory/projects/-Users-you-my-app/{session-id}/.current_topic
```

## 编辑记忆

记忆文件是纯 Markdown，可以直接编辑：

- **删除话题：** 删除对应的 `.md` 文件
- **编辑摘要：** 打开并修改话题 `.md` 文件
- **删除偏好：** 编辑 `REMEMBER.md` 删除对应行
- **重置项目记忆：** `rm -rf ~/.memory/projects/{project-id}`
- **重置所有记忆：** `rm -rf ~/.memory`

修改在下次 SessionStart 时生效（记忆会重新注入）。

## 运行测试

```bash
# 脚本级测试（快速，不需要 Claude CLI）
node tests/test-scripts.js

# E2E 测试（需要 Claude CLI，消耗 Token）
node tests/test-e2e.js

# 运行特定 E2E 测试
node tests/test-e2e.js --test "cold"

# 列出 E2E 测试但不运行
node tests/test-e2e.js --dry-run
```
