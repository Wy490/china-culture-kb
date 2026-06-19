# AI 漫剧长篇 Story Agent Seedance 后期生产开发计划

> 日期：2026-06-19
> 范围：从 Seedance 镜头回片到字幕、音频、片头片尾、最终成片和外部剪辑平台交付。

## 1. 当前基线

当前系统已经具备从长篇 AI 漫剧规划到 Seedance 镜头生产闭环的基础能力。

已完成：

- 系列规划、保存、加载、复制、归档、恢复、删除。
- 单集生成：故事正文、分镜、GEARS segments、Seedance prompts。
- 系列级 Seedance 镜头提示词包导出，支持 Markdown / JSON。
- `seedance_production` 镜头生产账本。
- 镜头状态更新、批量流转、JSON 回传导入、外部 callback。
- 镜头级视频版本记录，支持 `quality_score` 和 `review_note`。
- 人工选择剪辑版与自动择优。
- 剪辑交付包、失败重试包、版本对比报告。
- 素材引用完整性报告、素材库绑定、剪辑台资产包。
- 缩略图抽帧计划包。
- 缩略图抽帧 worker，支持 dry-run / overwrite / 分集或镜头筛选 / limit。
- 剪辑装配 worker，支持 source copy concat 与 H.264/AAC 转码装配。
- `seedance_cut_assembly` 装配账本。
- 成片精修计划包，包含镜头时间轴、缩略图、SRT 字幕 cue、音频 cue、片头片尾卡和质检清单。
- SRT 字幕包导出、sidecar 字幕文件生成和 burn-in 字幕 worker。
- `seedance_subtitle_render` 字幕渲染账本。

当前能力边界：

- 已能把 Seedance 回片组织为可剪辑资产，并自动抽缩略图、装配初版成片。
- 已能生成后期精修计划，执行 SRT 字幕文件输出与可选字幕烧录，导出音频计划、导入音频素材、生成混音 dry-run 命令和混音账本，并生成片头片尾计划、片头片尾 render dry-run、final delivery dry-run、final manifest、外部剪辑平台包和生产总览 dashboard；真实混音素材生产、真实片头片尾渲染和最终交付真实装配仍待增强。
- 外部剪辑平台已有通用 JSON / CSV / SRT / asset manifest 首版，平台专用 FCPXML / Premiere XML / 剪映草稿格式仍待适配。
- 审片返修闭环首版已完成：可记录审片意见、标记解决、导出返修包，并在 dashboard 中形成 blocker / next action。

## 2. 总体目标

目标是把 Story Agent 的 Seedance 后期链路推进到“可持续生产长篇 AI 漫剧成片”的程度。

最终系统应支持：

- 从 ready 镜头自动生成剪辑、字幕、音频、片头片尾和最终成片。
- 每一步都有结构化计划包、worker、输出文件和生产账本。
- 前端能显示生产总览、阻塞项和下一步操作。
- 外部剪辑平台可以导入同一套资产、时间线、字幕和音频计划。
- 审片意见可以回流到镜头重做、版本重选、字幕修订、混音修订和最终重装配。

## 3. 架构原则

- 所有后期能力都应遵循“计划包 -> worker -> 账本 -> 前端状态”的模式。
- 计划包只描述结构和意图，不直接修改项目状态。
- worker 执行或 dry-run 后必须写入对应账本。
- ffmpeg 命令必须可复现，并保存到结果和账本中。
- 真实执行必须支持 `dry_run`、`overwrite` 和明确的失败原因。
- 输出文件应保存在系列项目目录下，避免生成无法追踪的孤立资产。
- 前端只展示和触发生产状态，不把复杂生产逻辑写在 UI 中。
- 大系列场景需要考虑 30 集以上、300-600 个镜头的性能。

## 4. 目标生产链路

```text
Seedance prompts
  -> seedance_production
  -> 回片版本 / 质量分 / 评审备注
  -> 选择剪辑版 / 自动择优
  -> cut package
  -> thumbnail plan
  -> thumbnail worker
  -> cut assembly worker
  -> finishing plan
  -> subtitle package
  -> subtitle render worker
  -> audio plan
  -> audio mix worker
  -> title card plan
  -> title card render worker
  -> final delivery assembly
  -> dashboard
  -> review and repair loop
```

