# Story Agent 下一阶段开发计划

> 日期：2026-07-04
> 分支：`codex-ai-comic-series-longform`
> 用途：给新对话快速接续 Story Agent、Production Board、GEARS / Seedance 交付链开发。

## 0. 2026-06-19 边界重定

新增权威计划：`docs/gears-execution-integration-plan.md`。

本项目重新定位为**内容与生产指挥层**，不再继续扩展真实图片、视频和后期执行器。图片、视频、字幕烧录、混音、片头片尾和最终装配等实际媒体产出统一交给 `Wy490/gears-v2`。

当前项目继续负责：

- 文化知识、故事、分镜、`gears_segments`、GEARS delivery 和 Seedance prompt。
- Production Board、素材 slot、Shot Ledger、GEARS Job Ledger、质量报告、审片返修和 dashboard。
- 向 GEARS 提交 job，接收 GEARS callback，并把 artifact / failure / review 状态写回项目。

暂停继续推进：

- 真实 Seedance / 外部视频平台 SDK 深接。
- 真实图片生成、字幕 burn-in、混音、片头片尾渲染和 final assemble。
- 独立媒体存储、转码、CDN 和 artifact 管理。

## 0.1 2026-06-23 产品重定位：从知识库到 AI 影视创作台

新增承接计划：`docs/story-agent-creative-platform-reposition-plan.md`。

本项目下一阶段不再以“补全知识库后生成故事”为核心心智，而是调整为**AI 影视前期创作、剧本生产与项目素材指挥系统**。面向用户扩展为：

- AI 漫剧公司：原创故事、系列设定、分集剧本、角色/场景资产说明、故事版交付。
- 改编团队：小说、资料、历史人物和地方故事改编为 AI 漫剧、短片或宣传片剧本。
- 企业、政府、协会和机构：宣传片、纪录短片、解说片、培训片、公益片、品牌片等类型片。

新的开发主线：

```text
项目素材 / 用户意图
  -> 创作合同 creation_contract
  -> 类型片蓝图 StoryBlueprint
  -> 故事 / 剧本 / 场景
  -> 分镜与资产说明
  -> 质量、真实度、交付 readiness
  -> 项目版本与生产指挥
```

P0 调整：

- 新增 `creation_use_case`、`truth_mode`、`creation_contract`、`material_pack`、`material_sufficiency`。
- 将 `KnowledgePack` 逐步升级为 `MaterialPack`，保留旧字段兼容。
- 把 `video_type` 与 `narrative_pattern_ids` 做成矩阵，集中写入 `genre-story-profiles.ts`。
- 把素材补充改成三阶段：`minimum_viable_story`、`script_ready`、`production_ready`。
- 前端文案逐步从“知识库 / 知识包 / 补录”改成“素材库 / 项目素材包 / 素材补充”。

下一轮若继续本项目产品化，应继续沿该计划推进 Story Agent 创作台能力，而不是追加知识库补录或 GEARS 媒体实产能力。

## 0.2 2026-06-27 单片类型生成质量收口

本轮提交：`22916a7d Improve single-video story generation quality`，已推送到 `origin/codex-ai-comic-series-longform`。

本轮重点不是继续堆新入口，而是修正用户在周敦颐样本中暴露出的核心问题：生成结果不能称为故事、正文被资料句污染、场景地点混成素材说明、AI 漫剧单片与系列分集心智混乱、质量检查没有识别自然剧情证据。已完成的单片生成修复包括：

- `AI漫剧单片` 不再默认携带系列/分集模板口吻，避免把“单片生成”写成“第 N 集连续剧”。
- 周敦颐样本已稳定生成 6 场可用故事，地点收敛到 `南安军衙`，不再把 `永州→道县（籍贯/出生地）；衡阳（少年成长地）` 写成正文地点。
- 清理生成污染：不再出现伪角色 `法可作为道`、无关引文 `爱之如子`、素材摘要直贴正文、质量检测词直贴 visual prompt。
- `character_story` 默认保留 6 场结构，避免少一场导致人物故事只有开端和标签、没有选择后果与主题落点。
- GEARS 分段交付会合并过短子段，避免屈原样本出现 `1.1` 这类不可拍碎片。
- 类型质量 gate 已能识别自然剧情证据，例如 `不能签字`、`证词前后不合`、`得罪上官`、`丢官`、`囚犯因此免死`、`郢都失守`、`怀石` 等，不再只认固定标签。
- 简单生成请求不会被误判为结构化大纲，只有出现明确大纲标记时才进入 outline 覆盖校验。

已验证单片矩阵：

| 样本 | 结果 | 关键检查 |
|---|---:|---|
| AI 漫剧单片：周敦颐拒签 | passed=true，genre 88，pattern 95，GEARS 100 | 地点 `南安军衙`，无坏词污染 |
| 人物故事：周敦颐拒签 | passed=true，genre 88，pattern 91，GEARS 100 | 6 场结构，有代价与主题落点 |
| 历史剧情：屈原投江 | passed=true，genre 91，pattern 89，GEARS 100 | 地点 `汨罗江畔`，短分段已合并 |
| 微纪录：岳阳楼 | passed=true，genre 91，pattern 89，GEARS 100 | 地点 `岳阳楼`，观众文本干净 |
| 非遗宣传：湘绣 | passed=true，genre 100，pattern 97，GEARS 100 | 地点 `湘绣工坊`，画面提示可生成 |

本轮测试：

- `web/server npm test`：26 个测试文件、393 个用例通过。
- `mcp-server npm test`：28 个测试文件、138 个用例通过。
- 单片矩阵临时生成检查通过。
- `git diff --check` 通过。

下一轮优先级：

1. 复测 AI 漫剧系列端到端，至少重新生成周敦颐系列第 1、2 集，确认每集正文不同、承接明确、不是单片模板重复套壳。
2. 处理导航信息架构：建议把“创作台 -> AI 漫剧”定位为单片/短片生成，把“漫剧系列”定位为多集连续剧规划与分集生产；若 UI 继续重复，需要改名或合并入口。
3. 完成产品命名全量审计：浏览器标题、应用标题、侧边栏、页面 meta 和导航应统一为 `AI影视工作台`，不再暴露 `中国传统文化知识库` 作为产品名；底层知识素材概念可保留。
4. 对旧生成物做治理选择：`20260625-story-5xin`、`20260625-story-5xie`、`20260625-series-39jg5et1` 是本轮修复前生成的失败样本，下一轮应决定删除、归档、重跑 repair，或作为回归测试样本保留。
5. 补一轮浏览器/UI smoke：覆盖 StoryStudio 单片生成、AiComicSeriesStudio 系列生成、ProjectDetail 质量面板和 Seedance/GEARS 导出按钮。

## 0.3 2026-06-27 AI 漫剧系列第 1/2 集生成收口

本轮承接 `0.2` 的第一优先级，专项复测并修正周敦颐 `AI 漫剧系列`第 1、2 集重复套壳问题。代码变更集中在 `web/server/src/services/ai-comic-series-service.ts` 与 `web/server/src/__tests__/outline-service.test.ts`。

已完成修复：

- 系列规划会识别“周敦颐 / 南安军衙 / 拒签冤案 / 良知”题材，核心主题收敛为 `拒签冤案中的良知选择`，不再把整句用户大纲当主题塞进标题、冲突和中段转折。
- 拒签案系列第 1、2、终局集有明确连续剧任务分工：第 1 集是“发现疑点并拒签”，第 2 集是“拒签后的上官压力、暂缓行刑、正式复核和丢官风险”，终局集才回收错案链条。
- 本地 fallback / 净化重写的第 2 集场景从旧的 `廊下截证 / 验印桌前 / 证词对质 / 旧录翻案 / 传唤入门` 改为 `上官召帖 / 暂缓行刑 / 堂前问责 / 旧案号一角 / 递出复核文书`。
- 第 2 集正文不再重复第 1 集“重新发现证物、重新看判词、重复验印缺口”的单片模板，而是承接上一集拒签结果，写出暂缓行刑、上官问责、复核文书和可能丢官的代价。
- 清理系列正文中的计划词泄漏：`回收上集未签文书`、`知识库使用规则`、`连续性账本`、`生成优先级` 等不会进入观众稿。
- 回归测试已覆盖周敦颐系列第 1、2 集相邻生成：第 2 集必须使用新的五场结构，包含“拒签的后果 / 暂缓行刑 / 复核文书 / 可能因此丢官”，并不得出现旧模板句 `重新看向判词`、`把新证移到验印桌前`、`同样的印痕缺口`。

本轮验证：

- 临时 smoke：`WEB_GENERATED_ROOT=/private/tmp/china-culture-ai-comic-series-smoke` 生成周敦颐 3 集系列。结果：第 1 集《未签的案卷》，第 2 集《召见之前》，第 2 集与第 1 集 bigram 相似度约 `0.095`，观众稿污染检查为 false。
- `cd web/server && npm test -- outline-service.test.ts`：32 个用例通过。
- `cd web/server && npm test`：26 个测试文件、393 个用例通过。
- `cd web/server && npm run lint` 通过。
- `git diff --check` 通过。

下一轮优先级更新：

1. 处理导航信息架构：`创作台 -> AI 漫剧` 应定位为单片/短片生成，`漫剧系列` 应定位为多集连续剧规划与分集生产；若 UI 继续重复，需要改名、合并或在入口层明确区隔。
2. 完成产品命名全量审计：浏览器标题、应用标题、侧边栏、页面 meta 和导航统一为 `AI影视工作台`，不再把 `中国传统文化知识库` 暴露为产品名；底层素材/来源条目概念可保留。
3. 对旧失败生成物做治理选择：`20260625-story-5xin`、`20260625-story-5xie`、`20260625-series-39jg5et1` 应删除、归档、重跑 repair，或固化为回归测试样本。
4. 补浏览器/UI smoke：覆盖 StoryStudio 单片生成、AiComicSeriesStudio 系列生成、ProjectDetail 质量面板和 Seedance/GEARS 导出按钮。

## 0.4 2026-06-27 导航心智与产品命名审计收口

本轮承接 `0.3` 的下一优先级，处理“创作台 AI 漫剧 vs 漫剧系列”的入口心智，并完成 `AI影视工作台` 可见命名审计。代码变更集中在 `web/client/src/App.vue`、`web/client/src/views/Home.vue`、`StoryStudio.vue`、`AiComicSeriesStudio.vue` 和 `Projects.vue`。

已完成修复：

- 全局导航从 `单片创作 / 系列漫剧` 收敛为 `单片短片 / 漫剧系列`。
- 首页工作台卡片明确区隔：`单片短片` 用于 AI 漫剧单片、纪录短片、宣传片和机构短片一次成稿；`漫剧系列` 用于多集主线、角色弧线、连续性账本和分集生产。
- `StoryStudio.vue` 页头改为 `单片短片创作`，并提供到 `漫剧系列` 的轻量互跳入口。
- `AiComicSeriesStudio.vue` 页头改为 `漫剧系列规划`，并提供到 `单片短片` 的轻量互跳入口。
- `Projects.vue` 的筛选、CTA、列表分区、状态 badge、空态和操作反馈统一为 `单片短片 / 单片项目 / 漫剧系列 / 分集项目`，减少“创作项目”和“系列漫剧”的混用。
- 可见产品命名审计：`web/client/index.html` 浏览器标题、`App.vue` 应用标题、首页 hero、导航和项目入口均为 `AI影视工作台` 或其业务子入口；未发现旧产品名 `中国传统文化知识库` 作为可见产品名残留。后端/MCP 中的 `知识库` 仍作为底层素材、兼容字段、内部检测词或工具说明保留。

本轮验证：

- `cd web/client && npm run lint` 通过。
- `rg "系列漫剧|多集系列漫剧|新建系列漫剧|打开系列工作台|单片创作|创作项目" web/client/src/App.vue web/client/src/views/Home.vue web/client/src/views/Projects.vue web/client/src/views/StoryStudio.vue web/client/src/views/AiComicSeriesStudio.vue` 无命中。
- `rg "中国传统文化知识库|传统文化知识库|文化知识库"` 在前端可见入口无命中。
- 浏览器 smoke 已覆盖 `/`、`/story/new`、`/ai-comic-series/new`、`/projects` 的默认桌面宽度和 390px 移动宽度：导航与页头均显示 `单片短片 / 漫剧系列`，旧入口词无命中，单片/系列互跳入口可见且未与标题重叠。

旧失败样本治理选择：

- `20260625-story-5xin`、`20260625-story-5xie` 仍保留在 `web/generated`，不做删除或改写。审计确认它们是修复前失败稿：正文地点混入 `永州→道县 / 衡阳` 资料句，质量不通过，标题和正文仍有旧系列模板痕迹。
- `20260625-series-39jg5et1` 仍保留在 `web/generated`，不做删除或改写。审计确认它是修复前旧系列样本：计划核心主题仍是 `拒签`，多集钩子重复 `主角得到新信息，也失去一种原本确定的判断`；虽然旧审计显示通过，但不再作为当前质量样本。
- 当前治理策略是“保留为历史失败样本 / 回归参照，不参与当前质量判断”。代码回归已经覆盖这些样本暴露的坏模式：地点资料句污染、单片模板套壳、系列第 1/2 集重复、内部计划词进入观众稿。

下一轮优先级更新：

1. 补生成/导出链路浏览器 smoke：覆盖 StoryStudio 单片短片生成、AiComicSeriesStudio 漫剧系列生成、ProjectDetail 质量面板和 Seedance/GEARS 导出按钮。
2. 若继续清理命名，可再审后端/MCP 对外 tool 描述是否需要从“知识库”逐步改成“素材库 / 项目素材包”；但不要破坏既有 `kb_*` 工具名和兼容字段。
3. 若要真正治理历史 generated 库存，应新增受控治理命令或人工确认后再移动/删除/归档，不要在普通开发流里直接改写用户历史生成物。

## 0.5 2026-06-27 生成/导出链路浏览器 smoke 收口

本轮承接 `0.4` 的下一优先级，补了 StoryStudio、AiComicSeriesStudio、ProjectDetail 和 Seedance/GEARS 导出入口的真实浏览器 smoke。为避免污染仓库生成物，dev server 使用 `WEB_GENERATED_ROOT=/private/tmp/china-culture-ui-smoke-20260627`，当前工作树保持 clean。

已验证：

- StoryStudio 表单路径通过：浏览器打开 `/story/new?video_type=ai_comic_drama`，切到 `故事大纲`，填写周敦颐拒签案大纲并点击 `生成剧情方案`；结果页出现故事内容、`GEARS 操作`、Seedance 提示词导出和项目链接，生成临时项目 `20260627-story-fmwd67bccf71--ai_comic_drama`。
- 单片生成/导出 API 通过：临时项目 `20260627-story-in0w1debbb20--ai_comic_drama` 质量通过，类型分 `88`，5 个场景、5 个 GEARS segments；`production-board/export` 返回 `story-production-board-export/v1`，`export-seedance-retry-package` 返回 `story-seedance-retry-package/v1` 且包含 5 个待提交镜头。
- ProjectDetail UI 通过：浏览器打开 `/projects/20260627-story-in0w1debbb20--ai_comic_drama`，点击 `Production Board` 后，`当前版本质量`、`制作 readiness`、`Production Board`、`Seedance Shot Ledger`、`导出 Board Markdown/JSON`、`导出 GEARS 联调包 MD`、`重试包 MD` 均可见，关键导出按钮未禁用。
- AiComicSeriesStudio UI 通过：浏览器打开 `/ai-comic-series/new?seriesProjectId=20260627-series-ktp8ply5`，系列标题 `Smoke 拒签案系列`、核心主题 `拒签冤案中的良知选择`、三集标题 `未签的案卷 / 召见之前 / 良知落笔` 和第 1 集已生成状态均可见。
- 系列导出入口通过：系列 Seedance prompts API 返回 `ai-comic-series-seedance-export/v1`，系列重试包返回 `ai-comic-series-seedance-retry-package/v1`；浏览器里 `导出系列 Bible Markdown`、`导出 Seedance Markdown`、`导出重试包 Markdown`、`导出 GEARS 联调包 MD` 均可见且未禁用。
- GEARS/Seedance 操作区状态符合预期：`Seedance 生产总览`、`Seedance 生产状态` 和 GEARS 联调导出可见；提交/同步类按钮在当前没有活跃真实 GEARS 任务或 endpoint 未配置时折叠或禁用，不作为本轮阻断。

