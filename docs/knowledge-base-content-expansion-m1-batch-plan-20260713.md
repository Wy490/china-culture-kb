# 中国文化知识库 M1 全国最低覆盖执行清单（2026-07-13）

## 1. Phase 0 基线复核

基线命令：`cd mcp-server && npm run kb:production-audit`。

复核时间：2026-07-13（Asia/Shanghai）；审计产物时间戳为 2026-07-12T18:33:26.863Z。

| 指标 | 基线值 | M1 目标 |
|---|---:|---:|
| 省级文件 | 34 | 34 |
| 正式条目 | 169 | 192 |
| 有正式条目的地区 | 31 / 34 | 34 / 34 |
| 达到至少 2 条的地区 | 14 / 34 | 34 / 34 |
| 零条目地区 | 香港、澳门、台湾 | 0 |
| 仅 1 条地区 | 17 | 0 |
| 湖南条目与占比 | 124 / 73.4% | 本阶段不新增湖南条目 |
| 来源 | 596 | 随正式条目增加；新条目每条不少于 3 个来源 |

口径说明：候选标题、来源计划、机器元数据、机器评分、fixture、simulation、fallback、prepared、未审稿草案、黄金卡候选和故事生成结果均不计入正式内容或人工通过。正式条目与“黄金卡”“真实人工审稿通过”是不同状态，不能相互替代。

## 2. 去重方法与结果

1. 以 `knowledge-base-production-audit.json` 的 169 条 `province + name + type` 作为精确去重基线。
2. 对候选的核心资产、别名、跨地区流布范围做语义复核，避免只换标题重复已有条目。
3. 三个零条目文件当前没有已整理条目；17 个单条地区的现有条目均为革命史、历史事件或纪念空间，本轮候选优先补工艺、民俗、饮食、戏曲与当代传承。
4. 23 个候选与现有 169 个标题无精确重复；跨地区共享项目在正式研究时必须限定本地传承范围，不能把多地版本合并成一个地区的独占事实。

## 3. M1 去重候选、内容组与片型映射

状态枚举：`batch_1_complete` 表示本轮已完成联网核验、正式写入和机器检查；`planned` 只表示确定性候选，不计正式内容。`batch_1_complete` 不等于黄金卡或真实人工审稿通过。

