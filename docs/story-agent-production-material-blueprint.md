# Story Agent 生产素材体系开发蓝图

更新时间：2026-06-27

## 本轮对话已完成

1. 明确当前素材库的补充逻辑：项目已经有知识条目、知识组合包、项目素材包、素材充分度 gate、类型画像矩阵和 StoryBlueprint，但缺少“按成片类型稳定生产”的素材模板层。
2. 选择首批稳定产出的三类片：`heritage_promo`、`documentary_short`、`ai_comic_drama`。
3. 为三类片建立生产素材包：每类一套 `required_fields`、三阶段 gate、补充问题和 10 条样板条目。
4. 记录 B站 `BV1xuVC6AEbg` 爆款 AI 漫剧解说来源，但限定为 `ai_comic_drama`，不作为全类型参考。
5. 联网补充模板依据：非遗官方影音资源、纪录片技法、B-roll 论文、Seedance 2.0、Video-of-Thought、角色/动作一致性论文。
6. 接入 Story Agent 自动调用：按 `video_type` 读取当前类型生产素材模板，写入 prompt、生成结果和 `_request_meta`。
7. 新增生产素材 readiness：模板字段不只是进入 prompt，还会生成缺口报告和补库任务。

## 原始诊断必须并入路线

底层素材库仍然是 `data/provinces/*.md` 的省份 Markdown 条目。每条条目由简介、故事梗概、文化意义、地点、关键词、来源、可信度、核实方法和待核实点构成；可选机器字段包括 `knowledge_domain`、`entry_role`、`era`、`asset_usage`、`asset_split`。

补库工具分两类：

- 写入型：`kb_collect`、`kb_ingest_video`、`kb_add_entry`。
- 检索/策略型：`kb_supplement`，只找同名异地版本、同省同类型素材、相关条目和本地化关系，不自动写入事实。

生成链路已经会把条目转成 `knowledge_pack`，再转成 `material_pack`，并运行 `minimum_viable_story -> script_ready -> production_ready` 三阶段 gate。类型矩阵已经覆盖 15 类片，但省份条目本身还没有大规模升级为生产卡片。

当前库的真实问题（2026-06-27 审计后）：

- 已整理 169 条，湖南 124 条。
- 类型集中在非遗、地方掌故、名胜古迹、历史人物。
- 平均来源数 3.77；可信度已归一为枚举，独立 `核实方法` section 已补齐。
- 169 条均已有机器字段；仍有 168 条存在待核点，只有 7 条有 `asset_split`。
- 湖南后段若干条目存在旧导入残留：`[object Object]` 来源行、`undefined：undefined` 地点行，需要单独做来源/地点清洗，不能盲目当作事实补写。
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

下一步。

- 将 production readiness 写入 `quality_report`。
- 当 production_ready 阶段缺口过多时，GEARS 交付状态降级为 `needs_input`。
- repair prompt 可针对缺字段生成补救版场景或素材采集清单。

### Phase 4：前端工作台

下一步。

- 在项目详情页显示当前类型生产模板。
- 展示 readiness 分数、缺口字段、阶段 gate。
- 支持筛选 `production_material_missing_field` 补充任务。

### Phase 5：在线模板采集流水线

下一步。

- 给任意新类型输入 3 到 6 个外部来源。
- 自动生成候选 `ProductionMaterialPack`。
- 人工确认后写入 `data/production-packs`。
- 自动生成隔离测试，确认只进入目标 `video_type`。

### Phase 6：省份条目批量升级为生产卡片

状态：可信度归一化和机器字段补齐已完成；asset_split 和类型最小素材包仍待批量补齐。

- 已标准化 `可信度` 枚举：`可靠 / 基本可靠 / 待核实 / 存疑 / 混合`。
- 已把 87 条旧 `可信度与核实` 合并 section 拆成独立 `可信度` 和 `核实方法`。
- 已把 60 条显式 `可信度` 长说明挪入 `核实方法`，确保 `可信度` 只保留枚举。
- 已为 146 条缺机器字段条目补齐 `knowledge_domain`、`entry_role`、`asset_usage`，并在可推断时补 `era`；当前审计显示 169 条均有机器字段。
- 下一步对高优先级条目补齐 `asset_split`。
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
- `mcp-server/src/tools/plan-production-material-upgrade.ts`
- `mcp-server/src/tools/normalize-credibility-sections.ts`
- `mcp-server/src/tools/enrich-machine-metadata.ts`

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

1. 批量补 `asset_split`：人物、场景、人物随身道具、场景陈设。
2. 清洗旧导入残留：`[object Object]` 来源、`undefined：undefined` 地点，并回溯补源。
3. 处理来源等级缺口和少量 `era` 精细化缺口。
4. 把 readiness 接进质量报告和 GEARS 交付状态。
5. 在前端显示生产模板缺口。
6. 扩第四类高频类型模板，建议从 `social_short` 或 `explainer_video` 选一个。
7. 做一个在线模板采集命令，避免每次手工写 JSON。