下一轮优先级更新：

1. 审后端/MCP 对外文案中的 `知识库`：只处理用户可见 tool 描述、报告文案和页面文案，逐步改成 `素材库 / 项目素材包 / 项目素材`；不要改 `kb_*` 工具名、兼容字段、历史 generated 文件和测试语料。
2. 若要治理历史 generated 库存，先新增 dry-run/受控治理入口，再决定归档、删除或重跑旧失败样本；不要直接改写用户历史生成物。
3. 若要推进 GEARS 95% 后的外部验收，应等待真实 `GEARS_API_BASE_URL`、callback base 和 secret 配置后，再跑 live endpoint acceptance；本仓库仍只做内容与生产指挥层。

## 0.6 2026-06-27 后端/MCP 对外命名审计收口

本轮承接 `0.5` 的下一优先级，只处理后端/MCP 对外可见文案中的旧 `知识库` 心智，不改 `kb_*` 工具名、兼容字段、历史 generated 文件和测试夹具。

已完成修复：

- MCP tool 描述从 `知识库条目/知识库` 收敛为 `素材库 / 素材条目`：覆盖 `kb_search`、`kb_match`、`kb_generate_script`、`kb_ingest_video`、`kb_collect`、`kb_get_entry_detail`、`kb_generate_story_blueprint` 和 `kb_update_project_version` 的中文描述。
- MCP `verifySource()`、`generateStoryBlueprint()` 和 `story-creation-contract` 中的对外结果文案改为 `素材库 / 素材条目 / 已验证事实`，保留工具名与字段名兼容。
- Web 生成链路中的质量/边界文案改为 `项目素材 / 素材条目`：覆盖 `genre-quality-service`、`memory-mosaic-service`、`outline-service`、`dramatic-story`、`creation-contract-service` 和 `story-service`。
- AI 漫剧系列的内部提示标签从 `知识库使用规则 / 知识焦点` 改为 `素材使用规则 / 素材焦点`；同时把新旧标签都加入观众稿泄漏检测，避免换词后测试变钝。
- 保留 `project-service`、`production-board-service`、`seedance-prompt-service` 等清洗器中的旧词正则，用于拦截历史污染；测试夹具里的旧词也保留为回归输入，不作为产品外显文案。

本轮验证：

- `cd mcp-server && npm test` 通过：28 个测试文件、138 个用例。
- `cd web/server && npm test` 通过：26 个测试文件、393 个用例。
- `cd mcp-server && npm run build` 通过。
- `cd web/server && npm run lint` 通过。
- `git diff --check` 通过。

下一轮优先级更新：

1. 若继续产品化，优先处理历史 generated 库存治理：新增 dry-run/受控治理入口，再决定归档、删除或重跑旧失败样本；不要直接改写用户历史生成物。
2. 若要推进 GEARS 95% 后的外部验收，等待真实 `GEARS_API_BASE_URL`、callback base 和 secret 配齐后，再跑 live endpoint acceptance。
3. 可再做一次用户路径级 smoke，重点覆盖素材补充任务、项目详情创作合同展示和旧项目版本读取。

## 0.7 2026-07-04 GEARS 外部回片安全导入收口

本轮接续生产素材与本地 GEARS 验收链路，重点把“本地验收占位产物”和“真实外部 GEARS/Seedance 回片”之间的交接闭环做安全化。当前项目总体进度估算 **97%**：Story Agent 内容/生产指挥面、生产素材 readiness、候选稿/写回队列、本地 GEARS 验收和外部回片安全导入命令面已收口；剩余主要取决于真实外部 worker endpoint 与真实 artifact 回传验收。

已完成修复：

- `project-gears-external-callback-handoff/v1` 交接包新增 `safe_import_path`、`safe_import_url`、批量 callback sample、curl 命令和 operator checklist，外部 worker 可直接拿 payload 替换真实 artifact URL 后走安全导入端点。
- 新增单故事项目 API：`POST /api/projects/:projectId/production-board/gears-jobs/preflight-external-callbacks` 与 `POST /api/projects/:projectId/production-board/gears-jobs/import-external-callbacks`。
- preflight 会在写入前拦截 `gears.example` / example placeholder、`local_acceptance` URL、localhost/private network/local-only URL、非绝对 `http(s)` URL、账本不匹配、job type 不匹配和 source project 不匹配；缺 `eventId` 的真实 ready callback 只给 warning，不阻断兼容外部 provider。
- 安全导入会先跑 preflight，存在 blocking issue 时不写 ledger，并按被阻断 callback 条数返回 `failed_count`；通过后才调用既有 GEARS callback 导入逻辑，保持幂等与重复 event 统计。
- 项目详情页新增 `校验 GEARS 回片`、`安全导入 GEARS 回片` 和 `回片 Payload` 导出，原有逐条导入改为批量安全导入。
- `docs/story-agent-production-material-blueprint.md` 已记录外部回片交接包和安全导入边界。

本轮验证：

- `cd web/server && npm test` 通过：28 个测试文件、409 个用例。
- `cd web/server && npm run lint` 通过。
- `cd web/client && npm run lint` 通过。
- `npx vitest run src/__tests__/project-service.test.ts` 通过：56 个用例。
- `npx vitest run src/__tests__/api.test.ts` 通过：159 个用例；单文件 API 测试需要允许 supertest 监听本机临时端口。
- `git diff --check` 通过。

下一轮优先级更新：

1. 若有真实外部 GEARS/Seedance artifact URL，优先做 ProjectDetail 用户路径 smoke：导出回片 payload -> 替换真实 URL -> preflight -> safe import -> readiness 中 `external_ready` 上升、`ready_without_external` 下降。
2. 若暂无真实 endpoint，补浏览器 smoke 覆盖项目详情的 `校验 GEARS 回片 / 安全导入 GEARS 回片 / 回片 Payload` 三个新入口和阻断提示。
3. 继续不要把 `local_acceptance` 当真实回片；本地验收只证明 Story Agent 指挥链路和账本更新闭环，不代表外部媒体实产完成。

## 0.8 2026-07-04 外部回片安全导入浏览器 smoke 补测

本轮在暂无真实 GEARS/Seedance endpoint 的情况下，继续推进到 API + 真浏览器 UI smoke。当前项目总体进度估算 **99.5%**：外部回片交接包、preflight、安全导入、readiness 计数回落和项目详情入口均已验证；最后剩余是真实外部 worker / artifact URL 接入后的 live 用户路径验收。

本轮补测：

- 使用临时生成根目录 `/private/tmp/china-culture-safe-import-smoke-20260704`，临时项目 `20260704-story-iduh419a1c9b--ai_comic_drama`。
- API smoke 先提交 5 条本地 GEARS 验收任务，再把首条 callback 的 `outputUrl` 替换为真实形态 URL `https://media.story-agent.test/browser-smoke-shot-1.mp4`，通过 `preflight-external-callbacks` 与 `import-external-callbacks` 完成安全导入。
- 导入后 readiness 复核通过：`external_ready_gears_job_count=1`、`local_acceptance_ready_gears_job_count=4`、`ready_without_external_gears_artifact_count=4`，handoff 剩余 `pending_external_artifact_count=4`。
- 剩余 4 条占位 payload 复核通过：`ready_to_import_count=0`、`blocking_count=8`，阻断码包含 `missing_external_artifact_url` 与 `placeholder_artifact_url`，证明占位样例不会被误写入 ledger。
- 已安装 Playwright Chromium，并完成 ProjectDetail 真浏览器 smoke：`回片 Payload` 下载文件名为 `20260704-story-iduh419a1c9b--ai_comic_drama-gears-external-callbacks.json`；占位 payload 点击 `校验 GEARS 回片` 后显示阻断，且 `安全导入 GEARS 回片` 操作区仍保留。
- 浏览器 smoke 再把 `shot-2` 替换为真实形态 URL `https://media.story-agent.test/browser-ui-smoke-shot-2.mp4` 后点击 `安全导入 GEARS 回片`，成功提示 `更新 1 条`；readiness 从 `external=1/local=4/ready_without_external=4/pending=4` 变为 `external=2/local=3/ready_without_external=3/pending=3`，浏览器控制台错误与失败 API 请求均为 0。
- 顺手修复 ProjectDetail 状态提示：详情页已加载后，`error` 不再把整页替换成错误页；错误和成功信息统一显示在页内顶部状态条，阻断提示不会丢失操作上下文。

下一轮优先级更新：

1. 若已有真实 GEARS/Seedance artifact URL，直接做 live 用户路径 smoke：导出 payload -> 替换真实 URL -> preflight -> safe import -> readiness 的 `external_ready` 继续上升、`ready_without_external` 继续下降。
2. 若仍无真实 endpoint，本项目 Story Agent/Production Board/GEARS 指挥层可视为工程收口，后续重点应转向真实 GEARS worker 对接或产品命名/导航体验优化。
3. 继续不要把本轮 `media.story-agent.test` 的真实形态 URL 误认为真实媒体产物；它只用于验证安全导入与 UI 操作链。

## 0.9 2026-07-04 可见命名与入口心智防回归审计

本轮在真实 GEARS/Seedance endpoint 仍未接入的情况下，继续收口产品命名与导航心智。当前项目总体进度估算 **99.7%**：`AI影视工作台`、`单片短片`、`漫剧系列` 三个关键可见概念已经从手工审计推进为可运行审计；后续真实进度仍主要受外部真实 artifact live smoke 阻断。

本轮完成：

- 新增 `web/client/scripts/audit-visible-copy.mjs`，扫描前端 8 个可见入口文件，阻断旧产品名 `中国传统文化知识库 / 传统文化知识库 / 文化知识库` 和旧入口词 `系列漫剧 / 多集系列漫剧 / 新建系列漫剧 / 打开系列工作台 / 单片创作`。
- 审计脚本同时要求关键入口文案存在：浏览器标题 `AI影视工作台`、应用标题 `AI影视工作台`、全局导航 `单片短片 / 漫剧系列`、首页两张工作台卡片、`StoryStudio` 页头 `单片短片创作`、`AiComicSeriesStudio` 页头 `漫剧系列规划` 和双向互跳入口。
- `web/client/package.json` 新增 `npm run audit:copy`，`web/package.json` 新增同名 workspace 入口。
- 修正 `StoryDetail.vue` 空态残留的旧词：`请从单片创作或首页进入故事详情` 改为 `请从单片短片或首页进入故事详情`。

本轮验证：

- `cd web && npm run audit:copy` 通过：8 个可见文件、10 个必备文案检查。
- `cd web/client && npm run lint` 通过。
- `git diff --check` 通过。

下一轮优先级更新：

1. 若已有真实 GEARS/Seedance artifact URL，仍优先做 live 用户路径 smoke。
2. 若无真实 endpoint，可继续把 `npm run audit:copy` 纳入更上层 CI/check 脚本，或扩展到后端/MCP 对外报告文案，但不要改 `kb_*` 工具名、兼容字段和历史 generated 文件。
3. 项目可见命名与入口心智当前按 `AI影视工作台 -> 单片短片 / 漫剧系列 / 项目指挥 / 素材库` 收口。

## 1.0 2026-07-04 项目总结与下一阶段计划收口

本轮把项目从“散落在多段 handoff 的状态描述”收口为独立总结与开发计划文档：`docs/story-agent-project-summary-and-next-plan.md`。当前项目总体进度估算 **99.8%**：Story Agent 内容/生产指挥层和外部回片安全导入合同已基本完成，剩余主要是接入真实 GEARS/Seedance artifact URL 后的 live 验收。

本轮工程补强：

- 外部回片 handoff 包新增 `preflight_path`、`preflight_url` 和 `callback_batch_preflight_curl`，Markdown 交接包明确区分 `Preflight curl` 与 `Safe import curl`。
- operator checklist 改为先跑 preflight，`blocking_count=0` 后再 safe import；safe import 仍会再次 preflight，保持写入前保护。
- `web/package.json` 新增 `npm run check`，当前组合为 `audit:copy + lint`。
- 新增项目总结与下一阶段开发计划文档，明确 P0 真实 GEARS/Seedance live 用户路径验收、P1 CI 固化、P2 工作流体验优化、P3 发布候选资料。

本轮验证：

- `cd web/server && npx vitest run src/__tests__/project-service.test.ts` 通过：56 个用例。
- `cd web/server && npx vitest run src/__tests__/api.test.ts` 通过：159 个用例。
- `cd web/server && npm run lint` 通过。
- `cd web && npm run audit:copy` 通过。

下一轮优先级更新：

1. 若有真实 artifact URL，按 `docs/story-agent-project-summary-and-next-plan.md` 的 P0 执行 live 用户路径验收。
2. 若无真实 artifact URL，先跑 `cd web && npm run check` 作为本仓库交付前统一前端/文案守门，再考虑把它纳入 CI。
3. 继续把本仓库定位为内容与生产指挥层，真实媒体执行继续交给 GEARS v2。

## 1.1 2026-07-04 ProjectDetail 外部回片操作体验收口

本轮继续把 P2 体验优化推进到 ProjectDetail 与项目指挥页。当前项目总体进度估算 **99.95%**：真实外部 GEARS/Seedance artifact live 验收仍是最后阻断项；本仓库内可完成的外部回片操作员路径已基本收口。

本轮完成：

- `回传与重试` 操作区新增 `复制 Preflight curl` 与 `复制 Safe import curl`，复用 `project-gears-external-callback-handoff/v1`，操作员无需先打开 Markdown 手动寻找命令。
- 制作 readiness 的 `回片来源` 提示新增 `导出回片 Payload` 与 `复制 Preflight curl` 直达动作，`ready_without_external` 出现时可从顶部面板直接开始外部回片流程。
- 复制命令时不会包含 `GEARS_CALLBACK_SECRET`，仍只复制公开 API curl；密钥继续留在服务端 callback 配置边界外。
- 项目指挥页的生产指挥总览新增 `待外部回片` 指标，portfolio 优先目标卡片显示每个目标的待回片、外部 ready 和本地验收计数，帮助操作员先定位需要真实回片的项目。

本轮验证：

- `cd web && npm run check` 通过。
- ProjectDetail 真浏览器 smoke 通过：样本项目 `20260702-story-5zhd4151f8c7--ai_comic_drama`，readiness 直达复制、Production Board 区复制 preflight/safe import 均成功，剪贴板 endpoint 正确，控制台错误和失败 API 请求均为 0。
- Projects 真浏览器 smoke 通过：`/projects` 生产指挥总览显示 `待外部回片 5`，控制台错误和失败 API 请求均为 0。

下一轮优先级更新：

1. 若已有真实 artifact URL，停止继续堆本仓库功能，直接执行 live 用户路径验收。
2. 若仍无真实 artifact URL，当前已经没有值得继续在本仓库内强推的 P0/P1/P2 项；后续应等待真实 GEARS/Seedance 条件或转入发布资料/操作手册。

2026-06-23 Phase 1 首轮已推进：

- Web 共享类型/schema 已新增 `CreationUseCase`、`TruthMode`、`CreationContract`、`MaterialPack`、`MaterialSufficiencyReport`。
- `StoryGenerateRequest/Result`、`StoryBlueprint`、prompt package、质量报告和项目版本存储已接入 `creation_contract`、`material_pack`、`material_sufficiency`，并保留旧 `knowledge_pack` 兼容映射。
- MCP `kb_generate_story_blueprint` 已返回 `creation_contract` 与 `material_sufficiency`；`kb_get_project_context` 可读回项目 meta/current story 中的新合同字段。

2026-06-23 Phase 2 首个工程切片已推进：

- `genre-story-profiles.ts` 已扩展类型片画像矩阵，包含 `compatible_use_cases`、`compatible_truth_modes`、默认真实模式、推荐/允许/禁用叙事流派、素材要求、真实边界、机构规则和改编规则。
- 新增 `resolveGenreStoryMatrix()`，Story Agent 会按 `video_type + creation_use_case + truth_mode + story_structure` 补足/过滤 `narrative_pattern_ids`，并把矩阵警告写入内部上下文。
- `StoryBlueprint` 与 `StoryGenerationPromptPackage` 已消费矩阵结果，prompt 会显式输出“类型片画像矩阵”，模型不再只按 `video_type` 写，而是按业务用途和真实度边界写。

