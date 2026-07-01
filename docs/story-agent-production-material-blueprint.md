# Story Agent 生产素材体系开发蓝图

更新时间：2026-07-02

## 本轮对话已完成

1. 明确当前素材库的补充逻辑：项目已经有知识条目、知识组合包、项目素材包、素材充分度 gate、类型画像矩阵和 StoryBlueprint，但缺少“按成片类型稳定生产”的素材模板层。
2. 选择首批稳定产出的三类片：`heritage_promo`、`documentary_short`、`ai_comic_drama`。
3. 为三类片建立生产素材包：每类一套 `required_fields`、三阶段 gate、补充问题和 10 条样板条目。
4. 记录 B站 `BV1xuVC6AEbg` 爆款 AI 漫剧解说来源，但限定为 `ai_comic_drama`，不作为全类型参考。
5. 联网补充模板依据：非遗官方影音资源、纪录片技法、B-roll 论文、Seedance 2.0、Video-of-Thought、角色/动作一致性论文。
6. 接入 Story Agent 自动调用：按 `video_type` 读取当前类型生产素材模板，写入 prompt、生成结果和 `_request_meta`。
7. 新增生产素材 readiness：模板字段不只是进入 prompt，还会生成缺口报告和补库任务。
8. 完成 Phase 3 核心联动：`production_material_readiness` 已进入 `quality_report`，会参与 `passed` 判断、生成 `production_material` 修复动作，并让 GEARS 交付包在生产素材未达 `production_ready` 时降级为 `needs_input`。
9. 完成 Phase 4 首版前端接入：项目详情和生成结果页已显示 Production Material 质量卡与生产素材缺口；补充任务页已支持筛选 `production_material_missing_field`。
10. 完成 Phase 5 首版模板草案流水线：新增 `kb_draft_production_pack` / `npm run kb:draft-production-pack`，可从目标类型来源观察生成候选 `ProductionMaterialPack`、审稿清单和警告；已生成 AI 漫剧草案报告。

## 原始诊断必须并入路线

底层素材库仍然是 `data/provinces/*.md` 的省份 Markdown 条目。每条条目由简介、故事梗概、文化意义、地点、关键词、来源、可信度、核实方法和待核实点构成；可选机器字段包括 `knowledge_domain`、`entry_role`、`era`、`asset_usage`、`asset_split`。

补库工具分两类：

- 写入型：`kb_collect`、`kb_ingest_video`、`kb_add_entry`。
- 检索/策略型：`kb_supplement`，只找同名异地版本、同省同类型素材、相关条目和本地化关系，不自动写入事实。

生成链路已经会把条目转成 `knowledge_pack`，再转成 `material_pack`，并运行 `minimum_viable_story -> script_ready -> production_ready` 三阶段 gate。类型矩阵已经覆盖 15 类片，但省份条目本身还没有大规模升级为生产卡片。

当前库的真实问题（2026-07-01 审计后）：

- 已整理 169 条，湖南 124 条。
- 类型集中在非遗、地方掌故、名胜古迹、历史人物。
- 十三批回溯后平均来源数 3.53；可信度已归一为枚举，独立 `核实方法` section 已补齐。
- 169 条均已有机器字段；仍有 168 条存在待核点，严格四段口径已有 169 条有完整 `asset_split`。
- 湖南后段 40 条旧导入残留已清理：删除 188 条 `[object Object]` 来源占位和 119 条 `undefined：undefined` 地点占位；十三批回溯后缺来源、缺相关地点均已清零。
- Asset Split 建议报告已生成并清空：剩余 0 条缺完整 `asset_split` 的条目，0 条需要先补来源/地点。
- 当前完成百分比：`source_location_backfill` 已完成 37/37（100%）；正式完整 `asset_split` 写回 169/169（100%）；`kb:lint` 已覆盖 34 个文件、169 条 enriched entries 并通过。
- 结构化资产字段覆盖率仍低，整体正在从文化故事资料库升级为多片型生产素材库。

因此，后续开发必须同时推进两条线：

1. 类型生产模板线：继续扩 `ProductionMaterialPack`。
2. 底库治理线：把省份 Markdown 条目批量审计、标准化、补齐生产卡片字段。

## 总体目标

把素材库从“能查文化资料”升级为“能稳定生产不同类型影片”的生产系统：

```text
文化条目 / 用户素材 / 外部样片研究
  -> MaterialPack
  -> MaterialSufficiencyReport
  -> ProductionMaterialPack
  -> ProductionMaterialReadinessReport
  -> StoryBlueprint
  -> full_text / scene_breakdown / gears_segments
  -> quality report / supplement tasks / repair
```