## 5. 阶段一：成片精修计划包 V2

### 目标

将当前 `export-seedance-finishing-plan` 从基础后期合同升级为可直接驱动字幕、混音、片头片尾和最终装配的执行合同。

### 后端任务

- 扩展 `AiComicSeriesSeedanceFinishingPlanPackage`。
- 增加 `timeline_tracks`。
- 增加 `subtitle_tracks`。
- 增加 `audio_tracks`。
- 增加 `title_card_assets`。
- 增加 `export_targets`。
- 增加 `render_dependencies`。
- 字幕 cue 增加 `speaker`、`style`、`position`、`max_chars_per_line`、`needs_manual_review`。
- 字幕 cue 标记文化名词、人名、地名、典故、朝代等需人工复核内容。
- 音频 cue 增加 `volume_db`、`ducking`、`fade_in_sec`、`fade_out_sec`、`asset_url`、`asset_id`、`generated_prompt`。
- 片头片尾卡增加 `background_source`、`safe_area`、`font_style`、`transition_in`、`transition_out`。

### 前端任务

- 系列工作台增加“精修计划预览”面板。
- 展示镜头时间线、字幕 cue、音频 cue、片头片尾卡、缺失素材和质检警告。
- 支持导出 Markdown / JSON。
- 支持下载 SRT 草稿。

### 测试

- 服务测试：计划包字段完整。
- API 测试：route 404 和成功响应。
- 字幕 cue 时间连续性测试。
- Markdown 核心内容断言。

### 验收标准

- 每个 ready 镜头都有时间码、字幕 cue 和音频 cue。
- 缺失镜头、缺失缩略图、缺失音频素材能进入质检清单。
- 前端可预览精修计划并导出。

## 6. 阶段二：SRT 字幕导出与字幕 worker

### 目标

将字幕 cue 转成真实 `.srt` 文件，并支持可选字幕烧录。

当前状态：已完成首版。

### 后端任务

- 新增类型：
  - `AiComicSeriesSeedanceSubtitlePackage`
  - `AiComicSeedanceSubtitleRenderRequest`
  - `AiComicSeriesSeedanceSubtitleRenderResult`
  - `AiComicSeedanceSubtitleRenderLedger`
- 新接口：`export-seedance-subtitles`
- 新 worker：`seedance-subtitles/render`
- 支持 `dry_run`、`overwrite`、`episode_no`、`output_filename`。
- 支持 `mode=sidecar` 保存 `.srt` 文件。
- 支持 `mode=burn_in` 调用 ffmpeg 烧录字幕。
- 输出目录：
  - `subtitles/{seriesProjectId}/...srt`
  - `cuts/{seriesProjectId}/...subtitled.mp4`
- 新账本：`seedance_subtitle_render`
  - `status`
  - `srt_path`
  - `output_path`
  - `ffmpeg_command`
  - `rendered_at`
  - `failure_reason`

实现状态：

- `web/shared/types.ts` 已新增字幕包、渲染请求、渲染结果和渲染账本类型。
- `web/shared/schemas.ts` 已新增字幕导出和渲染请求 schema。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 SRT 包导出、SRT 写盘、burn-in ffmpeg 命令/runner 和账本写回。
- `web/server/src/routes/outline.ts` 已新增 `export-seedance-subtitles` 与 `seedance-subtitles/render` 路由。

### 前端任务

- 系列工作台增加“导出 SRT”。
- 系列工作台增加“生成字幕文件”。
- 系列工作台增加“烧录字幕”。
- 展示字幕 render 状态、输出路径和失败原因。

实现状态：

- `AiComicSeriesStudio.vue` 已新增导出 SRT、生成字幕文件、烧录字幕成片和字幕渲染状态卡。

### 测试

- SRT 格式测试。
- dry-run 测试。
- mock ffmpeg 成功测试。
- mock ffmpeg 失败测试。
- API validation 测试。

实现状态：

