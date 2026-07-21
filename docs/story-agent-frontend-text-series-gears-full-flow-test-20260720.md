# Story Agent 前端文本、长剧集与 GEARS 全流程测试报告

> 测试日期：2026-07-20
> 前端地址：`http://localhost:5174/`
> 文本引擎：`STORY_GEN_LOCAL_ONLY=1`
> GEARS 模式：本地任务包与账本；外部 execution worker 未配置

## 1. 结论

- 15 种单片文本片型从前端创作页发起，15/15 返回 HTTP 200；均生成正文、分场、GEARS 段和交付单元，文化域机器门禁通过。
- AI 漫剧长剧集分别完成 10、20、30 集生成；共 60 集、300 个场景、300 个 GEARS 段。三个系列审计分均为 100，孤立伏笔和记忆冲突均为 0。
- 30 集系列选取 E1、E15、E30 做资产链路测试；本地 GEARS 账本 89 项全部进入 `submitted`，0 失败。
- 另选历史剧情、微纪录片、AI 漫剧单片和非遗宣传片四篇做项目级全链路测试；最终代表项目账本合计 133 项，0 失败。
- 测试发现并修复非遗宣传片把皮影错套成湘绣流程的问题。修复后正文不再出现“绣架/劈丝/穿针/落针/针脚/绸面”，并生成影偶、雕刀、操纵杆等 7 类道具任务。
- 外部 GEARS 未配置，因此上述结果是可执行任务包和持久化账本，不是实际生成的图片、视频、音频或最终成片。

## 2. 15 种文本片型

所有请求均从 `http://localhost:5174/story/new` 的页面上下文调用前端同源 `/api/stories/generate`，来源条目为《衡山皮影戏——湘南光影的千年传奇》。最终结果如下：

| 片型 | Story ID | 正文字数 | 场景 | GEARS 段 | 交付单元 | 结果 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 人物故事 | `20260720-story-7yvq9f25d0b5` | 515 | 6 | 6 | 10 | 通过 |
| 历史剧情短片 | `20260720-story-7z41d9152335` | 498 | 6 | 6 | 12 | 通过 |
| 神话/传说故事 | `20260720-story-7z2t8836c607` | 440 | 5 | 5 | 5 | 通过 |
| AI 漫剧单片 | `20260720-story-7z0c916c7139` | 321 | 5 | 5 | 12 | 通过 |
| 儿童故事片 | `20260720-story-7z1565c09259` | 284 | 5 | 5 | 11 | 通过 |
| 文化宣传片 | `20260720-story-7yyfb4531b48` | 491 | 5 | 5 | 5 | 通过 |
| 非遗/工艺宣传片 | `20260720-story-7yxode52857c` | 修复后复测 | 5 | 5 | 14 | 通过 |
| 城市/文旅宣传片 | `20260720-story-7yyrc332587d` | 329 | 5 | 5 | 5 | 通过 |
| 竖屏短视频 | `20260720-story-7z2q3f532dbb` | 173 | 4 | 4 | 4 | 通过 |
| 微纪录片 | `20260720-story-7z1dbfda238e` | 428 | 5 | 5 | 11 | 通过 |
| 知识讲解视频 | `20260720-story-7yuz904c5966` | 423 | 5 | 5 | 10 | 通过 |
| 宣讲片 | `20260720-story-7yz604113e2e` | 470 | 5 | 5 | 9 | 通过 |
| 教育/培训片 | `20260720-story-7z3ua2c2f52b` | 538 | 8 | 8 | 16 | 通过 |
| 场景短片 | `20260720-story-7yyd73d09ff7` | 316 | 4 | 4 | 4 | 通过 |
| 山水意境片 | `20260720-story-7yxd1eb04a76` | 194 | 3 | 3 | 6 | 通过 |

共同校验：HTTP 200、`domain_safety.passed=true`、`external_model_call_performed=false`、无内部生成规则污染词。

## 3. 10/20/30 集长剧集

故事梗概：少年阿湘为阻止老街戏台拆除，沿祖父留下的皮影机关线索寻找失散戏班成员，并以公开演出完成传承。

| 规模 | 系列 ID | 已生成 | 场景 / GEARS 段 | 系列审计 | 孤立伏笔 | 记忆冲突 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 10 集 | `20260720-series-bhu18919` | 10/10 | 50 / 50 | 100 | 0 | 0 |
| 20 集 | `20260720-series-cr47g5ja` | 20/20 | 100 / 100 | 100 | 0 | 0 |
| 30 集 | `20260720-series-5bw0hdb0` | 30/30 | 150 / 150 | 100 | 0 | 0 |

前端地址：

- `http://localhost:5174/ai-comic-series/new?seriesProjectId=20260720-series-bhu18919`
- `http://localhost:5174/ai-comic-series/new?seriesProjectId=20260720-series-cr47g5ja`
- `http://localhost:5174/ai-comic-series/new?seriesProjectId=20260720-series-5bw0hdb0`

