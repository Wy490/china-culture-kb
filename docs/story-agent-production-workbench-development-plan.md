# Story Agent 生产工作台开发计划

> 日期：2026-06-16
> 范围：`china-culture-kb` Web Story Agent、Production Board、GEARS / Seedance 交付链、AI 漫剧系列生产链。
> 目标：把当前系统从“故事生成器”推进为“可持续迭代的故事到成片生产工作台”。

## 1. 当前开发程度

整体判断：

- Story Agent MVP：约 75%
- Production Board / GEARS / Seedance 交付链：约 94%
- AI 漫剧系列生产链：约 45%
- 可商用制作中台：约 35-40%

当前已经跑通的主链路：

```text
知识库 / 用户大纲
  -> 故事生成
  -> 质量报告
  -> 一键质量修复
  -> Production Board
  -> Supervision Agent
  -> 生产修复
  -> Seedance 镜头提示词
  -> 交付包落盘
```

这说明系统已经越过原型阶段，进入“生产链路可用但还需强化稳定性和协作能力”的中段。

## 2. 已完成能力

### 2.1 P0 质量闭环

已完成：

- Outline Coverage Report
- Pattern Quality Report
- GEARS Readiness Report
- 前端展示三类质量报告
- 一键质量修复工作流
- 项目版本记录与修复 trace

价值：

- 用户不只看到“质量偏弱”，还能看到为什么弱、影响什么、可以点哪里修。
- 质量报告已经从单纯评分升级为可执行修复入口。

### 2.2 Production Board

已完成：

- 角色资产
- 场景资产
- 道具资产
- 服饰资产
- 导演计划
- 镜头单元
- Seedance 分镜提示词
- QA 报告
- Supervision Agent

价值：

- 故事结果已经可以转换成生产结构。
- 生产链路开始区分剧本文本、画面提示、镜头建议、连续性约束和负面约束。

### 2.3 生产监督与修复

已完成监督项：

- 时代服饰错配
- 资产缺失
- 提示词杂质
- 镜头可拍性不足
- 连续性约束不足
- 长镜头时段拆分不足

已完成修复入口：

- `执行生产修复`
- `修复 P0`
- `修复并落盘`
- 后端 `POST /api/projects/:projectId/production-board/repair`
- 后端 `POST /api/projects/:projectId/production-board/repair-export`
- 新版本类型 `production_board_repair`

当前确定性生产修复支持：

- 修正时代服饰错配
- 补齐角色 / 场景资产
- 清理提示词杂质
- 增强镜头可拍性
- 补充连续性提示
- 为长镜头补分时段提示

### 2.4 交付包落盘

已完成：

- `POST /api/projects/:projectId/production-board/export`
- 前端 `一键落盘交付包`
- 导出目录：`web/generated/projects/<projectId>/production-board/`
- 测试或多实例运行需要隔离生成物时，可用 `WEB_GENERATED_ROOT` 覆盖默认 `web/generated` 根目录。

交付文件：

- `manifest.json`
- `production-board.json`
- `production-board.md`
- `supervision-report.json`
- `repair-plan.json`
- `seedance-prompts.json`
- `seedance-prompts.md`

价值：

- 外部 Agent、人类导演、分镜师或视频制作链路都可以读取同一份交付包。
- 当前交付不再依赖手动复制页面文本。

### 2.5 前端工作台

已完成：

- 项目列表
- 项目详情
- 质量报告
- 一键质量修复
- Production Board
- 生产修复按钮
- 一键落盘交付包
- 版本记录
- AI 漫剧系列入口和部分生产工具

## 3. 当前薄弱点

### 3.1 Production Board 修复仍偏规则化

当前生产修复适合解决明确结构问题：

- 服饰错配
- 提示词杂质
- 连续性缺失
- 资产缺失

仍不足：

- 剧本正文变厚
- 对白增强
- 情绪层次升级
- 场景调度更高级
- 单镜头“导演式”精修

这部分仍依赖质量修复模型链路，尚未成为 Production Board 内的逐镜头精修能力。

### 3.2 小说改编工作台未完整成型

已有基础：

- 原作改编分析
- 小说改编模式
- 改编相关流派支持

仍缺：

- 章节解析
- 人物关系图
- 事件链
- 情绪线
- 世界观规则
- 改编策略选择
- 分集 / 分场 / 分镜输出

