# Story Agent 创作能力目录 M0 技术规格与 ADR（2026-07-31）

## 1. 状态

- 决策状态：Accepted and implemented
- 实现阶段：M0 完成，M1 尚未开始
- 影响范围：共享类型与 schema、服务端只读 capability registry、验证测试
- 不影响范围：生成 prompt、StoryBlueprint 内容、模型适配、确定性 fallback、质量修复、项目持久化、API、MCP 和客户端

本 ADR 落实
`docs/story-agent-writing-capability-knowledge-base-2-handoff-20260731.md`
第 15 节。首切片只建立可审计、默认关闭的创作能力目录，不启用任何生成增强。

## 2. 已核对的现有真实调用链

当前中国文化故事生成入口不是旧 `story-service.ts` 内的一体化实现。真实链路为：

```text
routes / domain pack
  -> domains/china-culture/story-generation-service.ts
  -> story-generation-preparation-service.ts
       -> GenreStoryProfile / genre matrix
       -> StoryBlueprint
       -> KnowledgePack / MaterialPack / creation contract
  -> story-generation-execution-service.ts
       -> deterministic local assembly
       -> story-generation-prompt.ts
       -> model adapter
       -> accepted model output or local fallback
  -> story-post-generation-orchestration.ts
       -> genre/base/delivery quality
       -> repair orchestration
       -> GEARS delivery
  -> generated-story-persistence.ts
```

关键事实来源：

- 15 种 `VideoType`：`web/shared/types.ts` 与 `web/shared/schemas.ts`
- 类型规则单一事实来源：`web/server/src/services/genre-story-profiles.ts`
- 蓝图：`web/server/src/services/story-blueprint-service.ts`
- prompt 包：`web/server/src/services/story-generation-prompt.ts`
- 本地确定性内容：`web/server/src/services/dramatic-story.ts` 及 domain local generation
- 类型质量：`web/server/src/services/genre-quality-service.ts`
- repair：`web/server/src/platform/story-repair-orchestration.ts`
- 持久化：`web/server/src/platform/generated-story-persistence.ts`

首切片没有在上述生成路径中导入 capability registry。

## 3. 决策

### 3.1 新增 `writing-capability-profile/v1`

共享合同 `WritingCapabilityProfileV1` 记录：

- 稳定 `capability_id` 和展示名；
- 外部来源仓库、40 位固定 commit、作者和许可证；
- 内部重写后的规则；
- 允许和禁止的 `VideoType`；
- 未来可接入 blueprint、scene、quality 和 repair 的规则；
- 静态审计 provenance；
- `enabled` 状态。

schema 采用 strict、fail-closed 策略：

- provenance 必填；
- commit 必须是 40 位小写十六进制 SHA；
- license 不得为空；
- allowed / forbidden 不得重复或冲突；
- 外部代码执行、网络访问、文件写入和命令执行只能声明为 `false`；
- 未知字段被拒绝。

`enabled` 在 schema 中保留为布尔值，供 M2 设计 feature flag 时使用；M0 canonical
registry 的三个条目全部固定为 `false`，且没有任何生成路由消费它们。

### 3.2 新增静态 registry

`web/server/src/services/writing-capability-registry.ts`：

- 启动注册时使用共享 schema 再验证；
- 重复 `capability_id` 直接拒绝；
- 输出按 `capability_id` 稳定排序；
- 返回冻结后的 profile 和只读 catalog report；
- 不提供 execute、install、download、sync、writeback 或 dynamic import 能力。

只读报告合同为 `writing-capability-catalog-report/v1`，明确包含：

- profile 总数、启用数、关闭数；
- 来源仓库、固定 commit、许可证、允许/禁止类型和审计时间；
- `catalog_only: true`；
- `affects_generation: false`；
- `third_party_code_executed: false`；
- `external_execution_allowed: false`。

M0 不新增 API 或 MCP。等 M2 的权限、feature flag、版本持久化和回滚合同确定后，再决定
是否暴露状态端点。

### 3.3 首批三个默认关闭条目

| capability_id | 来源 | 固定 commit | 许可证 | 当前范围 |
| --- | --- | --- | --- | --- |
| `continuity_state_tracking` | `danjdewhurst/story-skills` | `c482d48f4eb9b488f033a77a51f9fae55cc0d75f` | MIT | 5 种叙事类 |
| `reader_simulation_review` | `haowjy/creative-writing-skills` | `fb9dab2d4d23434ae76568e8de36aaf515dea8d5` | Apache-2.0 | 除空间/氛围类外的 13 种文本型作品 |
| `short_drama_develop_write_review` | `worldwonderer/drama-skills` | `adab39cdfa001f272f03bbcf4e68ed005a43d8b6` | MIT | `ai_comic_drama`、`social_short` |

commit 固定于 2026-07-31 的 M0 静态审计快照。后续上游变化不会自动进入产品。

## 4. 外部来源静态审计

本轮只查看公开仓库页面、README、许可证、目录和能力说明，没有 clone、安装依赖或执行
第三方代码。

### 4.1 `danjdewhurst/story-skills`

- 仓库：<https://github.com/danjdewhurst/story-skills>
- 固定提交：<https://github.com/danjdewhurst/story-skills/commit/c482d48f4eb9b488f033a77a51f9fae55cc0d75f>
- 许可证：MIT
- 可采用方法：story bible；人物、物件、知识状态；场景出场；承诺/兑现；开放问题。
- 发现的能力面：Node/Bun CLI、项目脚手架、Markdown/YAML 文件读写、导入导出、
  GitHub Actions、外部 Agent workflow 和安装命令。
