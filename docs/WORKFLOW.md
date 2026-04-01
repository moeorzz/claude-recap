# Claude-Recap 工作流指南

本文档详细说明 claude-recap 的 6 个核心功能及其集成使用方法。

## 目录

- [功能概览](#功能概览)
- [搜索与恢复功能](#搜索与恢复功能)
- [话题管理功能](#话题管理功能)
- [集成使用工作流](#集成使用工作流)
- [最佳实践](#最佳实践)

---

## 功能概览

| 功能 | 类型 | 作用 | 使用场景 |
|------|------|------|----------|
| `/search-project-topics` | 搜索 | 搜索话题摘要 | 记得关键词，快速查找 |
| `/search-project-sessions` | 搜索 | 搜索完整对话 | 记得具体内容，深入查看 |
| `/restore-project-context` | 恢复 | 恢复工作上下文 | 直接继续之前的工作 |
| `/save-topic` | 管理 | 保存检查点 | 长时间工作，保存进度 |
| `/list-topics` | 管理 | 查看当前话题 | 回顾今天的工作 |
| `/ignore-topic` | 管理 | 排除话题归档 | 调试、测试话题不归档 |

---

## 搜索与恢复功能

### 1. `/search-project-topics "关键词"`

**作用：** 在已归档的话题摘要中搜索关键词

**搜索范围：**
- 只搜索话题的摘要文件（如 `01-setup-auth.md`）
- 搜索所有历史 Session 的话题
- 返回匹配的话题列表和摘要片段

**适用场景：**
- 你记得讨论过某个主题，但不记得具体哪次 Session
- 想快速找到某个功能/bug 的讨论记录
- 需要回顾某个技术决策的背景

**示例：**
```bash
你：/search-project-topics "认证 bug"

Claude 返回：
找到 3 个相关话题：
1. Session abc123 / 02-fix-auth-timeout (2024-03-15)
   摘要：修复认证超时问题，将 token 过期时间从 1 小时改为 24 小时...

2. Session def456 / 01-oauth-integration (2024-03-10)
   摘要：集成 OAuth 2.0 认证流程，遇到 redirect_uri 不匹配的 bug...
```

### 2. `/search-project-sessions "关键词"`

**作用：** 搜索完整的 Session 对话记录（从 JSONL 文件）

**搜索范围：**
- 搜索原始对话内容（用户消息 + Claude 回复）
- 不仅是摘要，而是完整的对话细节
- 可以找到代码片段、具体讨论过程

**适用场景：**
- 你记得讨论的具体内容或代码细节
- 需要找到某个具体的实现方案
- 想看完整的讨论过程，不只是摘要

**示例：**
```bash
你：/search-project-sessions "重构"

Claude 返回：
找到 2 个相关 Session：
1. Session abc123 (2024-03-15, 3 个话题)
   匹配内容：
   【U】我们需要重构 UserService，现在的代码太乱了
   【A】好的，我建议按照以下步骤重构：1. 提取接口...

2. Session xyz789 (2024-03-12, 2 个话题)
   匹配内容：
   【U】路由重构完成了吗？
   【A】是的，已经将所有路由从 app.js 移到了 routes/ 目录...
```

### 3. `/restore-project-context`

**作用：** 智能恢复之前的工作上下文 + 检查当前仓库状态

**工作流程：**
1. 根据你的描述搜索相关 Session/话题
2. 读取相关的话题摘要或 Session 记录
3. **关键：检查当前 git 状态**（文件变更、分支等）
4. 综合记忆和当前状态，继续工作

**适用场景：**
- 想直接继续之前的工作，不只是查看
- 需要 Claude 结合记忆和当前代码状态
- 一步到位恢复工作上下文

**示例：**
```bash
你：/restore-project-context 继续支付集成

Claude 执行：
1. 搜索 "支付集成" 相关话题
2. 找到 Session abc123 / 03-implement-payment-api
3. 读取话题摘要：已完成 Stripe API 集成，待实现退款功能
4. 检查 git status：发现 payment.ts 有未提交的修改
5. 回复：
   "我看到你之前在实现 Stripe 支付集成，已完成基础支付功能。
   当前 payment.ts 有未提交的修改，看起来是在实现退款逻辑。
   让我们继续完成退款功能的实现..."
```

**三者对比：**

| 功能 | 搜索深度 | 返回内容 | 是否检查代码 | 适合场景 |
|------|----------|----------|--------------|----------|
| `search-project-topics` | 摘要级别 | 话题列表 + 摘要片段 | 否 | 快速浏览 |
| `search-project-sessions` | 对话级别 | 完整对话内容 | 否 | 深入查看 |
| `restore-project-context` | 综合分析 | 上下文恢复 + 工作建议 | 是 | 直接继续 |

---

## 话题管理功能

### 4. `/save-topic` - 保存检查点

**作用：** 在不切换话题的情况下，立即保存当前话题的进度

**工作机制：**
- 正常情况下，话题只在切换时才归档
- `/save-topic` 让你主动触发保存，但话题标签不变
- 相当于"存档"当前进度

**使用场景：**

**场景 1：完成重要里程碑**
```bash
你：我们刚完成了用户认证的核心功能
Claude：› `implement-user-auth`
     [实现代码...]
你：/save-topic
# 立即保存进度，但话题仍是 implement-user-auth
```

**场景 2：工作中断前**
```bash
你：我要去开会了，先保存一下
Claude：/save-topic
# 保存当前状态，下次继续同一话题
```

**场景 3：长时间工作的检查点**
```bash
你：已经工作 2 小时了，保存一下进度
Claude：/save-topic
# 防止意外丢失，但不结束当前话题
```

**为什么需要：**
- 话题可能持续很长时间（几小时甚至跨天）
- 中途可能遇到意外（断网、崩溃、compaction）
- 重要节点需要明确的存档点

### 5. `/list-topics` - 查看当前 Session 话题

**作用：** 列出当前 Session 中讨论过的所有话题

**返回内容：**
- 话题 slug 列表
- 每个话题的简短描述
- 话题切换的时间点

**使用场景：**

**场景 1：回顾今天的工作**
```bash
你：/list-topics
Claude：今天讨论的话题：
1. setup-dev-environment (09:00-09:30)
2. implement-user-auth (09:30-11:00)
3. fix-login-bug (11:00-11:45)
4. code-review (11:45-现在)
```

**场景 2：准备日报**
```bash
你：今天都做了什么？
Claude：/list-topics
# 快速生成工作清单
```

**场景 3：Session 太长，忘记讨论了什么**
```bash
你：我们今天讨论过数据库优化吗？
Claude：/list-topics
# 检查话题列表确认
```

**与搜索的区别：**
- `/list-topics` - 只看当前 Session
- `/search-project-topics` - 搜索所有历史 Session

### 6. `/ignore-topic` - 排除话题归档

**作用：** 标记某些话题不需要归档（元话题、调试、闲聊等）

**工作机制：**
- 在项目的 `.ignore` 文件中添加规则
- 匹配的话题在切换时不会被归档
- 支持精确匹配或模式匹配

**使用场景：**

**场景 1：调试插件本身**
```bash
你：claude-recap 的 hook 好像有问题
Claude：› `debug-claude-recap-hook`
     [调试过程...]
你：/ignore-topic debug-claude-recap-hook
# 这种元话题不需要归档
```

**场景 2：闲聊或测试**
```bash
Claude：› `casual-chat`
你：/ignore-topic casual-chat
# 非工作内容不归档
```

**场景 3：批量排除模式**
```bash
你：/ignore-topic debug-*
# 所有 debug- 开头的话题都不归档
```

**场景 4：查看忽略规则**
```bash
你：/ignore-topic --list
Claude：当前忽略规则：
- debug-*
- test-*
- casual-chat
```

**为什么需要：**
- 避免无用话题污染记忆
- 元话题（讨论工具本身）不应该归档
- 保持记忆库的高质量

---

## 集成使用工作流

### 工作流 1：长期功能开发

```bash
# === Day 1: 开始新功能 ===
你：开始实现支付系统
Claude：› `implement-payment-system`
     [讨论架构...]

你：/save-topic  # 里程碑 1：架构设计完成
     [开始编码...]

你：/save-topic  # 里程碑 2：基础 API 完成
     [继续开发...]

# 下班前
你：/list-topics  # 查看今天的进度
Claude：今天讨论的话题：
1. implement-payment-system (全天)
   - 已保存 2 个检查点

# === Day 2: 继续开发 ===
你：/restore-project-context 继续支付系统
Claude：[读取昨天的检查点，检查代码状态]
     "昨天完成了基础 API，当前代码在 payment.ts 有未提交修改..."

你：继续实现退款功能
Claude：› `implement-payment-system`  # 同一话题继续
     [实现退款...]

你：/save-topic  # 里程碑 3：退款功能完成
```

### 工作流 2：多话题切换 + 搜索

```bash
# === 上午：功能开发 ===
Claude：› `implement-dashboard`
     [开发仪表板...]

# 突然发现 bug
你：等等，登录有问题
Claude：› `fix-login-bug`  # 自动切换话题，dashboard 被归档
     [修复 bug...]

# Bug 修完，回到仪表板
你：/search-project-topics "dashboard"
Claude：找到话题：implement-dashboard (今天 09:00-10:30)
     摘要：实现用户仪表板，完成了数据展示组件...

你：/restore-project-context 继续仪表板开发
Claude：› `implement-dashboard`  # 恢复之前的话题
     [继续开发...]

# === 下午：代码审查 ===
你：我们来审查一下今天的代码
Claude：› `code-review`

你：/list-topics  # 看看今天都做了什么
Claude：今天的话题：
1. implement-dashboard (09:00-10:30, 11:00-现在)
2. fix-login-bug (10:30-11:00)
3. code-review (现在)

你：/ignore-topic code-review  # 代码审查不需要归档
```

### 工作流 3：调试 + 清理

```bash
# 遇到奇怪的问题，开始调试
Claude：› `debug-webpack-config`
     [各种尝试...]

你：/save-topic  # 保存调试进度（可能需要多次尝试）

# 问题解决了
你：/ignore-topic debug-webpack-config  # 调试过程不归档

# 但想记录解决方案
你：记录一下：webpack 配置需要添加 resolve.fallback
Claude：› `document-webpack-solution`
     [记录解决方案...]
# 这个话题会被归档，作为知识库
```

### 工作流 4：跨天项目 + 检查点

```bash
# === Week 1 ===
Claude：› `design-microservice-architecture`
你：/save-topic  # 每天下班前保存

# === Week 2 ===
你：/search-project-sessions "微服务架构"
Claude：找到 5 个相关 Session，最近的是上周五...

你：/restore-project-context 继续微服务架构设计
Claude：[读取所有检查点，综合上周的讨论]
     "上周完成了服务拆分设计，定义了 3 个核心服务..."

Claude：› `design-microservice-architecture`  # 继续同一话题
你：/save-topic  # 继续保存检查点
```

---

## 最佳实践

### 功能选择决策树

```
工作中...
│
├─ 需要保存进度？
│  ├─ 话题还在继续 → /save-topic
│  └─ 话题要切换了 → 自动归档（无需操作）
│
├─ 想看今天做了什么？
│  └─ /list-topics
│
├─ 想找之前的工作？
│  ├─ 记得关键词 → /search-project-topics
│  ├─ 记得具体内容 → /search-project-sessions
│  └─ 想直接继续 → /restore-project-context
│
└─ 当前话题不想归档？
   └─ /ignore-topic
```

### 使用建议

#### 1. 定期检查点
- **长话题每 1-2 小时 `/save-topic` 一次**
- 防止意外丢失进度
- 在重要里程碑后立即保存

#### 2. 每日回顾
- **下班前 `/list-topics` 查看进度**
- 快速生成工作日报
- 确认所有重要工作都已归档

#### 3. 清理无用话题
- **调试、测试话题用 `/ignore-topic`**
- 元话题（讨论工具本身）不归档
- 使用模式匹配批量排除（如 `debug-*`）

#### 4. 跨天恢复
- **用 `/restore-project-context` 而不是手动搜索**
- 一步到位恢复上下文 + 检查代码状态
- 比单独搜索更高效

#### 5. 组合使用
- **先 `/list-topics` 看概览**
- **再 `/search-project-sessions` 看细节**
- **最后 `/restore-project-context` 继续工作**

### 常见场景速查

| 场景 | 推荐操作 | 说明 |
|------|----------|------|
| 开始新功能 | 正常对话 | 话题自动标记 |
| 完成里程碑 | `/save-topic` | 保存检查点 |
| 工作中断 | `/save-topic` | 防止丢失进度 |
| 切换话题 | 正常切换 | 自动归档旧话题 |
| 下班前 | `/list-topics` | 查看今天进度 |
| 第二天开始 | `/restore-project-context` | 恢复昨天工作 |
| 找之前的讨论 | `/search-project-topics` | 搜索关键词 |
| 找具体代码 | `/search-project-sessions` | 搜索对话内容 |
| 调试问题 | `/ignore-topic` | 调试话题不归档 |
| 准备日报 | `/list-topics` | 生成工作清单 |

### 记忆库维护

#### 保持高质量
- 及时标记无用话题为 ignore
- 调试过程不归档，只归档解决方案
- 闲聊、测试话题不归档

#### 定期回顾
- 每周查看 `~/.memory/projects/{project}/`
- 检查话题摘要是否准确
- 删除过时或无用的 Session 目录

#### 搜索优化
- 使用具体关键词而不是泛泛的词
- 先用 topics 快速定位，再用 sessions 深入
- restore-project-context 会自动综合多个相关话题

---

## 总结

**6 个功能的定位：**

1. **搜索层（查找）：**
   - `/search-project-topics` - 快速浏览摘要
   - `/search-project-sessions` - 深入查看对话

2. **恢复层（继续）：**
   - `/restore-project-context` - 一步恢复工作

3. **管理层（维护）：**
   - `/save-topic` - 主动保存检查点
   - `/list-topics` - 查看当前进度
   - `/ignore-topic` - 清理无用话题

**核心原则：**
- 话题归档是自动的，无需手动操作
- 只在需要时主动干预（save、ignore）
- 搜索和恢复配合使用，效率最高
- 保持记忆库高质量，定期清理

**推荐工作流：**
```
开始工作 → 正常对话（自动标记话题）
         ↓
      长时间工作 → /save-topic（保存检查点）
         ↓
      切换话题 → 自动归档
         ↓
      下班前 → /list-topics（查看进度）
         ↓
      第二天 → /restore-project-context（恢复工作）
         ↓
      需要回顾 → /search-project-topics 或 /search-project-sessions
         ↓
      调试/测试 → /ignore-topic（不归档）
```
