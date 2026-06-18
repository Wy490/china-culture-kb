# Story Agent MCP 质量闭环与交付能力实施计划

> 版本：v0.1
> 日期：2026-06-16
> 目标项目：`/Users/wuyu/Desktop/china-culture-kb`
> 关联文档：
> - `.codex/mcp-upgrade-roadmap.md`
> - `.codex/mcp-config.md`
> - `.codex/skills/china-culture-story-agent/SKILL.md`
> - `.codex/skills/china-culture-screenwriting/SKILL.md`
> - `.codex/skills/gears-seedance-delivery/SKILL.md`
> - `开发文档/story-agent-genre-text-generation-upgrade-plan.md`
> - `开发文档/story-agent-workbench-project-edit-export-dev-doc.md`
> - `开发文档/installed-ai-tools.md`

---

## 1. 总体目标

当前项目已经具备 Story Agent 的关键基础：

- 项目级 Codex skills 已建立；
- Mac Codex 已接入 `china-culture-kb` MCP；
- MCP 已新增 Story Agent 工具：
  - `kb_get_project_context`
  - `kb_generate_story_blueprint`
  - `kb_validate_genre_story`
  - `kb_generate_gears_delivery`
  - `kb_generate_seedance_prompt`
  - `kb_repair_story(auto_apply=false)`
  - `kb_update_project_version`
- MCP 全量测试已恢复绿色；
- Story Agent Web 端已有类型片 profile、StoryBlueprint、项目版本、质量报告、GEARS delivery 等基础模块。

下一阶段目标是把 Story Agent 从“能生成故事”推进到：

```text
能读取项目
能生成蓝图
能校验类型片质量
能生成 GEARS 交付包
能生成 Seedance 提示词
能构造修复方案
能安全写入新项目版本
```

最终形成完整闭环：

```text
Knowledge entry / user material
  -> StoryBlueprint
  -> full_text / scene_breakdown / gears_segments
  -> genre quality validation
  -> repair package / repair apply
  -> GEARS delivery
  -> Seedance prompt
  -> project version update
```

---

## 2. 当前状态

### 2.1 已完成 MCP 工具

当前 `china-culture-kb` MCP 工具数：21。

新增 Story Agent 相关工具：

| 工具 | 状态 | 说明 |
|---|---|---|
| `kb_get_project_context` | 已完成 | 读取项目元数据、当前 story、版本摘要，可选完整版本快照和 exports |
| `kb_generate_story_blueprint` | 已完成 | 从知识库条目生成类型片 StoryBlueprint |
| `kb_validate_genre_story` | 已完成 | 只读校验 Story Agent 结果的类型片质量，支持 project_id、story_id、story_json |
| `kb_generate_gears_delivery` | 已完成 | 只读生成 GEARS 交付包，支持 project_id、story_id、story_json |
| `kb_generate_seedance_prompt` | 已完成 | 只读生成 Seedance 2.0 镜头提示词包和素材引用计划 |
| `kb_repair_story(auto_apply=false)` | 已完成 | 只读生成修复动作、目标场景、字段提示和风险说明 |
| `kb_update_project_version` | 已完成 | 将 Agent 产出的 story snapshot 受控写入项目新版本，不覆盖旧版本 |

### 2.2 已完成配置

| 配置 | 状态 |
|---|---|
| Mac Codex 全局 `china-culture-kb` MCP | 已接入 |
| `.codex/mcp-config.md` | 已新增 |
| `.codex/mcp-upgrade-roadmap.md` | 已新增 |
| `.claude/settings.mac.example.json` | 已新增 |
| `.claude/settings.local.json` MCP 权限 | 已扩展 |
| `开发文档/installed-ai-tools.md` | 已更新 |

### 2.3 已完成项目级 skills

| Skill | 位置 | 用途 |
|---|---|---|
| `china-culture-story-agent` | `.codex/skills/china-culture-story-agent/` | Story Agent 生成链路、蓝图、校验、修复、项目版本规则 |
| `china-culture-screenwriting` | `.codex/skills/china-culture-screenwriting/` | 中国文化知识库编剧、事实边界、类型片写作规则 |
| `gears-seedance-delivery` | `.codex/skills/gears-seedance-delivery/` | GEARS delivery、Seedance prompt、字段分离和 prompt 清洗规则 |

---

## 3. 实施原则

### 3.1 先只读，后写入

优先实现只读 MCP：

