# Installed AI Tools, Skills, and MCP

Last updated: 2026-06-08

This document records the AI tools, MCP servers, skills, plugins, and supporting CLI across two machines: **Mac** (wuyu) and **Windows** (Administrator).

## Main Applications

| Tool | Mac Path | Windows Path | Notes |
| --- | --- | --- | --- |
| VS Code | `/Applications/Visual Studio Code.app` | VS Code native install | Mac CLI: `/opt/homebrew/bin/code`; Windows: system PATH |
| Claude Code | `/opt/homebrew/bin/claude` | `C:\Users\Administrator\AppData\Roaming\npm\claude` | v2.1.133 (npm global); configured through Aliyun GLM 5.1 on both |
| Codex | `/Applications/Codex.app` | `C:\Users\Administrator\AppData\Roaming\npm\codex` | v0.128.0 (npm global); Mac uses default model; Windows uses beefapi gpt-5.5 |
| Qwen Code | `/opt/homebrew/bin/qwen` | — | Mac only |

## VS Code Extensions

| Extension | Purpose | Platform |
| --- | --- | --- |
| `anthropic.claude-code` | Claude Code in VS Code | Both |
| `openai.chatgpt` | OpenAI ChatGPT / Codex extension | Both |
| `vue.volar` | Vue 3 + TypeScript support | Windows |

## MCP Servers

### Windows — Claude Code MCP

| MCP name | Type | Command / URL | Status / Purpose |
| --- | --- | --- | --- |
| `china-culture-kb` | stdio | `node mcp-server/dist/index.js` (cwd: `d:/china-culture-kb`) | **Project-level** — 中国传统文化知识库，14 个工具（搜索、详情、添加、匹配、补充、采集、验证、B站视频、文章、录入、脚本、故事、索引、地区条目） |
| `github` | http | `https://api.githubcopilot.com/mcp/` | **Plugin-level** — GitHub 官方 MCP（Issue、PR、代码搜索、API 操作）；认证: `GITHUB_PERSONAL_ACCESS_TOKEN` |

### Mac — Claude Code & Codex Shared MCP

| MCP name | Type | Command | Status / Purpose |
| --- | --- | --- | --- |
| `context7` | stdio | `/opt/homebrew/bin/context7-mcp` | Official/current library and framework documentation lookup |
| `fetch` | stdio | `/opt/homebrew/bin/mcp-fetch-server` | Fetch webpages as text/Markdown; YouTube transcripts |
| `playwright` | stdio | `/opt/homebrew/bin/playwright-mcp` | Browser automation, page interaction, visual inspection, UI testing |
| `chrome-devtools` | stdio | `/opt/homebrew/bin/chrome-devtools-mcp` | Chrome DevTools inspection, console/network/page debugging |
| `duckduckgo` | stdio | `/opt/homebrew/bin/ddg-mcp` | Web search without an API key |

Mac Claude Code health check (2026-06-08):

```text
chrome-devtools: connected
playwright: connected
fetch: connected
context7: connected
duckduckgo: connected
```

### Windows — Codex MCP

Codex on Windows has no additional MCP servers beyond the browser-use plugin's built-in browser automation (see Codex Plugins below).

## Claude Code Config

### Windows

Config file: `C:\Users\Administrator\.claude\settings.json`

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-sp-...",
    "ANTHROPIC_BASE_URL": "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    "ANTHROPIC_MODEL": "glm-5.1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5.1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1"
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "code-simplifier@claude-plugins-official": true,
    "skill-creator@claude-plugins-official": true,
    "github@claude-plugins-official": true
  },
  "includeCoAuthoredBy": false
}
```

All model tiers (Haiku/Sonnet/Opus) map to **glm-5.1** via Aliyun MaaS proxy.

### Mac

Config file: `/Users/wuyu/.claude.json`

Contains the 5 shared MCP servers (context7, fetch, playwright, chrome-devtools, duckduckgo) and project-specific MCP entries. Uses CC Switch for model routing.

## Codex Config

### Windows

Config file: `C:\Users\Administrator\.codex\config.toml`

```toml
model_provider = "beefapi_codex"
model = "gpt-5.5"
model_reasoning_effort = "medium"

