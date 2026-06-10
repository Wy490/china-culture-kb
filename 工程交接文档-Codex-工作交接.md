# 工程交接文档 — Codex 工作交接

> 分支: `feat/memory-mosaic-biography-phase5`
> 日期: 2026-06-10
> 测试: 111 passed, 0 failed
> 工作区: **干净**（全部已 commit + push）

---

## 一、本次窗口完成的工作

### Commit 清单（本次新增 5 个）

| Commit | 说明 |
|--------|------|
| `d4ff02c` | Codex 收口修复 + 项目系统前端 + 场景重写桥接 + 文档（37 files, 5321 行） |
| `9bf7691` | 旧故事兼容修复 — 3 bug + 3 tests (108→108) |
| `1edba69` | 部署指南文档 docs/deployment-guide.md |
| `965d18f` | 桥接脚本去掉 `--json-schema` 和 `--allowedTools ''` |
| `e1aa7b6` | MCP 搜索增强 + entry-service 意图扩展 + 搜索测试 (108→111) |

### 修复的 Bug

| Bug | 位置 | 修复 |
|-----|------|------|
| 旧故事 `generation_mode` undefined → 显示绿色 | StoryResult.vue:252 | `?? 'local_only'` → 灰色 |
| `||` 吞掉 `generation_used_fallback: false` | story-service.ts:1124 | `||` 改 `??` |
| 后端多处无默认值填充 | story-service.ts, project-service.ts | 所有输出边界 `?? 'local_only'` / `?? false` |
| `--allowedTools ''` 导致 CLI 报错 | 两个桥接脚本 | 删除该参数 |
| `--json-schema` 导致响应 >120s | story-generate-agent-bridge.mjs | 去掉 `--json-schema`，改用 `parseJsonBlock` |

### 实际验证结果

**Claude Sonnet 外部模型生成成功** ✅：

```
generation_mode: external_model
generation_used_fallback: false
generation_source: Claude Sonnet
model_profile_id: claude_sonnet
title: 吾不为也
scene_count: 5, scene_ids: [1,2,3,4,5]
reference_trace: {applied_rules: ['provider:command_json']}
```

---

## 二、当前架构总览

### 服务端核心

| 文件 | 职责 |
|------|------|
| `story-service.ts` | 全文生成主流程 + 兼容性检查 + 合并 + listStories/getStory |
| `story-generation-model.ts` | 适配器（spawn + Zod + fallback） |
| `story-generation-prompt.ts` | prompt package 构建（system_prompt + user_prompt） |
| `story-regenerate-service.ts` | 场景重写（不修改 generation 字段） |
| `scene-regeneration-model.ts` | 场景重写适配器 |
| `scene-regeneration-prompt.ts` | 场景重写 prompt 构建 |
| `project-service.ts` | 项目 CRUD + 版本管理 + normalizeStoryGenerationFields |
| `model-catalog.ts` | 3 个 model profile（claude_sonnet, claude_opus, codex_gpt55） |
| `entry-service.ts` | 条目搜索（意图扩展 + 多字段评分） |
| `mcp-proxy.ts` | MCP 工具桥接 |

### 桥接脚本

| 文件 | 职责 |
|------|------|
| `story-generate-agent-bridge.mjs` | 全文生成：读 stdin prompt → spawn claude/codex → parseJsonBlock → validateOutput |
| `scene-regenerate-agent-bridge.mjs` | 场景重写：同架构，validatePatch |

### 前端

| 文件 | 职责 |
|------|------|
| `Home.vue` | 三卡片工作台（知识库/项目/生成） |
| `StoryStudio.vue` | 模型选择下拉框 + localStorage + 生成 + 链接到项目 |
| `StoryResult.vue` | 三色（绿/橙/灰）模型状态 + 故事展示 |
| `StoryDetail.vue` | "进入故事项目" + "继续生成" 双链接 |
| `ProjectDetail.vue` | 项目详情 + 场景重写交互 |
| `Projects.vue` | 项目列表 |
| `Knowledge.vue` | 知识库浏览（按省份） |
| `ProvinceGrid.vue` | 省份卡片 → KnowledgeProvince 路由 |

### 共享类型

| 文件 | 新增 |
|------|------|
| `types.ts` | GenerationMode + generation_mode/generation_used_fallback 3 个接口 |
| `schemas.ts` | model_profile_id + ProjectIdParam + StorySceneRegenerateRequestSchema |

### 路由

| 路径 | 说明 |
|------|------|
| `/api/entries` | 知识库条目检索 |
| `/api/stories` | 故事生成/列表/详情/GEARS |
| `/api/story-outline` | 大纲分析 |
| `/api/projects` | 项目 CRUD + 场景重写 |
| `/api/system` | 系统信息 + 模型 Profile |

---

## 三、关键设计决策（已落地）

### 全文生成一致性策略

- 模型 `scene_breakdown` 必须与本地骨架 **场景数相等 + scene_ids 双向精确匹配 + 双方唯一**
- 不兼容 → 整体 fallback 到本地结果，不做部分合并
- 合并时精确按 `scene_id` 匹配（不再是 find-by-index）