- 已覆盖 SRT 包、分集 SRT、sidecar dry-run、sidecar 写盘、burn-in mock runner 和 API validation。
- 待补：mock ffmpeg 失败专项断言。

### 验收标准

- 能生成合法 SRT。
- dry-run 可输出完整 ffmpeg 命令。
- mock runner 可写回 `seedance_subtitle_render`。
- 前端能看到字幕状态和输出路径。

## 7. 阶段三：音频资产库与混音计划

### 目标

将音频 cue 从文字建议升级为可绑定、可检查、可执行的音频资产计划。

当前状态：已完成首版。

### 后端任务

- 新增 `seedance_audio_library`。
- 音频素材字段：
  - `asset_id`
  - `kind`
  - `label`
  - `file_url`
  - `file_id`
  - `duration_sec`
  - `license_note`
  - `loopable`
  - `bpm`
  - `mood_tags`
  - `updated_at`
- 新接口：`seedance-audio-library`
- 新导出：`export-seedance-audio-plan`
- schema：`ai-comic-series-seedance-audio-plan/v1`
- 合并 finishing plan 与 audio library。
- 输出混音轨道、缺失音频、建议素材和绑定状态。

实现状态：

- `web/shared/types.ts` 已新增音频素材库、音频计划包、混音请求、混音结果和混音账本类型。
- `web/shared/schemas.ts` 已新增音频素材库更新和混音请求 schema。
- `web/server/src/services/ai-comic-series-service.ts` 已新增音频素材库保存、音频计划导出、素材绑定状态归一化和 Markdown 输出。
- `web/server/src/routes/outline.ts` 已新增 `seedance-audio-library` 与 `export-seedance-audio-plan` 路由。

### 前端任务

- 支持音频素材 JSON 导入。
- 精修面板显示音频资产绑定状态。
- 支持导出音频计划 Markdown / JSON。

实现状态：

- `AiComicSeriesStudio.vue` 已新增音频素材 JSON 导入、音频计划 Markdown / JSON 导出和混音状态展示。

### 测试

- 音频库 normalize / clone 测试。
- 音频计划导出测试。
- 缺失音频统计测试。

实现状态：

- 已覆盖缺失音频计划导出、素材绑定后计划更新、音频素材库请求校验和缺失项目响应。

### 验收标准

- 系列项目能保存音频素材库。
- 音频计划能标记 cue 已绑定或需要补素材。

## 8. 阶段四：混音 worker

### 目标

调用 ffmpeg 将背景音乐、环境声、音效与视频合成为带音频的成片。

当前状态：dry-run / mock runner 与真实素材路径校验首版已完成；完整混音策略仍需继续打磨。

### 后端任务

- 新接口：`seedance-audio/mix`
- 支持 `dry_run`、`overwrite`、`episode_no`、`input_video_path`、`output_filename`、`audio_profile`。
- 生成 ffmpeg `filter_complex`。
- 支持多音轨输入。
- 支持 volume、fade、atrim、aloop、amix。
- 支持基础 ducking 策略。
- 新账本：`seedance_audio_mix`
  - `status`
  - `output_path`
  - `ffmpeg_command`
  - `source_video_path`
  - `source_audio_count`
  - `missing_audio_count`
  - `mixed_at`
  - `failure_reason`

实现状态：

- `seedance-audio/mix` 已支持 `dry_run`、`overwrite`、`episode_no`、`input_video_path`、`output_filename` 和 `audio_profile`。
- 服务层已生成可复现 ffmpeg 命令，并将 dry-run / mock runner / fake runner 结果写回 `seedance_audio_mix`。
- 真实执行已校验源视频存在、音频素材为项目内本地路径且文件存在；远程 URL 或协议路径会写入明确失败原因。
- 当前首版优先保证计划可审查、命令可复现和真实 runner 输入安全；后续继续补原声混合策略、真实 ffmpeg 专项和多分集边界。

### 前端任务

- 工作台增加“生成混音计划”。
- 工作台增加“执行混音”。
- 显示混音输出路径和失败原因。

实现状态：

