# 部署指南

> 本文档覆盖服务端、前端和 AI 模型适配器的部署配置。

---

## 1. 前置条件

- Node.js 22+（ESM 项目）
- npm 或 pnpm
- 知识库数据目录（`data/`）已就位

---

## 2. 服务端部署

### 安装与构建

```bash
cd web/server
npm install
npm run build          # tsup → dist/
```

### 启动

```bash
# 开发模式（tsx watch，热重载）
npm run dev

# 生产模式
npm run start          # node dist/index.js
```

### 核心环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端监听端口 |
| `KB_ROOT` | `../../data`（相对 dist/） | 知识库根目录路径 |
| `NODE_ENV` | `development` | 环境标识 |

### GEARS 对接环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GEARS_WEBHOOK_URL` | 空 | 故事生成完成后发送 `story_ready` 通知的 GEARS 接收地址 |
| `GEARS_CALLBACK_BASE_URL` | 空 | 对外可访问的知识库平台 API 基址，用于生成 `gears_video_callback_url` |
| `PUBLIC_API_BASE_URL` | 空 | `GEARS_CALLBACK_BASE_URL` 未配置时的备用 API 基址 |
| `APP_BASE_URL` | 空 | 上述两项未配置时的备用应用基址 |

`story_ready` 通知会携带 `gears_video_callback_url`。GEARS 完成成片后向该地址提交 `storyId`、`status`、`video_url`、`thumbnail_url`，平台会把成片状态写回故事项目。

---

## 3. 前端部署

### 安装与构建

```bash
cd web/client
npm install
npm run build          # vue-tsc + vite → dist/
```

### 开发模式

```bash
npm run dev            # vite dev server，默认代理 /api → localhost:3000
```

前端默认通过 Vite proxy 将 `/api` 请求转发到后端 `PORT`。生产部署时需配置反向代理（nginx/caddy）将 `/api` 路由到后端服务。

---

## 4. AI 模型适配器配置

故事生成和场景重写各有一套独立的环境变量。未配置时，两者均走**本地 fallback**（内置结构化逻辑），不影响基本功能。

### 4.1 全文生成（Story Generation）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `STORY_GEN_PROVIDER` | `command_json` | 适配器类型 |
| `STORY_GEN_COMMAND` | 空（local_only） | 外部命令路径，未配置则走本地 fallback |
| `STORY_GEN_COMMAND_ARGS` | `[]` | 命令参数（JSON 数组或空格分隔） |
| `STORY_GEN_COMMAND_TIMEOUT_MS` | `330000` | 适配器超时（毫秒） |
| `STORY_GEN_AGENT` | `claude` | 桥接 agent：`claude` 或 `codex` |
| `STORY_GEN_AGENT_MODEL` | 空 | 模型名称（如 `sonnet`, `opus`, `gpt-5.5`） |
| `STORY_GEN_AGENT_CLAUDE_PATH` | `claude` | Claude CLI 路径 |
| `STORY_GEN_AGENT_CLAUDE_ARGS` | `[]` | Claude 附加参数（JSON 数组） |
| `STORY_GEN_AGENT_CODEX_PATH` | `codex` | Codex CLI 路径 |
| `STORY_GEN_AGENT_CODEX_ARGS` | `[]` | Codex 附加参数（JSON 数组） |
| `STORY_GEN_AGENT_TIMEOUT_MS` | `300000` | 桥接脚本超时（毫秒） |

**模型 Profile ID 映射**：

| Profile ID | Agent | 模型 | 说明 |
|------------|-------|------|------|
| `claude_sonnet` | claude | sonnet | 推荐：平衡速度和质感 |
| `claude_opus` | claude | opus | 偏创作质量 |
| `codex_gpt55` | codex | gpt-5.5 | 结构清晰、执行稳定 |