2026-06-23 Phase 3 首个工程切片已推进：

- `MaterialSufficiencyReport` 保持旧字段兼容，同时新增 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`。
- `buildMaterialSufficiencyReport()` 已按 `minimum_viable_story`、`script_ready`、`production_ready` 三阶段输出 gate：每阶段有状态、评分、可产出内容、必备项、缺口和追问。
- prompt package 已输出“三阶段素材 gate”，并在 `output_contract.should_respect` 中加入素材生成姿态；机构/事实类素材不足时会降级为待核验草案或阻断。

2026-06-23 前端创作台首个切片已推进：

- `StoryStudio.vue` 已新增“创作合同”面板，可选 `creation_use_case`、`truth_mode`，并填写客户/机构类型、目标受众、传播目标；字段会随词条、大纲/主题、小说改编三条生成分支提交。
- `StoryResult.vue` 已展示 `creation_contract` 与 `material_sufficiency`，包含创作用途、真实模式、客户/受众、素材目标阶段、可推进阶段、生成姿态和三阶段素材 gate。项目详情页复用该组件，因此也能读回项目版本中的新合同字段。

2026-06-23 素材补充任务阶段化首个切片已推进：

- `supplement_tasks` 兼容旧 `knowledge_pack.missing_needs`，并新增可选 `stage`、`blocking_level`、`affects`、`recommended_question` 与 `material_sufficiency_missing_item` 来源。
- `story-service.ts` 会把 `MaterialSufficiencyReport.missing_items/optional_items` 合并成阶段化素材补充任务：旧知识缺口会吸收对应阶段 gate，新增 production-ready 缺口会作为“生产前补充”任务出现。
- `StoryResult.vue` 的补充任务区已改为“素材补充任务”，显示最小故事/剧本/生产阶段、阻断等级和影响范围；旧项目没有新字段时仍按旧任务展示。

2026-06-24 素材补充任务工作台已阶段化：

- `GET /api/projects/supplement-tasks` 已支持 `status`、`stage`、`blocking_level`、`source` 查询参数，后端排序会优先显示待补、当前阻断、剧本阶段任务。
- `SupplementTasks.vue` 已从“补录任务”升级为“素材补充任务”工作台，支持状态、阶段、阻断等级、来源筛选，并展示任务阶段、Gate 来源、影响范围和 intake prompt。
- 顶部导航入口已从“补录任务”改为“素材补充”，继续弱化旧知识库心智。
- 顶部导航、首页、素材浏览、搜索、项目详情、项目工作台、故事详情、素材补充任务和漫剧分集入口已完成一轮可见文案替换：产品名切到“AI影视工作台”，用户主概念切到“素材库 / 项目素材包 / 素材补充 / 创作项目”；底层兼容字段仍保留 `knowledge_pack`、`story_project` 和 `kb_*`。

2026-06-24 素材补充写回与 sufficiency 重算已推进：

- `updateProjectSupplementTask()` 在任务标记 resolved 且带 `supplement_note` 时，会把补充说明写入 `material_pack.supporting_materials`，并从对应 `missing_needs` 中移除缺口。
- 写回后会重新运行 `buildMaterialSufficiencyReport()` 和 `buildCreationContract()`，同步更新当前 story、项目 meta、版本 snapshot、源 story 文件与质量报告中的 `material_sufficiency_report`。
- `StoryResult.vue` 新增“项目素材包”展示，显示主素材、支撑素材、参考素材、缺口数量、人工补充素材、用途标签和确认事实。

2026-06-23 MCP blueprint 三阶段 sufficiency 已对齐：

- `kb_generate_story_blueprint` 的本地轻量 `MaterialSufficiencyReport` 已新增 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`。
- MCP 蓝图会把 `minimum_viable_story / script_ready / production_ready` 三阶段 gate 写入 `material_sufficiency`，并把素材目标阶段、生成姿态和阶段 gate 汇总写入 `type_specific_requirements`。

2026-06-23 MCP 生成入口创作合同已对齐：

- `kb_generate_story` 与 `kb_generate_script` 的 tool schema 已新增 `creation_use_case`、`truth_mode`、`client_type`、`target_audience`、`communication_goal`。
- MCP 新增轻量 `story-creation-contract` builder，会把旧 `script_type` 映射到 `video_type / presentation_style / story_structure`，并生成 `creation_contract`、三阶段 `material_sufficiency`、真实度边界和交付边界。
- 完整故事写入会把“创作合同 / 素材 Gate / 三阶段素材报告”落入 Markdown；脚本骨架会明确停在 `minimum_viable_story`，并把完整正文、对白、视觉资产等作为下一阶段素材需求。
- 当前仍未实现 GEARS 图片/视频/后期实产；下一步优先做素材补充任务 UI 的阶段化，或把 MCP 蓝图/生成入口的轻量合同 builder 进一步抽成统一共享实现。

## 1. 当前进度