[model_providers.beefapi_codex]
name = "beefapi_codex"
base_url = "https://beefapi.com/v1"
wire_api = "responses"
requires_openai_auth = true

[plugins."browser-use@openai-bundled"]
enabled = true

[windows]
sandbox = "elevated"
```

### Mac

Config file: `/Users/wuyu/.codex/config.toml`

Contains the 5 shared MCP servers (same as Claude Code).

## Claude Code Plugins

Installed from the official Claude plugin marketplace. Listed per platform where different.

### Windows Plugins

| Plugin | Version | Purpose |
| --- | --- | --- |
| **superpowers** | 5.1.0 | 开发流程技能套件 — 14 个 skill（brainstorming, TDD, debugging, verification, writing-plans 等），覆盖从设计到验证的完整开发周期 |
| **code-review** | (git hash) | PR 代码审查 — 多 Agent 协作审查，自动评分过滤，PR 评论发布 |
| **code-simplifier** | 1.0.0 | 代码简化 — 自动精简最近修改的代码，保持功能不变 |
| **skill-creator** | (git hash) | Skill 创建器 — 从零创建/编辑/测试/优化 skill，含评估和基准测试 |
| **github** | (git hash) | GitHub MCP 插件 — 提供 GitHub API MCP 服务器（HTTP 类型） |

### Mac Plugins

| Plugin | Purpose |
| --- | --- |
| `agent-sdk-dev` | Claude Agent SDK development |
| `mcp-server-dev` | MCP server development |
| `feature-dev` | Feature development workflow with specialized agents |
| `code-review` | Code review command/workflow |
| `code-simplifier` | Code simplification agent |
| `security-guidance` | Security guidance and reminders |
| `frontend-design` | Frontend design guidance |
| `claude-md-management` | CLAUDE.md management and improvement |

> `code-review` and `code-simplifier` exist on both platforms — same functionality, not duplicated above.

## Superpowers Plugin Skills (Windows, 14 个)

### 🔴 严格型（Rigid — 必须严格遵循）

| Skill | 触发条件 | 说明 |
| --- | --- | --- |
| **systematic-debugging** | 遇到 bug、测试失败或异常行为 | 四阶段：根因调查→模式分析→假设验证→实施。铁律：没有根因就没有修复 |
| **test-driven-development** | 实现功能或 bugfix，写代码之前 | 红-绿-重构循环。铁律：没有失败测试就不写生产代码 |
| **verification-before-completion** | 声称完成/通过/准备提交前 | 证据先于声明。铁律：没有验证证据就不能声称完成 |
| **receiving-code-review** | 收到代码审查反馈时 | 技术严谨不盲从。阅读→理解→代码验证→评估→回应→逐项实施 |
| **using-git-worktrees** | 需隔离的功能开发，或执行计划前 | 确保隔离工作空间。检测→原生工具优先→git worktree 备选 |
| **writing-skills** | 创建/编辑/验证 skill | Skill 创建 = TDD 应用于流程文档 |

### 🟡 流程型（Flexible — 可适应上下文）

| Skill | 触发条件 | 说明 |
| --- | --- | --- |
| **brainstorming** | 任何创作性工作之前 | 协作式设计探索→提问→2-3方案→展示→批准→spec→writing-plans |
| **writing-plans** | 有 spec/需求的多步骤任务，写代码前 | 全面实施计划：bite-sized 任务，零假设，无占位符，含自审 |
| **executing-plans** | 有写好的计划需执行 | 加载→审查→逐步执行+验证→finishing-a-development-branch |
| **requesting-code-review** | 完成任务/功能/合并前 | 派遣审查子 Agent。审查早、审查多 |
| **dispatching-parallel-agents** | 2+ 独立任务，无共享状态 | 每个 Agent 一个独立域，并发工作 |
| **subagent-driven-development** | 执行有独立任务的实施计划 | 每 task 一子 Agent，两阶段审查：spec→代码质量 |
| **finishing-a-development-branch** | 实现完成、测试通过，需决定整合 | 验证→检测环境→展示选项→执行→清理 |

### 🟢 元型

| Skill | 触发条件 | 说明 |
| --- | --- | --- |
| **using-superpowers** | 开始任何对话时 | 元 skill：1% 可能性就必须调用。检查在澄清问题之前 |

## Codex Skills

### Windows

| Skill | Path | Purpose |
| --- | --- | --- |
| `Claude-to-IM` / `Claude-to-IM-skill` | `C:\Users\Administrator\.codex\skills\` | 消息桥接 — 将 Claude/Codex session 连接到 Telegram/Discord/飞书/QQ/微信，子命令: setup, start, stop, status, logs, reconfigure, doctor |

### Mac

| Skill | Path | Purpose |
| --- | --- | --- |
| `agent-dev-standards` | `/Users/wuyu/.codex/skills/agent-dev-standards/SKILL.md` | Token-saving 开发规则、研究流程、代码质量规则、中文视频平台处理 |
| `playwright` | `/Users/wuyu/.codex/skills/playwright/SKILL.md` | Browser automation from the terminal |
| `screenshot` | `/Users/wuyu/.codex/skills/screenshot/SKILL.md` | OS-level screenshot capture |
| `security-best-practices` | `/Users/wuyu/.codex/skills/security-best-practices/SKILL.md` | Security best-practice reviews |
| `transcribe` | `/Users/wuyu/.codex/skills/transcribe/SKILL.md` | Audio/video transcription workflow |

## Codex Plugins

### Windows

| Plugin | Version | Purpose |
| --- | --- | --- |
| `browser-use@openai-bundled` | 0.1.0-alpha1 | Codex 内嵌浏览器自动化 — inspect pages, navigate, test local apps, click, type, screenshot |

## Local Claude Skills (Mac)

| Skill/plugin | Path | Purpose |
| --- | --- | --- |
| `agent-dev-standards@skills-dir` | `/Users/wuyu/.claude/skills/agent-dev-standards` | Token-saving agent development rules, research workflow, code quality rules, Chinese video platform handling |

> Note: this local skill is not installed on Windows; the **superpowers** plugin provides overlapping discipline (TDD, debugging, verification) and the **writing-plans** skill covers structured development workflow.

## china-culture-kb MCP Server Tools (14)

Project-level MCP server, available on Windows in the `china-culture-kb` project workspace.

| 工具名 | 功能 | 输入参数 |
| --- | --- | --- |
| `kb_search` | 搜索知识库条目 | keywords, type, province, region |
| `kb_get_entry_detail` | 获取条目完整详情 | name |
| `kb_add_entry` | 添加新条目到省份文件 | name, province, region, type, summary, story, culturalSignificance, keywords, sources, credibility, verificationMethod, unverifiedPoints |
| `kb_add_region_entry` | 添加地区级条目 | province, region, name, type, summary, story, culturalSignificance, keywords, sources, credibility, verificationMethod |
| `kb_match` | 语义匹配条目 | storyText |
| `kb_supplement` | 三维度补充条目 | name, dimension (人物背景/版本差异/现代关联) |
| `kb_collect` | 采集来源 | url, sourceType (bilibili/article/book/oral) |
| `kb_verify_source` | 验证来源可信度 | sourceLabel, sourceType, claim |
| `kb_fetch_video` | 获取B站视频元数据 | bvId |
| `kb_fetch_article` | 获取文章内容 | url |
| `kb_ingest_video` | 一键录入视频内容 | bvId, province, entryType, entryTitle |
| `kb_generate_script` | 生成文化脚本 | entryName, scriptType (纪录片/短剧/动画/文化解说), duration |
| `kb_generate_story` | 生成剧情化故事 | entryName, eventType |
| `kb_query_index` | 查询索引统计 | province, type, region, keyword |

## Supporting CLI Tools

| Tool | Mac Path | Windows Path | Purpose |
| --- | --- | --- | --- |
| `yt-dlp` | `/opt/homebrew/bin/yt-dlp` | — | Inspect/download subtitles, metadata, audio/video |
| `ffmpeg` | `/opt/homebrew/bin/ffmpeg` | — | Audio/video extraction, clipping, conversion |
| `ffprobe` | `/opt/homebrew/bin/ffprobe` | — | Media metadata inspection |
| `uv` | `/opt/homebrew/bin/uv` | `C:\Users\Administrator\.local\bin\uv` | Python tool/package runner |
| `node` | — | system PATH (v24.15.0) | JavaScript runtime |
| `npm` | — | system PATH (v11.12.1) | Package manager |
| `git` | — | system PATH (v2.54.0) | Version control |
| `python` | — | system PATH (v3.14.4) | Python runtime |

### Mac Only

| Tool | Path | Purpose |
| --- | --- | --- |
| `specify` | `/Users/wuyu/.local/bin/specify` | GitHub Spec Kit CLI (v0.9.6.dev0) — spec-driven development |

> Spec Kit is not installed on Windows. The **superpowers:writing-plans** skill provides equivalent structured planning functionality.

## Chinese Platform Research Workflow

For Bilibili, Douyin, Zhihu, and similar sources:

1. Search first with `duckduckgo` (Mac) or `WebSearch` (Windows built-in).
2. Open public pages with `fetch` (Mac) or `WebFetch` (Windows built-in).
3. Prefer page text, captions, subtitles, and metadata before downloading media.
4. Use `yt-dlp` (Mac) to inspect subtitles/metadata or download audio only when necessary.
5. Use `ffmpeg`/`ffprobe` (Mac) for local audio extraction, clipping, or media inspection.
6. If login, QR code, captcha, or account-specific content is required, complete login manually in the browser.
7. On Windows, use `kb_fetch_video` and `kb_fetch_article` MCP tools for Bilibili and article content within the china-culture-kb project.

## Skill Usage Statistics (Windows)

From `.claude.json` skillUsage tracking:

| Skill | Usage Count |
| --- | --- |
| `superpowers:brainstorming` | 7 |
| `superpowers:writing-plans` | 4 |
| `run` | 3 |
| `superpowers:subagent-driven-development` | 1 |
| `superpowers:systematic-debugging` | 1 |
| `deep-research` | 1 |

## Skill Usage Flow

```
用户请求
    │
    ▼
using-superpowers ── 检查是否有 skill 适用
    │
    ├── 创作性任务 ──→ brainstorming ──→ 用户批准 ──→ writing-plans ──→ 执行选择
    │                                                        │
    │                                                        ├── subagent-driven-development ──→ requesting-code-review
    │                                                        └── executing-plans (inline)
    │
    ├── Bug/测试失败 ──→ systematic-debugging ──→ 根因 → 修复
    │
    ├── 功能实现 ──→ test-driven-development ──→ 红-绿-重构
    │
    ├── 完成声明 ──→ verification-before-completion ──→ 证据确认
    │
    ├── 收到审查 ──→ receiving-code-review ──→ 严谨评估 → 逐项实施
    │
    ├── 分支完成 ──→ finishing-a-development-branch ──→ merge/PR/保持
    │
    ├── 独立多任务 ──→ dispatching-parallel-agents
    │
    ├── 深度研究 ──→ deep-research ──→ 多源搜索 → 对抗验证 → 综合
    │
    └── 代码精简 ──→ code-simplifier（自动）
```