核心问题：

- 用户提供小说时，系统应该先分析原作，再改编为成片结构，而不是重新生成一个新故事。

### 3.3 Seedance 交付缺资产绑定

已有：

- 镜头级 Seedance 提示词
- Seedance Markdown / JSON 导出
- 角色 / 场景 / 道具参考图字段首版
- 素材 slot 首版
- `@图片1` 用途分配与素材数量、复杂度、时长校验
- Production Board 级素材缺口报告首版
- 独立 `seedance-asset-report.json` / `.md` 交付文件
- 单故事素材库绑定回写首版
- 文件 URL / file_id 持久化首版
- 单故事 Seedance Shot Ledger 首版
- 独立 `seedance-shot-ledger.json` / `.md` 交付文件
- 单故事 Seedance 回传导入首版
- 单故事 Seedance 失败重试包 Markdown / JSON 首版
- 单故事 Seedance 手动/自动择优首版
- 单故事 Seedance 批量状态流转首版
- 单故事 Seedance 外部素材清单批量导入首版
- 单故事 Seedance 素材上传态字段首版
- 单故事 Seedance 真实文件上传首版
- 单故事 Seedance 跨项目资产库复用首版
- 单故事 Seedance 素材上传历史 UI 首版
- 单故事 Seedance provider 任务提交抽象首版
- 单故事 Seedance provider 队列元数据首版
- 单故事 Seedance provider 超时恢复首版
- 单故事 Seedance provider 外部回传 schema 首版
- 单故事 Seedance provider 轮询入口首版
- 单故事 Seedance provider 失败分类和错误码传递首版
- 单故事 Seedance provider 通用 poll adapter 首版
- 单故事 Seedance provider 通用 submit adapter 首版
- 单故事 Seedance provider 队列状态总览首版
- 项目详情页 Seedance provider 队列健康条首版
- 单故事 Seedance `@视频1` / `@音频1` 引用校验首版

仍缺：

- 真实 Seedance / 外部 provider 平台 SDK/HTTP submit/query 实现
- 真实平台错误码映射扩展和人工重试策略

### 3.4 GEARS / 外部制作工具集成仍偏文件交付

已有：

- 结构化交付包
- 文件落盘

仍缺：

- Webhook / API 推送
- 外部工具状态回传
- 生产任务队列
- 错误恢复
- 批量状态流转

### 3.5 产品级稳定性还需加强

仍缺：

- 故事项目列表过于复杂，普通管理动作被淹没
- 单个故事选择不明显，全选入口不够直观
- 删除故事的反馈和后端清理不够可靠
- 批量操作保护
- 版本 diff
- 一键回滚
- 导出历史
- 失败恢复
- 更明确的状态机
- 端到端测试集

### 3.6 故事管理 UX 需要先降噪

当前故事项目页同时承载故事项目、漫剧系列、导出、装配、修复、清理等动作，用户在“生成故事后管理结果”时容易找不到最基础的选择和删除。

下一步必须先保证：