| 顺序 | 地区 | 原子候选 | 内容组 | 推荐 VideoType | 去重/边界提示 | 状态 |
|---:|---|---|---|---|---|---|
| 1 | 香港 | 中秋节——大坑舞火龙 | 民俗、节庆与地方生活 | `heritage_promo`、`documentary_short`、`social_short` | 只写大坑社区版本；起源为相传 | batch_1_complete |
| 2 | 香港 | 港式奶茶制作技艺 | 饮食、器物与日常技艺 | `explainer_video`、`social_short`、`education_training` | 不等同整个茶餐厅文化；起源版本待核 | batch_1_complete |
| 3 | 澳门 | 鱼行醉龙节 | 民俗、节庆与地方生活 | `heritage_promo`、`documentary_short`、`social_short` | 限澳门鲜鱼行传统；源流与神异故事分层 | batch_1_complete |
| 4 | 澳门 | 土生葡人美食烹饪技艺 | 饮食、器物与日常技艺 | `explainer_video`、`documentary_short`、`education_training` | 写技艺系统，不把单一菜谱当唯一标准 | batch_1_complete |
| 5 | 台湾 | 大溪木艺 | 非遗、工艺、地方产业 | `heritage_promo`、`documentary_short`、`education_training` | 限大溪木器产业链，不等同全台湾木雕 | batch_1_complete |
| 6 | 台湾 | 歌仔戏 | 非遗、工艺、地方戏曲 | `heritage_promo`、`documentary_short`、`ai_comic_drama` | 区分历史形成、剧种规范和当代表演 | planned |
| 7 | 重庆 | 川江号子 | 非遗、工艺、地域声音 | `heritage_promo`、`documentary_short`、`education_training` | 限川江船工劳动号子，不泛化全部号子 | planned |
| 8 | 福建 | 泉州提线木偶戏 | 非遗、工艺、地方戏曲 | `heritage_promo`、`documentary_short`、`ai_comic_drama` | 单独写提线木偶，不并入全部木偶戏 | planned |
| 9 | 广西 | 壮族织锦技艺 | 非遗、工艺、地方生活 | `heritage_promo`、`explainer_video`、`education_training` | 区分区域纹样和传承人口述 | planned |
| 10 | 海南 | 黎族传统纺染织绣技艺 | 非遗、工艺、地方生活 | `heritage_promo`、`documentary_short`、`education_training` | 社区、纹样、传承人和作品使用需授权 | planned |
| 11 | 河南 | 钧瓷烧制技艺 | 非遗、工艺、器物 | `heritage_promo`、`explainer_video`、`education_training` | 限钧瓷工艺；窑变不作神秘化断言 | planned |
| 12 | 黑龙江 | 赫哲族伊玛堪 | 传说、文学与民间故事；地域声音 | `documentary_short`、`children_story`、`ai_comic_drama` | 口头传统不等同历史实录；社区授权优先 | planned |
| 13 | 湖北 | 汉绣 | 非遗、工艺、地方生活 | `heritage_promo`、`explainer_video`、`education_training` | 纹样寓意逐项找出处，不机器推断 | planned |
| 14 | 吉林 | 朝鲜族农乐舞 | 非遗、工艺、节庆生活 | `heritage_promo`、`documentary_short`、`social_short` | 限中国朝鲜族传承语境；表演拍摄需授权 | planned |
| 15 | 内蒙古 | 蒙古族长调民歌 | 非遗、工艺、地域声音 | `heritage_promo`、`documentary_short`、`education_training` | 跨地域传统需标版本；歌词和录音有版权 | planned |
| 16 | 宁夏 | 贺兰砚制作技艺 | 非遗、工艺、器物 | `heritage_promo`、`explainer_video`、`education_training` | 区分石材地质事实、工艺和市场称谓 | planned |
| 17 | 青海 | 热贡艺术 | 非遗、工艺、公共文化 | `heritage_promo`、`documentary_short`、`explainer_video` | 原子写艺术传统；宗教图像与仪式需授权 | planned |
| 18 | 上海 | 海派旗袍制作技艺 | 非遗、工艺、城市生活 | `heritage_promo`、`documentary_short`、`education_training` | 不把“海派”写成单一起源或固定样式 | planned |
| 19 | 四川 | 蜀锦织造技艺 | 非遗、工艺、地方生活 | `heritage_promo`、`explainer_video`、`education_training` | 区分蜀锦、蜀绣和现代文创 | planned |
| 20 | 天津 | 杨柳青木版年画 | 非遗、工艺、地方生活 | `heritage_promo`、`explainer_video`、`children_story` | 区分传统套印、彩绘和现代复制品 | planned |
| 21 | 西藏 | 藏戏 | 非遗、工艺、地方戏曲 | `heritage_promo`、`documentary_short`、`ai_comic_drama` | 仪式、流派、唱腔和面具寓意逐项核验 | planned |
| 22 | 新疆 | 维吾尔木卡姆艺术 | 非遗、工艺、地域声音 | `heritage_promo`、`documentary_short`、`education_training` | 区分十二木卡姆与各地木卡姆版本 | planned |
| 23 | 浙江 | 龙泉青瓷传统烧制技艺 | 非遗、工艺、器物 | `heritage_promo`、`explainer_video`、`education_training` | 区分历史窑址、现代技艺和商业产品 | planned |

候选结构检查：23 条中 22 条属于民俗、饮食、工艺、戏曲、文学口传、地域声音或当代传承；23 条均有现实地点、流程或可见动作方向，满足 M1 对结构性缺口的优先要求。