1. `kb_validate_genre_story`
2. `kb_generate_gears_delivery`
3. `kb_generate_seedance_prompt`
4. `kb_repair_story(auto_apply=false)`

最后再实现自动应用型 MCP：

1. `kb_repair_story(auto_apply=true)`

原因：

- 只读工具风险低；
- 可以先稳定输入输出契约；
- 后续写入版本时能复用已验证的读取、校验、交付逻辑。

### 3.2 Web 服务与 MCP 行为保持一致

MCP 不应成为第二套孤立 Story Agent。

优先策略：

- 能复用 web/server service 的逻辑时，抽取共享纯函数；
- 如果跨包 import 会引入 alias 或运行时复杂度，则 MCP 先做轻量本地版本；
- 文档必须明确 MCP-local 版本与 Web 端完整版本的差异。

### 3.3 不写知识库事实文件

以下 MCP 不得写入：

```text
data/provinces/*.md
```

允许写入的只有明确 intake/write 工具，例如：

- `kb_add_entry`
- `kb_add_region_entry`
- `kb_ingest_video`
- `kb_collect`

Story Agent 生成、修复、交付相关内容应写入：

```text
web/generated/
```

或只返回 JSON。

### 3.4 每个工具必须有测试

每新增一个 MCP 工具，都必须完成：

```text
1. tool 文件
2. index 注册
3. 单元测试
4. npm run build
5. npm test -- 新工具
6. npm test 全量
7. 真实项目 smoke
8. 权限与文档更新
```

---

## 4. Phase 1：类型质量校验 MCP

### 4.1 目标

新增：

```text
kb_validate_genre_story
```

状态：已完成第一版 MCP-local 轻量校验，输出结构与 Web 端质量报告字段对齐。

让 MCP 能判断一个 Story Agent 结果是否符合所选 `video_type` 的类型片要求。

### 4.2 输入设计

```json
{
  "project_id": "20260614-story-5xim--ai_comic_drama",
  "story_id": "可选",
  "story_json": "可选，JSON 字符串",
  "include_repair_actions": true
}
```

读取优先级：

1. `project_id`
2. `story_id`
3. `story_json`

### 4.3 输出设计

```json
{
  "story_id": "20260614-story-5xim",
  "project_id": "20260614-story-5xim--ai_comic_drama",
  "video_type": "ai_comic_drama",
  "story_structure": "single_event_drama",
  "passed": false,
  "genre_score": 72,
  "issues": [],
  "missing_required_elements": [],
  "weak_beats": [],
  "forbidden_patterns_found": [],
  "repair_actions": []
}
```

### 4.4 第一版覆盖类型

优先覆盖 6 类：

| 类型 | 关键校验 |
|---|---|
| `ai_comic_drama` | 对白/旁白、表情动作、强钩子、结尾追看问题、分镜画面 |
| `historical_drama` | 史实锚点、事件因果、制度/时代压力、创作边界 |
| `character_story` | 主角目标、阻力、价值选择、代价、人物弧光 |
| `heritage_promo` | 手部动作、工具材料、工艺流程、传承关系、现代连接 |
| `explainer_video` | 核心问题、概念定义、例子、可视化解释、总结 |
| `scene_short` | 空间路线、视觉节点、时间层、氛围收束 |

### 4.5 实现文件

新增：

```text
mcp-server/src/tools/validate-genre-story.ts
mcp-server/__tests__/validate-genre-story.test.ts
```

修改：

```text
mcp-server/src/index.ts
.claude/settings.local.json
.codex/mcp-upgrade-roadmap.md
开发文档/installed-ai-tools.md
```

已同步：

```text
.codex/mcp-config.md
.codex/skills/china-culture-story-agent/references/story-agent-contract.md
```

### 4.6 验收标准

- 能读取已有 `project_id` 并返回质量报告；
- 能接受直接传入的 `story_json`；
- 能识别至少以下问题：
  - AI 漫剧缺对白；
  - 非遗宣传缺工艺步骤；
  - 历史剧情缺史实边界；
  - 人物故事写成生平流水账；
  - 讲解视频缺核心问题；
  - 场景短片缺空间路线；
- `npm test -- validate-genre-story` 通过；
- `npm test` 全量通过。

---

## 5. Phase 2：GEARS 交付 MCP

### 5.1 目标

新增：

```text
kb_generate_gears_delivery
```

从 story 或 project version 生成 GEARS-ready package。

### 5.2 输入设计