- 故事列表默认可扫描；
- 单个故事选择框可见；
- 全选当前筛选结果可见；
- 删除所选、清空选择放在同一管理条；保留最近项目属于高风险低频清理，收进清理操作；
- 删除后明确显示成功/失败；
- 后端删除必须清理项目版本引用过的故事文件。
- 故事生成页只保留最近故事和管理入口，不复制批量删除逻辑；
- 生成成功后提供“打开当前故事”和“管理故事”两个明确出口。
- 故事生成页最近故事允许单条删除，但批量选择、全选和筛选外删除保护必须继续集中在项目工作台，避免生成主流程变复杂。
- 故事生成页默认只暴露主流程，模型、表现形式、时长、叙事流派和质量强度收进生成设置。
- 故事生成页成片类型默认只展示常用类型，完整类型能力收进更多成片类型。
- 项目工作台默认只暴露搜索、项目类型和故事管理条，状态/成片/质量等筛选收进筛选区。
- AI 漫剧系列卡片默认只暴露继续、归档/恢复和删除，导出/制作类低频操作收进制作操作。
- AI 漫剧系列工作台摘要区默认只保留保存和下一集路径，Bible / Seedance / 剪辑类导出收进导出与制作。
- Seedance 生产状态区默认先展示统计总览，批量流转、导入回传、装配、抽帧和版本对比收进生产操作。
- Seedance 单镜头卡片默认只展示镜头状态、视频版本和缩略图状态，单镜头状态更新收进更新状态。
- Production Board 修复包必须支持单任务修复入口，并在修复结果区展示交付阶段、阻断项、监督分、QA 分和剩余任务的前后 diff；逐场景 diff 已完成首版，默认折叠展示，按需展开。
- Production Board 修复未产生实际变化时不得生成新版本，避免版本记录被空修污染。
- Production Board 已支持“修复并落盘”一键流程：先复用生产修复生成新版本或确认无变化，再复用交付包导出当前 Board。
- Production Repair History 已接入版本记录：生产修复版本摘要会回读 repair trace，Production Board 导出会在当前版本快照记录交付包落盘信息。
- Production Board 已支持按镜头 / 问题类别修复：修复请求可用 `shot_ids`、`scene_ids`、`categories` 收窄任务目标，项目页问题卡和镜头卡提供对应入口。
- 删除成功反馈必须显示已清理的关联故事文件数量，避免用户误以为只删了列表项。
- 批量删除默认只作用于当前筛选结果中已选故事，筛选外历史选择必须显式提示并可一键清除。
- 当前筛选结果只选中部分故事时，全选框必须显示半选状态，避免用户误判为未选择。
- 故事项目选择列必须同时显示复选框和“选择/已选”文字，批量栏在已有选择时必须高亮，降低用户找不到单选/全选入口的概率。
- 批量删除确认必须提示筛选外已选故事不会被删除；筛选区必须提供重置入口。

## 4. 总体开发路线

### 阶段 1：Production Board 修复闭环增强

目标：把监督问题真正变成可执行任务链。

开发项：

- 单个任务修复按钮
- 按任务、按镜头、按问题类别修复（已完成首版）
- 修复前后 diff
- 修复后自动重新生成 Board
- 修复后自动判断是否 ready
- “修复并落盘”一键流程（已完成首版）
- Production Repair History（已完成首版）

验收标准：

- 用户能从阻断问题一路点到可交付状态。
- 用户不需要手动理解全部底层字段。
- 每次修复都有 trace、版本和可读说明。

优先级：P0。

### 阶段 2：Seedance 制作包升级

目标：从“文本提示词”升级为“视频模型生产包”。

开发项：

- 角色参考图字段
- 场景参考图字段
- 道具参考图字段
- `@图片1` / `@视频1` / `@音频1` 引用角色分配（已完成首版）
- 素材数量限制校验
- Prompt Complexity / Duration 校验
- Production Board 级素材缺口报告（已完成首版）
- 单故事素材库绑定回写（已完成首版）
- 外部素材清单批量导入（已完成首版）
- 素材上传态字段（已完成首版）
- 真实文件上传（已完成首版）
- Seedance Shot Ledger（已完成首版）
- 回传导入（已完成首版）
- 批量状态流转（已完成首版）
- 按镜头记录：
  - 生成状态（已完成首版）
  - provider job id（已完成首版）
  - 视频 URL（已完成首版）
  - 版本（已完成首版）
  - 评分（已完成首版）
  - 选用版本（已完成首版）
- 手动选择剪辑版（已完成首版）
- 自动选择最佳版本（已完成首版）
- 失败重试包（已完成首版）
- provider 任务提交抽象（已完成首版）
- provider 队列状态总览（已完成首版）
- `@视频1` / `@音频1` 引用校验（已完成首版）

验收标准：

- 一个故事项目能直接拆成 Seedance 可执行镜头任务列表。
- 每个镜头都有明确素材引用、提示词、时长、状态和结果。

优先级：P0-P1。

### 阶段 3：小说改编工作台

目标：用户粘贴小说后，系统进入专业改编模式。

开发项：

- 小说章节切分
- 人物关系图
- 事件链
- 情绪线
- 世界观规则
- 必须保留项
- 可压缩项
- 改编风险
- 改编策略选择：
  - 忠实改编
  - 漫剧节奏
  - 短剧强钩子
  - 分镜优先
- 输出：
  - 分集大纲
  - 单集剧本
  - 分镜表
  - GEARS 包
  - Seedance 包

验收标准：

