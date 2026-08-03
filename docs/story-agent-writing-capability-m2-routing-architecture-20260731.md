# Story Agent M2 Capability Router 与 Shadow Rollout 技术规格（2026-08-01）

## 1. 状态

- 阶段：M2 第七切片完成（三类初始能力真实内部接线）
- M2 工程进度：99%
- 专项总进度：54.75%
- 当前行为：三个 capability profile 全部关闭；为单能力/单类型提供静态 adapter、只读 preview 与离线 shadow evaluation
- 未接入：StoryBlueprint 消费、prompt、fallback、quality、repair、持久化、API、MCP

本切片建立 `writing-capability-router/v1`，用于在任何创作规则进入产品生成链之前，
先确定 capability 是否登记、是否适用于指定 `VideoType`、是否被类型明确禁止，以及
profile 是否仍处于关闭状态。

## 2. 路由合同

输入：

- `schema_version: writing-capability-routing-request/v1`
- 一个有效的 `video_type`
- 零到多个稳定 `capability_id`

输出：

- `schema_version: writing-capability-routing-report/v1`
- 稳定排序的请求 ID；
- 与请求一一对应的拒绝决策；
- 固定为空的 `active_capability_ids`；
- profile schema 版本和固定 source commit；
- 汇总数量及不可突破的默认关闭边界。

请求中的 capability ID 必须唯一。重复 ID、未知字段、非法类型或非法 ID 均在请求
schema 层 fail closed。

## 3. 决策优先级

每个请求按以下顺序判断：

1. 未登记：`unknown_capability`
2. profile 明确禁止该类型：`video_type_forbidden`
3. profile 未允许该类型：`video_type_not_allowed`
4. 类型适用但 canonical profile 仍关闭：`profile_disabled`

类型判断优先于 enabled 状态。因此，一个不适用于宣传片的连续性能力不会只显示为
“尚未开启”，而会明确显示为“该类型禁止”，避免未来开关误配置后静默扩散。

router 启动时还会检查 canonical registry。只要发现任一 profile 已经开启，
`writing-capability-router/v1` 整体 fail closed，因为本版本不具备运行时启用权限。

## 4. 默认关闭边界

每份路由报告固定声明：

- `router_only: true`
- `affects_generation: false`
- `runtime_enablement_supported: false`
- `profile_rules_injected: false`
- `third_party_code_executed: false`
- `all_profiles_default_disabled: true`

本切片没有被 preparation、StoryBlueprint、prompt、deterministic fallback、quality、
repair、生成编排或持久化导入。它也不执行、安装、下载或动态加载任何第三方代码。

## 5. 15×3 路由基线

机器报告：

`data/reports/story-agent-writing-capability-m2-routing-baseline.json`

结果：

| 指标 | 数量 |
| --- | ---: |
| VideoType | 15 |
| Capability profile | 3 |
| 路由决策 | 45 |
| 类型适用但 profile 关闭 | 20 |
| 类型明确禁止 | 25 |
| 未登记 | 0 |
| 未允许但未明确禁止 | 0 |
| 激活 capability | 0 |

矩阵 SHA-256：

`6d59efae036581f08ca61e0429436e5327ec0ffa12d2a1cfbe868df1e118d432`