```json
{
  "project_id": "20260614-story-5xim--ai_comic_drama",
  "version_id": "可选",
  "story_json": "可选，JSON 字符串",
  "include_markdown": true
}
```

### 5.3 输出设计

```json
{
  "schema_version": "gears-delivery/v1",
  "project_id": "...",
  "story_id": "...",
  "title": "...",
  "summary": {},
  "characters": [],
  "scenes": [],
  "units": [],
  "validation_notes": [],
  "markdown": "可选"
}
```

### 5.4 字段分离规则

必须保持：

| 字段 | 内容 |
|---|---|
| `script_text` | 剧本文本、动作、对白、旁白 |
| `visual_prompt` | 空间、人物、道具、光线、构图、氛围 |
| `camera_suggestion` | 景别、运镜、角度、节奏 |
| `segment_prompt_hint` | 风格、制作要求、连续性、限制 |
| `validation_notes` | 给人或 agent 的问题说明，不混入 prompt |

### 5.5 实现文件

新增：

```text
mcp-server/src/tools/generate-gears-delivery.ts
mcp-server/__tests__/generate-gears-delivery.test.ts
```

可选新增：

```text
mcp-server/src/lib/story-projects.ts
mcp-server/src/lib/gears-delivery.ts
```

### 5.6 验收标准

- 能从 `project_id` 读取当前版本；
- 能从 `story_json` 直接生成；
- 返回 units；
- 对缺少 `script_text` 的场景给出 `validation_notes`；
- 能清理明显 prompt 污染；
- 不写文件；
- 全量测试通过。

---

## 6. Phase 3：Seedance 提示词 MCP

### 6.1 目标

新增：

```text
kb_generate_seedance_prompt
```

把单个 scene 或 GEARS segment 转成即梦 Seedance 2.0 提示词。

### 6.2 输入设计

```json
{
  "project_id": "...",
  "scene_id": 1,
  "segment_id": 1,
  "duration_sec": 15,
  "language": "zh",
  "reference_assets": [
    {
      "ref": "@图片1",
      "role": "人物形象参考"
    }
  ]
}
```

### 6.3 输出设计

```json
{
  "prompt": "0-3秒：...",
  "duration_sec": 15,
  "asset_roles": [],
  "checks": {
    "has_time_segments": true,
    "has_audio_direction": true,
    "has_camera_language": true,
    "has_reference_roles": true
  },
  "warnings": []
}
```

### 6.4 规则来源

项目级：

```text
.codex/skills/gears-seedance-delivery/references/gears-seedance-contract.md
```

Codex 全局：

```text
seedance-prompt-zh
seedance-prompt-en
```

### 6.5 验收标准

- 8 秒以上自动分时段；
- 每个 `@素材` 都有用途；
- 包含镜头语言；
- 包含音效/音乐提示；
- 能提示时长过载、引用模糊、写实真人脸素材风险；
- 不混入质量报告或内部字段名；
- 全量测试通过。

---

## 7. Phase 4：故事修复 MCP

### 7.1 目标

新增：

```text
kb_repair_story
```

先做只读修复包，再做自动应用。

### 7.2 第一版：只读修复包

输入：

```json
{
  "project_id": "...",
  "repair_instruction": "增强对白冲突和结尾钩子",
  "auto_apply": false
}
```

输出：

```json
{
  "repair_plan": [],
  "repair_prompt_package": {
    "system_prompt": "...",
    "user_prompt": "..."
  },
  "target_scenes": [],
  "expected_changes": []
}
```

### 7.3 第二版：自动应用

输入：

```json
{
  "project_id": "...",
  "repair_instruction": "增强第1场钩子",
  "auto_apply": true
}
```

输出：

```json
{
  "project_id": "...",
  "version_id": "...",
  "before_quality_report": {},
  "after_quality_report": {},
  "changed_scene_ids": []
}
```

### 7.4 实现文件

新增：

```text
mcp-server/src/tools/repair-story.ts
mcp-server/__tests__/repair-story.test.ts
```

可能复用：

```text
web/server/src/services/story-repair-service.ts
web/server/src/services/quality-repair-service.ts
```

### 7.5 验收标准

- `auto_apply=false` 不写文件；
- 修复包能引用质量报告问题；
- 目标场景明确；
- 不把虚构补足写成事实；
- `auto_apply=true` 安全应用首版已完成：必须由调用方提供 `repaired_story_json`，工具会先校验修复后 story，再通过 `kb_update_project_version` 写入新版本。