- 未采用：CLI、脚本、工作流、文件格式、安装命令、自动 PR、任何外部 Agent 调用。
- 主要风险：供应链与安装执行、广泛文件读写、工作流网络调用、把小说项目合同误套到
  短视频或非叙事类型。

### 4.2 `haowjy/creative-writing-skills`

- 仓库：<https://github.com/haowjy/creative-writing-skills>
- 固定提交：<https://github.com/haowjy/creative-writing-skills/commit/fb9dab2d4d23434ae76568e8de36aaf515dea8d5>
- 许可证：Apache-2.0
- 可采用方法：证据化 story review、模拟读者反应维度、写作/批评/修订分阶段。
- 发现的能力面：Meridian/Claude Agent 编排、hooks、bootstrap、依赖同步、脚本、
  项目知识库维护与文件写入。
- 未采用：Agent、hooks、bootstrap、安装/同步、脚本、知识库写入和风格模仿流程。
- 主要风险：提示注入和 Agent 越权、依赖/同步供应链、项目文件修改、把机器 reader
  simulation 冒充真人反馈、对在世作者形成可辨识风格模仿。

### 4.3 `worldwonderer/drama-skills`

- 仓库：<https://github.com/worldwonderer/drama-skills>
- 固定提交：<https://github.com/worldwonderer/drama-skills/commit/adab39cdfa001f272f03bbcf4e68ed005a43d8b6>
- 许可证：MIT
- 可采用方法：develop / write / review 分阶段；目标—压力—策略—局部结果—交接；
  结构、证据、制作和风格选择分层复核。
- 发现的能力面：Python 3.10+ 工具、项目文件读写、技能路由、资产/分镜/图片与视频
  提示词生产链。
- README 声明当前不调用真实图片、视频或音频生成服务，但工具本身仍有本地执行与
  文件写入能力。
- 未采用：Python 工具、安装/链接命令、项目文件格式、资产与生成提示词链。
- 主要风险：第三方本地执行、项目文件改写、商业钩子过度扩散、短剧规则覆盖文化事实
  与类型边界。

## 5. 适配优先级与冲突裁决

无论未来是否启用，优先级固定为：

```text
事实/文化/安全/权利边界
  > GenreStoryProfile 类型规则
  > StoryBlueprint 与知识/素材缺口
  > capability 适配规则
  > 文风和节奏偏好
```

因此 capability 不得：

- 把待核验、异说或戏剧化内容包装为确定事实；
- 自动补平 `missing_material`；
- 自动写回 `data/provinces/*.md`；
- 伪造真人审稿、权利许可或 production credit；
- 执行上游脚本或安装依赖；
- 绕过 `GenreStoryProfile`、quality 或 repair；
- 在 `scene_short`、`landscape_mood` 上强行套人物冲突和短剧钩子。

## 6. M2 接入前置条件

M0 目录存在不代表产品能力已启用。M2 接入至少还需要：

1. type-aware router，拒绝不适用类型；
2. 明确的 feature flag，默认关闭并可按类型回滚；
3. capability profile 版本与项目版本 provenance；
4. blueprint / prompt / local fallback / quality / repair 的对称规则；
5. 关闭 flag 时的字节级或结构级基线对照；
6. 外部服务失败时的确定性降级；
7. 15 × 3 固定样本机器评测和真人盲评；
8. 事实、文化、安全指标不下降。

## 7. 验证合同

### 7.1 冻结的本地生成基线

机器可读基线：

`data/reports/story-agent-writing-capability-m0-baseline.json`

它固定记录：

- 当前分支与基线 HEAD；
- 15 类型 × 3 变体共 45 例的现有产物路径、SHA-256 和覆盖统计；
- 15 类型 canonical matrix 的路径、SHA-256 和覆盖统计；
- 本轮重新运行的隔离测试命令与耗时；
- 两份知识库健康报告的 SHA-256 与核心总量；
- 三个 capability 全部关闭、不会影响生成的边界。

本地确定性路径没有调用语言模型，因此 token 不适用、付费成本为 0。该结论不能外推为
外部模型的 token、延迟、成本或质量基线；这些指标必须在 M4 使用固定模型和参数单独采集。

### 7.2 本轮验证结果

定向测试覆盖：

- provenance 必填；
- allowed / forbidden 冲突；
- commit 和 license；
- 外部 command/network/file/code execution 永远为 false；
- 重复 `capability_id`；
- 三个 canonical 条目存在且全部关闭；
- 只读报告稳定、冻结且明确不影响生成。

生成未接入的回归证据由既有
`story-generation-prompt.test.ts`、`dramatic-story-quality.test.ts` 和
`story-blueprint-genre-quality.test.ts` 提供。因为本切片没有修改或导入生成链，关闭
capability 时现有 prompt 和 fallback 路径保持原样。

实测结果：

- capability schema / registry / catalog report：1 文件、9 测试通过；
- prompt、dramatic fallback、blueprint/genre quality：3 文件、27 测试通过；
- 15 × 3 隔离稳定性：1 文件、1 测试通过，45 例合同保持成立；
- Server 全量：193 文件通过、1 文件跳过；1600 测试通过、2 测试跳过；
- MCP 全量：107 文件、551 测试通过；
- Server TypeScript lint 与 MCP build：通过；
- Server + Client production build：通过；
- 三个固定 GitHub commit 和对应 MIT / Apache-2.0 / MIT 许可证：只读核验通过；
- `git diff --check`：通过。

## 8. 回滚

本切片没有迁移、持久化或 API 合同。回滚只需删除：

- `WritingCapabilityProfileV1` / schema / catalog report types；
- `writing-capability-registry.ts`；
- 对应测试和本 ADR。

不需要转换项目文件、生成快照或知识库数据。
