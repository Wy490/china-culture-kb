# Story Agent Stage 8 P2 三角色盲评签名检查器（2026-07-12）

## 结论

新增 `/story/stage8-blind-review-signature`，对15片型75项目的v2 review bundle执行服务端decision重算，并验证三角色Ed25519 attestation。仓库trust policy当前为空模板，因此所有真实项目仍blocked，真人盲评与专业通过信用均为0。

## 签名合同

`story-agent-stage8-blind-review-signature-attestation/v1`绑定：

- benchmark、video type和run ID；
- canonical review bundle SHA-256；
- 服务端重算decision SHA-256；
- 片型weight contract SHA-256；
- score threshold状态；
- review完成时间；
- 编剧/剧本编辑、类型/导演、事实/文化三角色reviewer ID、key ID和Ed25519签名。

签名payload使用`story-agent-stage8-blind-review-ed25519-payload/v1`领域分离。服务不信任请求提供的decision或trust policy。

签名时间链固定为`review submitted ≤ review completed ≤ signed_at ≤ validation now`；active policy必须在review完成前建立，reviewer授权必须不晚于其签名。即使密码学签名有效，未来时间或事后授权也会阻止`signature_verification_ready`。

## Trust与readiness

- `data/professional-benchmarks/all-format-stage8-blind-review-trust-policy.json`为仓库侧独立策略，当前`preparation_template`、reviewer0。
- `data/reports/story-agent-stage8-blind-review-signature-readiness.json`覆盖75项目，threshold ready0、signature ready0、真实签名0。
- `scripts/story-agent-stage8-blind-review-signature.mts --write|--check`提供确定性报告与stale-check。

有效签名测试fixture只证明三个外部trusted key可以通过密码学验证；报告显式排除该fixture，不写入真实signature、attestation或human pass计数。

## 只读产品面

- `GET /api/stage8-blind-review/signature`返回75项目、双JSON模板、trust摘要和23项检查。
- `POST /api/stage8-blind-review/signature/validate`只做内存验证。
- sign、credit、persist、finalize、release和writeback端点均不存在。
- 页面支持项目切换、review bundle与attestation检查、证据摘要和零信用状态展示。

## 验证

- P19重点测试：1个文件、6个用例通过。
- 覆盖空trust policy、有效三签名、签后篡改、撤销reviewer、未来时间/事后授权和禁止变更端点。
- Server TypeScript、Client production build通过；144 modules transformed。
- signature readiness stale-check通过。
- Playwright Chromium实测75项目、Trusted0/3、Threshold Ready0、Signature Ready0、23项fail-closed检查和六类零信用状态；唯一控制台错误为既有favicon 404。
- 截图：`output/playwright/stage8-blind-review-signature.png`。

签名fixture、verification ready、readiness、页面和canonical hash均不计真实签名、真人盲评通过、signed release或专业通过。专业文本创作进度保持47.5%，模型调用为0。