## 架构分层

### 1. 数据层

文件：

- `data/provinces/*.md`
- `data/production-packs/video-type-material-supplement-packs.json`
- `sources/videos/BV1xuVC6AEbg.md`
- `docs/video-type-online-template-research.md`

职责：

- 按 `video_type` 存储生产素材模板。
- 每个来源必须标注 `applies_to_video_types`。
- 样板条目只能作为生产组织方式参考，不能直接写入知识事实。
- 省份 Markdown 条目必须逐步补齐生产卡片字段：已确认事实、待核事实、可戏剧化空间、人物、场景、道具、服饰/时代、视觉符号、对白口吻、禁用表达和来源等级。

### 2. 自动分类调用层

文件：

- `web/server/src/services/production-material-pack-service.ts`
- `web/server/src/services/story-service.ts`
- `web/server/src/services/story-generation-prompt.ts`

职责：

- 从生成请求解析 `video_type`。
- 自动取当前类型模板。
- 禁止把其他类型的爆款样片方法跨类型套用。

### 3. 生产缺口管理层

文件：

- `web/server/src/services/production-material-readiness-service.ts`
- `web/shared/types.ts`
- `web/server/src/services/project-service.ts`
- `web/server/src/routes/projects.ts`

职责：

- 将模板 `required_fields` 与当前 `MaterialPack` 做保守匹配。
- 生成 `production_material_readiness`。
- 将缺口字段转为 `supplement_tasks`，来源为 `production_material_missing_field`。

### 4. 质量与修复层

后续要接入：

- `genre-quality-service.ts`
- `story-repair-service.ts`
- `gears-delivery-service.ts`

目标：

- 不只检查故事质量，也检查“该类型能不能进入生产”。
- 对 production_ready 缺口给出修复动作，而不是只提示素材不足。

## 开发路线

### Phase 0：底库生产化审计

状态：首版已完成。

- 扫描 `data/provinces/*.md`，统计条目数量、地区/类型分布、来源数、可信度、核实方法、待核点。
- 审计每条是否具备生产卡片字段：人物、场景、道具、时代/服饰、视觉符号、禁用表达、asset usage、asset split。
- 审计每条适合哪些成片类型，以及缺哪些类型化素材字段。
- 输出 Markdown/JSON 报告，不直接批量改老条目。

产物：

- `docs/knowledge-base-production-audit.md`
- `data/reports/knowledge-base-production-audit.json`
- `mcp-server/src/tools/audit-production-materials.ts`

### Phase 1：三类模板可调用

状态：已完成。

- 三类模板：非遗宣传片、微纪录片、AI 漫剧。
- 自动按 `video_type` 调用。
- prompt 中明确模板边界。
- 测试覆盖跨类型隔离。

### Phase 2：模板缺口可管理

状态：本轮已完成首版。

- 新增 `ProductionMaterialReadinessReport`。
- 新增 `production-material-readiness-service.ts`。
- 生成结果带 `production_material_readiness`。
- 模板缺口自动进入项目补充任务。

### Phase 3：质量报告联动

状态：核心联动已完成，前端展示待接入。

- 已将 production readiness 写入 `quality_report.production_material_readiness_report`。
- 已让 production readiness 参与 `quality_report.passed`：状态非 `ready`、分数低于 70 或有阻塞字段时，质量报告自动降级。
- 已新增 `production_material` 修复动作，repair prompt 会按缺字段生成素材补充清单。
- 已让 GEARS 交付包写入 `delivery_status`：生产素材未达 `production_ready` 时降级为 `needs_input`，并在 `validation_notes` 和 Markdown 中显示缺口。
- 待继续：把这些状态接入前端工作台的质量面板和补充任务筛选。

### Phase 4：前端工作台

状态：首版已完成，细化交互待继续。

- 已在项目详情页质量区显示 Production Material 分数、状态和缺口摘要。
- 已在 `StoryResult` 的可修复质量报告区显示 Production Material 卡片。
- 已在补充任务页支持筛选 `production_material_missing_field`。
- 待继续：在项目详情页单独展示当前类型生产模板、三阶段 gate 和推荐补充问题。

### Phase 5：在线模板采集流水线

状态：首版草案生成已完成，联网采集与正式写入仍需人工确认。