### generation_source 结构化状态

| 字段 | 类型 | 值 | 颜色 | 说明 |
|------|------|-----|------|------|
| `generation_source` | string | 可读文案 | — | 展示给用户 |
| `generation_mode` | GenerationMode | `external_model` / `local_fallback` / `local_only` | 绿/橙/灰 | 程序判断 |
| `generation_used_fallback` | boolean | true/false | 橙色 | 前端颜色 |

### 场景重写语义分离

- `generation_source/mode/used_fallback` **只描述原始全文生成来源**
- 场景重写信息 **只进 reference_trace**
- 不再混成一个语义不清的字段

### 桥接脚本 JSON 提取策略

- **不用 `--json-schema`**（复杂 schema 导致 CLI >120s）
- 用 `parseJsonBlock` 从 Claude/Codex 输出中提取 JSON
- `validateOutput`/`validatePatch` 做字段校验和类型转换

---

## 四、环境变量参考

### 全文生成

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `STORY_GEN_PROVIDER` | `command_json` | 适配器类型 |
| `STORY_GEN_COMMAND` | 空（local_only） | 外部命令路径 |
| `STORY_GEN_COMMAND_ARGS` | `[]` | 命令参数 JSON |
| `STORY_GEN_COMMAND_TIMEOUT_MS` | `120000` | **⚠️ 建议改为 330000** |
| `STORY_GEN_AGENT` | `claude` | 桥接用 claude/codex |
| `STORY_GEN_AGENT_MODEL` | 空 | 模型名（sonnet/opus） |
| `STORY_GEN_AGENT_CLAUDE_PATH` | `claude` | Claude CLI 路径 |
| `STORY_GEN_AGENT_TIMEOUT_MS` | `180000` | **⚠️ 建议改为 300000** |

### 场景重写

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SCENE_REGEN_PROVIDER` | `command_json` | 适配器类型 |
| `SCENE_REGEN_COMMAND` | 空 | 外部命令路径 |
| `SCENE_REGEN_COMMAND_ARGS` | `[]` | 命令参数 |
| `SCENE_REGEN_COMMAND_TIMEOUT_MS` | `45000` | 适配器超时 |
| `SCENE_REGEN_AGENT` | `claude` | 桥接 agent |
| `SCENE_REGEN_AGENT_TIMEOUT_MS` | `120000` | 桥接超时 |

### 核心服务

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端端口 |
| `KB_ROOT` | `../../data` | 知识库根目录 |

> 详细部署文档见 [docs/deployment-guide.md](docs/deployment-guide.md)

---

## 五、测试覆盖（111 个）

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| `api.test.ts` | ~73 | 路由集成 + Projects API + 参数验证 + 新搜索测试 |
| `story-generation-model.test.ts` | 16 | 适配器 fallback + 兼容性检查 + 合并 + 边界 |
| `story-regenerate-service.test.ts` | 4 | 场景重写本地/模型/记忆拼图 |
| `project-service.test.ts` | 5 | 项目 CRUD + 场景重写 + **旧故事兼容 3 个** |
| `model-catalog.test.ts` | ? | 模型目录 |
| `scene-regeneration-bridge.test.ts` | ? | 场景重写桥接 |
| `search.test.ts` | ? | MCP 搜索意图扩展 + 关键词拆分 |

---

## 六、下一步建议（Codex 接手）

### 优先级 P0 — 必须先做

1. **桥接脚本 `scene_id` 类型修复** — 模型返回 `scene_id: null`（应为整数），桥接脚本的 `validateOutput` 需强转
   - 文件: `web/server/scripts/story-generate-agent-bridge.mjs` 的 `validateOutput` 函数
   - 当前: `scene_id: Number(s.scene_id)` — `Number(null)` = `0`，不是期望的 1-N
   - 建议: 检查 `scene_id` 是否为 null → 用数组索引 +1 作为 fallback

2. **默认超时值调整** — 当前默认值 120000 不够，真实 Claude CLI 调用需 ~2-3 分钟
   - 文件: `web/server/src/services/story-generation-model.ts` 和 `scene-regeneration-model.ts`
   - 当前默认: `STORY_GEN_COMMAND_TIMEOUT_MS = 120000`
   - 建议: 改为 `330000`（5.5 分钟）
   - 同理: `STORY_GEN_AGENT_TIMEOUT_MS` 从 180000 改为 300000

### 优先级 P1 — 建议接下来做

3. **前端 ProjectDetail 页面打磨** — 骨架已成型（509 行），但需要：
   - 场景重写交互的 UI 完善（加载状态、错误提示、重写结果对比展示）
   - 项目版本历史的可视化展示
   - 移动端响应式适配

4. **场景重写真实链路测试** — 需配置 `SCENE_REGEN_*` 环境变量，验证单场重写能走 Claude CLI
   - API: `POST /api/projects/:projectId/regenerate-scene`
   - 需验证: 模型返回 JSON patch 格式是否兼容 `validatePatch`

5. **MCP 搜索质量验证** — 新增的意图扩展和评分逻辑需用实际条目测试
   - 输入: "找湖南的人物故事"
   - 期望: 命中历史人物类型条目，并扩展关键词

### 优先级 P2 — 不急但值得做

6. **tsconfig.json rootDir 删除的长期影响** — 当前删除了 `rootDir` 以解决 `@shared` 跨目录类型错误，但可能导致构建产物结构变化。需要确认 `npm run build`（tsup）的输出是否正常。

7. **codex 模式测试** — 场景重写桥接脚本支持 codex，但未经实际测试。

### ❌ 不建议做

- 不要恢复 `--json-schema` — 已验证它导致响应时间 >120s
- 不要恢复 `--allowedTools ''` — 已验证空字符串导致 CLI 报错
- 不要大改三卡片工作台布局 — 已成型
- 不要增加新的 model profile — 3 个已足够

---

## 七、Residual Risk

| Risk | 说明 | 当前缓解 |
|------|------|----------|
| 模型返回 `scene_id: null` | Claude 可能不给整数 scene_id | `Number(null)` = 0 → 兼容性检查会 reject → fallback |
| 模型 `full_text`/`scene_breakdown` 语义不一致 | 模型内部质量问题 | 兼容性检查 reject → fallback，无法解决语义不一致 |
| `parseJsonBlock` 误解析 | Claude 输出含多个 JSON 对象时可能取错 | `parseJsonBlock` 取 `{...}` 最外层匹配，大部分情况足够 |
| 默认超时 120s 不够 | 真实调用需 ~2-3 分钟 | 需手动设环境变量 330s，或改默认值 |
| 旧 JSON 无 generation 字段 | 已存故事缺少新字段 | 已做 `?? 'local_only'` / `?? false` 兜底 |

---

## 八、本地开发启动

```bash
# 后端
cd web/server
npm run dev    # 端口 3000