- 系列工作台已新增“混音 dry-run”和混音状态卡，显示源视频、素材数、缺失音频数、状态、输出路径和失败原因。

### 测试

- `filter_complex` 生成测试。
- dry-run 测试。
- mock runner 成功/失败测试。
- API validation 测试。

实现状态：

- 已覆盖混音 dry-run 命令、远程音频素材真实执行失败、本地音频 fake runner 成功、音频输入路径安全校验、混音请求 validation 和缺失项目响应。
- 待补：真实 ffmpeg 成功/失败专项、原声混合策略和多分集边界测试。

### 验收标准

- 没有真实音频素材时能明确提示缺失。
- dry-run 能生成稳定命令。
- mock runner 可生成 ready 账本。

## 9. 阶段五：片头片尾卡渲染 worker

### 目标

将 title cards 渲染成视频片段，并参与最终装配。

当前状态：计划包、render dry-run、字体校验和 fake runner 成功/失败首版已完成；真实视觉模板仍需继续打磨。

### 后端任务

- 新导出：`export-seedance-title-card-plan`
- schema：`ai-comic-series-seedance-title-card-plan/v1`
- 新 worker：`seedance-title-cards/render`
- 支持用 ffmpeg color / drawtext 或图片背景生成短视频。
- 输出目录：`title-cards/{seriesProjectId}/...mp4`
- 新账本：`seedance_title_card_render`
  - `status`
  - `card_count`
  - `rendered_count`
  - `output_paths`
  - `ffmpeg_commands`
  - `failure_reason`
- 支持 `FFMPEG_FONT_PATH` 配置。
- 字体缺失时返回明确错误。

实现状态：

- `web/shared/types.ts` 已新增片头片尾计划、render 请求、render 结果和 render 账本类型。
- `web/shared/schemas.ts` 已新增 `AiComicSeedanceTitleCardRenderRequestSchema`。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 title card plan 导出、`color + drawtext` ffmpeg 命令、render dry-run、真实 runner 输出文件校验和账本写回。
- `web/server/src/routes/outline.ts` 已新增 `export-seedance-title-card-plan` 与 `seedance-title-cards/render` 路由。

### 前端任务

- 工作台增加“导出片头片尾计划”。
- 工作台增加“渲染片头片尾”。
- 显示 card 渲染状态。

实现状态：

- `AiComicSeriesStudio.vue` 已新增片头片尾计划 Markdown / JSON 导出、“片头片尾 dry-run”和片头片尾状态卡。

### 测试

- title card plan 测试。
- 字体缺失错误测试。
- mock runner 渲染测试。

实现状态：

- 已覆盖 title card plan、render dry-run、ffmpeg command hint、runner 未产出文件失败、fake runner 成功和 API validation。
- 待补：真实 ffmpeg 成功/失败专项、字体缺失 API 专项和视觉模板回归。

### 验收标准

- 可为系列片头、分集片头、分集片尾、系列片尾生成计划。
- mock 渲染能写回账本。
- ffmpeg 命令可复现。

## 10. 阶段六：最终成片装配 worker

### 目标

将视频镜头、片头片尾、字幕、混音合成为最终交付文件。

当前状态：final delivery dry-run、manifest 写盘和 fake runner 成功/失败首版已完成；精确片头片尾插入时间线仍需继续打磨。

### 后端任务

- 新接口：`seedance-final/assemble`
- 支持：
  - `dry_run`
  - `overwrite`
  - `include_subtitles`
  - `include_audio_mix`
  - `include_title_cards`
  - `output_profile`
  - `missing_dependency_mode=strict|tolerant`
- 新账本：`seedance_final_delivery`
  - `status`
  - `output_path`
  - `output_filename`
  - `manifest_path`
  - `ffmpeg_command`
  - `source_cut_path`
  - `subtitle_path`
  - `audio_mix_path`
  - `title_card_paths`
  - `delivered_at`
  - `failure_reason`
- 输出目录：
  - `delivery/{seriesProjectId}/{seriesProjectId}-final.mp4`
  - `delivery/{seriesProjectId}/{seriesProjectId}-final.srt`
  - `delivery/{seriesProjectId}/{seriesProjectId}-manifest.json`