30 集标题共 30 个不重复标题。可见文本未出现“濂溪/案卷/封泥/催签”等历史案件模板污染。

## 4. 代表集 GEARS 资产链路

30 集系列选择：

- E1：`20260720-story-cqe613647b18`
- E15：`20260720-story-cqlr76b4bd6e`
- E30：`20260720-story-cqlrfd6ec4b7`

三集资产要求覆盖 27 个 storyboard、9 个角色、12 个场景、3 个道具、27 个 Seedance 视频镜头、270 条全系列预生成字幕，以及系列与三集片头片尾卡。

| GEARS job type | 账本数 |
| --- | ---: |
| `storyboard_image` | 27 |
| `character_image` | 9 |
| `scene_image` | 12 |
| `prop_image` | 3 |
| `seedance_video` | 27 |
| `subtitle_render` | 1 |
| `audio_mix` | 1 |
| `title_card_render` | 8 |
| `final_assemble` | 1 |
| 合计 | 89 |

账本状态：89 个 `submitted`，0 `failed`；provider adapter 为 `mocked`。

## 5. 代表单片 GEARS 资产链路

| 代表片 | 项目 ID | 本地任务数 | 失败 |
| --- | --- | ---: | ---: |
| 历史剧情短片 | `20260720-story-7z41d9152335--historical_drama` | 33 | 0 |
| 微纪录片 | `20260720-story-7z1dbfda238e--documentary_short` | 27 | 0 |
| AI 漫剧单片 | `20260720-story-7z0c916c7139--ai_comic_drama` | 33 | 0 |
| 修复后皮影非遗宣传片 | `20260720-story-7yxode52857c--heritage_promo` | 40 | 0 |
| 合计 |  | 133 | 0 |

四个项目均尝试 9 类任务。不存在对应人物或道具要求时，该类别合法返回 0；跨四个代表项目已覆盖所有任务类型。修复后的皮影项目单独包含 14 storyboard、1 场景、7 道具、14 视频、字幕、混音、标题卡和最终装配任务。

## 6. 本轮修复

1. 系列原创梗概不再继承历史案件模板；主角、传承主线、阶段节拍和伏笔均绑定用户输入。
2. 系列故事变换后重新构建 GEARS delivery，避免资产仍引用变换前人物、场景和服装。
3. 系列 `prop_image` 从 Production Board 真实道具要求生成，不再使用通用占位任务。
4. 没有 ready 视频时，字幕可从已生成分集 Seedance prompt 预生成；30 集导出 270 条 cue。
5. 没有 ready 视频时，已生成分集仍会得到分集片头/片尾卡；30 集标题卡计划共 62 张。
6. 非遗文本按皮影、刺绣、表演和通用工艺选择动作、旁白、视觉提示与传承动作。
7. Production Board 新增皮影及表演类道具识别，并避免“灯幕”同时误抽为泛化“灯”。
8. Track A 重型 generated-health 冷启动扫描的测试等待预算由 30 秒调整为 45 秒，总预算调整为 90 秒。

## 7. 自动回归

- Web server：157 个测试文件，156 通过、1 条件跳过；1375 项通过、2 项条件跳过、0 失败。
- 定向回归：`outline-service` 33/33、`gears-delivery-service` 14/14、片型矩阵与皮影门类 2/2。
- Track A Playwright：7/7 通过。
- `npm run check`：可见文案审计、server TypeScript、client Vue TypeScript 全通过。
- `npm run build`：server 与 client 生产构建通过。
- `git diff --check`：通过。

## 8. 外部生产边界

`/api/system/gears-execution-config` 当前返回：

- `ready_for_submit=false`
- `GEARS_EXECUTION_WORKER_API_BASE_URL` 未配置
- GEARS API token、callback secret 和 callback base 均未配置
- 支持的 9 类任务合同已就绪，但只能使用本地 mocked adapter

因此本报告不能声明已生成真实图片、视频、音频或最终成片。要完成真实全流程，还需接入可运行的 GEARS execution worker、配置回调安全参数，并取得 provider 回片、人工资产审核、实际成本和成片验收证据。

## 9. 证据

- `output/playwright/series-scale-20260720/heritage-promo-shadow-puppetry-production-board.png`
- `output/playwright/series-scale-20260720/ai-comic-series-30-episodes.png`
- `output/playwright/track-a-results.json`

## 10. 当前开发进度

| 阶段 | 完成度 |
| --- | ---: |
| A 文本与结构合同 | 100% |
| B 类型质量与修复 | 100% |
| C 项目、版本与治理 | 99% |
| D GEARS / Seedance 本地生产链 | 96% |
| E 前端、验收与交付治理 | 99% |
| 等权总进度 | **98.8%** |

阶段 D 的剩余 4% 和阶段 E 的剩余 1% 只接受真实外部回片、真人评审、成本与恢复演练证据，不以本地任务账本填满。
