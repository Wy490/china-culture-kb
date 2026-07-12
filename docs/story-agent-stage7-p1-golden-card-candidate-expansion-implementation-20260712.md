# Story Agent Stage 7 P1 黄金卡候选补齐准备（2026-07-12）

## 结论

仓库新增 `/story/stage7-golden-card-expansion`，为当前没有黄金卡候选的12个片型建立60个可填写槽位。槽位全部复用既有固定 benchmark 项目，并绑定当前 `GenreStoryProfile`，没有调用模型、生成候选卡、写文件或授予信用。

当前状态：

```text
已有候选覆盖片型：3 / 15
缺失候选片型：12 / 15
计划槽位：60
已填写候选：0
导入 ready：0
持久化候选：0
人工通过：0
专业通过：0
```

## 60槽位来源

`character_story`、`historical_drama`、`legend_story`、`children_story`、`culture_promo`、`city_brand_promo`、`social_short`、`explainer_video`、`lecture_video`、`education_training`、`scene_short` 和 `landscape_mood` 各使用5个既有固定项目。已有10张候选的 `ai_comic_drama`、`heritage_promo`、`documentary_short` 不重复创建槽位。

每个槽位固定：

1. deterministic slot ID 与 candidate ID；
2. video type、benchmark ID、知识条目和 benchmark 文件；
3. benchmark 文件 SHA-256；
4. benchmark project canonical SHA-256；
5. `GenreStoryProfile` 的 narrative promise、material/truth rules、required fields、must/avoid 和 quality rules 合同 SHA-256；
6. 片型必填素材字段。

## 候选导入门禁

`story-agent-stage7-golden-card-candidate/v1` 要求：

- 所有槽位、片型、benchmark、知识条目和三类 SHA-256 绑定一致；
- 所有片型必填素材字段存在且已填写；
- 至少一个可被镜头观察的动作；
- verified facts、plausible dramatization、fictional additions、unknowns 和 forbidden claims 分层存在；
- 至少一个已核事实、一个来源引用和一个禁用断言；
- 知识条目已经独立确认，来源或授权不再是 pending；
- 候选保持 `draft_pending_human_review`，`generated_by_model=false`；
- `human_approved`、`golden_card_promoted`、`professional_passed` 固定为 false。

完整填写且通过上述门禁只返回 `candidate_ready_for_external_human_review=true`，不代表候选已被仓库接受，更不代表黄金卡或人工通过。

## API 与写入边界

- `GET /api/stage7-golden-cards/candidate-expansion`：返回60槽位、15片型覆盖、动态 operator 模板和模板检查。
- `POST /api/stage7-golden-cards/candidate-expansion/validate`：只在内存验证 JSON。
- `/generate`、`/persist`、`/create-card`、`/promote`、`/writeback` 均不存在。
- 固定报告 candidate 未落盘、统一索引未修改、卡片文件未创建、`data/provinces/*.md` 未修改、人工批准和专业通过均为 false。

静态 operator 模板位于 `data/professional-benchmarks/all-format-stage7-golden-card-candidate-operator-template.json`；readiness 位于 `data/reports/story-agent-stage7-golden-card-candidate-readiness.json`。合同测试把模板与当前 benchmark/Profile 动态哈希绑定，任一合同漂移都会 fail closed。

## 验证

- P14 重点测试：1个文件、5个用例通过。
- 覆盖60槽位基线、完整人工填写 fixture、benchmark/Profile 哈希篡改、缺来源与自报信用、禁止写入端点。
- Server TypeScript、Client TypeScript 与 production build 通过。
- Playwright Chromium 实际点击“验证候选 JSON”：12个缺失片型、60槽位、已填写0、ready0、人工通过0；模板因内容与来源为空保持 BLOCKED，全部写入标志为否。
- 截图：`output/playwright/stage7-golden-card-candidate-expansion.png`。

浏览器控制台只有既有 `favicon.ico` 404，与候选验证 API 无关。

## 信用边界

专业文本创作进度保持47.5%。60个槽位不是60张候选卡；benchmark、模板、fixture、schema合法、三类SHA-256和外部人审ready均不计候选成稿、黄金卡人工通过、Stage 7实际启动、真人盲评、真实修订或专业通过。