---

## 8. Phase 5：项目版本更新 MCP

### 8.1 目标

新增：

```text
kb_update_project_version
```

让 agent 能把修复后的 story snapshot 保存成项目新版本。

### 8.2 输入设计

```json
{
  "project_id": "...",
  "change_type": "quality_repair",
  "change_target": {
    "scene_ids": [1, 2]
  },
  "snapshot_json": "{...}",
  "user_instruction": "增强第1场钩子"
}
```

### 8.3 输出设计

```json
{
  "project_id": "...",
  "version_id": "...",
  "current_version_id": "...",
  "version_count": 2,
  "updated_at": "..."
}
```

### 8.4 写入规则

必须：

- 新增 `versions/{version_id}.json`；
- 更新 `project.json`；
- 不覆盖旧版本；
- 保留 `created_at`；
- 更新 `updated_at`；
- 更新 `current_version_id`；
- 能被 `kb_get_project_context` 读取。

不得：

- 写入 `data/provinces/*.md`；
- 直接覆盖 `web/generated/stories/{video_type}/{storyId}.json`；
- 在 snapshot 中丢失 `quality_report`、`story_blueprint`、`gears_segments` 等已有字段。

### 8.5 验收标准

- 新版本写入成功；
- 旧版本仍存在；
- `kb_get_project_context(include_versions=true)` 能读到新版本；
- 测试覆盖非法 project id、缺失 snapshot、无效 JSON；
- 全量测试通过。

### 8.6 当前实现状态

已完成首版：

- 实现文件：`mcp-server/src/tools/update-project-version.ts`。
- 测试文件：`mcp-server/__tests__/update-project-version.test.ts`。
- 注册工具：`kb_update_project_version`。
- 输入限定 `change_type` 为 `scene_regeneration`、`quality_repair`、`production_board_repair`。
- 写入时新增版本快照并更新 `project.json`，不覆盖旧版本、不写省份知识库、不覆盖 generated story 原始文件。
- `snapshot_json` 省略 `quality_report`、`story_blueprint`、`gears_segments` 等关键字段时，会从当前版本补回并返回 `preserved_fields`。
- 已通过 `npm test -- __tests__/update-project-version.test.ts`、`npm test`、`npm run build`。

### 8.7 Repair auto_apply 当前实现状态

已完成安全应用首版：

- `kb_repair_story` 新增 `repaired_story_json` 和 `user_instruction`。
- `auto_apply=true` 时必须同时提供 `project_id` 和 `repaired_story_json`。
- 工具不会自行虚构修复正文；只负责校验调用方提供的修复后 story，并调用 `kb_update_project_version` 写入 `quality_repair` 新版本。
- 返回 `after_quality_snapshot`、`update_result`、`risk_notes`。
- 缺少 `repaired_story_json` 时只返回 dry-run 和阻断说明。
- 已通过 `npm test -- __tests__/repair-story.test.ts`、`npm test`、`npm run build`。

---

## 9. Phase 6：前端质量反馈视图

### 9.1 目标

让用户在 Story Agent 工作台中看见：

- 类型匹配度；
- 缺失元素；
- 弱节拍；
- 禁止模式；
- 修复建议；
- GEARS readiness；
- Seedance prompt readiness。

当前状态：已完成首版。

### 9.2 可能改动文件

```text
web/client/src/components/StoryResult.vue
web/client/src/views/ProjectDetail.vue
web/client/src/api/projects.ts
web/server/src/routes/projects.ts
web/server/src/services/project-service.ts
web/shared/types.ts
web/shared/schemas.ts
```

### 9.3 设计原则

- 不做营销页；
- 信息密度适中；
- 以项目详情页为中心；
- 质量报告可扫描；
- 修复动作可直接触发；
- GEARS/Seedance readiness 与实际导出动作相邻。

### 9.4 验收标准

- 项目详情页能显示质量报告；已完成。
- 用户能知道为什么“不像 AI 漫剧”；已通过缺失要素、弱节拍、不适配表达和修复建议首版覆盖。
- 用户能知道为什么“不适合 GEARS 交付”；已有 GEARS Readiness 卡片。
- 质量问题能关联到 scene 或 segment；修复动作已显示关联场景 ID 和标题。
- 浏览器 smoke：本机缺 Chrome 可执行文件，已用 `web/client npm run build`、本地页面 200 和 API 200 替代；后续需在有 Chrome 的环境补视觉回归。

---

