# AI 漫剧长篇 Story Agent Seedance 后期生产开发计划

> 日期：2026-06-16
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

当前能力边界：

- 已能把 Seedance 回片组织为可剪辑资产，并自动抽缩略图、装配初版成片。
- 已能生成后期精修计划，但还没有真正执行字幕烧录、混音、片头片尾渲染和最终交付装配。
- 外部剪辑平台尚未有专用导入格式。
- 审片返修闭环仍处于待建设状态。

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

### 前端任务

- 系列工作台增加“导出 SRT”。
- 系列工作台增加“生成字幕文件”。
- 系列工作台增加“烧录字幕”。
- 项目总览页增加字幕快捷按钮。
- 展示字幕 render 状态、输出路径和失败原因。

### 测试

- SRT 格式测试。
- dry-run 测试。
- mock ffmpeg 成功测试。
- mock ffmpeg 失败测试。
- API validation 测试。

### 验收标准

- 能生成合法 SRT。
- dry-run 可输出完整 ffmpeg 命令。
- mock runner 可写回 `seedance_subtitle_render`。
- 前端能看到字幕状态和输出路径。

## 7. 阶段三：音频资产库与混音计划

### 目标

将音频 cue 从文字建议升级为可绑定、可检查、可执行的音频资产计划。

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

### 前端任务

- 支持音频素材 JSON 导入。
- 精修面板显示音频资产绑定状态。
- 支持导出音频计划 Markdown / JSON。

### 测试

- 音频库 normalize / clone 测试。
- 音频计划导出测试。
- 缺失音频统计测试。

### 验收标准

- 系列项目能保存音频素材库。
- 音频计划能标记 cue 已绑定或需要补素材。

## 8. 阶段四：混音 worker

### 目标

调用 ffmpeg 将背景音乐、环境声、音效与视频合成为带音频的成片。

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
  - `audio_asset_count`
  - `missing_audio_count`
  - `mixed_at`
  - `failure_reason`

### 前端任务

- 工作台增加“生成混音计划”。
- 工作台增加“执行混音”。
- 显示混音输出路径和失败原因。

### 测试

- `filter_complex` 生成测试。
- dry-run 测试。
- mock runner 成功/失败测试。
- API validation 测试。

### 验收标准

- 没有真实音频素材时能明确提示缺失。
- dry-run 能生成稳定命令。
- mock runner 可生成 ready 账本。

## 9. 阶段五：片头片尾卡渲染 worker

### 目标

将 title cards 渲染成视频片段，并参与最终装配。

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

### 前端任务

- 工作台增加“导出片头片尾计划”。
- 工作台增加“渲染片头片尾”。
- 显示 card 渲染状态。

### 测试

- title card plan 测试。
- 字体缺失错误测试。
- mock runner 渲染测试。

### 验收标准

- 可为系列片头、分集片头、分集片尾、系列片尾生成计划。
- mock 渲染能写回账本。
- ffmpeg 命令可复现。

## 10. 阶段六：最终成片装配 worker

### 目标

将视频镜头、片头片尾、字幕、混音合成为最终交付文件。

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

### 测试

- final dry-run 测试。
- strict / tolerant 缺依赖测试。
- mock runner 成功测试。
- API route 测试。

### 验收标准

- 项目可从 ready 镜头走到 final delivery 账本。
- 最终输出路径稳定。
- 缺少字幕、音频或片头片尾时错误明确。

## 11. 阶段七：外部剪辑平台导入包

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

### 前端任务

- 工作台增加“外部剪辑平台导出”。
- 支持选择导出格式。
- 项目总览支持 generic package 快捷导出。

### 测试

- JSON package 测试。
- CSV 时间线测试。
- asset manifest 测试。

### 验收标准

- 不依赖真实平台也能输出完整剪辑清单。
- 后续适配具体平台时只需增加 formatter。

## 12. 阶段八：生产总览 dashboard

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

### 前端任务

- 系列工作台顶部增加生产仪表盘。
- 项目总览页显示最终状态 badge。
- 每个 blocker 提供对应操作入口。

### 测试

- dashboard 汇总测试。
- blocker 优先级测试。
- 前端类型检查。

### 验收标准

- 用户打开项目即可知道下一步该做什么。
- 所有 worker 状态都能在一个地方看到。

## 13. 阶段九：审片与返修闭环

### 目标

让最终成片、剪辑版和镜头版本都能进入评审、返修、重导出流程。

### 后端任务

- 新账本：`seedance_review_ledger`
- 评审字段：
  - `review_id`
  - `target_type=shot|cut|final`
  - `target_id`
  - `status`
  - `severity`
  - `issue_type`
  - `note`
  - `created_at`
  - `resolved_at`
- 新接口：
  - 新增评审意见
  - 标记已解决
  - 导出返修包
  - 根据评审意见生成重试包或重装配计划
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

### 测试

- review ledger 测试。
- review -> retry package 联动测试。
- review -> final reassemble blocker 测试。

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

1. `export-seedance-subtitles`
2. `seedance-subtitles/render` sidecar 模式
3. `seedance-subtitles/render` burn-in 模式
4. `seedance_audio_library`
5. `export-seedance-audio-plan`
6. `seedance-audio/mix`
7. `export-seedance-title-card-plan`
8. `seedance-title-cards/render`
9. `seedance-final/assemble`
10. `seedance-production-dashboard`
11. `export-seedance-editing-platform-package`
12. `seedance_review_ledger`
13. 30 集压测和性能优化

## 16. 下一步最小可交付切片

下一步建议优先实现：

```text
export-seedance-subtitles
  -> seedance-subtitles/render sidecar
  -> seedance_subtitle_render ledger
  -> 前端导出 SRT / 生成字幕文件
```

原因：

- 直接承接当前已完成的成片精修计划包。
- 不依赖第三方平台。
- 不需要先解决复杂音频素材来源。
- ffmpeg 依赖和 worker 模式已经在缩略图、剪辑装配中跑通。
- 能马上把系统从“可拼接视频”推进到“可输出字幕交付件”。

该切片完成后，系统后期链路将达到：

```text
ready 镜头
  -> 剪辑装配
  -> 缩略图
  -> 精修计划
  -> SRT 字幕文件
```

这会为后续字幕烧录、混音、片头片尾和最终成片装配打下稳定基础。