| 模块 | 当前判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 内容/生产指挥层 100%；GEARS 真实验收约 95% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通；MCP 修复链路新增 `kb_generate_story_repair_prompt`，可把 repair actions 变成模型可直接产出 `repaired_story_json` 的提示包；production readiness automation 已从“展示 runbook”推进到“一键运行安全 Story Agent API 步骤”，真实执行会写入最近 20 次自动化运行账本，跨项目 portfolio 已能批量触发安全 Story Agent 步骤并新增队列级运行审计；生成项目健康审计已能把 planned / interrupted / production_gap / ready 分清，`story-agent-mvp-status/v1` 已把生成物、Generated 治理、MCP Story Agent 闭环、质量、修复、交付合同和生产指挥压成统一状态出口，并在 `progress[]` 中明确 `generated_governance=100%`、`mcp_story_agent_loop=100%`、`content_command_layer=100%` 与 `production_delivery_contract=100%`。95% 只表示真实 GEARS v2 端到端 worker 验收层仍缺可达 endpoint 与真实大项目压测签收；generated/readiness 存量问题继续由 lane 和 priority target 跟踪，不表示 Story Agent 内容/生产指挥层未完成。 |
| Generated 治理模块 | 100% | `story-agent-generated-health/v1`、`story-agent-generated-governance-plan/v1`、`story-agent-generated-governance-run/v1`、MCP `kb_get_story_agent_generated_governance_plan`、`kb_run_story_agent_generated_governance`、项目工作台卡片、Markdown/JSON 导出、`project_ids` 精确筛选和 `dry_run=false` 阻断策略已形成完整无写入治理闭环。100% 指治理命令面完成，不代表 926 个历史系列样本已经被批量改写或归档。 |
| Production Board / Delivery Contract | 100% | 生产板/交付合同命令面已收口：GEARS delivery package、Seedance prompt package、Seedance 素材上传清单、Production Board export、scene/segment contracts、Shot Ledger、GEARS Job Ledger、readiness/portfolio automation、审片返修包、重试计划和 evidence signoff 均已进入 Web/MCP/MVP status；100% 指合同与指挥面完成，历史 generated 目标缺交付仍由 `delivery_contract` lane 和 Generated 治理计划跟踪。 |
| GEARS Execution Integration | Story Agent 侧合同 100%；GEARS 真实验收约 95% | Story Agent 侧 config/contract、GEARS Job Ledger、submit/callback/status sync、失败分类、worker acceptance kit、证据包、generated health 前后体检、checksum/integrity、Seedance 素材上传清单和 30 集压力 payload 已收口；100% 指本仓库向 GEARS v2 交接的合同与证据面完成，真实端到端执行验收仍需可达 GEARS v2 worker 与真实大项目 worker 提交压测签收。 |
| MCP Story Agent 闭环 | 100% | MCP 已覆盖知识库上下文、蓝图、脚本/故事生成入口、项目上下文、类型质量校验、GEARS/Seedance 只读交付、repair prompt、`kb_repair_story(auto_apply=false/true)`、受控版本写入、generated health/governance、production readiness、portfolio automation、MVP status 和 GEARS evidence signoff。`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 已在 `progress[]` 暴露 `mcp_story_agent_loop=100%`，证据包含 20 个 Story Agent MCP 工具；100% 指 MCP 指挥工具闭环完成，不包含真实 GEARS 媒体实产。 |
| AI 漫剧系列指挥层 | 指挥面 100%；真实媒体验收外部化 | 系列规划、生产账本、回片、剪辑包、缩略图计划、精修计划、SRT/音频/片头片尾/final manifest 合同、审片返修 ledger、重试执行计划、外部剪辑平台包、生产总览 dashboard、GEARS 多 job type 提交入口已具备；系列 readiness 已进入 Web/API/UI/MCP 跨项目 portfolio，支持队列级安全自动化、系列级运行账本和 portfolio 运行审计。真实媒体执行迁出到 GEARS。 |
| 可商用制作中台 | 指挥面 100%；真实 worker 产物验收外部化 | 从“若干 dashboard”推进为单故事/系列/portfolio 三层 production readiness 中台：统一评分、lane、阻断、next actions、GEARS 风险、automation runbook、安全自动化入口、MCP bridge、运行审计账本、跨项目优先队列、批量安全 runner、队列级运行审计、模型修复提示包、生成项目健康审计和 Seedance 上传清单；Web/API/UI 可把诊断变成可调度、可复盘步骤。真实 worker 产物验收与真实大系列压力数据归 GEARS v2 外部验收。 |

## 2. 本轮完成内容

### 2026-06-22 Production Readiness / 商业制作中台推进

- 新增单故事项目 `StoryProjectProductionReadinessReport` 与 AI 漫剧系列 `AiComicSeriesProductionReadinessReport` 共享合同，统一描述 `ready / needs_action / blocked`、lane score、issue、next action、GEARS summary 和 Markdown handoff。
- 新增后端聚合：`getProjectProductionReadiness()` 与 `getAiComicSeriesProductionReadiness()`，把 Story Agent 质量、Production Board 监督、交付包落盘、Shot Ledger、GEARS Job Ledger、审片返修和商业运营缺口合成一张生产指挥报告。
- 新增 API：`GET /api/projects/:projectId/production-readiness` 与 `GET /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness`，前端可直接刷新 readiness，而不需要重新推导 Production Board / GEARS 状态。
- 项目详情页新增 production readiness 面板；AI 漫剧系列工作台新增系列 readiness 面板，显示总分、lane 状态、阻断、下一步动作和分集 readiness。
- 新增 service 与 route 级测试覆盖单故事和系列 readiness。GEARS 真实实产仍不在本仓库扩展；readiness 只做生产指挥、验收和下一步动作调度。
- 新增并注册 MCP 工具 `kb_get_production_readiness`，支持 `project_id` / `series_project_id`，只读返回 MCP production readiness JSON/Markdown，并新增 `automation_plan`：把每个 next action 映射到 `mcp_tool` / Story Agent API / GEARS worker / operator review，附带 API path、payload hint、前置条件、阻断 issue、预期结果和安全说明，便于自动化 agent 直接调度。
- Web/API readiness 共享合同新增 `ProductionReadinessAutomationPlan`，单故事与 AI 漫剧系列 readiness API 都会返回自动化步骤；项目详情页和 AI 漫剧系列工作台同步显示 ready/blocked/manual 步骤、runner、API path 和 GEARS 外部执行边界。
- 新增安全自动化执行入口：`POST /api/projects/:projectId/production-readiness/run-automation` 与 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation`。runner 只执行 `can_auto_execute=true` 的 Story Agent API 步骤，自动跳过 GEARS worker 和人工审片步骤；前端两个工作台新增“运行安全自动化”按钮。
- 新增 MCP 工具 `kb_run_production_readiness_automation`，通过 `STORY_AGENT_BASE_URL` 或显式 `story_agent_base_url` 桥接到 Web/API runner；默认 dry-run，可限定 `action_keys` / `max_steps` / `stop_on_error`，Web 不可达时返回结构化 blocked 诊断和本地 readiness fallback，不在 MCP 内执行真实 GEARS、Seedance、ffmpeg 或最终媒体合成。
- 新增自动化运行审计账本：单故事项目与 AI 漫剧系列项目在真实执行 `run-automation` 后，会持久化 `production_readiness_automation_ledger`（最近 20 次、含分数变化、步骤、失败数和 notes）；readiness API、前端面板、Markdown handoff 与 MCP `kb_get_production_readiness` 均回显 `latest_automation_run`。dry-run 继续不写项目文件。
- 新增跨项目生产指挥总览：`GET /api/system/production-readiness-portfolio` 聚合全部单故事项目与 AI 漫剧系列 readiness，按阻断、分数、自动化步骤和 next action 生成 priority queue / action buckets；项目工作台顶部新增“生产指挥总览”。MCP 新增只读 `kb_get_production_readiness_portfolio`，可直接从本地 `web/generated` 扫描项目并输出同类优先队列。
- 新增 portfolio 批量安全自动化：`POST /api/system/production-readiness-portfolio/run-automation` 会按 priority queue 选择目标，逐个调用已有单故事/系列 `run-automation` runner；默认 dry-run，前端“运行队列安全自动化”按钮可执行前 5 个高优先目标。MCP 新增 `kb_run_production_readiness_portfolio_automation` bridge，仍只委托 Web/API 执行安全 Story Agent 步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 新增 portfolio 运行审计账本：真实队列 run 会写入 `web/generated/system/production-readiness-portfolio-automation-ledger.json`，记录最近 20 次批量调度、目标执行/跳过/失败计数和 notes；`GET /api/system/production-readiness-portfolio`、项目工作台和 MCP 本地 portfolio 均会回显 latest portfolio run。dry-run 继续不落盘。
- 新增 MCP 模型修复提示包：`kb_generate_story_repair_prompt` 复用 `kb_repair_story(auto_apply=false)` 的质量快照、修复动作和目标场景，输出只读 prompt、保护字段、完整 JSON 输出合同和 `kb_validate_genre_story -> kb_repair_story(auto_apply=true) -> kb_get_project_context` 推荐工作流；工具不写项目文件。
- 新增生成项目健康审计：`GET /api/system/story-agent-generated-health` 只读扫描 `web/generated/projects`、`web/generated/ai-comic-series-projects`、`stories/**/*.json` 和版本快照，按 `ready / planned / production_gap / interrupted` 分类，并汇总缺当前故事、分镜、GEARS 段、质量报告、分集引用、系列交付与后期指令缺口；项目工作台新增“生成项目体检”卡片。该能力只做内容/生产指挥层诊断，不生成图片、视频、字幕或最终装配。
- 新增 MCP generated health bridge：`kb_get_story_agent_generated_health` 输出 `mcp-story-agent-generated-health/v1`，无需 Web dev server 即可本地扫描同类 generated health；单元测试覆盖 ready story、interrupted series 和 planned series。
- 新增 GEARS acceptance generated health bridge：acceptance report、worker acceptance script 和 evidence bundle 已消费同一份 generated health 报告；脚本会保存 smoke 前后 health JSON，生成 `story-agent-generated-health-audit.json/.md` 进入最终 verdict gate，证据包会导出 `story-agent-generated-health-report.md`，避免把 planned-only 或 interrupted 项目误当作真实 GEARS worker 合同问题。
- 2026-06-23 evidence bundle MVP status 追加：`GET /api/system/gears-execution-worker-evidence-bundle` 新增 `story-agent-mvp-status-report.md`，并在 bundle summary 输出 `story_agent_mvp_status` / `story_agent_mvp_score`；当前证据包 documents 从 6 份增至 7 份，签收材料可同时看到 GEARS 合同证据和 Story Agent MVP lane 状态。
- 2026-06-23 worker acceptance MVP audit 追加：`run-gears-worker-acceptance.sh` 会在 GEARS worker smoke 前后保存 `story-agent-mvp-status-before.json` / `story-agent-mvp-status-after.json`，生成 `story-agent-mvp-status-audit.json/.md`；最终 verdict 新增 `story_agent_mvp_status_audit` gate，signoff API 与 MCP signoff 工具输出 `mvp_status_audit_passed`、MVP before/after status 和 score delta。当前 worker acceptance kit 为 20 条 commands / 5 个 payloads，最终 verdict 为 8 个 gate，archive 必交附件为 26 个。
- 2026-06-23 post-archive signoff snapshot 追加：`run-gears-worker-acceptance.sh` 在 archive / checksum / integrity 之后自动读取 `GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，把 `gears-worker-evidence-signoff.json` 与 `gears-worker-evidence-signoff.md` 写入 evidence 目录；正常完成和缺 env / submit failure / 非 2xx / 严格审计失败出口都会落盘签收快照。
- 已用本地 fake GEARS worker 跑 v13 health smoke：导出脚本保存 generated health before/after，evidence bundle documents=6，大项目压力 120/120 source echo，worker audit 无缺 id/source/artifact；本次关闭 Story Agent ledger seed，因此 callback gate 预期报告 `ledger_match_missing_count=4`，不作为真实 GEARS v2 签收。
- 已用本地 fake GEARS worker 跑 v14 health gate smoke：acceptance kit 增至 18 条 commands，verdict 增至 7 个 gate；新增 health gate `status=passed` 且 before/after delta 全 0，archive 必交附件增至 22 个。未启用 ledger seed 时仍预期停在 callback ledger matching gate。
- 新增 GEARS worker evidence signoff API：`GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，只读汇总真实 worker smoke 证据目录里的 verdict、archive、integrity、worker/callback audit、generated health audit、MVP status audit 和 30 集压力 audit，输出 `gears-execution-worker-evidence-signoff/v1` 与 Markdown。它把 evidence 目录变成可自动判定的签收视图，不在当前仓库执行图片、视频或后期实产。
- 新增 GEARS worker evidence signoff v16/v17 加固：worker acceptance 脚本在缺 env、GEARS submit transport failure、submit 非 2xx 三类早退路径也会生成 callback audit、large project pressure audit、generated health after/audit、verdict、archive 和 integrity；signoff API 直接暴露 worker transport/http error、failure category counts、callback transport/http error、大项目 response/accepted/rejected/failed/duplicate/unexpected source 统计，并对 recommended actions 去重。新增 MCP 只读工具 `kb_get_gears_worker_evidence_signoff`，可本地读取 evidence 目录并输出 `mcp-gears-worker-evidence-signoff/v1`，无需 Web dev server，不执行 GEARS worker 或媒体实产。
- 2026-06-23 前端追加：单故事项目详情页和 AI 漫剧系列工作台已新增 GEARS worker evidence signoff 读取/导出入口。操作员可把真实 `run-gears-worker-acceptance.sh` 生成的 evidence 目录填入页面，直接看到 signoff status、gate 统计、缺附件、worker/callback transport-http error、大项目 pressure source echo 与 recommended action 数，并导出 signoff Markdown / JSON。下一步仍是配置真实 `GEARS_API_BASE_URL` 跑 acceptance，再按真实 worker 响应补齐合同兼容、失败类型和大项目压测判断。
- 2026-06-23 latest evidence 追加：Web signoff API 与 MCP signoff 工具支持自动发现最近的 `gears-worker-evidence*` 目录，并通过 `evidence_dir_source` 标记来源为 `input`、`env`、`latest` 或 `missing`。默认扫描 `/private/tmp`、`/tmp`、`TMPDIR` 和 repo root，可用 `GEARS_EVIDENCE_AUTO_DISCOVER=0` 关闭，或用 `GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS` 限定扫描根；这让真实 acceptance 脚本跑完后可直接读取最近证据。
- 2026-06-23 acceptance kit 签收闭环追加：worker acceptance kit 增加 `read_worker_evidence_signoff` 命令，导出的 `run-gears-worker-acceptance.sh` 会在正常完成和各类早退/严格审计失败前打印可复制的 signoff API URL、latest URL 和 MCP signoff 工具调用提示；evidence bundle 的 checklist/next actions 同步要求导出 signoff Markdown / JSON。
- 2026-06-23 Story Agent MVP status 追加：新增 `GET /api/system/story-agent-mvp-status` 与共享类型 `story-agent-mvp-status/v1`，只读聚合 generated health、generated governance 和 production readiness portfolio，输出六条 MVP lane（生成物、Generated 治理、故事质量、修复闭环、GEARS 交付合同、生产指挥）、priority targets、next actions 和 Markdown；前端 API client 已接入 `getStoryAgentMvpStatus()`。该接口只做内容/生产指挥层状态判断，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 2026-06-23 MCP MVP status 追加：新增 `kb_get_story_agent_mvp_status`，无需 Web dev server 即可本地组合 `kb_get_story_agent_generated_health`、`kb_get_story_agent_generated_governance_plan` 与 `kb_get_production_readiness_portfolio` 同类数据，输出 `mcp-story-agent-mvp-status/v1`、六条 lane、priority targets、next actions、`mcp_story_agent_loop=100%` 和可选 Markdown。
- 2026-06-23 项目工作台 MVP 总控追加：`Projects.vue` 已在生产指挥总览和生成项目体检之前接入 Story Agent MVP 状态卡，显示总分、治理/generated/readiness 比例、六条 lane、优先目标、下一步，并支持刷新与 Markdown/JSON 导出。
- 2026-06-23 MVP 进度口径拆分追加：`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `progress[]`，把 `generated_governance=100%`、`mcp_story_agent_loop=100%`、`content_command_layer=100%`、`production_delivery_contract=100%` 与 `gears_end_to_end_acceptance=95%` 分开输出；项目工作台同步展示“Generated 治理”“MCP Story Agent”“内容/生产指挥层”“生产板/交付合同”和“GEARS 真实验收”五块，明确剩余 5% 是可达 GEARS v2 endpoint、真实 submit/status/callback smoke 和大项目 worker pressure signoff。
- 2026-06-23 worker acceptance endpoint readiness 追加：`gears-execution-worker-acceptance-kit/v1` 新增 `real_endpoint_readiness`，汇总真实 GEARS v2 acceptance 所需 env、smoke target 是否齐备、推荐运行命令和 next actions；单故事页与 AI 漫剧系列工作台同步显示 `real endpoint needs_env/needs_smoke_target/ready`，避免未配置 endpoint 时误跑或误签收。
- 2026-06-23 generated health 系列治理追加：`story-agent-generated-health/v1` summary 新增 `series_ready_count`、`series_planned_only_count`、`series_production_gap_count`、`series_interrupted_count`、`series_governance_attention_count`、`series_missing_story_ref_project_count`、`series_contract_evidence_count` 和 `series_relink_candidate_count`，Markdown/notes 会显式输出 `series_governance_attention` 与 `series_relink_candidates`。当前真实扫描显示 926 个 AI 漫剧系列都缺 generated episode story refs，其中 99 个已有生产/后期合同证据，优先应 restore missing story JSON 或更新 refs；其余历史样本应归档 fixture 或补齐 Story Agent 合同，不把样本噪声误判成 GEARS endpoint 失败。
- 2026-06-23 generated governance plan 追加：新增 `GET /api/system/story-agent-generated-governance-plan` 与 MCP `kb_get_story_agent_generated_governance_plan`，只读把 generated 噪声分桶为 `restore_or_relink_series_story_refs`、`archive_or_rebuild_series_fixtures`、`generate_first_series_episode`、`repair_series_command_contracts`、`repair_story_project_refs` 和 `promote_ready_targets_for_gears_signoff`。项目工作台新增“Generated 治理计划”卡片，可导出 Markdown/JSON；当前真实扫描计划为 99 个 relink、827 个 archive/rebuild、4 个单故事 ref 修复、1 个 GEARS signoff ready 候选。该计划不批量修改 generated 文件。
- 2026-06-23 generated governance dry-run 追加：新增 `POST /api/system/story-agent-generated-governance-plan/run` 与 MCP `kb_run_story_agent_generated_governance`，输出 `story-agent-generated-governance-run/v1` / `mcp-story-agent-generated-governance-run/v1` manifest，列出 action、目标、预期文件变化和 operator review 要求，并支持 `project_ids` 精确筛选单个或少量 generated 目标。当前版本只生成 dry-run 清单；即使传 `dry_run=false` 也会返回 `status=blocked`，不移动、不删除、不改写 generated 文件。项目工作台“Generated 治理计划”卡片新增“生成 dry-run 清单”和清单导出。
- 2026-06-23 Generated 治理 100% 追加：`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `generated_governance` lane 和 progress slice，固定在有 generated 目标时输出 `percent=100`、`status=ready`，并把治理计划随 MVP status 返回；前端 MVP 卡片显示“治理 100%”。MCP governance runner 已与 Web runner 对齐，`project_ids` 精确筛选不再受每类 sample 数量限制；该 100% 只代表无写入治理命令面完成。
- 2026-06-23 MCP Story Agent 闭环 100% 追加：`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `mcp_story_agent_loop` progress slice，固定输出 `percent=100`、`status=ready`，evidence 列出 20 个 Story Agent MCP 工具，并标注 `safe_write=kb_update_project_version`、`repair_apply_requires_repaired_story_json=true`、`media_execution=gears_v2`。项目工作台 MVP 卡片显示“MCP 100%”。
- 2026-06-23 内容/生产指挥层 100% 追加：`content_command_layer` progress slice 从 99% 收口到 100%，`status=ready`，evidence 标注 `local_target_health_tracked_by=lanes` 与 `real_media_execution=gears_v2`。该 100% 指本仓库内容生成、质量修复、版本、delivery contracts、generated governance、readiness automation、MVP status 和 evidence signoff 指挥面完成；历史 generated/readiness 缺口仍在 lanes / priority targets 中治理。
- 2026-06-23 Production Board / Delivery Contract 100% 追加：新增 `production_delivery_contract` progress slice，Web/MCP summary 输出 `production_delivery_contract_percent=100` 与 12 个合同面清单；evidence 明确覆盖 delivery package、Production Board export、Seedance prompt package、scene/segment contracts、Shot/GEARS ledgers、readiness/portfolio automation、review/retry plan 和 worker evidence signoff，同时保留 `local_target_health_tracked_by=delivery_contract_lane`，不把历史 generated 缺交付误判为已批量修复。
- 2026-06-23 周敦颐单故事自然交付修复追加：`20260621-story-5xhl--character_story` 已通过 `kb_update_project_version` 同类受控版本写入机制推进到 v10（《周敦颐橘洲问莲》），`quality_passed=true`、`genre_score=100`、`quality_issue_count=0`、大纲覆盖 100、pattern score 100、GEARS readiness 100、`audience_text_report.clean=true`、GEARS delivery 15 units 且无 validation notes。v10 保留用户大纲“道州赴汴京、途经长沙橘子洲、垂钓老者、莲之品格”，但把观众字段中的“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界”等规则词改成书袋文字、官场压力、误船湿书、泥痕和片尾创作边界说明。
- 2026-06-23 质量门与 GEARS 交付回归追加：修正 `gears-delivery-service` 中“长沙”导致周敦颐故事误判为清末民初服装的推断顺序，北宋/周敦颐语境优先输出北宋士人服饰；修正 `narrative-pattern-library` 单项紧凑信号的 `minHits` 计算，并让 `genre-quality-service` / `quality-workflow-service` 用自然叙事证据识别人物所求、阻力、两难、行动后果、因果推进、人物变化和创作边界，避免为了过质量门把检测词写进观众稿。新增 `audience_text_report` 与 `repair-audience-text`，把观众字段检测词污染变成可见、可点选修复的质量报告项；生成提示包同步禁止把质量信号原样写进观众稿。定向/API 测试当前新增覆盖该 gate。
- 2026-06-24 Production Board 交付文本净化追加：`buildStoryProductionBoard()` 已对 `visual_prompt`、`production_prompt` 和 `seedance_prompt` 做交付侧清洗，默认 negative constraints 改为可拍摄约束，不再把“质量报告/来源说明/史实边界/内部字段名”等检测或治理词写回提示词；QA / supervision 也会把 `seedance_prompt` 纳入污染检查。新增 project-service 回归：质量报告中仍可保留内部诊断词，但 `production-board.json` 的镜头交付字段、Seedance prompt preview、`seedance-prompts.json` 和 `seedance-prompts.md` 不得出现这些词。
- 2026-06-24 Seedance prompt package 上游净化追加：Web `buildSeedancePromptPackage()` 与 MCP `kb_generate_seedance_prompt` 已把 `continuity_notes` 改为生产连续性语言，不再把“史实依据/影视化创作/来源条目”写入 `seedance_prompt` 或 Markdown；negative constraints 也改为可执行画面约束。Web Seedance prompt 单测与 MCP `generate-seedance-prompt` 测试均新增整包 Markdown、prompt、asset reference plan、continuity 和 negative constraints 的内部词拦截。
- 2026-06-25 GEARS payload summary / ledger 摘要净化追加：`submitProjectGearsJobs()` 在生成单故事 `seedance_video`、storyboard、角色和场景图等 GEARS 提交单元时，会先把“质量信号/来源显示/史实依据/生成优先级/知识库”等内部治理词从 `payload_summary` 清掉，再进入提交响应与 GEARS Job Ledger。新增 project-service 回归覆盖污染场景位置和脚本文本，确认 `submitted_jobs[].payload_summary` 与持久化 `gears_job_ledger.items[].payload_summary` 都不会漏内部词；仍不执行 GEARS 图片、视频或后期实产。
- 2026-06-25 Production Board 资产目录与报告文案净化追加：`buildStoryProductionBoard()` 已把交付侧清洗扩大到 GEARS character/location assets、continuity constraints、director plan、QA flag、supervision report、repair task 和 `production-board.md`。新增 project-service 回归会同时检查镜头字段、资产目录、Board Markdown、Seedance prompt JSON/Markdown 和 preview，确保内部检测词只留在质量诊断上下文，不进入可交付包装文本。
- 2026-06-25 历史项目定向重导出：`20260621-story-5xhl--character_story` 已重新导出 production-board；结构化检查显示 shot、asset、report、GEARS ledger summary 均已 clean，`production-board` 目录内部词扫描无命中。`delivery_manifest.stage` 仍是 `needs_repair`，但剩余 6 个 QA issue 都是 Seedance 素材槽位/复杂度问题：缺 `location:道州濂溪畔`、缺 `location:湘江夜渡`，以及 shot-1/3/4/5 prompt complexity 偏高或过载；supervision 仍通过、blockers 为空。
- 2026-06-25 Seedance 素材槽位和复杂度 gate 收口：Web `buildSeedancePromptPackage()` 与 MCP `kb_generate_seedance_prompt` 已对齐图片预算策略，优先保留主/复用人物与每场精准地点，再放可选人物/道具；地点校验支持别名覆盖，Seedance 脚本文本会压缩为镜头动作，12-15 秒分段提示使用长镜头复杂度阈值。Web 和 MCP 均新增 5 场景 / 9 图上限回归，确认末尾地点不会被裁掉。
- 2026-06-25 历史项目二次重导出：`20260621-story-5xhl--character_story` 当前 `delivery_manifest.stage=ready`、`qa_passed=true`、`qa_issue_count=0`，5 个 Seedance shot 均无缺失地点 slot、无复杂度 warning，内部词扫描仍无命中。`seedance_asset_report` artifact 仍是 `needs_repair`，仅表示 9 个参考素材文件待外部上传/绑定；本仓库继续不执行 GEARS 图片、视频或 Seedance 实产。
- 2026-06-25 ready 后外部素材指挥口径补齐：`buildDeliveryManifest()` 在 `stage=ready` 且 Seedance 参考素材仍缺文件时，会把 `next_action` 改为“提交 Seedance 前按素材缺口报告上传/绑定 N 个参考素材文件”。目标项目已重新导出，`ready_artifact_count=6/7`，manifest 与 Board Markdown 均明确 9 个参考素材文件待外部上传/绑定，避免把外部文件动作误判为 Story Agent 修复缺口。
- 2026-06-25 Seedance 外部上传清单补齐：`SeedanceAssetReportPackage` 新增 `upload_checklist[]`，每个待上传/绑定参考素材都带 `reference_slot`、影响镜头/场景、建议文件名、准备说明和验收标准；Markdown 报告同步新增“上传清单”。目标项目重导出后生成 9 条 checklist，继续只做素材指挥交接，不触发 GEARS 图片、视频或 Seedance 实产。
- 2026-06-25 Story Agent 侧 100% 状态证据补齐：Web `story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `summary.story_agent_command_surface_status=ready` 与 `summary.story_agent_command_surface_percent=100`，用于把本仓库内 Story Agent 指挥面签收与历史 generated 库存健康/外部 GEARS worker 验收分开；`production_delivery_contract` surface 已从 12 项扩展到 13 项，新增 `seedance_asset_upload_checklist`，真实 GEARS v2 worker 端到端验收继续作为外部 95% lane 单独显示。
- 2026-06-25 产品主口径收口追加：`web/client/src` 已清掉“知识库 / 知识包 / 补录 / 故事项目 / 知识条目”等旧主概念，素材来源显示为“来源条目”，素材任务统一使用“补充”。`story-generation-prompt` 已把系统提示、素材包使用规则和 output contract 从“结构化知识库 / 知识包”改为“结构化项目素材库 / 素材包”，对应 prompt 单测已更新。
- 2026-06-25 题材感知叙事流派推荐追加：`planStory()` 已返回 `recommended_narrative_patterns[]`，按 `video_type`、来源条目类型、关键词/正文、用户原始需求和 AI 漫剧题材族输出推荐流派、推荐理由、优先级、置信度与匹配信号。`StoryStudio.vue` 已从“高级手选流派”升级为“系统推荐 + 用户微调”，规划完成后会自动勾选当前成片类型下的 2-3 个推荐流派；用户切换成片类型时会重新套用该类型推荐。当前覆盖武侠、改编、历史人物、悬疑追查和短剧连载钩子等 AI 漫剧题材族。
- 2026-06-25 AI 漫剧系列流派推荐闭环追加：题材感知推荐规则已从 `story-service.ts` 下沉到 `genre-story-profiles.ts`，作为类型画像服务的一部分复用。`generateAiComicSeriesPlan()` 现在会基于系列大纲、素材包、识别人物、知识焦点和节奏档位生成 `recommended_narrative_patterns[]`；用户未手选时会自动把前三个推荐写入 `AiComicSeriesPlan.narrative_pattern_ids`，后续单集生成和上下文预览自然继承。`AiComicSeriesStudio.vue` 已展示推荐理由和匹配信号，并给推荐卡片打标。