可复现命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:writing-capability-routing
```

## 6. 验证

定向测试覆盖：

- 空请求得到冻结的空决策报告；
- capability 请求顺序不影响结果；
- 类型禁止优先于 profile 关闭；
- 重复请求 fail closed；
- 未知 capability 不伪造 profile provenance；
- 15×3 矩阵稳定且激活数为 0；
- router 未进入生成、质量、修复和持久化模块；
- 机器报告与固定 SHA-256 一致。

实测结果：

- Router + registry：2 个测试文件、16 个测试通过；
- Server 全量：197 个测试文件通过、1 个跳过；1625 个测试通过、2 个跳过；
- Server TypeScript 与 scripts tsconfig：通过；
- Server + Client production build：通过；
- Visible copy audit：9 个文件、17 项检查通过；
- `git diff --check`：通过。

## 7. Rollout Policy 与 Shadow Preparation Plan

`writing-capability-rollout-policy/v1` 把首个候选严格锁定为：

- capability：`short_drama_develop_write_review`
- `VideoType`：`ai_comic_drama`
- profile commit：`adab39cdfa001f272f03bbcf4e68ed005a43d8b6`
- 内部适配版本：`short-drama-adapter/v1`
- 回滚标识：`disable-short-drama-ai-comic-shadow-v1`
- 状态：`shadow_plan`

policy 只能包含一个 candidate，不允许 `enabled` 状态、全局开关或运行时激活。source commit、
profile schema、类型范围与 canonical registry 发生任何漂移时，计划降级为
`policy_incompatible`。

preparation 仅通过内部第二参数显式请求 shadow plan；默认调用返回形状保持不变。计划状态包括：

- `not_requested`
- `policy_disabled`
- `shadow_ready`
- `policy_incompatible`
- `candidate_mismatch`
- `routing_rejected`
- `adapter_blocked`

即使是 `shadow_ready`：

- 底层 router 仍返回 `profile_disabled`；
- `active_capability_ids` 仍为空；
- blueprint / scene / quality / repair 四类规则投影固定为空；
- StoryBlueprint 与默认 preparation 完全一致；
- 不进入公开 `StoryGenerateRequest`、API 或 MCP；
- 不进入 prompt、fallback、quality、repair、document persistence。

## 8. 15 类型 Shadow 基线

机器报告：

`data/reports/story-agent-writing-capability-m2-shadow-plan-baseline.json`

结果：

| 指标 | 数量 |
| --- | ---: |
| VideoType | 15 |
| Shadow-ready | 1 |
| Candidate mismatch | 14 |
| 激活 capability | 0 |
| 投影规则 | 0 |

矩阵 SHA-256：

`0d98d1e96a7507e9099b7bb3b6c2bbb01e9126f90f472735c9a05b56c1fde177`

可复现命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:writing-capability-shadow-plan
```

## 9. 第三切片验证（2026-08-02）

- M0 / M1 / M2 定向回归：7 个测试文件、50 个测试通过；
- Adapter / rollout 契约收口：2 个测试文件、16 个测试通过；
- Server 全量：199 个测试文件通过、1 个跳过；1641 个测试通过、2 个跳过；
- Server TypeScript 与 scripts tsconfig：通过；
- Server + Client production build：通过；
- Visible copy audit：9 个文件、17 项检查通过；
- routing、shadow-plan 与 adapter-preflight 三份机器审计：通过；
- `git diff --check`：通过。

这些结果只证明静态 adapter、冲突预检和 shadow preview 合同稳定，不代表 capability
已启用或创作质量已经提升。

## 10. 静态 Adapter 与冲突预检

首个 adapter 精确锁定：

- capability：`short_drama_develop_write_review`
- `VideoType`：`ai_comic_drama`
- adapter：`short_drama_ai_comic_shadow_adapter` revision 1
- 内部适配版本：`short-drama-adapter/v1`
- profile commit：`adab39cdfa001f272f03bbcf4e68ed005a43d8b6`
- 回滚标识：`disable-short-drama-ai-comic-shadow-v1`

adapter 只含 7 条内部改写规则，按四层组织：

| 层 | 规则数 | 用途 |
| --- | ---: | --- |
| blueprint | 1 | 标记单集因果主干 |
| scene | 2 | 检查行动推进与钩子边界 |
| quality | 2 | 检查因果链与复核分层 |
| repair | 2 | 提供局部、非执行式修复建议 |

每条规则携带稳定 `rule_id`、目标层、canonical profile 来源字段与索引。预检检查：

1. adapter schema 与四层归属；
2. capability、类型、profile schema、source commit、内部适配版本与 rollout policy 完全一致；
3. profile 仍处于 disabled，类型仍在允许范围；
4. 来源规则索引存在；
5. adapter 内规则 ID/文本不重复，且不与现有 `GenreStoryProfile` 原文重复；
6. `GenreStoryProfile`、知识证据、文化安全、权利许可和回滚身份 guardrail 全部保留；
7. 不允许“忽略/覆盖事实、文化、安全或许可”等削弱边界的表达。

