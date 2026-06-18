# Story Agent 下一阶段开发计划

> 日期：2026-06-18
> 分支：`codex-ai-comic-series-longform`
> 用途：给新对话快速接续 Story Agent、Production Board、GEARS / Seedance 交付链开发。

## 1. 当前进度

| 模块 | 当前判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通。 |
| Production Board / GEARS / Seedance | 约 89% | 生产板、监督、修复、导出、素材库、Shot Ledger、回传、重试、provider 队列元数据、超时恢复、外部回传 schema 首版已完成。 |
| MCP Story Agent 闭环 | 约 75-80% | 项目读取、蓝图、质量校验、GEARS/Seedance 只读交付、repair dry-run、受控版本写入、安全 auto_apply 首版已完成。 |
| AI 漫剧系列生产链 | 约 45% | 系列规划、生产账本、回片、剪辑包、缩略图、精修计划已有；字幕、混音、片头片尾、final delivery 待做。 |
| 可商用制作中台 | 约 35-40% | 主链路可用；还缺 UX 降噪、状态总览、真实外部 provider、审片返修和稳定压测。 |

## 2. 本轮完成内容

### MCP / Agent 工具

- 新增并注册 `kb_generate_gears_delivery`：从 `project_id`、`story_id`、`story_json` 只读生成 GEARS 交付包。
- 新增并注册 `kb_generate_seedance_prompt`：生成 Seedance 2.0 镜头提示词包，支持 `@图片/@视频/@音频` 参考。
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
  - 回传可按 job 匹配，也可按 `queue_id + queue_position` 映射到 Shot Ledger。
  - 状态归一化复用内部回传导入，ready/failed/processing/submitted 等平台状态会更新 `seedance_shot_ledger`。
  - 修复状态更新丢失 provider / queue 元数据的问题。

### 文档同步

- 更新 `docs/story-agent-next-conversation-handoff.md`。
- 更新 `docs/story-agent-production-workbench-development-plan.md`。
- 更新 `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`。
- 保持下一阶段方向从“队列化准备”推进到“外部回传 schema、自动轮询、真实 provider API”；外部回传 schema 已完成首版。

## 3. 已验证命令

```bash
cd mcp-server && npm test
cd mcp-server && npm run build
cd web/server && npm test
cd web/server && npm run lint
cd web/server && npm run build
cd web/client && npm run lint
cd web/client && npm run build
git diff --check
```
最近一次结果：

- `mcp-server`：24 files / 114 tests passed，build passed。
- `web/server`：24 files / 228 tests passed，lint/build passed。
- `web/client`：lint/build passed。
- `git diff --check`：passed。

注意：`web/server` 的 API 测试会启动本地 HTTP server，在沙箱中可能触发 `listen EPERM 0.0.0.0`，需要允许非沙箱运行。

## 4. 当前工作区提醒

- 当前仍有未提交改动。
- `data/provinces/湖南.md` 是已有脏改动，不属于本轮 Story Agent/Seedance 推进范围；新对话不要随意覆盖或回滚。
- 新对话开始必须先执行：

```bash
git status --short
git diff --stat
```

## 5. 下一阶段优先级

### P0：收尾当前工作区

1. 复核 `git status --short` 和 `git diff --stat`。
2. 确认没有意外文件后提交当前成果。
3. 不要覆盖用户已有改动，尤其是 `data/provinces/湖南.md`。

建议提交信息：

```text
完善 Story Agent MCP 与 Seedance provider 生产链
```

### P0：Seedance provider 自动轮询 / 真实 API

目标：

- 外部 provider 回传 schema 已完成首版。
- 支持根据 provider job / queue 查询状态。
- 建立自动轮询入口或 worker 形态。
- 将超时恢复、失败分类、重试包和真实回传结果串起来。

建议先做最小切片：

```text
SeedanceProviderCallbackSchema
  -> normalize provider status
  -> map provider job to shot ledger
  -> update status / video_url / failure_reason
  -> tests
```

### P0：MCP 更深模型修复链路

目标：

- 根据 `kb_repair_story(auto_apply=false)` 返回的 repair actions，让模型或 Agent 生成 `repaired_story_json`。
- 生成后先校验，再调用 `kb_repair_story(auto_apply=true)` 安全写入。
- 保持“模型生成内容”和“工具写入版本”分离。

### P0-P1：故事管理 UX 降噪

继续简化默认界面：

- 批量删除确认必须明确“只删除当前筛选结果中的已选故事”。
- 筛选外已选故事继续保持可见提示和一键清除。
- 筛选区增加更明显重置入口。
- 项目工作台默认只保留高频主路径，高级制作动作放折叠区。

### P1：AI 漫剧字幕链路

下一块建议做：

```text
export-seedance-subtitles
  -> seedance-subtitles sidecar
  -> subtitle render ledger
  -> 前端导出 SRT
```

## 6. 新对话开场指令

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/story-agent-next-development-plan.md，再阅读 docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform，当前有未提交改动。先执行 git status --short 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。优先收尾当前工作区，然后继续 P0：Seedance provider 外部回传 schema / 自动轮询 / 真实 API、MCP 更深模型修复链路、故事管理 UX 降噪。默认界面保持简单，只保留高频主路径。
```