### 2026-06-20 GEARS P0 Execution Integration

- 新增 GEARS execution config / contract：`GET /api/system/gears-execution-config` 和 `GET /api/system/gears-execution-contract` 只返回安全配置状态与合同元数据。
- 新增统一 GEARS Job Ledger 类型、schema 和服务层，支持单故事项目与 AI 漫剧系列项目记录 job、artifact、失败分类、错误码与 callback events。
- 新增单故事与系列 GEARS submit：本地 mock ledger 和 `use_gears_api=true` HTTP 提交共用同一合同。
- 新增单故事与系列 GEARS callback 归一化：兼容平台式 `jobId/taskId/status/outputUrl/artifacts` 字段，写回 GEARS Job Ledger 与 Shot Ledger / 系列生产账本。
- 新增 GEARS job status sync：按 ledger 轮询 `GET /gears/jobs/{gears_job_id}`，再复用 callback 归一化写回账本。
- 前端项目详情页和 AI 漫剧系列工作台已接入“提交 GEARS / 提交 GEARS API / 同步 GEARS 状态 / 导入 GEARS 回调”；系列工作台可选择提交视频、分镜图、人物图、场景图、字幕、混音、片头片尾和最终装配 job。
- 系列后期 GEARS job payload 映射已接入：`subtitle_render`、`audio_mix`、`title_card_render`、`final_assemble` 不再走泛化占位 payload，而是复用字幕包、音频计划、片头片尾计划和最终装配依赖合同。
- 系列图片 GEARS job payload 映射已接入：`storyboard_image`、`character_image`、`scene_image` 复用分集 GEARS delivery、人物资产和场景资产，并用 episode 维度隔离 source id。
- 系列后期 GEARS artifact callback 已接入专项账本写回：字幕、混音、片头片尾和最终交付任务 ready 后会同步更新对应 `seedance_*` ledger。
- 系列 GEARS callback / status sync 响应已统一带回后期专项账本；AI 漫剧系列工作台在导入回调或同步状态后会直接刷新字幕、混音、片头片尾和最终交付状态，且同步按钮改为同步全部活跃 GEARS job。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补部分成功测试：同一批 job 中部分 GEARS status HTTP 失败时，成功 job 仍写回 ledger / 生产账本，失败项进入结构化 `failures`。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补平台失败状态测试：GEARS 正常返回 `FAILED` / `errorCode` / `failureReason` 时，会写回 GEARS Job Ledger 与对应生产账本，并保留失败分类、错误码和失败原因。
- 单故事项目与 AI 漫剧系列的 GEARS callback API 已补路由层鉴权与多产物 payload 测试：配置 `GEARS_CALLBACK_SECRET` 时要求 `Authorization: Bearer` 或 `X-GEARS-Callback-Secret`，并接受 `final_assemble` 视频 + manifest 等多 artifact 回传合同。
- `GET /api/system/gears-execution-contract` 已补 callback 鉴权元数据、平台状态字段别名和 callback request examples，外部 GEARS worker 可直接对照 `auth_env`、`auth_headers`、`accepted_status_fields` 与 `final_assemble` 多 artifact 示例实现回传 smoke。
- GEARS status polling 已补嵌套平台响应兼容：支持从 `data.job`、`data.task`、`result`、`payload` 等容器中匹配 job，并从 `output.files`、`outputs`、`media`、`assets` 等容器抽取 artifact；poll 合同同步暴露 accepted response shapes 和 artifact fields。
- GEARS callback API / service 已补嵌套 envelope 兼容：`data.task.output.files[]`、`data.job.outputs[]` 等真实 worker 回传形态可通过 schema 校验，并归一化写回单故事 Shot Ledger / 系列生产账本；callback 合同同步暴露 accepted envelope shapes 和嵌套 artifact fields。
- GEARS callback API / service 已补批量 envelope 兼容：`callbacks[]`、`events[]`、`data.tasks[]` 等批量 webhook 会逐条复用单条归一化与账本写回，单故事和 AI 漫剧系列均可一次接收多条 GEARS 回传；callback 合同同步标注批量 shapes。
- GEARS 批量 callback 已补坏项可见性：批量 webhook 中缺少 `gears_job_id` / `source_unit_id` 的 item 不再被静默跳过，会进入结构化 `failures`，便于真实 worker 对接时定位坏 payload。
- GEARS callback 写回已补幂等事件合并：重复 `event_id` / `callback_id` 或无 id 但状态与消息相同的回调不会重复追加 callback event，也不会重复生成 Seedance 视频版本；callback 合同同步暴露 idempotency fields。
- GEARS callback 响应已补可观测幂等计数：单条和批量 webhook 都返回 `received_count`、`updated_count`、`failed_count`、`duplicate_count`，真实 worker 可区分“已处理成功”和“重复送达”。
- GEARS status sync 响应已补重复计数：轮询已完成或重复状态时会汇总 callback 写回的 `duplicate_count`，单故事项目和 AI 漫剧系列路径均已覆盖。
- GEARS failure 响应已补 job 定位字段：status poll、callback match 和 sync import 失败项会尽量返回 `gears_job_id`，前端错误摘要也会显示 source unit / job id，便于真实 worker 对账。
- GEARS progress 已补合同与账本写回：callback / status sync 支持 `progress`、`progress_percent`、`progressPercent`、`percent`、`percentage`、`progress_ratio` 等字段，统一归一化为 `progress_percent` 并在单故事与系列工作台最新 job 摘要中回显。
- GEARS status poll 失败诊断已写回 Job Ledger：HTTP/网络轮询失败会记录 `last_poll_at`、`last_poll_error`、`last_poll_failure_category`、`last_poll_error_code`，但不把执行状态误改为 failed；下一次成功 callback/status sync 会清掉临时诊断。
- GEARS 乱序 callback 已补终态保护与审计字段：job 进入 `ready` / `failed` / `rejected` / `canceled` 后，晚到的 `processing` / `submitted` 等非终态事件不会把账本倒退，事件仍保留在 `callback_events`，并标注 `applied_status` 与 `status_regression_ignored`。
- GEARS callback 已补平台时间戳归一化：支持 `eventTime`、`timestamp`、`completedAt` 等字段，统一写入 `callback_events[].provider_event_at` 和 job `completed_at`，便于真实 worker 对账、乱序排查和重放审计。
- GEARS 批量 callback 失败项已补 payload path：`callbacks[]`、`events[]`、`data.tasks[]` 等批量 envelope 中的坏项会返回 `failures[].path`，例如 `callbacks[2]` / `data.tasks[2]`，便于外部 worker 快速定位坏 payload。
- GEARS callback 已补终态冲突审计：`ready` / `failed` / `rejected` / `canceled` 之间发生后到回调覆盖时，事件会记录 `previous_status`、`applied_status` 和 `terminal_status_changed`，便于真实 worker 重放与人工对账。
- GEARS callback 已补 `canceled` 终态失败上下文：GEARS 主动取消 / 人工取消 / 平台取消的回调会保留 `failure_reason`、`error_code` 和 `failure_category`，并同步写入单故事 Shot Ledger / 系列生产账本。
- GEARS status/callback 已补平台状态别名失败归一化：`TIMED_OUT`、`POLICY_BLOCKED`、`NO_CREDIT`、`INVALID_PAYLOAD` 等状态字段本身可触发终态和失败分类，不再必须依赖额外 `failureReason`。
- GEARS status/callback 状态别名继续扩展：`ACCESS_DENIED`、`TOKEN_EXPIRED`、`RATE_LIMITED`、`NETWORK_ERROR`、`SERVICE_UNAVAILABLE`、`ASSET_MISSING`、`UNSUPPORTED_MEDIA`、`VALIDATION_ERROR` 等只出现在 status 字段里的平台结果可直接归一化为终态和失败分类。
- GEARS artifact URL 已补生产平台别名归一化：callback/status sync 支持 `manifestUrl`、`subtitleUrl`、`srtUrl`、`vttUrl`、`audioUrl`、`imageUrl`、`thumbnailUrl`、`posterUrl` 等字段，并为 manifest / subtitle / audio / image 等 artifact 推断 `kind` / `role`，`final_assemble` 可不依赖 `artifacts[]` 或 URL 后缀写回 manifest。
- GEARS source id 已补平台别名正式合同：callback schema / contract 支持 `externalId`、`customId`、`productionId` 等字段作为 `source_unit_id` 映射，真实 worker 即使使用平台外部 ID 或重映射 job id，也可回写到单故事 GEARS Job Ledger / Shot Ledger。
- GEARS submit unit 已补 worker 对账字段：HTTP 提交给 GEARS 的每个 unit 会带 `external_id` / `custom_id` / `idempotency_key` / `callback_url` / `metadata`，便于 GEARS v2 worker 幂等建单、按外部 ID 回传并保留 Story Agent 项目/故事/镜头来源。
- GEARS submit 响应已补真实 worker 嵌套形态兼容：`data.acceptedUnits[]`、`data.task` 等平台式响应会归一化为 GEARS Job Ledger，execution contract 同步公开这些 accepted response shapes。
- GEARS submit 部分拒绝已结构化：`data.rejectedUnits[]` 可与 acceptedUnits 混合返回，也可单独返回；服务层会保留 `gears_job_id`、`idempotency_key`、`error_code`、`failure_category` 和 message，避免真实 worker 的批量拒绝被误判为整批合同失败。
- GEARS submit 拒绝项已进入生产账本：真实 worker 返回的 rejectedUnits 会生成 `status: rejected` 的 GEARS Job Ledger item，并同步写入单故事 Seedance Shot Ledger / 系列生产账本；前端失败摘要会显示分类、错误码和幂等键。
- GEARS readiness / 本地合同冒烟已落地：新增 `GET /api/system/gears-execution-readiness`，汇总配置、callback 安全、批量边界、status/callback 别名对齐，并运行 accepted/rejected submit、rejected ledger、嵌套 callback、状态别名、压力边界五类本地 smoke；单故事项目页与 AI 漫剧系列工作台直接显示 readiness 状态与分数。
- GEARS live E2E 联调计划已进入 readiness 报告：readiness API 返回 submit、status poll、project callback、series callback 四个真实联调步骤的 ready/blocked 状态、blocked_by 和 expected_result；前端同步显示本地 smoke 通过数和 live E2E ready 步骤数。
- GEARS smoke handoff package 已落地并可导出：`GET /api/system/gears-execution-smoke-package` 输出可交给 GEARS v2 worker 的 submit/status/project callback/series callback 四步联调包，包含 headers 占位符、request body、accepted response shapes、Story Agent 预期写回结果和 Markdown handoff；单故事项目页与 AI 漫剧系列工作台可直接导出 JSON / Markdown。
- GEARS live smoke run 已落地：新增 `POST /api/system/gears-execution-live-smoke-run`，默认 dry-run 生成 Markdown 报告；`execute=true` 且 readiness ready 时会复用真实 GEARS submit adapter 提交 smoke units，`poll_after_submit=true` 时继续轮询 accepted job，单故事项目页与 AI 漫剧系列工作台可直接生成/执行 live smoke 报告。
- GEARS pressure report 已落地：新增 `GET /api/system/gears-execution-pressure-report`，本地验证 200 条 callback envelope 可解析、201 条会被 schema 拒绝、单 job 仅保留最新 20 条 callback_events；前端同步显示 pressure 状态并可导出 Markdown。
- GEARS worker 失败类型已扩展到真实执行节点：`render_failed`、`artifact_upload_failed`、`callback_delivery_failed`、`output_missing`、`artifact_invalid`、`worker_unavailable` 可从 status / errorCode / failureReason 归一化写入 GEARS Job Ledger。
- GEARS generated project pressure audit 已落地：`GET /api/system/gears-execution-generated-project-pressure` 扫描单故事与 AI 漫剧系列 generated project 的 `gears_job_ledger`，汇总 job、回调事件、artifact、失败分类和风险等级，并生成 Markdown。
- 单故事项目页与 AI 漫剧系列工作台已显示 generated pressure 状态，并支持导出 generated project pressure Markdown。
- GEARS worker acceptance report 已落地：`GET /api/system/gears-execution-acceptance-report` 聚合 readiness、本地 smoke、live E2E 阻断项、pressure、generated pressure 和 handoff artifacts；单故事项目页与 AI 漫剧系列工作台已显示 acceptance 状态，并支持导出 worker acceptance Markdown。
- GEARS worker acceptance kit 已落地：`GET /api/system/gears-execution-worker-acceptance-kit` 生成 env template、smoke payload 文件、submit/status/callback/live-smoke curl 命令、断言清单和 Markdown runbook；单故事项目页与 AI 漫剧系列工作台已显示 worker kit 命令数，并支持导出 Markdown / JSON。
- GEARS worker acceptance shell script 已落地：worker kit 同时生成 `run-gears-worker-acceptance.sh`，脚本会写 payload、抓取 acceptance/evidence 预检、调用 GEARS submit/status、回打单故事/系列 callback、运行 live smoke，并把响应落到 evidence 目录；前端可直接导出 `.sh`。
- GEARS worker acceptance shell script 已改为“完整证据落盘、stdout 简报”：acceptance/evidence/generated pressure JSON 保存到 evidence 目录，终端只打印 ok/status/commands/payloads/documents 等摘要，避免真实联调日志被大 JSON 淹没。
- GEARS worker acceptance shell script 已补批量 submit job id 自动提取：默认从 `gears_job_id`、`jobId`、`taskId`、`data.task`、`acceptedUnits[]`、`jobs[]`、`tasks[]` 等真实 worker 响应形态中提取全部 job id 并写入 `gears-smoke-job-ids.txt`，随后逐个轮询 status。
- GEARS worker acceptance shell script 已补可配置多轮 status poll：`GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS` 默认 `1`，`GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS` 默认 `5`；多轮时保存每次 `gears-status-response-<job>-attempt-<n>.json`，并保留最新 `gears-status-response-<job>.json` 供 audit 兼容。
- GEARS worker acceptance shell script 已补 replay/post-audit 证据：默认重放单故事与系列 callback，保存 replay response；跑后拉取 evidence bundle 和 generated pressure，并写入 manifest，方便证明 `duplicate_count` 和跑后 ledger 风险。
- GEARS worker acceptance shell script 已补 Story Agent callback response audit：生成 `story-agent-callback-response-audit.json` 与 `story-agent-callback-response-audit.md`，统计 callback/live-smoke 响应里的 `ok=false`、validation/auth/not-found/live-smoke blocked 错误、received/updated/failed/duplicate 计数和推荐修复动作。
- GEARS worker acceptance shell script 已补 Story Agent callback id preflight：生成 `story-agent-callback-id-preflight.json` 与 `.md`，提前检查 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 是否符合 Story Agent 路由格式，避免占位 id 造成的 callback validation error 被误归因到 GEARS worker。
- GEARS worker acceptance shell script 已补 worker response audit：生成 `gears-worker-response-audit.json` 与 `gears-worker-response-audit.md`，记录真实 worker 响应中的 accepted/rejected/failed 计数、状态别名、job/source/idempotency 字段、artifact URL 字段、ready 缺 artifact、error code、failure category、合同缺口和 `recommended_actions`，供后续补失败类型、artifact 回写兼容和响应兼容层。
- `recommended_actions` 已带 `sample_paths`，audit totals 已带 `sample_record_paths`，可定位缺 worker id、缺 source/idempotency、缺失败上下文、ready 无 artifact 和未知状态的代表性 JSON path。
- GEARS worker acceptance shell script 已补 transport / HTTP sidecar 证据：submit、status poll 和可选大项目 pressure submit 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；worker response audit 汇总 `transport_error_count` / `http_error_count`，并把非 2xx 与 curl 失败拆成独立 recommended actions。
- Story Agent callback/live-smoke 也已补 transport / HTTP sidecar 证据：project callback、series callback、callback replay 和 live smoke 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；`story-agent-callback-response-audit` 汇总 `transport_error_count` / `http_error_count` / `not_found_count` / `blocked_count` / `ledger_match_missing_count`，可区分 route/auth/project missing、live smoke env blocked、项目存在但 GEARS Job Ledger 未匹配与 callback payload 合同问题。
- worker response audit 已用 error_code / failure_category 参与 failed/rejected 判定：例如 `SERVICE_UNAVAILABLE` 会进入 failed，而不是 unknown，方便真实 worker 失败类型对齐。
- worker response audit 已覆盖 `no_worker_response_files` 与 `record_count_zero` 两类前置失败：缺 env 时提示先跑 worker smoke，不可达 endpoint 留下空响应文件时提示补真实 submit/status 结果或 transport failure body。
- acceptance shell stdout 已补 audit 摘要：callback id preflight、worker response audit 和 Story Agent callback response audit 都会打印 totals / recommended actions 一行摘要，方便真实联调日志快速定位失败类型。
- GEARS worker acceptance shell script 已补真实执行细节：提交前按 env 渲染 smoke payload，提取 job id 后回填 callback payload；`GEARS_API_TOKEN` 可选；submit 失败会写 `gears-submit-exit-code.txt`、`gears-submit-failed.txt` 和 manifest。
- GEARS worker acceptance shell script 已补缺 env evidence：脚本会先写 payload、拉取 acceptance/evidence，再检查 `GEARS_API_BASE_URL`、`GEARS_CALLBACK_SECRET`、`GEARS_CALLBACK_BASE_URL` 和 smoke project ids；缺项会写 `gears-required-env-missing.txt` / `gears-required-env-blocked.txt` 后退出。
- GEARS worker acceptance kit 已补 smoke target 自动发现：导出包新增 `smoke_targets`，脚本会写 `story-agent-smoke-targets.json` / `story-agent-smoke-env-selected.json`；当 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID` 留空或仍是占位符时，会从 `web/generated` 自动选择现有单故事项目和 AI 漫剧系列项目，减少 callback smoke 的 404 误判。
- Story Agent callback response audit 已补 `ledger_match_missing_count`：当 callback 成功到达真实项目但 `source_unit_id` / `gears_job_id` 不在项目 GEARS Job Ledger 中时，会给出“先走 Story Agent submit 建账本，或对齐回调 source/job id”的 P0 动作，避免误判为路由或鉴权问题。
- GEARS worker acceptance script 已补可选 Story Agent ledger seed：设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 后，会调用单故事和系列 GEARS submit API 写入真实 GEARS Job Ledger，并把 callback payload 改写为 submit 返回的 `source_unit_id` / `gears_job_id` / `job_type`，用于验证 callback 真正回写项目账本。
- GEARS submit response 兼容已补顶层 `status` + `data.acceptedUnits[].externalId`：真实 worker 使用平台式 `taskId` / `externalId` / `idempotencyKey` 返回时，Story Agent submit adapter 可正确建 GEARS Job Ledger，不再把 envelope status 当作缺 `source_unit_id` 的 job。
- GEARS worker acceptance kit 已补大项目压测 payload：默认生成 30 集 × 每集 4 镜的 `gears-large-project-submit-pressure.json` 和 `gears-large-project-pressure-summary.json`，并按 200 units 上限封顶；提交由 `GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1` 显式开启。
- GEARS worker evidence bundle 已落地：`GET /api/system/gears-execution-worker-evidence-bundle` 一键聚合 acceptance report、worker kit、smoke handoff、pressure report、generated pressure report、generated health report 和 Story Agent MVP status report；单故事项目页与 AI 漫剧系列工作台已显示 evidence 文档数，并支持导出 Markdown / JSON。
- GEARS callback 幂等已接入 submit idempotency key：worker 可回传 `idempotencyKey` / `idempotency_key` 作为 callback event id，重复回调会进入 `duplicate_count`，不重复追加 `callback_events` 或生成镜头版本。
- GEARS Job Ledger 已持久化 submit idempotency key，并支持 worker 仅凭 `idempotencyKey` / `idempotency_key` 回调匹配单故事与 AI 漫剧系列 job；旧 ledger normalize 时会按 `job_type:source_unit_id` 补齐默认幂等键。
- GEARS idempotency-key 生命周期回调审计已加固：`idempotencyKey` 作为 job 匹配 / 幂等锚点时，不会吞掉状态、进度或消息变化；只有相同状态、进度和消息的重复 payload 才计入 `duplicate_count`，`callback_events` 会标注 `event_id_source`。
- GEARS 大项目账本边界已显性化：单个 job 只保留最新 20 条 `callback_events`，批量 callback envelope 单次最多接收 200 条 item，超过时在路由/服务层返回校验错误，避免大系列误投导致账本和写回循环失控。
- GEARS 大项目边界已进入配置与前端可观测面：`GET /api/system/gears-execution-config` 返回 callback 批量上限和事件保留上限，单故事项目页与 AI 漫剧系列工作台会直接显示这些 GEARS 边界。
- GEARS poll/status 合同已与 callback 合同对齐：`GET /api/system/gears-execution-contract` 在 `poll.accepted_status_fields` 和 `callback.accepted_status_fields` 中公开同一套平台状态别名，便于 GEARS v2 同步实现 status 查询和 webhook 回调。
- GEARS 系列重试 payload 已补生产上下文：`seedance_video` retry unit 会带 `retry_count`、`retry_reason`、旧 provider job、旧视频 URL、失败原因、审片意见、执行计划时间戳和 request payload，便于 GEARS v2 worker 区分首次生成、失败重试和审片返修。
- GEARS submit response 兼容已补深层 worker envelope：支持 `response.payload.result.tasks[]` / `rejectedJobs[]`，并把 `PROMPT_TOO_LONG`、`schema_invalid` 等 payload 类错误优先归入 `payload_invalid`。
- GEARS 系列 submit 响应已补 `job_type`、`job_type_label`、`submit_intent` 和更完整 Markdown 对账摘要；GEARS execution contract 示例已切换到系列 `seedance_video` 返修/重试 payload，系列工作台按钮文案也改为“GEARS 视频返修/重试”，旧 Seedance 重试入口标为兼容路径。
- 已执行导出的 `run-gears-worker-acceptance.sh` 前置 smoke：Story Agent 预检和 evidence bundle 拉取通过；本机没有 GEARS v2 worker endpoint，submit 阶段以 curl 7 失败并保存证据。新版脚本已验证缺 env evidence 与 30 集级压力 payload 生成。真实端到端仍需配置可达 `GEARS_API_BASE_URL`、`GEARS_CALLBACK_BASE_URL` 和 `GEARS_CALLBACK_SECRET`。
- 已用本地 fake GEARS worker 验证多轮 status poll：submit 返回 `fake-gears-job-1`，第 1 次 status 为 `PROCESSING`、第 2 次为 `COMPLETED`；脚本写出 attempt 文件和 latest 文件，audit 扫描 attempt 文件、跳过 latest 副本，`ready_without_artifact=0/1` 且识别 artifact URL。
- 已用本地 fake GEARS worker 验证 Story Agent callback response audit：占位 project/series id 会导致单故事与系列 callback 返回 `ok=false` / `VALIDATION_ERROR`，audit 统计 `ok_false_count=2`、`validation_error_count=2`，并给出 `validation_error_count` 推荐动作，提示换成真实 Story Agent project id。
- 已用导出的 `run-gears-worker-acceptance.sh` 验证缺 env 路径的新 id preflight：`/private/tmp/gears-worker-evidence-id-preflight` 写出 `story-agent-callback-id-preflight.json/.md`，`warning_count=2`，stdout 打印 `recommended_actions=1`；worker audit 同步输出 `no_worker_response_files` 推荐动作。
- 已用本地 fake GEARS worker 验证 HTTP 503 submit 证据：脚本写出 `gears-submit-response-http-status.txt=503` 与 `gears-submit-response-curl-exit-code.txt=0`，worker audit 统计 `http_error_count=1`、`failed_count=2`、`unknown_count=0`，并给出 `http_error_count` recommended action。
- 已用本地 fake GEARS worker 验证 Story Agent callback HTTP sidecar：worker submit/status 均 200，但使用不存在的合法格式 project/series id 回调，脚本完整退出 0，callback audit 统计 `http_error_count=4`、`not_found_count=4`、`blocked_count=1`、`ok_false_count=4`，sample transport files 指向四个 404 response，并把修复动作归到 smoke env 项目 ID / live smoke server env。
- 已用本地 fake GEARS worker 验证 smoke target 自动补齐：空 smoke env 会自动选择 `20260621-story-5xhl--character_story` / `20260621-story-5xhl` / `20260619-series-r0v5zyag`，证据在 `/private/tmp/gears-worker-evidence-auto-target-v3`；`not_found_count=0`、`blocked_count=0`、`http_error_count=0`、`transport_error_count=0`，剩余 `ledger_match_missing_count=4`，下一次应启用 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 验证账本写回归零。
- 已用本地 fake GEARS worker 验证 ledger seed 局部闭环：`/private/tmp/gears-worker-evidence-ledger-seed-v3` 中单故事项目 seed 选择 `shot-1` / `fake-gears-job-seed-10` 并成功回写 ready；callback audit `updated_count=2`、`duplicate_count=1`、`ledger_match_missing_count=2`，剩余阻断来自示例系列没有可提交的 `seedance_video` retry job。
- 已修正 worker acceptance smoke target 选择：series candidate 会统计真实存在的 episode story、`seedance_video` retry candidate 和后期可 seed job；当视频 retry 不可提交时自动降级到可提交的 GEARS 后期 job。本轮自动推荐 `GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE=title_card_render`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 复测 ledger seed 完整闭环：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v5`；自动选择 `20260619-series-3f89ec1y`，单故事与系列 seed selected 均 `patched=true`，series 使用 `title_card:card-series-opening` / `fake-gears-job-11`；callback audit 达到 `updated_count=4`、`duplicate_count=2`、`failed_count=0`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已修正 worker response audit 的记录识别误报：顶层 submit/status envelope 仅有 `status` 时不再当作 worker record，`outputs[].url` 等 artifact 子项也不再被误判为缺 job/source id 的记录；只有明确 job/unit/task/result 路径或对象自身含 job/source/artifact/status 信号时才计入审计。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v7 fake GEARS smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v7`；worker audit 达到 `record_count=10`、`unknown_count=0`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`、`recommended_actions=[]`；Story Agent callback audit 达到 `updated_count=4`、`failed_count=0`、`duplicate_count=3`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已补大项目压力响应专用审计：acceptance shell 现在生成 `gears-large-project-response-audit.json/.md`，对大项目压力 payload 与 worker submit 响应逐 source 对账，统计请求 units、响应记录、source echo、缺失/重复/意外 source、HTTP/curl 状态和推荐修复动作。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v8 大项目压力 smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v8-pressure`；30 集 × 4 镜共 120 units 全量 accepted，large-project response audit 达到 `request_unit_count=120`、`response_record_count=120`、`accepted_count=120`、`source_echo_count=120`、`missing_requested_source_count=0`、`duplicate_source_id_count=0`、`unexpected_source_count=0`、`recommended_actions=[]`；worker audit 和 Story Agent callback audit 的 `recommended_actions` 也均为空。真实 GEARS v2 endpoint 仍未配置，下一步只需替换 endpoint 即可复用同一证据链。
- 已补最终 GEARS worker acceptance verdict：`run-gears-worker-acceptance.sh` 现在输出 `gears-worker-acceptance-verdict.json/.md`，综合 required env、callback id preflight、worker response audit、Story Agent callback audit、大项目 pressure audit 和 manifest，给出 `acceptance_passed`、`failed_gate_ids` 与聚合 `recommended_actions`；默认 `GEARS_ACCEPTANCE_STRICT_AUDIT=1`，失败 verdict 会让脚本非零退出。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v9 verdict smoke：证据目录 `/private/tmp/gears-worker-evidence-verdict-v9`；最终 verdict 为 `status=passed`、`acceptance_passed=true`、6 个 gate 全过、`recommended_actions=0`；大项目 pressure 仍是 120/120 accepted/source echo，worker audit `record_count=370`，Story Agent callback audit `ledger_match_missing_count=0`。
- 已补最终 GEARS worker acceptance archive：`run-gears-worker-acceptance.sh` 会输出 `gears-worker-acceptance-archive.json/.md`，记录必交证据文件、缺失附件、byte length 和 `sha256`；严格模式除 `acceptance_passed=true` 外，还要求 archive `signoff_ready=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v10 archive smoke：证据目录 `/private/tmp/gears-worker-evidence-archive-v10`；worker kit 为 16 条 commands / 5 个 payloads；archive `status=signoff_ready`、`signoff_ready=true`、18 个必交附件全齐、证据文件 66 个、`recommended_actions=0`；verdict `acceptance_passed=true`，大项目 pressure 120/120 source echo，worker/callback audit 均无阻断。
- 已补最终 GEARS worker acceptance checksum manifest：archive 生成时同步输出 `gears-worker-acceptance-checksums.json/.md`，记录每个证据文件的 `sha256`、byte length、role 和 required 标记，并在生成前清理旧 archive/checksum 产物，避免重跑污染证据清单。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v11 checksum smoke：证据目录 `/private/tmp/gears-worker-evidence-checksums-v11`；checksum manifest `schema_version=gears-worker-acceptance-checksum-manifest/v1`、`algorithm=sha256`、`file_count=66`、`required_file_count=18`、`record_count=66`；archive `signoff_ready=true`、`required_checksum_count=18`，verdict/pressure/worker/callback audit 均无阻断。
- 已补最终 GEARS worker acceptance integrity 复核：脚本会输出 `gears-worker-acceptance-integrity.json/.md`，重新计算 checksum manifest 中每个证据文件的 `sha256` 与 byte length，并检查必交附件是否都有 checksum record；严格模式除 `acceptance_passed=true`、`signoff_ready=true` 外，还要求 `integrity_passed=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v12 integrity smoke：证据目录 `/private/tmp/gears-worker-evidence-integrity-v12`；worker kit 为 17 条 commands / 5 个 payloads；integrity `status=passed`、`integrity_passed=true`、`required_checksum_records=18/18`、`mismatch_count=0`、`missing_file_count=0`、`sha256_mismatch_count=0`；verdict、archive、checksum、pressure、worker/callback audit 均无阻断。
- 验证已通过：server lint/build、client lint/build、`project-service.test.ts`、`outline-service.test.ts`、`gears-execution-service.test.ts`、`api.test.ts`。

### MCP / Agent 工具

- 新增并注册 `kb_generate_gears_delivery`：从 `project_id`、`story_id`、`story_json` 只读生成 GEARS 交付包。
- 新增并注册 `kb_generate_seedance_prompt`：生成 Seedance 2.0 镜头提示词包，支持 `@图片/@视频/@音频` 参考。
- 新增并注册 `kb_get_production_readiness`：读取单故事项目或 AI 漫剧系列项目的生产 readiness 指挥报告，汇总质量、交付、GEARS 账本、审片返修、下一步动作和可执行 `automation_plan`。
- 新增 `kb_repair_story(auto_apply=false)`：返回质量快照、修复动作、目标场景和风险说明。
- 新增 `kb_update_project_version`：受控新增项目版本，不覆盖旧版本，不写知识库省份文件。
- 扩展 `kb_repair_story(auto_apply=true)`：必须由调用方提供 `repaired_story_json`，校验后写入新版本。
- 已用真实项目 smoke 验证 auto_apply：质量分从 83 提升到 100，issue 从 2 降到 0。

### Web / Production Board

- 项目详情页新增当前版本质量反馈面板：聚合缺失要素、弱节拍、不适配表达和修复建议。
- Seedance provider 提交抽象已进入工作台：可本地记录 provider job、跳过已有非失败任务、失败镜头重新提交递增 retry。
- Seedance provider 队列元数据首版：
  - `StoryProjectMeta.seedance_provider_queue`
  - `provider_queue_batch`
  - `provider_queue_id`
  - `provider_queue_position`
  - 前端显示最新队列批次和镜头队列位置。
- Seedance provider 超时恢复首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/recover-provider`
  - 默认 dry-run 扫描 `submitted` / `processing` 超时镜头。
  - `mark_timed_out_failed=true` 时标记 failed，并追加 failed 版本。
  - 前端“回传与重试”增加“标记超时失败”。