任何冲突都返回 `blocked`，不暴露 preview rules；接入 rollout 后状态为
`adapter_blocked`。通过时仅在显式内部参数中增加 `adapter_preview`，原有
`projected_rules` 仍固定为空，真实 StoryBlueprint 与默认 preparation 相同。

## 11. Adapter 机器审计

机器报告：

`data/reports/story-agent-writing-capability-m2-adapter-preflight-baseline.json`

结果：

| 指标 | 数量 |
| --- | ---: |
| Preview rules | 7 |
| Blueprint / scene / quality / repair | 1 / 2 / 2 / 2 |
| 负向冲突样本 | 8 |
| Fail-closed 样本 | 8 |
| 激活 capability | 0 |
| 运行时投影规则 | 0 |

Baseline SHA-256：

`95bdb8a4128d47e86f09a8fe5f6be8b4c51ce9357f044f316335bcef1c7163ef`

可复现命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:writing-capability-adapter-preflight
```

## 12. 离线 Shadow Evaluation 与准入阈值

第四切片新增 `writing-capability-shadow-evaluation-dataset/v1`、evaluation policy 与
evaluation report。固定数据集只包含 13 个明确标注为 `fictional_fixture` 的 AI 漫剧短样本，
不包含用户故事、生产项目或省级知识库正文。

每个样本同时保存：

- 原始合成文本；
- 人工预设的 expected issue；
- 完全空的 closed state；
- 只读 shadow preview observations；
- 两侧固定 `story_mutated: false`。

诊断维度为：

1. `action_progression`
2. `causal_chain`
3. `hook_payoff`
4. `fact_boundary`
5. `cultural_safety`
6. `rights_clearance`
7. `review_separation`

基线有意保留 1 个误报和 1 个漏报，防止合成 fixture 被包装成虚假的满分质量证明。
13 个样本共有 16 个 expected issue 和 16 个预测 issue，15 个命中。

冻结的机器阈值：

| 阈值 | 要求 |
| --- | ---: |
| 最少样本 | 12 |
| 最少 clean 样本 | 3 |
| Precision | ≥ 0.90 |
| Recall | ≥ 0.90 |
| False-positive rate | ≤ 0.10 |
| Clean sample false-positive rate | ≤ 0.34 |
| 单维 recall | ≥ 0.75 |
| 事实/文化/权利 boundary recall | 1.00 |
| 7 条 adapter rule coverage | 1.00 |
| 冲突 | 0 |
| 重复建议 | 0 |

机器门槛通过只会产生 `machine_gate_passed_human_review_required`：

- `canary_allowed: false`
- 六项人工复核全部 `pending`
- 不计为人工或专业评审信用
- 不执行 repair、写回、持久化或激活
- 回滚身份已绑定，但因为从未激活，`rollback_execution_required: false`

非法数据集、adapter identity 漂移、未知规则引用、保护边界削弱、阈值不足、重复样本或
重复建议全部 fail closed。

## 13. Shadow Evaluation 机器基线

Fixture：

`data/fixtures/story-agent-writing-capability-m2-shadow-evaluation-fixtures.json`

机器报告：

`data/reports/story-agent-writing-capability-m2-shadow-evaluation-baseline.json`

结果：

| 指标 | 结果 |
| --- | ---: |
| 合成样本 | 13 |
| Preview observations | 18 |
| Closed-state observations | 0 |
| Story mutations | 0 |
| Precision / recall | 0.9375 / 0.9375 |
| False positive / false negative | 1 / 1 |
| Boundary recall | 1.0 |
| Adapter rule coverage | 1.0 |
| 负向探针阻断 | 3 / 3 |
| Canary allowed | false |

Baseline SHA-256：

`11bb22166e2f652b2f311abb8bfc9ca05c15d86a66b570f85acca0f5c396365f`

可复现命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:writing-capability-shadow-evaluation
```

第四切片验证（2026-08-02）：

- M0 / M1 / M2 定向回归：8 个测试文件、58 个测试通过；
- Server 全量：200 个测试文件通过、1 个跳过；1649 个测试通过、2 个跳过；
- Web workspace lint：通过；
- Server + Client production build：通过；
- Visible copy audit：9 个文件、17 项检查通过；
- routing、shadow-plan、adapter-preflight、shadow-evaluation 四份机器审计：通过；
- `git diff --check`：通过。