## 10. Phase 7：文档与配置收口

### 10.1 目标

保持人类文档、Codex skills、MCP roadmap、实际代码一致。

### 10.2 必改文件

```text
开发文档/installed-ai-tools.md
开发文档/story-agent-mcp-quality-delivery-implementation-plan.md
.codex/mcp-config.md
.codex/mcp-upgrade-roadmap.md
.codex/skills/china-culture-story-agent/references/story-agent-contract.md
.codex/skills/gears-seedance-delivery/references/gears-seedance-contract.md
.claude/settings.local.json
```

### 10.3 验收标准

- 工具数量准确；
- 工具状态准确；
- implemented / planned 标注清楚；
- 权限列表包含新增 MCP；
- skills 触发描述与实际代码一致；
- 文档不再停留在过期工具清单。

---

## 11. 推荐执行顺序

```text
1. kb_validate_genre_story
2. kb_generate_gears_delivery
3. kb_generate_seedance_prompt
4. kb_repair_story(auto_apply=false)（已完成）
5. kb_update_project_version（已完成）
6. kb_repair_story(auto_apply=true)（已完成安全应用首版）
7. 前端质量反馈视图
8. 文档与配置总收口
```

---

## 12. 每个 MCP 工具的固定完成清单

每个工具完成时必须检查：

```text
[ ] 新增 mcp-server/src/tools/{tool}.ts
[ ] 在 mcp-server/src/index.ts 注册
[ ] 新增 mcp-server/__tests__/{tool}.test.ts
[ ] npm run build
[ ] npm test -- {tool}
[ ] npm test
[x] 真实项目 smoke
[ ] 更新 .claude/settings.local.json
[ ] 更新 .codex/mcp-upgrade-roadmap.md
[ ] 更新 .codex/mcp-config.md
[ ] 更新 开发文档/installed-ai-tools.md
[ ] 如涉及 skill 规则，更新 .codex/skills/*/references
```

---

## 13. 风险与控制

### 13.1 风险：MCP 与 Web 端逻辑分叉

控制：

- 优先抽纯函数；
- MCP-local 逻辑必须标注为轻量版本；
- 后续稳定后再考虑共享包。

### 13.2 风险：修复工具误改知识库事实

控制：

- 修复只作用于 story/project；
- evidence boundaries 必须随版本保存；
- 不允许写 `data/provinces/*.md`。

### 13.3 风险：Seedance prompt 混入分析文字

控制：

- prompt 字段与 validation 字段分离；
- 测试中加入 prompt pollution case；
- 使用 `gears-seedance-delivery` skill 规则。

### 13.4 风险：版本更新破坏历史快照

控制：

- 永远新增版本；
- 不覆盖旧版本；
- `kb_get_project_context` 必须能回读；
- 测试覆盖多版本。

---

## 14. 近期最小下一步

已完成：

```text
kb_validate_genre_story
kb_generate_gears_delivery
kb_generate_seedance_prompt
kb_repair_story(auto_apply=false)
kb_update_project_version
kb_repair_story(auto_apply=true，需 repaired_story_json)
单故事 Seedance provider 队列元数据首版
单故事 Seedance provider 超时恢复首版
单故事 Seedance provider 外部回传 schema 首版
```

完成原因：

- 它是质量闭环入口；
- 后续 `repair_story`、`gears_delivery`、`seedance_prompt` 都需要它；
- 当前已有 `StoryBlueprint` 和 genre profile 基础；
- 可先做只读，不影响现有生成与项目版本。

第一版验收：

```text
npm run build
npm test -- validate-genre-story
npm test
真实项目 smoke：读取 20260614-story-5xim--ai_comic_drama 并输出质量报告
```

下一步建议继续实现：

```text
repair_story 模型生成链路 + Seedance provider 自动轮询/真实 API
```

原因：

- MCP 已经能读项目、验证质量、生成 GEARS/Seedance 只读交付包、给出修复建议，并能受控新增项目版本；
- Web 工作台已有 provider 提交抽象、队列元数据、超时恢复和外部回传 schema，下一层应补自动轮询和真实 provider API；
- `kb_repair_story(auto_apply=true)` 仍要求调用方提供 `repaired_story_json`，下一步要让模型根据 repair_actions 生成可校验快照。

- 质量报告已经能指出问题；
- GEARS 交付包是修复和 Seedance prompt 之前最直接的生产输出；
- 仍然可以保持只读，不增加项目写入风险。
