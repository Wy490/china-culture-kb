# Story Agent Stage 6 P0 真实输入接入面实施报告

状态：`real_input_intake_contract_complete_all_15_blocked_external_inputs`

## 本轮完成

P0 已建立独立于生成主链的真实输入接入合同：

- 统一 `story-agent-stage6-real-input-intake/v1` schema，覆盖 operator、15 个真实项目 ID、初始 `ProfessionalTextPackage` 文件与 SHA-256、创作者或模型授权、两轮预算、三类评审者和桌读排期。
- 导入验证器逐项目核验 registry 绑定、真实 provenance、重复项目 ID、文件存在与仓库内 realpath、文件哈希、ProfessionalTextPackage schema、project/video type 绑定、可修订初稿、授权、预算、实名评审和桌读参与者。
- 生成 operator 可填写 JSON 模板；模板采用 `preparation_template` 和 `unverified`，本身确定性地保持 blocked。
- 生成 15 项逐项目 readiness 报告和结构化错误清单。当前 15/15 blocked、ready 0/15。
- readiness 报告固定 `completed_verified_revision_round_count=0`、`professional_pass_count=0`；fixture、simulation、fallback 和准备态不能获得真实输入或执行信用。

## 文件

- 共享类型：`web/shared/types.ts`
- 共享 schema：`web/shared/schemas.ts`
- 导入与 readiness 服务：`web/server/src/services/professional-multi-round-revision-intake-service.ts`
- 合同测试：`web/server/src/__tests__/professional-multi-round-revision-intake.test.ts`
- operator 模板：`data/professional-benchmarks/all-format-stage6-p0-real-input-operator-template.json`
- 当前 readiness：`data/reports/story-agent-stage6-p0-project-readiness.json`
- CLI：`scripts/story-agent-stage6-real-input-intake.mts`

## Operator 使用

1. 复制模板到独立 intake 文件，不直接把模板标记为真实输入。
2. 填写 operator 和 15 个项目；将 provenance 改为 `operator_submitted_real_input`。
3. 初始包必须存放在仓库内，填写按文件字节计算的 SHA-256；包必须为非 skeleton、schema 合法且 `project_id`、`video_type` 与 intake 一致。
4. 授权和预算必须覆盖 Round 1、Round 2，并填写 `verified`、核验引用、核验人和核验时间。
5. 三类评审者必须实名、身份已核验且 ID 互不重复；桌读参与者必须包含这三类评审者。
6. 运行：

```bash
npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-stage6-real-input-intake.mts \
  --input path/to/operator-intake.json \
  --report data/reports/story-agent-stage6-p0-project-readiness.json
```

该命令只验证和写 readiness，不调用任何模型，也不执行修订。

## 当前指标

```text
当前 Stage：Stage 6 / P0 真实输入接入面完成
覆盖片型：15 / 15
专业文本包通过：0 / 15
固定真实模型项目：0 / 75
真人盲评通过项目：0 / 45
黄金素材卡人工通过：0 / 75
硬门槛失败数：15
Stage 6 intake 项目：15
ready：0 / 15
blocked：15 / 15
完成两轮真实修订项目：0 / 15
已验证真实修订轮次：0
professional_text_creation_progress：40% -> 40%
```

## 验证

- P0、Iteration 2 execution 和 ProfessionalTextPackage 窄测试：11/11 通过。
- Web Server 全量：62 个测试文件、715 个用例通过。
- Web Server TypeScript：通过。
- Web copy audit、Server/Client 类型检查：通过。
- 当前模板 CLI 生成与 readiness 合同检查：通过。
- 未调用付费模型，未写入生成故事，未提升专业通过或真实修订指标。

## 下一步

外部真实输入到位前，15 个项目保持 blocked。下一开发项为 P1 修订批次执行器；执行器必须只消费本 P0 验证器产生的 `ready` 项目，并继续 fail closed。