## 14. Human Review Intake 与 Canary Decision Package

第五切片新增逐样本人工复核 intake 和只读 `eligible | blocked` decision package：

- 13 个样本 × 6 项清单，共 78 条 judgment；
- reviewer actor、独立性、非自动批准声明、签署与过期时间；
- dataset、evaluation report/baseline、adapter/preflight、rollout policy、evaluation policy 与 rollback 哈希绑定；
- 机器自签、contract fixture、覆盖缺失、失败 judgment、哈希/回滚漂移、attestation 错误和过期证据全部阻断；
- `eligible` 固定 `activation_allowed:false`、`capability_enabled:false`、`canary_executed:false`。

机器报告仅使用合成合同探针，不计真实人工复核或生产授权：

`data/reports/story-agent-writing-capability-m2-canary-decision-baseline.json`

Baseline SHA-256：

`3c2f03a8df3ac58bac69cce1331e0dbc86f1788f7b924a6124c223155272902a`

第五切片验证：定向 9 个文件、65 项通过；Server 全量 201 个文件通过、1 个跳过，
1656 项通过、2 项跳过；Web lint/build、9 文件 17 项 copy audit 与机器审计通过。

## 15. M2 第六切片：Dormant Runtime Integration

已完成：

1. 独立 runtime activation/context/resolution 合同，默认关闭且只允许显式内部 opt-in；
2. 首个候选 `short_drama_develop_write_review × ai_comic_drama` 的 7 条规则按四层进入蓝图、生成、质量和修复；
3. 质量层新增目标—压力—策略—结果、可见行动和首尾钩子三项确定性检查，失败项定位到 `scene_id`；
4. story、story_blueprint 与 `_request_meta` 保存 capability、profile、source commit、adapter、activation 和 rollback 身份；
5. 片型、activation 或 adapter 漂移全部 fail closed，fallback 蓝图与默认蓝图一致；
6. 不执行第三方代码，不改变公开 API/MCP。

验证：runtime integration 定向 6 项通过；受影响能力/蓝图/质量/修复回归 7 个文件、42 项通过；Server 全量 1663 项中 1661 项通过、2 项跳过、0 失败；Server lint、Web lint/build、9 文件 17 项可见文案审计和 `git diff --check` 通过。

## 16. M2 第七切片：连续性与机器读者能力

- 连续性能力新增 8 条静态映射规则、状态/承诺 ledger 和三项确定性检查；
- 机器读者能力新增 6 条静态映射规则和五项可定位体验检查；
- 两类能力与短剧能力共用 runtime context、蓝图注入、质量扣分、repair action 和持久化合同；
- 机器读者评估固定不冒充真人反馈；
- 新增及受影响回归 8 个文件、47 项通过；Server 全量 1667 项中 1665 项通过、2 项跳过、0 失败；Server lint、Web build、9 文件 17 项可见文案审计和 `git diff --check` 通过。

M2 工程实现为 99%。按最新优先级，人工/真人/用户注册不作为工程前置；唯一剩余证据项是运行三能力 runtime integration 审计并固化机器报告哈希。脚本已扩展，但本地沙箱的 `tsx` IPC 权限仍阻止执行。

## 17. 回滚

本切片没有迁移、API、生成或持久化接入。回滚只需删除：

- 路由与 rollout 共享 types/schemas；
- `writing-capability-router.ts`、`writing-capability-rollout-service.ts`、`writing-capability-adapter-service.ts`、`writing-capability-shadow-evaluation-service.ts` 与 `writing-capability-canary-decision-service.ts`；
- routing / shadow-plan / adapter-preflight / shadow-evaluation 审计脚本、报告、fixtures 和测试；
- 本文档。

不需要修改任何项目文件、故事快照或省级知识库。

第六切片可通过停止传入 runtime activation 立即回到默认路径；若需要代码级回滚，删除 runtime/quality service、共享 runtime 合同和蓝图/质量/修复/持久化的可选字段即可。既有 shadow 路由与评测报告不受影响。
