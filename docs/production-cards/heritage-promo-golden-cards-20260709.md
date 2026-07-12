# 非遗/工艺宣传片黄金生产素材卡审稿说明

更新时间：2026-07-09

对应数据文件：`data/production-cards/heritage-promo-golden-cards.json`

对应回归样本：`data/production-cards/heritage-promo-golden-regression-fixtures.json`

本轮交付是 Phase 1「黄金生产素材卡」的第二批可生产素材：非遗/工艺宣传片 10 条。它补的不是百科信息，而是宣传片真正需要的材料、工具、流程、手部动作、声音质感、授权边界和生产风险。

## 1. 本轮完成

| 序号 | 条目 | 类型 | 生产抓手 | 审稿重点 |
|---:|---|---|---|---|
| 1 | 常德丝弦 | 曲艺 | 扬琴、曲本、坐唱、小剧场 | 唱词版权、曲目授权、九板十八调补证 |
| 2 | 岳阳巴陵戏 | 地方戏曲 | 三腔合流、后台、岳阳楼转场 | 三腔形成时间、剧目授权、跨剧种混用 |
| 3 | 常德武陵戏 | 地方戏曲 | 内外八块、锣鼓、后台 | 常德高腔与武陵戏项目边界 |
| 4 | 湘西苗医苗药 | 民族医药 | 标本、档案、药柜、山地生态 | 医疗伦理、患者隐私、不得做医疗建议 |
| 5 | 桑植白族仗鼓舞 | 传统舞蹈 | 仗鼓、倒丁字步、三人队形 | 迁徙史、套路清单、村寨授权 |
| 6 | 土家族摆手舞 | 民俗舞蹈 | 摆手堂、鼓点、围圈 | 大小摆手边界、祭祀禁忌、旅游化边界 |
| 7 | 湘昆 | 传统戏剧 | 古戏台、武戏、曲笛 | 三昆说法、文物拍摄、院团授权 |
| 8 | 湖南花鼓戏 | 地方小戏 | 三小、手帕、扇子、大筒 | 分支唱腔、《刘海砍樵》版本 |
| 9 | 桑植民歌 | 传统音乐 | 采风、录音、山地对唱 | 歌词版权、长征传唱路径 |
| 10 | 湘剧 | 地方戏曲 | 高低昆乱、后台、档案 | 流派边界、剧目清单、学术评价 |

## 2. 字段覆盖

每条素材卡均已覆盖非遗/工艺宣传片片型的 15 个必填字段：

- `project_name`
- `heritage_or_craft_type`
- `confirmed_status_and_sources`
- `official_catalog_or_resource_links`
- `materials`
- `tools`
- `process_steps`
- `hand_actions`
- `practitioner_or_transmission_line`
- `community_or_practitioner_consent`
- `documentation_assets`
- `visual_symbols`
- `sound_or_texture_details`
- `modern_connection`
- `production_risks`

额外补充了：

- `evidence_boundaries`：区分已确认事实、待核项目和禁用断言。
- `source_refs`：保留既有知识库来源线索。
- `writeback_policy`：明确不直接写回 `data/provinces/*.md`。

## 3. 回归状态

当前状态：`pending_human_review`，其中 2 条已建立本地回归样本。

已完成的回归：

- 常德丝弦：5 场宣传片分镜、5 个 GEARS 分段、质量报告。
- 湘西苗医苗药：5 场宣传片分镜、5 个 GEARS 分段、医疗边界质量报告。
- 自动化测试通过：`npx vitest run __tests__/heritage-promo-golden-cards-regression.test.ts`。

仍不能直接标记为 `production_ready`。原因：

- 10 条均还需要人工审稿。
- 多数条目涉及官方项目页、保护单位、代表性传承人、可拍曲目、剧目片段、歌词、曲谱或场地授权。
- 湘西苗医苗药属于高风险医学边界题材，必须经过医疗伦理和专业审稿。

## 4. 下一步

下一轮进入微纪录片黄金卡 10 条：

1. 每条补齐现实入口、核心问题、来源结构、访谈角色、B-roll、再现边界和不可声称事项。
2. 抽 2 条做微纪录分镜与质量报告回归。
3. 继续保持候选生产卡与省份底库分离，审稿通过后再进入人工写回队列。