### 4.2 场景重写（Scene Regeneration）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SCENE_REGEN_PROVIDER` | `command_json` | 适配器类型 |
| `SCENE_REGEN_COMMAND` | 空（local fallback） | 外部命令路径 |
| `SCENE_REGEN_COMMAND_ARGS` | `[]` | 命令参数 |
| `SCENE_REGEN_COMMAND_TIMEOUT_MS` | `180000` | 适配器超时（毫秒） |
| `SCENE_REGEN_AGENT` | `claude` | 桥接 agent |
| `SCENE_REGEN_AGENT_MODEL` | 空 | 模型名称 |
| `SCENE_REGEN_AGENT_CLAUDE_PATH` | `claude` | Claude CLI 路径 |
| `SCENE_REGEN_AGENT_CLAUDE_ARGS` | `[]` | Claude 附加参数 |
| `SCENE_REGEN_AGENT_CODEX_PATH` | `codex` | Codex CLI 路径 |
| `SCENE_REGEN_AGENT_CODEX_ARGS` | `[]` | Codex 附加参数 |
| `SCENE_REGEN_AGENT_TIMEOUT_MS` | `180000` | 桥接脚本超时（毫秒） |

### 4.3 接法示例

**Claude（推荐）**：

```bash
# 全文生成
export STORY_GEN_COMMAND=node
export STORY_GEN_COMMAND_ARGS='["/path/to/web/server/scripts/story-generate-agent-bridge.mjs"]'
export STORY_GEN_AGENT=claude
export STORY_GEN_AGENT_CLAUDE_PATH=/opt/homebrew/bin/claude
export STORY_GEN_AGENT_MODEL=sonnet

# 场景重写
export SCENE_REGEN_COMMAND=node
export SCENE_REGEN_COMMAND_ARGS='["/path/to/web/server/scripts/scene-regenerate-agent-bridge.mjs"]'
export SCENE_REGEN_AGENT=claude
export SCENE_REGEN_AGENT_CLAUDE_PATH=/opt/homebrew/bin/claude
export SCENE_REGEN_AGENT_MODEL=sonnet
```

**Codex（可选）**：

```bash
export STORY_GEN_COMMAND=node
export STORY_GEN_COMMAND_ARGS='["/path/to/web/server/scripts/story-generate-agent-bridge.mjs"]'
export STORY_GEN_AGENT=codex
export STORY_GEN_AGENT_CODEX_PATH="/Applications/Codex.app/Contents/Resources/codex"

export SCENE_REGEN_COMMAND=node
export SCENE_REGEN_COMMAND_ARGS='["/path/to/web/server/scripts/scene-regenerate-agent-bridge.mjs"]'
export SCENE_REGEN_AGENT=codex
export SCENE_REGEN_AGENT_CODEX_PATH="/Applications/Codex.app/Contents/Resources/codex"
```

> 详细的桥接脚本内部机制和调试建议，见 [local-scene-regeneration-agent-bridge.md](local-scene-regeneration-agent-bridge.md)。

---

## 5. 生成状态字段说明

每条故事 JSON 包含三个字段描述生成来源：

| 字段 | 类型 | 值 | 颜色 | 说明 |
|------|------|-----|------|------|
| `generation_source` | `string` | 可读文案 | — | 展示给用户的文字描述 |
| `generation_mode` | `'external_model' \| 'local_fallback' \| 'local_only'` | 结构化枚举 | 绿/橙/灰 | 程序判断 |
| `generation_used_fallback` | `boolean` | true/false | 橙色 | 前端颜色判断 |

**旧故事兼容**：缺失 `generation_mode` → 默认 `'local_only'`（灰），缺失 `generation_used_fallback` → 默认 `false`。

---

## 6. 路由总览

| 路径 | 说明 |
|------|------|
| `/api/entries` | 知识库条目检索 |
| `/api/stories` | 故事生成、列表、详情、GEARS 分段 |
| `/api/story-outline` | 大纲分析 |
| `/api/projects` | 项目 CRUD、场景重写 |
| `/api/gears-callback/video-ready` | GEARS 成片结果回传 |
| `/api/system` | 系统信息、省份列表、类型列表、模型 Profile |

---

## 7. 测试

```bash
cd web/server
npm test                # vitest run → 111+ tests
```