实现状态：

- `web/shared/types.ts` 已新增 final delivery 请求、依赖状态、结果和账本类型。
- `web/shared/schemas.ts` 已新增 `AiComicSeedanceFinalDeliveryRequestSchema`。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 `seedance-final/assemble`，支持 strict/tolerant 缺依赖模式、planned 依赖 dry-run 串联、真实执行依赖文件校验、runner 输出校验、final ffmpeg 命令、manifest JSON 写盘和 Markdown 摘要。
- `web/server/src/routes/outline.ts` 已新增 `seedance-final/assemble` 路由。

### 前端任务

- 工作台增加“最终交付”区域。
- 展示各依赖状态：
  - 镜头 ready
  - 缩略图 ready
  - 剪辑装配 ready
  - 字幕 ready
  - 混音 ready
  - 片头片尾 ready
  - 最终成片 ready
- 增加一键最终装配。
- 项目总览显示最终交付状态。

实现状态：

- 系列工作台已新增“最终交付 dry-run”和最终交付状态卡，展示剪辑、字幕、混音、片头片尾依赖状态和 manifest 路径。

### 测试

- final dry-run 测试。
- strict / tolerant 缺依赖测试。
- mock runner 成功测试。
- API route 测试。

实现状态：

- 已覆盖 strict 缺片头片尾依赖、final delivery dry-run、runner 未产出文件失败、fake runner 成功、ffmpeg concat 命令、manifest 写盘和 API validation。
- 待补：真实 ffmpeg 成功/失败专项、精确 title card 时间线和 strict/tolerant 更多组合。

### 验收标准

- 项目可从 ready 镜头走到 final delivery 账本。
- 最终输出路径稳定。
- 缺少字幕、音频或片头片尾时错误明确。

## 11. 阶段七：外部剪辑平台导入包

当前状态：首版已完成；后续可继续补 FCPXML / Premiere XML / 剪映草稿格式适配和真实平台导入 smoke。

### 目标

支持把项目资产交给剪映、Premiere、DaVinci 或通用剪辑平台继续处理。

### 后端任务

- 新导出：`export-seedance-editing-platform-package`
- schema：`ai-comic-series-editing-platform-package/v1`
- 第一版支持：
  - `generic_json`
  - `csv_timeline`
  - `srt`
  - `asset_manifest`
- 后续可增加：
  - `fcpxml`
  - `premiere_xml`
  - 剪映草稿格式适配
- 输出内容：
  - timeline
  - video assets
  - audio assets
  - subtitle cues
  - title cards
  - thumbnails
  - missing assets
  - import notes

已落地：

- `web/shared/types.ts` 新增 `AiComicSeriesSeedanceEditingPlatformPackage`、timeline item、asset、subtitle cue 和 missing asset 类型。
- `web/server/src/services/ai-comic-series-service.ts` 新增 `exportAiComicSeriesSeedanceEditingPlatformPackage`。
- 时间线会串联系列片头、分集片头、镜头、分集片尾和系列片尾，并把字幕 cue 偏移到这条外部剪辑时间线。
- 包内同时输出 `csv_timeline`、`asset_manifest_csv`、`srt_content`、JSON 和 Markdown 摘要。
- missing assets 汇总缺失镜头、缺失音频和 final delivery dependency。
- `web/server/src/routes/outline.ts` 新增 `export-seedance-editing-platform-package` 路由。

### 前端任务

- 工作台增加“外部剪辑平台导出”。
- 工作台已新增剪辑平台 JSON、时间线 CSV、SRT 和素材清单 CSV 快捷导出。
- 项目总览支持 generic package 快捷导出。

### 测试

- 服务测试覆盖 JSON package、CSV 时间线、SRT、asset manifest、title card/audio assets 和 Markdown。
- API 测试覆盖缺失项目 404。

### 验收标准

- 不依赖真实平台也能输出完整剪辑清单。已完成。
- 后续适配具体平台时只需增加 formatter。

## 12. 阶段八：生产总览 dashboard

