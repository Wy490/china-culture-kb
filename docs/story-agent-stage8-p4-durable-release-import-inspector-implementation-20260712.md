# Story Agent Stage 8 P4 durable signed-release record 只读导入检查器（2026-07-12）

## 结论

新增 `/story/stage8-durable-release-import`，对外部已经持久化、已经签发的 durable signed-release record 做只读导入前验证。当前仓库 release authority registry 是空的 `preparation_template`，75/75 项目均 blocked；没有创建、签署、导入或持久化任何 release，professional pass 为 0，专业文本创作进度保持 47.5%。

```text
Verify ≠ Create ≠ Import ≠ Professional Pass
```

## 严格合同

`professional-benchmark-durable-signed-release/v1` 必须绑定：

- `professional-benchmark-finalization-decision/v2` 的 canonical SHA-256，且 decision 只能剩 `signed_release_record_missing`；
- benchmark ID、真实 run ID 与 `VideoType`；
- `professional-benchmark-release-artifact-manifest/v1` canonical SHA-256；
- 至少 12 件唯一、带 SHA-256 与 size 的不可变 artifact，以及终稿、artifact validation、人审 verification digest；
- release authority ID、authority key ID、外部证据环境、签发时间和到期时间；
- release record canonical SHA-256、领域分离 payload SHA-256 与 Ed25519 signature；
- `is_fixture=false`、`is_simulation=false`、`professional_passed=false`。

导入检查器还会独立复核decision质量门禁：终分至少85、增量必须为正，且`final-initial`必须与`verified_quality_improvement`一致，不能只信任`eligible_for_signed_release`自报布尔值。manifest除唯一artifact ID外还要求路径唯一，并要求终稿、artifact validation和人审verification三个不同摘要分别实际出现在artifact数组中，不能用重复路径或悬空摘要凑满12件。

外部 authority registry 使用 `professional-benchmark-release-authority-registry/v1`，固定从仓库配置读取，不接受请求自带 trust。它校验 authority/key 唯一性、active/revoked、scope、允许片型、有效期和已知 release ID。

## Fail-closed 场景

针对性测试覆盖：

- 不可验证或篡改的 Ed25519 签名；
- revoked authority key；
- benchmark、run、video type identity drift；
- 与外部 registry `known_release_ids` 重复的 release ID；
- 未来签发时间、过期或无效到期时间；
- 自报eligible但终分/正向增量/增量算术无效；
- 重复artifact路径，以及未绑定清单文件的三项关键摘要；
- 空 authority registry 与所有 mutation endpoint 缺失。

本轮8个针对性用例没有生成测试 key、没有调用签名函数、没有生成有效签名 fixture。测试只使用公开固定 public key 与无效签名字节验证 fail-closed 路径，信用固定为 0。

## 只读产品面与数据产物

- `GET /api/stage8-blind-review/durable-release` 返回 75 项 workspace、仓库侧 authority 摘要和双 JSON 模板。
- `POST /api/stage8-blind-review/durable-release/validate` 只做内存验证。
- create、sign、import、persist、release、approve、writeback 端点均不存在。
- 返回值固定 `release_record_created=false`、`release_record_imported=false`、`release_record_persisted=false`、`professional_passed=false`。
- `scripts/story-agent-stage8-durable-release.mts --write|--check` 维护 operator 模板和 readiness 报告。
- 统一 CI 读取 P21 报告并强制 candidate、active authority、verification ready、import 与 professional pass 全为 0。

## 浏览器验收

Playwright Chromium 实测 75 项、Candidate Ready 0、Active Authority 0、Verification Ready 0、Imported Release 0、Release/Pro Credit 0/0；点击只读验证后仍 fail closed，并明确显示 repository-controlled authority 与不创建/不导入/不持久化文案。

截图：`output/playwright/stage8-durable-release-import.png`。

## 证据边界

schema、readiness、页面、canonical hash、机器时间门禁、测试 public key 和失败验签只证明导入检查器合同；它们都不计真实修订、真人盲评、durable signed release、专业通过或专业进度增长。
