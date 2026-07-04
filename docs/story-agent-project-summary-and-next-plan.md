# Story Agent 项目总结与下一阶段开发计划

> 日期：2026-07-04  
> 分支：`codex-ai-comic-series-longform`  
> 当前总体进度：**99.8%**  
> 定位：`china-culture-kb` 是内容与生产指挥层；真实图片、视频、字幕、混音、片头片尾和最终装配交给 GEARS v2。

## 1. 项目当前状态

Story Agent 已从“文化知识库故事生成器”推进为 **AI影视工作台**：覆盖素材组织、单片短片创作、漫剧系列规划、项目版本、质量修复、Production Board、Seedance/GEARS 交付包、制作 readiness、外部回片交接和安全导入。

当前剩余缺口不在本仓库的内容/指挥能力，而在真实外部执行验收：

- 需要真实 GEARS/Seedance worker endpoint。
- 需要真实外部 artifact URL。
- 需要 live 用户路径验收：导出 payload -> 替换真实 URL -> preflight -> safe import -> readiness 计数变化。

## 2. 已完成能力总览

### 内容生成与质量

- 单片短片生成已收口：AI 漫剧单片、人物故事、纪录短片、宣传片等生成链路能输出观众稿、场景、GEARS segments 和质量报告。
- AI 漫剧系列已专项修复：分集正文不再重复套壳，连续性账本、分集目标和观众稿污染检测已覆盖。
- 类型片画像矩阵已落地：`GenreStoryProfile` 集中维护类型承诺、素材要求、真实边界、禁用模式、修复建议。
- 质量修复链路已具备：支持局部重写、一键修复、修复 prompt package、修复 JSON dry-run 和安全写入版本。

### 产品与前端

- 可见产品名收口为 `AI影视工作台`。
- 入口心智收口为 `单片短片 / 漫剧系列 / 项目指挥 / 素材库`。
- 新增 `npm run audit:copy`，防止旧产品名和旧入口词回流。
- ProjectDetail 已覆盖质量面板、Production Board、readiness、GEARS/Seedance 导出、外部回片校验与安全导入。

### 生产指挥与交付

- Production Board 已覆盖镜头单元、角色/场景/道具资产、Seedance Shot Ledger、GEARS Job Ledger、交付包导出和生产修复。
- 制作 readiness 已覆盖单故事、AI 漫剧系列和 portfolio：状态、分数、lane、issue、next action、automation plan 和运行账本。
- 本地 GEARS 验收可证明指挥链路闭环，但不会被误标为真实媒体完成。
- 外部回片安全导入已完成：preflight 阻断占位 URL、本地 URL、私网 URL、账本不匹配、job type 不匹配、重复 replay 等风险。

### GEARS/Seedance 外部交接

- `project-gears-external-callback-handoff/v1` 已输出 callback path/url、preflight path/url、safe import path/url、批量 payload、preflight curl、safe import curl 和 operator checklist。
- ProjectDetail 真浏览器 smoke 已通过：`回片 Payload` 下载、占位 payload 阻断、真实形态 URL 安全导入、readiness 计数变化和无控制台/API 错误均已验证。
- 最新补强：交接包明确要求先跑 preflight，再跑 safe import，避免操作员跳过校验。

## 3. 当前验证基线

本轮可作为下一轮接续基线的检查：

- `cd web && npm run check`
- `cd web/server && npx vitest run src/__tests__/project-service.test.ts`
- `cd web/server && npx vitest run src/__tests__/api.test.ts`
- `git diff --check`

本轮已通过：

- `npx vitest run src/__tests__/project-service.test.ts`：56 个用例。
- `npx vitest run src/__tests__/api.test.ts`：159 个用例。
- `cd web/server && npm run lint`。
- `cd web && npm run audit:copy`。

## 4. 下一阶段开发计划

### P0：真实 GEARS/Seedance live 用户路径验收

前置条件：

- 配齐真实 `GEARS_API_BASE_URL`、callback base、callback secret。
- 至少有 1 个真实外部 GEARS/Seedance artifact URL。
- artifact URL 必须是公开可达 `http(s)`，不能是 `local_acceptance`、`localhost`、私网或 `gears.example`。

执行步骤：

1. 在 ProjectDetail 导出 `回片 Payload`。
2. 将样例 callback 的 `outputUrl` 替换为真实 artifact URL，并设置唯一 `eventId`。
3. 调用 handoff 中的 preflight curl，确认 `blocking_count=0`。
4. 调用 safe import curl，确认导入成功。
5. 刷新 production readiness，确认 `external_ready` 上升，`ready_without_external` 和 `local_acceptance_ready` 下降。
6. 截图/保存 evidence，并更新接续文档。

验收标准：

- 不再把本地验收当真实媒体回片。
- 回片导入具有幂等性，重复 event 可识别。
- Production Board、Seedance Shot Ledger、GEARS Job Ledger 和 readiness 同步更新。

### P1：统一检查入口与 CI 固化

- 把 `cd web && npm run check` 纳入 CI 或交付前手动检查。
- 视需要扩展 `audit:copy` 到后端/MCP 对外文案，但不要改 `kb_*` 工具名、兼容字段和历史 generated 文件。
- 保持 Story Agent/GEARS 的核心回归测试：project-service、api、质量修复、series generation。

### P2：真实工作流体验优化

- 在 ProjectDetail 为外部回片加入更清晰的“复制 preflight curl / 复制 safe import curl”按钮。
- 给 readiness 的 `ready_without_external` 提示加上“一键导出 handoff payload”的直达动作。
- 在项目指挥页显示外部回片待处理数量，帮助操作员批量处理。

### P3：发布候选与运营资料

- 生成一份 `AI影视工作台` 操作手册：单片短片、漫剧系列、Production Board、GEARS 回片四条主路径。
- 固化 2-3 个演示项目：单片 AI 漫剧、漫剧系列、机构宣传短片。
- 准备发布候选清单：功能范围、已知边界、GEARS 真实验收状态、操作员 checklist。

## 5. 开发边界

- 不把真实媒体执行器继续堆进 `china-culture-kb`。
- 不把 generated 故事写回 `data/provinces/*.md`。
- 不把 `local_acceptance` 或 `media.story-agent.test` 当成真实媒体产物。
- 不破坏 `kb_*` MCP 工具名、兼容字段和历史 generated 文件。
- 类型片规则继续集中在 genre profiles，不在 UI、prompt、fallback 和测试之间分散复制。