当前状态：首版已完成；项目总览页 badge 和 blocker 对应操作入口仍可继续增强。

### 目标

将分散的生产状态汇总成可执行的生产仪表盘。

### 后端任务

- 新接口：`seedance-production-dashboard`
- schema：`ai-comic-series-seedance-dashboard/v1`
- 汇总：
  - prompt exported count
  - submitted count
  - ready count
  - failed count
  - selected version count
  - thumbnail ready count
  - cut assembly status
  - subtitle status
  - audio status
  - title card status
  - final delivery status
  - blockers
  - next_actions

已落地：

- `web/shared/types.ts` 新增 `AiComicSeriesSeedanceDashboard`、summary、status item、blocker、next action 和 episode summary 类型。
- `web/server/src/services/ai-comic-series-service.ts` 新增 `getAiComicSeriesSeedanceProductionDashboard`，只读聚合当前项目账本，不写项目文件。
- `web/server/src/routes/outline.ts` 新增 `seedance-production-dashboard` 路由。
- dashboard 会聚合提示词导出、镜头生产、缩略图、剪辑装配、字幕、混音、片头片尾、最终交付和外部剪辑包。
- 输出 blockers、next_actions 和 Markdown 摘要，方便制作人直接判断下一步。

### 前端任务

- 系列工作台已新增“Seedance 生产总览”面板。
- 项目总览页显示最终状态 badge。
- 每个 blocker 提供对应操作入口。

### 测试

- 服务测试覆盖 dashboard 汇总、失败 blocker、下一步动作、分集摘要和 Markdown。
- API 测试覆盖缺失项目 404。
- 前端类型检查覆盖 dashboard 面板接入。

### 验收标准

- 用户打开项目即可知道下一步该做什么。已完成首版。
- 所有 worker 状态都能在一个地方看到。已完成首版。

## 13. 阶段九：审片与返修闭环

当前状态：review ledger、返修包导出、dashboard blocker、工作台轻量录入、审片驱动重试包、重试执行计划、本地重试提交、系列 provider 超时恢复、strict final guard 和 final reassemble 执行闭环首版已完成；后续继续深化版本对比面板标注和 retry submit adapter。

### 目标

让最终成片、剪辑版和镜头版本都能进入评审、返修、重导出流程。

### 后端任务

- 新账本：`seedance_review_ledger`
- 评审字段：
  - `review_id`
  - `target_type=shot|cut|final|subtitle|audio|title_card`
  - `target_id`
  - `status`
  - `severity`
  - `issue_type`
  - `note`
  - `repair_action`
  - `created_at`
  - `resolved_at`
- 新接口：
  - 新增评审意见
  - 标记已解决
  - 导出返修包
  - 根据评审意见生成重试包或重装配计划
  - 导出重试执行计划，区分可直接提交、需人工处理和缺提示词镜头
  - 提交重试执行计划，将可提交候选写回生产账本为 submitted
  - 扫描 submitted/processing 超时镜头，并可标记为 failed
  - 最终重装配成功后可自动解决 reassemble_final 审片意见
- 返修类型：
  - 镜头重做
  - 版本重选
  - 字幕修改
  - 音频调整
  - 片头片尾修改
  - 最终重装配

### 前端任务

- 版本对比面板增加评审意见。
- 最终成片面板增加审片列表。
- 支持一键导出返修包。

实现状态：

- `web/shared/types.ts` 已新增 `AiComicSeedanceReviewLedger`、review item、add/resolve request 和 review repair package 类型。
- `web/shared/schemas.ts` 已新增 `AiComicSeedanceReviewAddRequestSchema` / `AiComicSeedanceReviewResolveRequestSchema`。
- `web/server/src/services/ai-comic-series-service.ts` 已新增审片意见、解决审片意见和导出审片返修包服务，并把 open review 计入 dashboard status / blocker / next action。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 Seedance 重试执行计划导出，复用重试包并输出可提交/阻断候选。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 Seedance 重试提交服务，生成本地 provider job id 并复用批量生产账本更新。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 Seedance provider 超时恢复服务，支持 dry-run 和 mark failed。
- `web/server/src/services/ai-comic-series-service.ts` 已新增 final reassemble 执行闭环：strict 默认仍阻断未解决 final reassemble 审片，显式执行成功后可自动解决对应审片意见。
- `web/server/src/routes/outline.ts` 已新增 `seedance-reviews`、`seedance-reviews/resolve`、`export-seedance-review-repair-package`、`export-seedance-retry-execution-plan`、`seedance-retry/submit` 和 `seedance-provider/recover-timeouts` 路由。
- 系列工作台最终交付区已新增审片返修轻量录入、open 列表、标记解决和返修包导出入口；Seedance 导出区已新增重试执行计划导出入口，生产操作区已新增提交重试计划和标记超时失败入口。