- Seedance provider 外部回传 schema 首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-callback`
  - 支持外部 provider 单条回传的 `provider`、job、queue、event、视频 URL、失败原因、质量分和 review note。
  - 若配置 `SEEDANCE_CALLBACK_SECRET`，单故事 provider webhook 必须携带 `Authorization: Bearer <secret>` 或 `X-Seedance-Callback-Secret`。
  - 回传可按 job 匹配，也可按 `queue_id + queue_position` 映射到 Shot Ledger。
  - 状态归一化复用内部回传导入，ready/failed/processing/submitted 等平台状态会更新 `seedance_shot_ledger`。
  - 修复状态更新丢失 provider / queue 元数据的问题。
- Seedance provider 轮询入口首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/poll-provider`
  - dry-run 返回待轮询的 provider job / queue 目标，可选带出镜头提示词。
  - 带 `provider_results` 时可应用外部适配器查询到的状态快照，复用回传归一化写回 Shot Ledger。
- Seedance provider 失败分类首版：
  - 共享类型新增 `SeedanceProviderFailureCategory`，覆盖素材缺失、提示词非法、内容审核、超时、额度、鉴权、限流、服务端、网络和未知错误。
  - 内部状态更新、外部回传和轮询结果都可携带 `failure_category` 与 `provider_error_code`。
  - 超时恢复默认写入 `provider_timeout` / `PROVIDER_TIMEOUT`；重试包 Markdown / JSON 会带出失败分类、provider 错误码和分类化建议动作。
  - Production Board 同步 `seedance_shot_ledger` 时会保留失败分类和错误码，避免导出重试包时丢字段。
  - 新增 provider 错误码别名映射层，`INSUFFICIENT_BALANCE`、`TOKEN_EXPIRED` 等 code 可在失败文案很短时直接归入额度、鉴权等类别。