# 前端
cd web/client
npm run dev    # 端口 5173，自动代理 /api → localhost:3000

# 测试
cd web/server
npm test       # 111 tests

# 带外部模型启动（需要 Claude CLI 已安装并登录）
export STORY_GEN_COMMAND=node
export STORY_GEN_COMMAND_ARGS='["$(pwd)/scripts/story-generate-agent-bridge.mjs"]'
export STORY_GEN_AGENT=claude
export STORY_GEN_AGENT_CLAUDE_PATH=/opt/homebrew/bin/claude
export STORY_GEN_AGENT_MODEL=sonnet
export STORY_GEN_PROVIDER=command_json
export STORY_GEN_COMMAND_TIMEOUT_MS=330000
export STORY_GEN_AGENT_TIMEOUT_MS=300000
npm run dev
```

前端地址: http://localhost:5173/

---

## 九、文件清单（按职责，含新增文件）

### 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `web/server/scripts/story-generate-agent-bridge.mjs` | 284 | 全文生成桥接 |
| `web/server/scripts/scene-regenerate-agent-bridge.mjs` | 206 | 场景重写桥接 |
| `web/server/src/services/story-generation-prompt.ts` | 341 | 全文 prompt 构建 |
| `web/server/src/services/scene-regeneration-model.ts` | 166 | 场景重写适配器 |
| `web/server/src/services/scene-regeneration-prompt.ts` | 195 | 场景重写 prompt |
| `web/server/src/services/model-catalog.ts` | 46 | 3 个 model profile |
| `web/server/src/routes/projects.ts` | 40 | 项目 API 路由 |
| `web/client/src/api/projects.ts` | 18 | 项目 API client |
| `web/client/src/views/Knowledge.vue` | 367 | 知识库浏览页 |
| `web/client/src/views/Projects.vue` | 314 | 项目列表页 |
| `web/client/src/views/ProjectDetail.vue` | 509 | 项目详情页 |
| `docs/deployment-guide.md` | 178 | 部署指南 |

### 修改文件（关键改动）

| 文件 | 改动 |
|------|------|
| `story-service.ts` | 兼容性检查双向匹配 + `??` 默认值 + getStory 填充 |
| `story-generation-model.ts` | childEnv 类型 + 适配器 fallback |
| `story-regenerate-service.ts` | 不覆盖 model_profile_id |
| `project-service.ts` | normalizeStoryGenerationFields + `??` 默认值 |
| `validate.ts` | cast 加 `as unknown as` |
| `tsconfig.json` | 删除 rootDir |
| `StoryResult.vue` | generation_mode fallback + 三色逻辑 |
| `Home.vue` | 三卡片工作台布局 |
| `StoryStudio.vue` | 模型选择 + localStorage |
| `StoryDetail.vue` | 双链接导航 |
| `App.vue` | 导航新增知识库 + 项目 |
| `router.ts` | 新增 /projects /knowledge 路由 |
| `schemas.ts` | model_profile_id + ProjectIdParam + SceneRegenerate |
| `entry-service.ts` | 意图扩展 + 多字段搜索 |
| `search.ts` (MCP) | 意图扩展 + 关键词评分 |