### 测试

- review ledger 测试。
- review -> retry candidate 联动测试。
- review -> final reassemble blocker 测试。

实现状态：

- 服务测试覆盖新增 final/shot 审片意见、final reassemble 执行后自动解决、返修包导出、retry candidate 计数、retry execution plan、retry submit、provider recovery 和 final reassemble dashboard blocker。
- API 测试覆盖 review add/resolve/export、retry execution plan、retry submit、provider recovery 路由校验和缺失项目响应。

### 验收标准

- 能从最终成片回到具体镜头、字幕或音频问题。
- 返修不会破坏已有 ready 资产。

## 14. 阶段十：长期稳定性与大系列压测

### 目标

保障 30 集以上、300-600 镜头的长篇项目仍能稳定使用。

### 压测任务

- 生成 30 集模拟项目。
- 批量模拟 Seedance 回片。
- 批量生成缩略图计划、剪辑包、精修计划、字幕包、最终交付包。
- 测试导出速度。
- 测试 JSON 体积。
- 测试前端渲染性能。
- 测试 worker dry-run 速度。
- 测试 dashboard 统计速度。

### 优化方向

- 生产账本分页加载。
- prompt、markdown 等大字段按需加载。
- 导出包支持 stream 或文件保存。
- worker 支持 episode range。
- 前端列表虚拟滚动。

### 验收标准

- 30 集、300-600 镜头项目可打开、可导出、可统计。
- 前端不明显卡死。
- 导出包结构稳定。

## 15. 推荐开发顺序

推荐按以下顺序继续：

1. `seedance_review_ledger` 到 retry submit adapter
2. `seedance-audio/mix` 真实 ffmpeg 专项和多分集边界增强
3. `seedance-title-cards/render` 真实 ffmpeg / 视觉模板回归
4. `seedance-final/assemble` 真实 ffmpeg 专项和精确片头片尾时间线
5. 30 集压测和性能优化

## 16. 下一步最小可交付切片

下一步建议优先实现：

```text
seedance_review_ledger retry submit adapter
  -> seedance-audio/mix real ffmpeg and multi-episode hardening
  -> seedance-title-cards/render real ffmpeg and visual template regression
  -> seedance-final/assemble real ffmpeg and precise title-card timeline
```

原因：

- 直接承接当前已完成的剪辑装配、字幕 worker、音频计划 / 混音 dry-run、片头片尾 dry-run、final delivery dry-run、外部剪辑平台包和生产总览 dashboard。
- 不依赖第三方平台。
- 可先用 mock runner 和真实路径校验把 dry-run 账本推进到 ready 账本，再逐步补真实视觉模板。
- ffmpeg 依赖和 worker 模式已经在缩略图、剪辑装配、字幕烧录和混音 dry-run 中跑通。
- 能把系统从“可审查最终交付依赖和成片装配命令”推进到“可交给外部剪辑平台或真实 worker 执行”。

该切片完成后，系统后期链路将达到：

```text
ready 镜头
  -> 剪辑装配
  -> 缩略图
  -> 精修计划
  -> SRT 字幕文件
  -> 字幕烧录成片
  -> 音频计划
  -> 混音 dry-run / 音频账本
  -> 片头片尾计划 / render dry-run
  -> final delivery dry-run / 依赖账本
```

这会为后续真实混音、真实片头片尾渲染、最终成片装配和外部剪辑平台包打下稳定基础。