- 小说输入后，系统先分析再改编。
- 不另起炉灶生成新故事。
- 改编输出能追踪“保留了什么、压缩了什么、调整了什么”。

优先级：P1。

### 阶段 4：AI 漫剧系列流水线

目标：从单集项目升级为连续剧制作。

开发项：

- Series Bible 完善
- Episode Memory
- 长期线索 ledger
- 角色状态递进
- 每集钩子与回收
- 系列级 Production Board
- 系列级 Seedance 生产队列
- 系列级剪辑包
- 集与集之间的 continuity audit

验收标准：

- 可以稳定生成 3-10 集短漫剧。
- 角色关系、伏笔、线索、知识边界不会前后打架。

优先级：P1-P2。

### 阶段 5：外部生产系统集成

目标：让交付不止是文件，而是任务协作。

开发项：

- GEARS Webhook 完善
- Seedance 任务 API 抽象（本地 provider 提交账本已完成首版，真实外部 API 对接待做）
- 回传视频状态（单故事首版已完成）
- 失败重试（重试包和失败镜头 provider 重新提交首版已完成，真实重试队列待做）
- 版本对比
- 自动选择最佳版本（单故事首版已完成）
- 剪辑包生成
- 成片装配
- 标准外部 Agent schema

验收标准：

- 外部制作工具可以直接消费系统导出的结构。
- 不依赖人类复制粘贴。
- 回片结果能自动进入项目状态。

优先级：P2。

### 阶段 6：质量与产品化

目标：从开发工具变成稳定产品。

开发项：

- 项目版本 diff
- 一键回滚
- 批量导出
- 导出历史
- 错误恢复
- 更清晰的状态机
- 端到端测试
- 示例项目集
- 部署文档更新
- 用户操作文档

验收标准：

- 新用户能从首页进入并完成一个项目。
- 不需要开发者在旁边解释。

优先级：P2-P3。

## 5. 下一阶段建议执行顺序

建议下一阶段先做六件事，先做故事管理降噪，再继续生产链：

1. 故事项目列表降噪：表格化、减少顶部危险动作
2. 单选 / 全选 / 批量删除明确可见
3. 删除链路增强：删除所有版本引用的故事文件并返回统计
4. Production Board 单任务修复
5. 修复前后 diff
6. Seedance 资产引用字段和素材校验（已完成首版）

原因：

- 用户首先需要能稳定管理已生成故事，避免列表越积越乱。
- 选择、全选和删除是低复杂度高收益的 P0 体验。
- 当前系统已经能生成 Board、发现问题、执行批量生产修复和落盘。
- 但用户还缺少“我只想修这个问题”的精细控制。
- 修复前后 diff 能显著提升信任感。
- Seedance 资产引用、`@视频/@音频` 引用校验、单故事资产绑定、素材缺口报告、外部素材批量导入、上传态字段、真实文件上传、跨项目资产库复用、素材上传历史 UI、Shot Ledger、回传导入、失败重试包、手动/自动择优、provider 任务提交抽象、provider 队列元数据、provider 超时恢复、provider 外部回传 schema、provider 轮询入口、provider 失败分类、provider 通用 submit/poll adapter、provider 队列状态总览、项目详情页 provider 队列健康条、MCP GEARS 只读交付工具、MCP Seedance prompt 只读工具、MCP repair dry-run、MCP 受控版本写入、MCP repair auto_apply 安全应用、真实项目 smoke 和前端质量反馈视图首版已进入工作台；下一步补真实平台 SDK/HTTP submit/query 细节。

建议下一阶段验收闭环：

```text
打开项目
  -> 在故事列表中单选 / 全选故事
  -> 删除所选并看到结果反馈
  -> 生成 Production Board
  -> 查看监督问题
  -> 点击单个修复任务
  -> 查看修复前后 diff
  -> 确认生成新版本
  -> Board 重新评分
  -> 一键修复并落盘
  -> 生成 Seedance 含资产引用的交付包
```

## 6. 关键代码入口

共享类型：

- `web/shared/types.ts`
- `web/shared/schemas.ts`

项目服务：

- `web/server/src/services/project-service.ts`

质量修复：

- `web/server/src/services/quality-workflow-service.ts`
- `web/server/src/services/quality-repair-service.ts`
- `web/server/src/services/story-repair-service.ts`

Production Board：