## 4. 来源搜集计划

### 4.1 每条最低证据包

- B 级或以上：国家/地区非遗名录、文化资产数据库、博物馆/文保机构、地方志或正式法规，至少 1 项。
- 独立交叉来源：大学、学术出版物、国家级专业机构、地方研究机构或另一独立公共文化机构，至少 1 个不同来源主体。
- 第三来源：用于核对工序、现实场所、当代传承、版本差异或授权边界。
- 每个关键事实用 `F编号 → [S编号]` 绑定；来源列表不替代 claim 绑定。
- 来源只保留短定位说明和 URL，不复制长篇受版权保护文本。

### 4.2 首批 5 条已定位来源主体

| 条目 | B 级来源 | 独立交叉来源 | 重点待核 |
|---|---|---|---|
| 大坑舞火龙 | 香港非遗办、国家非遗数字博物馆 | 香港大学中国文化研究院资料 | 1880 年起源故事、当代路线与器材数量、拍摄安全 |
| 港式奶茶制作技艺 | 香港非遗办、香港政府新闻处/香港邮政 | 岭南大学研究专刊 | 起源版本、茶叶配方差异、店家秘方与商标 |
| 鱼行醉龙节 | 国家非遗数字博物馆、澳门博物馆/文化局 | 华东师范大学民俗学田野研究 | 与香山旧俗的连续性、当年路线、参与和影像授权 |
| 土生葡人美食烹饪技艺 | 国家非遗数字博物馆、澳门文化局 | 香港大学出版社学术专著、Goldsmiths 研究 | 菜谱家庭差异、菜名发明人、社群身份与配方权利 |
| 大溪木艺 | 大溪木艺生态博物馆 | 客家委员会研究、台湾工艺研究发展中心 | 精确起点、匠师谱系、木材来源、作品与宗教图像授权 |

### 4.3 后续批次来源路由

- 国家级/联合国非遗项目：先查国家非遗数字博物馆、UNESCO 名录和项目保护单位，再查地方非遗中心与学术研究。
- 传统工艺：补材料、工具、工序、手部动作、危险操作和商业秘密边界。
- 戏曲与口头传统：补代表剧目/曲目版本、唱腔或表演结构、当代传承主体、文本与录音版权。
- 民族、宗教与社区内容：把社区授权、仪式禁拍、现实传承人肖像和声音权列为强制待核项。
- 饮食：区分历史演变、家庭/店家版本和可公开工序，不写唯一正宗配方。

## 5. 批次顺序与退出门槛

| 批次 | 条目 | 批次目的 | 退出门槛 |
|---|---|---|---|
| 1（5 条） | 香港 2、澳门 2、台湾 1 | 启动全部零条目地区 | 5 条均 ≥3 来源、≥1 A/B、≥2 主体；lint、audit、去重复核通过 |
| 2（5 条） | 台湾 1、重庆、福建、广西、海南 | 使台湾达到 2 条并启动 4 个单条地区 | 同上；民族/社区授权边界单列 |
| 3（5 条） | 河南、黑龙江、湖北、吉林、内蒙古 | 补工艺、口传、地域声音 | 同上；传说/口述不得史实化 |
| 4（5 条） | 宁夏、青海、上海、四川、天津 | 补工艺、器物、城市生活 | 同上；宗教图像与作品权利单列 |
| 5（3 条） | 西藏、新疆、浙江 | 完成 M1 34/34 地区至少 2 条 | 全量 audit、固定检索、StoryBlueprint 边界回归；不写回生成故事 |

## 6. 本轮不计入项

- 本文 23 个候选不计正式条目。
- 后四批的来源路由不等于来源已核验。
- 生产评分和片型 readiness 只用于检查缺口，不等于人工审稿或黄金卡。
- 首批条目不会被标记为黄金卡、真实人工审稿通过或生产素材卡通过。