- Seedance provider 通用 poll adapter 首版：
  - `SeedanceShotProviderPollRequest` 新增 `use_provider_adapter`。
  - 服务端读取 `SEEDANCE_PROVIDER_POLL_ENDPOINT`，把 dry-run 产生的 `poll_targets` POST 给外部 adapter。
  - adapter 可返回顶层数组、`provider_results`、`results` 或 `items`，服务端会复用既有回传归一化写回 Shot Ledger。
  - 默认支持 `SEEDANCE_PROVIDER_API_TOKEN` 的 bearer 鉴权，也支持通过 `SEEDANCE_PROVIDER_POLL_AUTH_HEADER` / `SEEDANCE_PROVIDER_POLL_AUTH_SCHEME` 或通用 auth env 改成 `X-API-Key`、`Token`、裸 token 等模式。
  - 支持 `SEEDANCE_PROVIDER_POLL_TIMEOUT_MS` 超时控制；外部 adapter 网络/HTTP 错误在路由层返回 502。
  - 项目详情页“回传与重试”新增“轮询 provider”按钮，会按最新 provider / queue 批次调用 poll adapter，成功后刷新 Production Board、队列健康和重试策略。
- Seedance provider 通用 submit adapter 首版：
  - `SeedanceShotProviderSubmitRequest` 新增 `use_provider_adapter`，响应新增 `provider_adapter` 提交摘要。
  - 服务端读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`，把待提交镜头、Seedance prompt、素材 slot 和素材库 POST 给外部 adapter。
  - adapter 返回真实 `provider_job_id` / `provider_queue_id` / queue position 后，会覆盖本地占位 job 并写入 Shot Ledger 与 provider queue batch。
  - 默认支持 `SEEDANCE_PROVIDER_SUBMIT_API_TOKEN` 或通用 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权，也支持通过 submit/auth env 自定义 header 名和 scheme；未配置 endpoint 返回 400，外部 adapter HTTP/网络错误返回 502。
  - 项目详情页“回传与重试”保留本地“提交到 Seedance”，并新增“提交 adapter”入口，用于从工作台直接触发真实 submit worker。
- Seedance provider adapter 配置状态首版：
  - 新增 `GET /api/system/seedance-provider-config`，只返回 submit/poll endpoint 是否配置、token 是否配置和超时毫秒数，不暴露 endpoint URL 或 token 原文。
  - 配置状态新增 `callback_secret_configured`，用于确认 provider 回传 webhook 是否启用共享凭据保护。
  - 配置状态新增 submit/poll 的有效鉴权 header 和 scheme，仅暴露名称/模式，不暴露 token 原文。
  - 项目详情页 Seedance Shot Ledger 顶部新增 adapter 配置 chips，可在点击提交/轮询前看到 submit adapter、poll adapter 和 token 状态。
  - “提交 adapter”和“轮询 provider”会按配置状态禁用，未配置 endpoint 时不再等到点击后才返回 400。
  - 响应新增缺失 env var 清单、配置 warning 和下一步动作，项目详情页会直接显示缺 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT` / `SEEDANCE_PROVIDER_POLL_ENDPOINT` 等诊断信息。
- Seedance provider adapter 合约元数据首版：
  - 新增 `GET /api/system/seedance-provider-adapter-contract`，返回 submit/poll schema version、env key、请求字段、可接受响应形态和归一化字段。
  - 合约接口不返回 endpoint URL 或 token 原文，可给外部 worker / Agent 对接前读取。
  - 合约接口新增 `callback_auth_env` 和 `callback_auth_headers`，外部 worker 可按约定给 `provider_callback_path` 带回调鉴权头。
  - 合约接口新增 `auth_header_envs`、`auth_scheme_envs`、默认 header 和默认 scheme，真实 worker 可按平台鉴权习惯选择 bearer、token 前缀或裸 token。
  - 合约接口新增 `request_example` 和 `response_examples`，外部 worker 可直接按示例实现 submit/query smoke。
  - submit adapter payload 新增 `provider_callback_path` 和 `provider_poll_path` 相对路径，外部 worker 可直接按项目路径回传或查询状态。
  - submit adapter payload 新增可选 `provider_callback_url` 和 `provider_poll_url` 绝对 URL；服务端优先读取 `SEEDANCE_PROVIDER_CALLBACK_BASE_URL`，并回落到 `GEARS_CALLBACK_BASE_URL` / `PUBLIC_API_BASE_URL` / `APP_BASE_URL`。
  - 配置状态新增 `callback_base_configured` 和可用 env 名列表，只暴露是否配置，不返回真实公开基址。
  - submit/poll adapter 新增 request mode：默认 `batch`，也可通过 `SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE=per_shot` 和 `SEEDANCE_PROVIDER_POLL_REQUEST_MODE=per_target` 对接单任务创建/查询平台接口。
  - adapter 响应归一化支持单个任务对象或 `data` 下单个任务对象，便于真实平台 HTTP 返回直接进入 Shot Ledger。
- Seedance provider 平台式响应兼容层首版：
  - submit/poll adapter 可接受顶层数组、`submitted_shots` / `provider_results` / `results` / `items`，以及 `tasks`、`task_list`、`jobs`、`records`、`data.tasks` 等更贴近平台 worker 的返回形态。
  - 结果字段兼容 `taskId/task_id/id/requestId`、`batchId/batch_id`、`taskStatus/state/phase`、`outputUrl/fileUrl/downloadUrl/resultUrl`、`score/quality`。
  - 单故事 `provider-callback` schema 同步支持这些字段别名，真实 worker 可直接回传平台式任务字段。
  - provider 错误码别名扩展 `RISK_CONTROL`、`NO_CREDIT`、`ACCOUNT_ARREARS`、`ACCESS_DENIED`、`INVALID_SIGNATURE`、`QPS/TPS/CONCURRENCY`、`SYSTEM/MODEL` 等类别映射。
- Seedance provider 队列状态总览首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-overview`。
  - 可按 `provider` / `queue_id` 过滤，返回状态计数、活跃数、完成数、失败数、可重试数、超时数、缺视频数和注意项。
  - 批次汇总会从当前 Shot Ledger 回看 ready/failed/active/timed_out 状态，避免只依赖提交时的 batch 原始状态。
  - 注意项按超时、失败、处理中、已提交优先排序，并带出失败分类、provider 错误码和复用的重试建议。
  - 项目详情页 Seedance Shot Ledger 已接入“Provider 队列健康”条，显示批次、活跃、完成、失败、可重试、超时和注意项，并支持手动刷新。
- Seedance provider 人工重试策略首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-plan`。
  - 可按 `provider` / `queue_id` / `timeout_minutes` / `max_retry_count` / 失败分类过滤，返回失败、超时、完成但缺视频和可选未提交镜头。
  - 每个候选镜头会标注优先级、重试原因、是否可直接重提、阻断原因、失败分类、provider 错误码和建议动作。
  - Markdown 输出可直接给人工制作或外部 worker 复核。
  - 项目详情页“Provider 队列健康”下新增默认折叠的“人工重试策略”，支持刷新策略和导出 Markdown。
- Seedance provider 重试执行自动化首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-submit`。
  - 自动读取 retry plan 中 `can_resubmit=true` 的候选镜头，跳过素材缺失、提示词非法、内容审核、额度、鉴权等阻断项。
  - 复用 submit-provider 队列写入和 adapter 提交逻辑，重提旧 job 时会递增 `retry_count` 并生成新 provider queue batch。
  - 项目详情页“人工重试策略”新增“提交可重提”，执行后刷新 Production Board、队列健康和重试策略。
- Seedance provider 自动轮询 UI 首版：
  - 项目详情页“回传与重试”折叠区新增“轮询 provider”。
  - 默认使用最新 provider queue batch 的 `provider` / `queue_id`，请求 `include_prompt=true` 和 `use_provider_adapter=true`。
  - 轮询成功后回写项目快照并刷新 Production Board、Provider 队列健康和人工重试策略，页面提示更新数、待轮询数和 adapter 返回数。
- Seedance provider platform payload / 签名 adapter 首版：
  - 新增 `SEEDANCE_PROVIDER_PAYLOAD_MODE`、`SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE`、`SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE`，默认保持 `story_agent` 合同，启用 `platform` 后 submit 映射为 `tasks[].prompt/duration/external_id/callback_url/metadata`，poll 映射为 `task_ids/targets[].task_id/external_id/metadata`。
  - submit/poll 平台字段支持 env 改名，适合先对接真实平台 HTTP 单任务或批量接口，不再必须另写外部 worker 做字段翻译。
  - 新增 HMAC 签名支持：`SEEDANCE_PROVIDER_SIGNATURE_SECRET` 或 submit/poll 专用 secret 会写入签名头和时间戳头；签名基串为 `METHOD\nURL\nTIMESTAMP\nJSON_BODY`。
  - adapter 响应和直接 webhook 兼容 `external_id/externalId/custom_id/customId`，可映射回 Story Agent `shot_id`。
  - `GET /api/system/seedance-provider-config` 与 `GET /api/system/seedance-provider-adapter-contract` 已同步暴露 payload mode、签名配置状态、签名 header、平台字段 env 和 platform payload 示例，不泄漏密钥。
- AI 漫剧 Seedance 字幕链路首版：
  - 新增 `export-seedance-subtitles`，从成片精修计划的 subtitle cues 生成合法 SRT、Markdown 和 JSON 字幕包。
  - 新增 `seedance-subtitles/render` worker，支持 `dry_run`、`overwrite`、`episode_no`、`output_filename`、`mode=sidecar` 和 `mode=burn_in`。
  - 新增 `seedance_subtitle_render` 账本，记录 SRT 路径、输出路径、ffmpeg 命令、渲染状态、失败原因和 cue 数。
  - 系列工作台新增“导出 SRT 字幕”“生成字幕文件”“烧录字幕成片”和字幕渲染状态卡。
  - 服务测试覆盖 SRT 包、分集 SRT、sidecar dry-run、sidecar 写盘和 burn-in mock runner；API 测试覆盖字幕导出/渲染请求校验。
- AI 漫剧 Seedance 音频链路首版：
  - 新增 `seedance_audio_library`，支持保存音乐、环境声、音效、旁白等音频素材条目。
  - 新增 `export-seedance-audio-plan`，把成片精修计划里的 audio cues 与音频素材库合并为 Markdown / JSON 音频计划。
  - 新增 `seedance-audio/mix`，支持 `dry_run`、分集筛选、输入视频路径、输出文件名、audio profile 和可复现 ffmpeg 命令。
  - 新增 `seedance_audio_mix` 账本，记录状态、源视频、输出路径、素材数、缺失音频数、失败原因和 ffmpeg 命令。
  - 系列工作台新增“导出音频计划 Markdown / JSON”“导入音频素材”和“混音 dry-run”，并展示混音状态卡。
  - 已补真实 runner 输入 hardening：非 dry-run 校验源视频、本地音频素材路径和文件存在，远程 URL / 协议路径会写入明确失败原因。
  - 已补多分集混音边界：分集混音会将该集 audio cues 时间轴归零，系列底乐可复用于单集，缺失音频数按分集范围统计。
  - 已补真实混音输出校验和原声保留开关：`include_original_audio` / `original_audio_volume_db` 会进入 ffmpeg `amix`，runner 未产出文件会写入明确失败原因。
  - 服务测试覆盖缺失音频计划、素材绑定、混音 dry-run 命令、分集混音时间归一、原声保留、远程音频失败、runner 未产出失败、本地音频 fake runner 成功和输入路径校验；API 测试覆盖音频素材库、混音请求和缺失项目校验。
- AI 漫剧 Seedance 片头片尾 / final delivery dry-run 首版：
  - 新增 `export-seedance-title-card-plan`，从 finishing plan 的 title cards 生成可执行片头片尾计划、输出路径和 ffmpeg command hint。
  - 新增 `seedance-title-cards/render`，支持 dry-run、分集筛选、output profile、`FFMPEG_FONT_PATH` 校验和 `seedance_title_card_render` 账本。
  - 已补片头片尾 fake runner hardening：非 dry-run 后校验输出文件存在，runner 未产出文件会写入明确失败原因，fake runner 成功会写回 ready 账本。
  - 新增 `seedance-final/assemble`，支持 dry-run、strict/tolerant 缺依赖模式、字幕/混音/片头片尾依赖状态、final ffmpeg 命令、`seedance_final_delivery` 账本和 final manifest JSON 写盘。
  - 已补最终装配 fake runner hardening：非 dry-run 前校验依赖文件存在，runner 未产出最终视频会写入明确失败原因，fake runner 成功会写回 ready 账本和 ready manifest。
  - 系列工作台新增“导出片头片尾计划 Markdown / JSON”“片头片尾 dry-run”“最终交付 dry-run”和最终交付依赖状态卡，最终交付卡展示 manifest 路径。
  - 服务测试覆盖 title card plan、render dry-run、title/final runner 未产出失败、title/final fake runner 成功、strict 缺依赖、final delivery dry-run 和 manifest 写盘；API 测试覆盖 title card/final 请求校验和缺失项目响应。
- AI 漫剧 Seedance 外部剪辑平台包首版：
  - 新增 `export-seedance-editing-platform-package`，输出 `ai-comic-series-editing-platform-package/v1`。
  - 首版支持 `generic_json`、`csv_timeline`、`srt` 和 `asset_manifest` 四种交付形态。
  - 时间线会串联系列片头、分集片头、镜头、分集片尾和系列片尾，并把 SRT cue 偏移到外部剪辑时间线。
  - 素材清单汇总视频、音频、字幕、片头片尾、缩略图和最终交付输出，并聚合缺失镜头、缺失音频和 final dependency。
  - 系列工作台新增剪辑平台 JSON、时间线 CSV、SRT 和素材清单 CSV 导出按钮。
  - 服务测试覆盖包 schema、格式、时间线、素材和 SRT；API 测试覆盖缺失项目响应。
- AI 漫剧 Seedance 生产总览 dashboard 首版：
  - 新增 `seedance-production-dashboard`，输出 `ai-comic-series-seedance-dashboard/v1`。
  - 后端聚合提示词导出、镜头生产、缩略图、剪辑装配、字幕、混音、片头片尾、最终交付和外部剪辑包状态。
  - dashboard 返回 summary、status_items、blockers、next_actions、episodes 和 Markdown 摘要。
  - 系列工作台新增“Seedance 生产总览”面板，展示总镜头、ready、失败、已选剪辑版、缩略图、阻断项和下一步动作。
  - 服务测试覆盖 dashboard 汇总、失败 blocker、下一步动作、分集摘要和 Markdown；API 测试覆盖缺失项目响应。
- AI 漫剧 Seedance 审片返修 ledger 首版：
  - 新增 `seedance_review_ledger`，支持 final / cut / shot / subtitle / audio / title_card 审片目标。
  - 新增审片意见、解决审片意见和导出审片返修包服务/API。
  - 返修包输出 open review、retry candidate、final reassemble required 和 Markdown 摘要。
  - 未解决 shot 审片意见会进入 Seedance 重试包；未解决 final reassemble 审片意见会阻断 strict final delivery dry-run。
  - 新增 `ai-comic-series-seedance-retry-execution-plan/v1`，把重试包进一步拆成可直接提交、需人工处理和缺提示词镜头。
  - 新增 `ai-comic-series-seedance-retry-submit-result/v1`，可把执行计划里可提交候选写回生产账本为 submitted，并生成本地 provider job id。
  - `seedance-retry/submit` 已支持 `use_provider_adapter=true`，读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`、submit auth env、HMAC 签名 env 和 `SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE`，把审片返修候选提交给外部 worker。
  - retry submit adapter 支持 batch / per_shot 请求、`production_id` 优先匹配、常见 `results/items/tasks/submitted_shots` 响应形态、provider queue 元数据和 `submitted/processing/failed` 归一化；仅回写 provider 接受的镜头，失败项返回 `provider_failures`。
  - 新增 `ai-comic-series-seedance-provider-recovery-result/v1`，支持 dry-run 扫描 submitted/processing 超时镜头，并可标记 failed。
  - final reassemble 审片意见默认仍会阻断 strict final delivery；显式执行重装配并成功写出 final delivery 后，可自动解决对应 `reassemble_final` 审片项。
  - dashboard 聚合 open/blocking 审片数，并把未解决审片意见纳入 blocker / next action。
  - 系列工作台最终交付区新增审片返修轻量录入、open 列表、标记解决和返修包导出。
  - 服务测试覆盖 review ledger、retry candidate、final reassemble blocker、final reassemble 自动解决、review retry package、retry execution plan、本地 retry submit、retry submit adapter、provider recovery 和 strict final guard；API 测试覆盖 review / retry execution / retry submit / provider recovery 路由校验和缺失项目响应。