- `web/server/src/services/production-board-service.ts`
- `web/server/src/services/production-board-repair-service.ts`

GEARS / Seedance：

- `web/server/src/services/gears-delivery-service.ts`
- `web/server/src/services/seedance-prompt-service.ts`

项目路由：

- `web/server/src/routes/projects.ts`

前端：

- `web/client/src/api/projects.ts`
- `web/client/src/views/ProjectDetail.vue`
- `web/client/src/views/Projects.vue`
- `web/client/src/views/AiComicSeriesStudio.vue`

测试：

- `web/server/src/__tests__/project-service.test.ts`
- `web/server/src/__tests__/seedance-prompt-service.test.ts`
- `web/server/src/__tests__/quality-workflow-service.test.ts`
- `web/server/src/__tests__/gears-delivery-service.test.ts`

## 7. 风险与处理原则

### 7.1 不要把知识库当资料仓库

知识库应继续作为结构化决策系统：

- 决定可信边界
- 决定人物、地点、时代、文化约束
- 决定可视化资产和叙事母题

不应把知识摘要直接铺进正文。

### 7.2 不要把 Production Board 做成纯展示页

Production Board 必须继续承担三件事：

- 生产资产派生
- 监督检查
- 可执行修复与交付

否则它会退化为“漂亮的报告页”。

### 7.3 不要让提示词字段混入内部分析

必须持续保持字段分离：

- `script_text`：观众能看到或听到的剧本内容
- `visual_prompt`：可见画面元素
- `camera_suggestion`：镜头语言
- `segment_prompt_hint`：生产指导
- `validation_notes`：人类或 Agent 看的问题，不得混入提示词

### 7.4 修复必须可追踪

所有修复都应产生：

- trace
- 版本记录
- 变更说明
- 可对比结果

否则用户无法信任自动修复。

## 8. 阶段完成定义

### 当前阶段已完成定义

当前已经完成：

- P0 质量可修复工作流
- Production Board 初版
- Supervision Agent 初版
- Production Board 交付包落盘
- Production Board 批量生产修复初版

### 下一阶段完成定义

下一阶段完成需要满足：

- 故事项目单选、全选、批量删除清晰可用
- 删除链路能清理项目版本引用的故事文件
- 单任务修复可用
- 修复前后 diff 可用
- 修复并落盘一键流程可用（已完成首版）
- Seedance 资产引用字段进入 Board 和导出包（已完成首版）
- Seedance 资产库绑定和缺口报告进入工作台（已完成首版）
- Seedance Shot Ledger 回传、重试包、手动/自动择优和批量状态流转进入工作台（已完成首版）
- Seedance 外部素材批量导入和上传态字段进入工作台（已完成首版）
- Seedance 真实文件上传进入工作台（已完成首版）
- Seedance 跨项目资产库复用进入工作台（已完成首版）
- Seedance 素材上传历史 UI 进入工作台（已完成首版）
- Seedance provider 任务提交进入工作台（已完成首版）
- Seedance provider 队列元数据进入工作台（已完成首版）
- Seedance provider 超时恢复进入工作台（已完成首版）
- Seedance provider 外部回传 schema 进入工作台（已完成首版）
- Seedance provider 轮询入口进入工作台（已完成首版）
- Seedance provider 失败分类和错误码传递进入工作台（已完成首版）
- Seedance provider 通用 poll adapter 进入工作台（已完成首版）
- Seedance provider 通用 submit adapter 进入工作台（已完成首版）
- Seedance provider 队列状态总览进入工作台（已完成首版）
- ProjectDetail provider 队列健康条进入工作台（已完成首版）
- Seedance `@视频1` / `@音频1` 引用校验进入提示词包和素材校验（已完成首版）
- MCP `kb_repair_story(auto_apply=false)` 只读修复建议进入 Agent 工具链（已完成首版）
- MCP `kb_update_project_version` 受控版本写入进入 Agent 工具链（已完成首版）
- MCP `kb_repair_story(auto_apply=true)` 安全自动应用进入 Agent 工具链（已完成首版，需调用方提供 `repaired_story_json`）
- MCP 自动修复真实项目 smoke 通过（已完成首版）
- 项目详情页前端质量反馈视图进入工作台（已完成首版）
- 相关服务测试、构建和浏览器烟测通过