- 已新增 `mcp-server/src/tools/draft-production-material-pack.ts`，从正式 packs 的 `source_observations` 和可选外部观察 JSON 生成候选 `ProductionMaterialPack`。
- 已新增命令 `npm run kb:draft-production-pack -- --video-type <type>`，输出 Markdown 审稿稿和 JSON 报告。
- 已新增 MCP 工具 `kb_draft_production_pack`，支持传入目标 `videoType` 和额外来源观察 JSON。
- 已生成样例产物：`docs/production-material-pack-draft-ai_comic_drama.md` 与 `data/reports/production-material-pack-draft-ai_comic_drama.json`。
- 待继续：接入真实联网采集、人工确认写入、正式包隔离测试自动生成。

### Phase 6：省份条目批量升级为生产卡片

状态：可信度归一化、机器字段补齐、导入残留清洗、来源/地点回溯、asset_split 候选建议和 asset_split 审稿写回已完成；严格四段式生产资产覆盖率 169/169（100%），类型最小素材包仍待继续做更细的片型增强。

- 已标准化 `可信度` 枚举：`可靠 / 基本可靠 / 待核实 / 存疑 / 混合`。
- 已把 87 条旧 `可信度与核实` 合并 section 拆成独立 `可信度` 和 `核实方法`。
- 已把 60 条显式 `可信度` 长说明挪入 `核实方法`，确保 `可信度` 只保留枚举。
- 已为 146 条缺机器字段条目补齐 `knowledge_domain`、`entry_role`、`asset_usage`，并在可推断时补 `era`；当前审计显示 169 条均有机器字段。
- 已清理 40 条旧导入残留，并在升级计划中新增 `source_location_backfill` 批次。
- 已完成十三批来源/地点回溯，当前审计显示 0 条缺来源、0 条缺相关地点；原 37 条高优先级补源队列已完成 37 条（100%）。
- 已修正 Markdown 条目解析边界，避免跨 `---` 或地区小标题读取后续条目的资产段。
- 已生成并清空 `Asset Split` 建议报告：剩余 0 条可进入编辑审稿，0 条需先走 `source_location_backfill`。
- 已正式写回 169 条完整 `asset_split`，严格覆盖率 169/169（100%）；下一步转入片型最小素材包增强、quality/readiness 联动和前端工作台。
- 按片型补最小素材包：
  - 人物/历史剧情：中心事件、人物目标、阻力、选择、代价、时代物件。
  - 纪录片：现实地点、可引用来源、采访/见证人、再现边界。
  - 非遗/工艺：完整流程、材料工具、手部动作、传承人、当代困境。
  - 城市/场景/山水：空间路线、地标节点、季节光影、生活场景。
  - 讲解/培训：核心问题、知识层级、例子、步骤、复盘。
  - 漫剧/短视频：前三秒钩子、对白冲突、表情动作、反转/追看钩子。

产物：

- `docs/knowledge-base-production-upgrade-plan.md`
- `data/reports/knowledge-base-production-upgrade-plan.json`
- `docs/knowledge-base-credibility-normalization.md`
- `data/reports/knowledge-base-credibility-normalization.json`
- `docs/knowledge-base-machine-metadata-enrichment.md`
- `data/reports/knowledge-base-machine-metadata-enrichment.json`
- `docs/knowledge-base-import-residue-cleanup.md`
- `data/reports/knowledge-base-import-residue-cleanup.json`
- `docs/knowledge-base-asset-split-suggestions.md`
- `data/reports/knowledge-base-asset-split-suggestions.json`
- `mcp-server/src/tools/plan-production-material-upgrade.ts`
- `mcp-server/src/tools/normalize-credibility-sections.ts`
- `mcp-server/src/tools/enrich-machine-metadata.ts`
- `mcp-server/src/tools/clean-import-residue.ts`
- `mcp-server/src/tools/plan-asset-split-suggestions.ts`

### Phase 7：Domain Pack 扩库

下一步。

- 朝代设定包。
- 地域文化包。
- 非遗流程包。
- 纪录片来源包。
- 儿童改写规则包。
- AI 漫剧分镜包。
- 短视频钩子包。
- 宣讲/培训结构包。

## 近期优先级

1. 回溯补源：`source_location_backfill` 已完成 37/37（100%），后续只需在新增条目进入队列时增量处理。
2. 审稿写回 `asset_split`：剩余 0 条，正式完整写回已到 169/169（100%）。
3. 处理来源等级缺口和少量 `era` 精细化缺口。
4. 把 readiness 接进质量报告和 GEARS 交付状态：核心链路已完成，下一步做前端显示。
5. 在前端显示生产模板缺口：首版已完成，下一步补模板详情和 gate 展示。
6. 扩第四类高频类型模板，建议从 `social_short` 或 `explainer_video` 选一个。
7. 在线模板采集命令：草案生成首版已完成，下一步补联网采集和正式写入审稿流。