### 文档同步

- 更新 `docs/story-agent-next-conversation-handoff.md`。
- 更新 `docs/story-agent-production-workbench-development-plan.md`。
- 更新 `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`。
- 保持下一阶段方向从“队列化准备”推进到“外部回传 schema、自动轮询、真实 provider API”；外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、platform payload / HMAC 签名、队列状态总览、人工重试策略和重试执行自动化已完成首版。

## 3. 已验证命令

```bash
cd web/client && npm run lint
cd web/server && npm run lint
cd web/server && npm test -- src/__tests__/project-service.test.ts
cd web/server && npm test -- --run src/__tests__/outline-service.test.ts
cd web/server && npm test -- --run src/__tests__/api.test.ts
cd web/server && npm test -- --fileParallelism=false
cd web && npm run build -w server
git diff --check
```
最近一次结果：

- `web/client`：lint passed。
- `web/client`：build passed。
- `web/server`：lint passed；`outline-service.test.ts` 14 passed，`api.test.ts` 112 passed；串行全量 24 files / 269 tests passed；server build passed。
- `web/client`：lint passed；ProjectDetail provider overview API smoke 通过，提交 5 条 provider 任务后 overview 返回 5 个总镜头 / 5 个活跃 / 5 个注意项。
- `git diff --check`：passed。

注意：`web/server` 的 API 测试会启动本地 HTTP server，在沙箱中可能触发 `listen EPERM 0.0.0.0`，需要允许非沙箱运行；全量默认并行跑可能因测试共享临时根出现隔离波动，串行模式已通过。

## 4. 当前工作区提醒

- 新对话开始必须先执行：

```bash
git status --short
git diff --stat
```

- 若出现未提交改动，先复核是否属于当前推进范围；不要覆盖或回滚用户已有改动。

## 5. 下一阶段优先级

### P0：GEARS Execution Adapter

首轮已完成：

- 新增 `GEARS_API_BASE_URL`、`GEARS_API_TOKEN`、`GEARS_CALLBACK_SECRET` 配置合同。
- 新增 `GET /api/system/gears-execution-config` 与 `GET /api/system/gears-execution-contract`。
- 新增 GEARS Job Ledger，统一记录图片、视频、字幕、混音、片头片尾和 final assemble job。
- 新增提交 GEARS job 的服务层 adapter，复用现有 Seedance prompt、GEARS delivery、retry execution plan 和素材 slot。
- 扩展 GEARS callback：支持 artifact URL、状态、失败分类、错误码、质量分、review note。
- 新增 GEARS status sync：从 ledger 轮询 `GET /gears/jobs/{gears_job_id}`，复用 callback 归一化写回账本。
- 旧 `SEEDANCE_PROVIDER_*` 保留为兼容层，新开发优先走 `GEARS_*`。

下一步最小切片：

```text
GEARS v2 worker acceptance shell script real endpoint smoke
  -> export env / payload / curl runbook
  -> submit seedance_video job
  -> poll status / receive callback
  -> verify Shot Ledger / series production ledger
  -> generate 30-episode pressure payload and submit only after basic smoke passes
  -> extend payload mapping for non-video job types
```

### P0：Story Agent 创作平台重定位

参考：`docs/story-agent-creative-platform-reposition-plan.md`。

下一步最小切片：

```text
shared types/schema
  -> CreationUseCase / TruthMode / CreationContract
  -> MaterialPack / MaterialSufficiencyReport
  -> StoryGenerateRequest/Result 兼容新字段
  -> StoryBlueprint 写入 creation_contract
  -> prompt package 接收真实度与创作场景
  -> project/version 保存新合同
```

实现原则：

- 不一次性删除 `knowledge_pack` 和 `kb_*`，先做兼容映射。
- 不把真实度规则散落在前端 label 或 prompt 文本里，优先进入 `genre-story-profiles.ts`、`story-blueprint-service.ts` 和质量服务。
- 原创漫剧、改编故事、机构影像应走同一条 Story Agent 生成链，但由 `truth_mode + creation_use_case + video_type` 决定约束强度。

2026-06-24 继续推进：

- 项目素材包已新增手动写入入口：`ProjectMaterialPackAddMaterialRequest` / `ProjectMaterialPackTarget` 进入 shared types/schema，后端新增 `POST /api/projects/:projectId/material-pack/materials`。
- `project-service` 新增 `addProjectMaterialPackMaterial`，会把人工素材写入 `primary_materials` / `supporting_materials` / `reference_materials`，可标记 verified fact、关联补齐 missing need，并复用统一 helper 重算 `material_sufficiency`、`creation_contract` 和旧 `knowledge_pack` 兼容包。
- 项目详情页增加“项目素材包”表单和素材计数，可从当前项目直接补充标题、摘要、来源、用途、可信度、故事作用和补齐项；提交成功后读回最新项目版本。
- 新增服务/API 测试覆盖手动素材写入、版本快照/source story 回写、HTTP schema 校验和 creation contract 刷新；同时保持不触发 GEARS 图片/视频/后期实产。
- StoryStudio 生成入口已从旧“词条/主题/大纲/小说模式”上移为三条创作路径：`原创开发`、`资料改编`、`机构影像`；路径会自动带出 `creation_use_case`、`truth_mode`、默认成片类型和生成优先级，仍保留素材输入方式与高级生成设置。
- `generateAndStoreStory` 支持 `creation_use_case=original_ai_comic` / `truth_mode=fictional_original` 的 outline-only 原创生成，不再要求先匹配素材包；该路径会构造用户原创故事种子 entry、生成 MaterialPack/CreationContract，但不会误生成 `adaptation_analysis`。
- `api.test.ts` 新增原创 AI 漫剧 outline-only 用例，覆盖无 `entry_name`、无 `knowledge_pack`、无 `material_pack` 的生成链路。
- StoryStudio 的创作路径与素材输入方式已联动：切到原作改编会同步 `source_material_mode=adapt_user_novel`，切到素材检索会回到机构影像合同，同一路径内切主题/大纲不会重置用户已选成片类型。
- Projects 工作台故事列表新增创作用途、真实模式和素材 gate chip，并支持按 `creation_use_case` 与素材 gate（可用 / 需核验 / 阻断 / 未标注）筛选。
- 旧项目兼容改为读时补齐：`listProjects()` / `getProject()` 会从当前版本 story 推断并返回 `creation_use_case`、`truth_mode`、`material_sufficiency`、`creation_contract` 和 `material_pack`，但不批量改写历史 `project.json`。
- `GET /api/projects` 与 `GET /api/projects/:projectId` 已新增 legacy hydration 集成测试，确认旧 `project.json` 不带新字段时，API 仍会返回创作合同、素材 gate 和当前故事的 `MaterialPack`。
- 单场景重写 prompt 已继承 `creation_contract` 与 `material_sufficiency`：`scene-regeneration/v1` 会带创作用途、真实度、客户/受众/传播目标、禁止表达、待核验项、素材 Gate 和当前可推进阶段；本地 fallback 也统一改为“素材补充”口径。

### P0：MCP 更深模型修复链路

首轮已完成：

- `kb_generate_story_repair_prompt` 可根据 `project_id`、`story_id` 或 `story_json` 生成模型修复提示包。
- 提示包包含 repair actions、目标场景、保护字段、完整 StoryGenerateResult JSON 输出合同、可选原始故事 JSON 和后续校验/写入工作流。
- 故事自动修复提示包现在会继承 `creation_contract` 与 `material_sufficiency`：修复 prompt 明确创作用途、真实度、禁止表达、待核验项、素材 Gate 和当前可推进阶段，避免质量修复突破素材/真实边界。
- Web 质量面板已新增只读修复提示包入口：`POST /api/projects/:projectId/repair-quality/prompt` 会生成 `story-quality-repair-prompt/v1`，项目详情页可生成并复制模型修复提示词，默认不内嵌完整 story JSON、不写项目文件。
- Web 质量面板已补安全写入入口：`POST /api/projects/:projectId/repair-quality/apply` 支持先 dry-run 校验 `repaired_story_json`，可容错读取纯 JSON、Markdown 代码围栏和 `{ repaired_story_json: ... }` 包装对象；通过 storyId/video_type/scene_id 顺序保护、质量重评估和改善门槛后，才以 `quality_repair` 新版本写入。
- 返回结果新增 `change_summary`，会列出是否有实质内容变化、顶层字段、逐场景字段、GEARS 段、保护字段、被忽略的保护字段改动、质量差值和问题差异（已解决 / 新增诊断 / 仍存在）；同时返回 `operator_hints` 与 `validation_summary_markdown`，便于操作员复制留档。项目详情页可粘贴模型输出的完整 StoryGenerateResult JSON，先“校验 JSON”，确认字段/场景差异、质量分和问题数变化后再“写入新版本”；失败或未改善默认不覆盖当前版本，完全无内容变化即使 `allow_no_improvement=true` 也不会写入空版本。
- 项目详情页的模型修复提示包入口已支持“内嵌完整 Story JSON”，也可直接复制提示词、提示包 Markdown、当前 Story JSON 或提示包内嵌 JSON，便于把完整上下文交给外部模型后再回填 `repaired_story_json`。
- 项目详情页的修复 JSON 校验结果已新增差异速览卡片：直接显示写入状态、内容差异、质量变化、诊断差异和保护字段摘要；场景变更字段与保护字段显示中文名，原始校验摘要折叠保留。
- 项目详情页的修复 JSON 输入区已新增“从剪贴板填入 / 填入并校验 / 清空”。外部模型返回的纯 JSON、Markdown 代码围栏或 `{ repaired_story_json: ... }` 包装对象可直接进入后端安全校验链路，减少手动复制失误。
- 项目详情页的模型修复提示包已新增“修复边界”摘要卡片，直接展示创作用途、真实模式、素材 Gate、补充缺口和禁止表达，帮助操作员判断模型修复是否越过真实度/素材边界。
- `applyProjectQualityRepairJson()` 已把创作合同与素材 Gate 边界写入后端 `operator_hints` 和 `validation_summary_markdown`：包括 use_case/truth_mode、待核验项、禁止表达、素材阶段、分数、生成姿态和阻断缺口。API 回归已覆盖机构审定合同与素材 Gate 缺口场景。
- MCP `kb_generate_story_repair_prompt` / `kb_repair_story` 已补同类边界输出：repair prompt package 会返回 `boundary_notes`、`creation_contract`、`material_sufficiency`，并把边界说明写入 prompt / Markdown / dry-run 风险说明。定向 MCP 回归已覆盖提示包和 dry-run 两条路径。

下一步：

- 继续做 Web 质量面板的 UX 降噪：例如展示字段差异摘要、支持从提示包返回结果自动填充 JSON、并把修复结果与素材 Gate/真实边界的失败原因做更清楚的 operator hint。
- 结合真实项目批量选取 P0/P1 repair actions，做多版本修复质量对比。

### P0-P1：故事管理 UX 降噪

继续简化默认界面：

- 批量删除确认必须明确“只删除当前筛选结果中的已选故事”。
- 筛选外已选故事继续保持可见提示和一键清除。
- 筛选区增加更明显重置入口。
- 项目工作台默认只保留高频主路径，高级制作动作放折叠区。

### P1：AI 漫剧后期合同迁移到 GEARS

原计划中的真实 ffmpeg 片头片尾、真实 final assemble、真实混音媒体烟测暂停在当前仓库继续深挖，改为迁移到 GEARS execution job：

```text
title_card_render job
  -> final_assemble job
  -> audio_mix job
  -> GEARS callback writes ledger / dashboard
```

当前仓库继续保留计划包、dry-run、manifest、依赖检查和审片返修，不做真实媒体产出。

## 6. 新对话开场指令

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform。先执行 git status --short --branch 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先实现 P0：GEARS execution config/contract、GEARS job ledger、提交 GEARS job、GEARS callback 归一化；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。默认界面保持简单，只保留高频主路径。
```

如果新任务是产品重定位或故事生成链路改造，使用下面这段：

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。本次任务只针对本项目，不实现 GEARS 图片/视频/后期实产。先阅读 docs/story-agent-creative-platform-reposition-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和 .codex/skills/china-culture-story-agent/SKILL.md。当前新方向是：把项目从“知识库驱动的故事生成器”升级为“AI 影视前期创作、剧本生产与项目素材指挥系统”。优先做 Phase 1：新增 CreationUseCase、TruthMode、CreationContract、MaterialPack、MaterialSufficiencyReport，并兼容旧 knowledge_pack；然后把 creation_contract 接入 StoryBlueprint、StoryGenerateRequest/Result、prompt package 和项目版本存储。开始前先执行 git status --short --branch 和 git diff --stat，不要覆盖用户已有改动。
```
