# Story Agent Stage 6 P9 ProfessionalTextPackage 初始包检查器（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-package-inspector`，用于在 P0 operator intake 前检查初始 `ProfessionalTextPackage`。它支持 15 个片型的 skeleton、JSON 原文导入、项目/片型绑定与可修订内容门禁，固定不落盘、不执行、不授予 P0 readiness 或专业信用。

默认 skeleton 实测：

```text
ProfessionalTextPackage schema：合法
P0 初始包门禁：blocked
场景：0
Beat：0
Input persisted：否
P0 readiness granted：否
Execution started：否
Professional passed：否
```

## 哈希边界

- `source_file_sha256` 对 UTF-8 JSON 原文逐字节计算，是保存为文件后应填入 P0 intake 的哈希。
- `canonical_package_sha256` 对 schema 合法包规范化排序后计算，用于后续 Round 0 → 1 → 2 内部包链。
- 两者用途不同；检查器和页面明确禁止用 canonical hash 代替 P0 原文件 SHA-256。

## P0 初始包门禁

检查器与现有 P0 validator 对齐，只在以下条件同时满足时返回 `p0_package_gate_passed=true`：

1. JSON 与 `ProfessionalTextPackageSchema` 合法。
2. `project_id` 已填写并匹配预期真实项目 ID。
3. `video_type` 匹配预期片型。
4. 状态不是 `skeleton`。
5. `full_text`、`sequence_beats`、`scene_breakdown` 和交付脚本文本存在。

Scene ID 唯一性与交付场景绑定作为额外一致性检查展示，但不偷偷改变既有 P0 门禁。即使包内自报 `quality_report.professional_passed=true`，检查结果仍固定 `professional_passed=false` 并显示信用排除提醒。

## API 与安全边界

- `GET /api/stage6-revisions/package-inspector?video_type=...`：返回片型 skeleton 和默认检查结果。
- `POST /api/stage6-revisions/package-inspector/validate`：只在内存解析 JSON 原文并生成结构化检查结果。
- `/persist` 和 `/execute` 均不存在，测试固定返回 404。
- 不创建 `web/generated/stage6-revisions`，不修改 P0 readiness 文件。

## 验证

- 检查器重点测试：1 个文件、4 个用例通过。
- Server TypeScript 检查、Client TypeScript 检查与 production build 通过。
- Playwright Chromium 实际点击只读检查：schema 合法、包门禁 blocked、专业信用 0、四类安全标志均为否。
- 截图：`output/playwright/stage6-professional-package-inspector.png`。

浏览器控制台只有既有 `favicon.ico` 404，与检查 API 和信用门禁无关。

## 信用边界

该检查器只计第五个专业流程产品面。Skeleton、schema 合法、包子门禁通过、原文件哈希、canonical hash、浏览器截图和自报质量字段均不计 P0 readiness、真实修订、真人盲评、Stage 6 退出或专业通过。
