# Story Agent 工作总结、市场能力审查与下一阶段全面开发计划

> 交接日期：2026-07-20
> 最后更新：2026-07-21
> 适用项目：`china-culture-kb` / Story Agent / AI 漫剧系列 / Production Board / GEARS / Seedance
> 当前分支：`codex/story-agent-manifest-integrity-20260718`
> 当前 HEAD：`4fadfb6b`
> 文档用途：作为新对话的唯一主交接文档；阶段 0–1 已于 2026-07-20 完成并计入 25%，阶段 2 已于 2026-07-21 取得绑定 E1/E10/E20 的真人盲评并正式封板，累计进度 45%。阶段 3 的稳定视觉身份图谱与结构化定义/人工审批两个工程切片已落地，但正式项目的完整视觉定义、批准和真实媒体资产仍为 0；新对话应从“阶段 3 系列视觉圣经与稳定资产图谱”继续。

## 1. 结论先行

Story Agent 的本地产品功能、结构合同、前端工作台、版本治理、Production Board、GEARS 任务合同和 Seedance 交付规划已经接近完成。按上一轮 A–E 等权口径，当前软件整改计划完成度为 **98.8%**。

但 **98.8% 不代表已经达到热门 AI 漫剧的商业成片水平**。历史真实前端失败样本与本轮修复后的证据共同表明，三个决定性缺口当前处于不同状态：

1. **用户设定忠实度硬门禁：已修复。** 20 集《皮影诡戏：守灯人》曾出现结构审计 100 分、核心人物和规则却被旧模板替换的问题；阶段 1 已用独立 premise contract、fidelity audit v2 和前端证据面板封住该路径。
2. **商业质量不能由结构分代替：阶段 2 的机器层与首轮真人盲评已经闭环。** 真人 reviewer `a001` 已对候选 `候选-21097EAA` 的钩子、人物、对白、推进、反转、结尾、文化可信度七维分别给出 4/5，整体平均与最低维度均为 4，结果绑定当前内容指纹及 E1/E10/E20 story ID，阶段 2 已通过并计入 20%。这仍是单一 reviewer 样本，不能外推为全市场或多角色评审结论。
3. **真实媒体执行尚未闭环：未解决。** Production Board、图片任务、资产库、回调和审核合同已经存在，但当前测试只生成 SVG placeholder 和 mocked GEARS 账本；真实图片、视频、音频和最终成片均为 0 个经过验证的外部回片。

因此下一阶段不再以“继续补本地字段或继续拆文件”作为主线，而以以下结果为主线：

- 用户锁定的角色、规则、主冲突和文化边界在 10/20/30 集中不丢失、不替换；
- 每集钩子、冲突、反转、结尾追问有明确证据，跨集模板重复受到硬限制；
- 系列角色、场景、道具形成稳定的视觉资产图谱；
- E1/E10/E20 先取得真实 GEARS 图片回片并通过人工审核，再扩大到视频、音频与成片；
- 最后使用合法、可复核的市场评审表进行盲评，而不是凭结构分宣称“达到爆款水平”。

## 2. 两套进度必须分开报告

### 2.1 已有软件整改计划

| 阶段 | 当前完成度 | 说明 |
| --- | ---: | --- |
| A 文本与结构合同 | 100% | StoryBlueprint、正文、分场、GEARS 段、类型合同已具备 |
| B 类型质量与修复 | 100% | 15 片型机器门禁、定向修复与专业质量服务已具备 |
| C 项目、版本与治理 | 99% | 项目版本、派生状态、资产历史与导出治理已具备 |
| D GEARS / Seedance 本地生产链 | 96% | 任务、账本、回调与交付规划已具备，真实回片未完成 |
| E 前端、验收与交付治理 | 99% | 前端工作流和本地验收已具备，真人/成本/恢复证据未完成 |
| 等权总进度 | **98.8%** | 软件整改计划口径，不等于商业成片成熟度 |

### 2.2 下一阶段“市场级内容与真实媒体”计划

本文建立一套新的 100% 计划，建立时起点为 **0%**；阶段 0–2 完成后的当前进度为 **45%**。以后每轮开发必须同时汇报：

- 软件整改总进度：当前 98.8%，只有真实外部证据才能补足剩余部分；
- 下一阶段计划进度：当前 45%，按本文阶段权重累计；
- 本轮新增证据：代码、测试、真实回片、人工审核、费用或恢复演练；
- 未解决阻塞：尤其是阶段 3 的视觉定义与真人视觉审核，以及后续 Provider 配置、费用授权和版权来源。

当前能力估计只用于确定优先级，不作为验收结论：

| 能力 | 当前估计 | 主要证据与限制 |
| --- | ---: | --- |
| 产品/工作流实现 | 98.8% | 本地功能和自动回归较完整 |
| 文本结构能力 | 75%–85% | 10/20/30 集结构完整，但会发生设定漂移 |
| 商业文本质量 | 70%–80% | 机器合同、差异化门禁与定向修复已完成；首位真人 reviewer 七维均为 4/5，但单一样本仍不能代表编剧、导演与文化评审全覆盖 |
| 图片资产规划 | 70%–80% | 资产要求、任务、绑定、审核合同已具备 |
| 真实图片产出 | 0% 已验证 | 当前只有 SVG placeholder，没有真实 Provider 回片 |
| 真实视频/音频/成片 | 0% 已验证 | 当前为 mocked 任务和本地计划 |

不得把上述区间求平均后宣称“已达到市场水平”。只要真实媒体仍为 0%，就必须显式报告。

## 3. 已完成工作总结

### 3.1 Story Agent 主链路

已建立并验证以下生成与治理链：

```text
用户素材 / 知识库条目
  → StoryBlueprint
  → full_text
  → scene_breakdown
  → gears_segments / delivery units
  → 类型质量门禁与修复
  → 项目版本与派生状态重建
  → Production Board
  → GEARS / Seedance 任务与交付包
```

主要能力包括：

- 15 种视频片型的统一请求、类型化输出和 `GenreStoryProfile` 行为；
- 中国文化题材的事实、口述、传说与戏剧化边界；
- StoryBlueprint、角色弧、场景、对白、视觉提示、镜头建议和分段提示；
- 质量报告、类型质量证据、修复建议、自动修复和修复后版本；
- Web 与 MCP 的 canonical 生成、引擎透明性和本地/外部模型边界；
- 项目保存、版本仓储、派生状态重建和 revision safety；
- 系列规划、逐集生成、连续性账本、系列记忆、伏笔回收和系列导出；
- Production Board 的人物、服装、场景、道具、镜头、媒体资产和 shot ledger；
- Seedance prompt、参考素材槽、媒体资产库、跨项目复用、上传、审核、历史与交付导出；
- GEARS 九类任务合同、任务提交/同步、callback、重试、状态恢复和本地验收；
- 字幕、音频、标题卡、剪辑包和最终装配的规划/执行边界。

### 3.2 已修复的重要问题

- 质量通过与生产就绪状态不再共用同一个含糊 `passed`；
- 镜头数量、镜头 ID 和交付单元的语义逐步统一；
- 修复动作不能在没有改善时静默标记成功；
- 场景重生成会重建相关派生状态；
- Web/MCP 写边界、revision source 和项目版本更新更安全；
- 用户原创 AI 漫剧不再强制要求静态知识库 primary entry；
- GEARS 图片回片、媒体身份、授权、人工审核和生产信用采用 fail-closed 合同；
- 本地 SVG placeholder 明确不计作真实图片和生产信用；
- 皮影非遗文本不再错误套用湘绣“绣架/劈丝/针脚”模板；
- Production Board 可识别皮影影偶、雕刀、操纵杆、唱本、灯幕、牛皮和颜料等道具；
- 无 ready 视频时可预生成字幕和标题卡计划；
- 生产看板、导出包、重试包和回调 handoff 已形成独立服务边界。
- 用户锁定的人物、规则、对抗力量、核心代价和文化边界已进入独立 premise contract 与 fidelity audit v2；
- AI 漫剧每集已具备独立商业节拍合同，跨集 exact/对白骨架/功能序列/钩子与标志组合重复由独立 diversity report 审计；
- 商业质量修复仅改失败的 `commercial_beats`，无改善或破坏 premise fidelity 时不得标记成功。
- 商业盲评材料已拆为 reviewer 可见的匿名 markdown、结构化回执 JSON 与仅供操作者保存的内部映射 manifest；评分必须回传候选编号和 reviewer 包 SHA-256，避免手抄、串包、改稿后沿用或暴露机器分与来源。

### 3.3 自动测试基线

截至阶段 2 工程切片完成后的最新记录为：

- Web server：159 个测试文件执行，158 个通过、1 个条件跳过；1386 项通过、2 项条件跳过、0 失败；
- premise contract 与 commercial quality 定向回归合计 9/9 通过；商业修复 API 1/1；匿名包导出与绑定提交 API 合跑 2/2；
- Track A Playwright：7/7 为此前已记录基线；本轮继续使用 Codex 内置浏览器对真实 Studio 页面完成补充目视冒烟，验证未生成代表集时匿名包/评分入口隐藏、代表集齐备后回执 JSON 可校验预填且不会自动提交，无效声明会阻断保存，浏览器控制台无页面 error；
- `npm run check`：可见文案审计、server TypeScript、client Vue TypeScript 全通过；
- 完整 Web server/client 生产构建通过；
- `git diff --check` 通过；
- MCP 未在最近切片修改，沿用此前 89 个测试文件、483 项通过的已记录基线，不能误报为本轮重跑。

除明确标记为历史基线的 Track A Playwright 与 MCP 外，其余结果均为阶段 0–2 当前工作区实跑。新对话仍须以当时工作区重新运行的结果为准。

## 4. 前端全流程实测证据

### 4.1 15 种文本片型

通过前端同源请求生成 15 种单片：15/15 HTTP 200，全部包含正文、分场、GEARS 段和交付单元，文化域机器门禁通过。测试运行于 `STORY_GEN_LOCAL_ONLY=1`，外部文本模型调用为 0。

完整项目 ID、字数和任务数据见：

- `docs/story-agent-frontend-text-series-gears-full-flow-test-20260720.md`

这证明 15 片型的结构覆盖，不证明 15 片型均已达到专业成稿水平。

### 4.2 10/20/30 集系列压力测试

| 规模 | 系列 ID | 已生成 | 场景 / GEARS 段 | 结构审计 |
| ---: | --- | ---: | ---: | ---: |
| 10 集 | `20260720-series-bhu18919` | 10/10 | 50 / 50 | 100 |
| 20 集 | `20260720-series-cr47g5ja` | 20/20 | 100 / 100 | 100 |
| 30 集 | `20260720-series-5bw0hdb0` | 30/30 | 150 / 150 | 100 |

30 集系列的 E1/E15/E30：

- E1：`20260720-story-cqe613647b18`
- E15：`20260720-story-cqlr76b4bd6e`
- E30：`20260720-story-cqlrfd6ec4b7`

三个代表集共建立 89 项本地 GEARS 账本，全部为 mocked submitted、0 失败：

- storyboard 27；
- 角色图 9；
- 场景图 12；
- 道具图 3；
- Seedance 视频 27；
- 字幕 1（270 条 cue）；
- 音频混合 1；
- 标题卡 8；
- 最终装配 1。

另选历史剧情、微纪录片、AI 漫剧单片和皮影非遗宣传片四个项目，建立 133 项本地任务，0 失败。以上均是本地任务包与账本，不是 Provider 实际回片。

### 4.3 市场导向 20 集测试：历史关键失败样本（阶段 1 已修复）

测试系列：**《皮影诡戏：守灯人》**
系列 ID：`20260720-series-t5nmqjtt`

用户输入的核心要求包括：

- 当代非遗悬疑；
- 明确人物“沈砚”“林灯”；
- 午夜皮影戏与二十条规则；
- 违反规则会被抹去记忆；
- 开发商与盗谱者构成对抗力量；
- 强钩子、强反转、强结尾追问；
- 文化事实与原创悬疑机制必须保持边界。

结构结果：20/20 集生成，100 个场景，结构审计 100/100，3/3 线索回收，0 个账本记忆冲突。

内容结果却不合格：

- “林灯”在生成正文中出现 0 次；
- “记忆被抹去”核心规则出现 0 次；
- “沈砚”只在极少位置出现，主体人物被“少女”“阿湘”等通用人物替换；
- 页面生成内容中“少女”约 182 次、“阿湘”约 48 次、“拆迁”约 96 次；
- 故事退化为旧戏台拆迁与修复模板；
- E1/E10/E20 的首段钩子、对白和场景组织高度相似；
- 角色描述存在“少女”却写成“少年”、人物代词混乱等身份一致性问题。

代表项目：

- E1：`20260720-story-a3if04edcf1c`
- E10：`20260720-story-a3idbdd971dc`
- E20：`20260720-story-a3j3719bed7d`

E1 前端详情路由（仅在本地服务仍运行时有效）：

- `http://localhost:5174/projects/20260720-story-a3if04edcf1c--ai_comic_drama`

这个样本必须成为下一阶段固定失败 fixture。未来任何实现只有在保留核心人物、世界规则和对抗机制的同时解决跨集重复，才算修复。

### 4.4 Production Board 和安全自动化实测

E1 初始 Production Readiness 为 32/100。通过前端操作：

1. 点击“草拟生产字段”，生产素材从 97 分 `needs_input` 变为 100 分 `ready`；
2. 运行“安全自动化”，执行 4 项、跳过 2 项、失败 0 项；
3. 项目从 v1 更新到 v2；
4. 总 readiness 由 35 提升到 38；
5. 生成 8 个 SVG placeholder，但正式生产信用仍为 0/8。

自动化后主要状态：

- Story Agent 83；
- Production Board 68；
- Delivery Contract 31；
- Shot Ledger 0；
- GEARS Execution 0；
- 3 个人物、3 套服装、4 个地点、2 个道具、9 个镜头；
- 9 个媒体资产要求、9 个图片任务计划、3 条 shot ledger；
- Production Board QA：`passed=false`，0 分，13 个问题；
- 4 个镜头缺少连续性提示；
- 8/8 媒体资产均非 production eligible。

这证明系统会安全地区分占位草案和真实生产资产，也证明当前仍未得到可用于成片的真实图片。

### 4.5 当前 GEARS 配置边界

当前能力探测返回：

- provider：`gears`；
- `ready_for_submit=false`；
- API base、token、callback base、callback secret 均未配置；
- 缺少 `GEARS_EXECUTION_WORKER_API_BASE_URL`；
- Workbench API/token 同样未配置；
- 九类任务合同已注册：storyboard、character、scene、prop、video、subtitle、audio、title card、final assemble。

所以不能声明真实图片、真实视频、真实音频或最终成片已经生成。

## 5. 市场对标结论（截至 2026-07-20）

市场信息只用于定义质量门槛，不用于模仿或复制受版权保护的角色、画面和剧情。

### 5.1 可确认的市场信号

- 红果 2026 年 7 月第二周榜单报道显示，AI 漫剧在头部榜单占比已经很高，《万妖图录传第八季》等多季 IP 形成持续追看；报道来源：[澎湃新闻](https://www.thepaper.cn/newsDetail_forward_33585816)。
- 2026 年 6 月 DataEye 榜单报道显示，头部 AI 漫剧以 3D 和 AI 真人风格为主，多季续作明显；来源：[澎湃新闻移动端](https://m.thepaper.cn/newsDetail_forward_33531893)。
- 暑期片单继续强化多季 IP 化，包括《万妖图录传》后续季等；来源：[新浪娱乐](https://ent.sina.cn/2026-07-15/detail-inihvqcq4952992.d.html)。
- Bilibili 可见长合集和多季连载形态，例如《一门双至尊》1–3 季一小时以上合集：[Bilibili 页面](https://www.bilibili.com/video/BV1AVjT6vErp/)；原创 AI 音视频作品《永生世界》也取得百万级播放：[Bilibili 页面](https://www.bilibili.com/video/BV19iLv6bEKh/)。
- 行业报道指出，接近真人的角色、动态运镜、分镜、光影和粒子特效已成为可见竞争项，但口型、动作和一致性仍是行业问题；来源：[新华网](https://www.news.cn/ent/20260129/b16bd6a58df8496e968588fcbc319e7d/c.html)。
- 实际生产依然是“脚本 → 分镜 → 文生图 → 图生视频 → 剪辑”的多岗位协作，而不是一次提示词生成完整成片；来源：[湖南日报·新湖南](https://m.voc.com.cn/xhn/news/202601/31411599.html)。

红果实时榜单并没有通过可直接访问的官方网页复核，本文采用平台榜单截图报道和 DataEye 报道作为方向性证据，不能声称是实时官方榜单。

### 5.2 与市场能力的当前比较

| 维度 | 当前项目 | 热门作品可见要求 | 判断 |
| --- | --- | --- | --- |
| 长系列结构 | 可生成 10/20/30 集并维护账本 | 多季、长合集、持续追看 | 基础具备 |
| 用户设定忠实度 | 会发生角色/规则被模板替换 | IP 角色和核心机制必须稳定 | P0 不合格 |
| 单集钩子与反转 | 有结构字段，但文本重复 | 高频强钩子、强冲突、强结尾 | 需重做质量门禁 |
| 跨集差异化 | E1/E10/E20 首段高度相似 | 每集有新信息、新代价、新视觉 | P0 不合格 |
| 视觉资产规划 | 角色/场景/道具/镜头合同完整 | 稳定角色、构图、光影、特效 | 规划较强 |
| 真实图片 | 仅 SVG placeholder | 可用的角色、场景和分镜图 | 尚未验证 |
| 动态与口型 | 只有 Seedance/GEARS 计划 | 动态镜头、动作、口型一致 | 尚未验证 |
| 成片与运营 | 有字幕/音频/标题卡/装配合同 | 可发布成片、封面、节奏和留存 | 尚未验证 |

结论：当前项目已经具备较强的 **AI 漫剧生产前置架构**，但还不具备以证据证明“文本层和图片资产层达到头部热门作品同等效果”的能力。

## 6. 下一阶段优先级

### 6.1 P0：不解决就不能进入真实批量生产

1. **系列设定忠实度与模板污染**
   用户锁定的人物、世界规则、冲突力量和核心代价必须进入机器可审计合同，不能被“少女/阿湘/拆迁”等旧模板替换。

2. **质量审计假阳性**
   结构审计、设定忠实度、商业文本质量和生产就绪必须分开。设定忠实度硬门禁失败时，总状态不能显示通过或 100 分。

3. **跨集模板重复**
   禁止相同首场、相同对白骨架、相同冲突推进和相同结尾问句在多集机械复用。

4. **系列角色与视觉身份不稳定**
   系列必须有稳定 character/location/prop ID、角色圣经、服装阶段、视觉签名和参考资产，分集不能重新发明泛化人物。

5. **真实图片执行为 0**
   必须接入实际 GEARS execution worker 或明确的兼容 Provider，取得真实文件、回调、费用和人工审核证据。

6. **真实模型与本地模板的能力边界不清**
   本地引擎只能证明离线可用性和结构合同；商业文本验收必须分别记录实际引擎、模型、fallback 和外部调用证据。

### 6.2 P1：完成 P0 后扩大到稳定成片

- 真实图片的人脸、服装、道具、地点和时代风格一致性检测；
- 镜头复杂度拆分、动作/视线/空间连续性和版本选择；
- Seedance 真实视频、口型、动作和运镜验收；
- 字幕、配音、音效、音乐、标题卡和最终装配；
- callback 安全、幂等、重试、超时恢复、可观测性和费用结算；
- 编剧、导演、文化事实和视觉四类真人评审；
- 10/20/30 集性能、恢复和批量成本测试。

### 6.3 P2：市场运营与长期 IP

- 红果、Bilibili、海外竖屏等平台 profile；
- 开篇 3 秒、首集完播、连续追看和结尾跳转的代理指标；
- 片名、封面、标题卡和梗概 A/B 测试；
- 多季续作的角色状态、世界规则、资产和伏笔继承；
- 合法素材来源、授权、审计与版权报告；
- 单集成本、失败率、返工率和生产吞吐看板。

## 7. 下一阶段总体路线与权重

| 阶段 | 名称 | 权重 | 预计工作量 | 外部阻塞 |
| --- | --- | ---: | ---: | --- |
| 0 | 交接、基线与失败复现 | 5% | 0.5–1 天 | 无 |
| 1 | Series Premise Contract 与忠实度硬门禁 | 20% | 2–4 天 | 无 |
| 2 | 商业文本质量与跨集差异化 | 20% | 3–5 天 | 真人盲评可后补 |
| 3 | 系列视觉圣经与稳定资产图谱 | 15% | 3–5 天 | 无，可先用规划/占位 |
| 4 | 真实 GEARS 图片执行闭环 | 15% | 3–7 天 | 需要 endpoint/token/callback/费用授权 |
| 5 | 真实视觉 QA 与连续性修复 | 10% | 3–5 天 | 依赖阶段 4 回片 |
| 6 | 视频、音频与最终成片 | 10% | 4–7 天 | 依赖 Provider 与费用授权 |
| 7 | 市场盲评与 10/20/30 集验收 | 3% | 2–4 天 | 需要真人评审 |
| 8 | 稳定性、成本、恢复与发布 | 2% | 2–4 天 | 需要真实运行数据 |
| 合计 |  | **100%** | **约 20–38 个工作日** | 外部配置会影响日历时间 |

进度只按每阶段 Definition of Done 计入，不按“写了多少代码”计入。阶段 4–8 不能用 mock、fixture 或 placeholder 替代真实证据。

## 8. 阶段 0：交接、基线与失败复现（5%）

### 目标

保护当前累计工作区，锁定现状，并把《皮影诡戏：守灯人》失败变成自动化回归。

### 实施项

1. 检查当前 branch、HEAD、dirty workspace 和已有用户改动；禁止 reset、checkout 或覆盖无关修改。
2. 读取本文、原全面审查和前端测试报告。
3. 在 `web/server/src/__tests__/` 增加固定 fixture：
   - 人物：沈砚、林灯；
   - 世界规则：午夜皮影戏、二十条规则、违反规则导致记忆抹除；
   - 对抗力量：开发商、盗谱者；
   - 文化边界：皮影事实与原创悬疑机制分开。
4. 先写失败测试，证明当前生成存在：角色缺失、核心规则缺失、通用人物替换和跨集首段重复。
5. 保存最小复现结果，不把本地临时服务状态当作永久证据。

### Definition of Done

- 失败测试在旧实现上稳定失败；
- 测试失败原因明确指向忠实度，而不是随机字数或快照；
- 当前既有定向测试没有被破坏；
- 交接文档记录最新 branch、HEAD 和测试结果。

## 9. 阶段 1：Series Premise Contract 与忠实度硬门禁（20%）

### 9.1 数据合同

新增 `SeriesPremiseContract`，建议采用独立 schema version，不静默改变 v1：

```ts
interface SeriesPremiseContract {
  schema_version: 'series-premise-contract/v1';
  locked_characters: Array<{
    name: string;
    role?: string;
    required: boolean;
    evidence_span: string;
  }>;
  world_rules: Array<{
    rule_id: string;
    statement: string;
    required: boolean;
    consequence?: string;
    evidence_span: string;
  }>;
  antagonistic_forces: Array<{
    label: string;
    function: string;
    required: boolean;
  }>;
  core_stakes: string[];
  must_cover_beats: string[];
  forbidden_substitutions: string[];
  cultural_boundaries: Array<{
    statement: string;
    truth_mode: 'verified_fact' | 'oral_tradition' | 'legend' | 'fictional_mechanism';
  }>;
}
```

规则：

- 自动抽取必须保留 `evidence_span`；
- 用户可在生成系列规划前编辑并锁定关键项；
- `required=true` 的项目不得被模型或本地模板替换；
- 抽取不确定时显示待确认，不能用通用人物补齐后假装成功；
- 知识库事实、传说和原创机制继续保持可区分的 truth mode。

### 9.2 生成链改造

- `generateAiComicSeriesPlan` 先建立 premise contract，再建立人物弧、线索、阶段和分集；
- `buildCharacterArcs` 必须以锁定人物为主，检测到的泛化人物只能作为未锁定辅助角色；
- `buildPlotThreads` 和 `buildEpisodes` 必须显式消费世界规则、代价和对抗力量；
- `generateAiComicEpisodeFromPlan` 必须把本集相关 contract anchors 放入 episode outline 和 blueprint；
- 删除或隔离固定“少女/阿湘/拆迁/戏台修复”分支，文化类型行为继续集中在 profile/策略层；
- 长系列不能仅靠 `text.includes(slice(0, 10))` 判定忠实度。

### 9.3 审计 v2

新增独立结果：

- `structural_audit`：集数、字段、账本、伏笔和连续性；
- `premise_fidelity_audit`：人物、规则、反派、代价、主题和禁止替换；
- `commercial_text_audit`：钩子、冲突、代价、反转、结尾和重复；
- `production_readiness`：素材、资产、任务、回片和审核。

建议 `series-quality-audit/v2` 至少包含：

- `named_character_coverage`；
- `world_rule_coverage`；
- `antagonistic_force_coverage`；
- `core_stakes_coverage`；
- `generic_substitution_issues`；
- `premise_coverage_score`；
- `hard_gate_passed`；
- 逐条证据和缺失项。

只要 required anchor 缺失或发生锁定人物替换，`hard_gate_passed=false`。结构审计 100 分不能覆盖这一失败。

### 9.4 主要代码入口

- `web/server/src/platform/types.ts`
- `web/server/src/services/ai-comic-series-service.ts`
- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/genre-story-profiles.ts`
- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/professional-ai-comic-drama-quality-service.ts`
- `web/server/src/repositories/series-project-repository.ts`
- `web/server/src/routes/outline.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`

建议新增独立模块，避免继续扩大超大 service：

- `ai-comic-series-premise-contract-service.ts`
- `ai-comic-series-fidelity-service.ts`
- 对应 characterization 和 regression tests。

### Definition of Done

- 《皮影诡戏：守灯人》计划和 E1/E10/E20 均保留“沈砚、林灯、午夜规则、记忆代价、开发商/盗谱者”；
- 生成正文不出现未由用户或计划引入的“少女/阿湘”核心人物替换；
- required anchor 覆盖率 100%，总 premise coverage ≥ 90；
- 删除任一核心人物或规则时，审计必须 fail；
- 前端能展示缺失证据和一键定位，不只显示抽象分数；
- 固定回归、相关 server tests、TypeScript check 和 build 通过。

## 10. 阶段 2：商业文本质量与跨集差异化（20%）

当前状态：**已完成并计入 20%，下一阶段计划累计 45%。** 机器门禁、差异化审计、定向修复、匿名盲评包、安全提交/持久化入口与前端证据展示均已落地；真人 reviewer `a001` 的七维评分均为 4/5，整体平均与最低维度均达到 4，且结果绑定候选、当前内容指纹及 E1/E10/E20 story ID。

### 目标

让“结构完整”升级为“单集可追看、跨集不机械、人物持续变化”。

### 实施项

1. 为 AI 漫剧分集显式建模：
   - 前 3 秒可视化钩子；
   - 本集目标；
   - 外部压力；
   - 失败代价；
   - 中段信息翻转；
   - 人物选择；
   - 可追踪状态变化；
   - 结尾悬念与下一集具体问题。
2. 将高概念悬疑、规则怪谈、成长、复仇、系统、修仙、女性成长等行为放入统一 profile/机制库，不散落硬编码。
3. 增加跨集去重：
   - 首场景标准化文本 exact hash；
   - 对白 n-gram 重复；
   - 场景功能序列重复；
   - 钩子类型连续重复；
   - 语义相似度或可解释的 token overlap；
   - 同一地点/人物/动作组合的连续使用上限。
4. 自动修复只改失败维度；如果修复后忠实度或多样性没有改善，不能标记成功。
5. 建立真人盲评表：钩子、人物、对白、推进、反转、结尾、文化可信度，每项 1–5 分。

### 验收阈值

- 20 集每集均有可定位的 hook/conflict/cost/turn/cliffhanger 证据；
- 不允许两个分集首场景 exact 相同；
- E1/E10/E20 首段不能复用同一对白骨架；
- 相邻集的高相似段落必须低于设定阈值，阈值由固定样本校准并写入测试；
- 人物状态每 1–3 集发生可追踪变化，不允许无条件回到初始状态；
- 真人盲评每个核心维度平均 ≥ 4/5，且无任一关键维度低于 3/5；
- 本地引擎和外部模型结果分开报告，不用 fallback 掩盖真实模型失败。

### 已实现模块

- `ai-comic-series-commercial-quality-service.ts`
- `ai-comic-series-diversity-service.ts`
- `ai-comic-series-commercial-profile.ts`
- `ai-comic-series-blind-review-service.ts`

匿名材料生成、去来源化、稳定哈希与内部映射已收敛在 blind review service；真人盲评归一化与阈值计算仍在 commercial quality service 内。若后续引入独立评审任务或签名，再拆分 `ai-comic-series-human-review-service.ts`。

## 11. 阶段 3：系列视觉圣经与稳定资产图谱（15%）

### 目标

让系列角色、服装、场景、道具和视觉规则成为跨集共享的源数据，而不是每集重新从文本猜测。

### 实施项

- 为系列建立稳定 `character_id`、`costume_id`、`location_id`、`prop_id`；
- 角色圣经记录：年龄区间、体态、脸部特征、发型、主服装、阶段服装、色彩、禁改项、性别/代词；
- 世界视觉圣经记录：时代、地域、建筑、光源、材质、文化事实和原创机制；
- 规则怪谈的每条规则映射为视觉符号、触发条件和后果；
- E1/E10/E20 的镜头引用同一 series asset identity；
- Production Board 优先绑定 series-level asset，不重复创建泛化人物；
- 图片 prompt 明确区分角色 identity、场景内容、动作、构图、镜头和负面约束；
- 输出资产复用报告、缺失报告和冲突报告。

### Definition of Done

- 沈砚、林灯在整个系列使用稳定 ID；
- 不存在“少女是少年”“人物代词变化”等 blocker；
- E1/E10/E20 的人物、核心地点和关键道具 100% 绑定 series asset；
- 生产看板不再创建未解释的通用替代人物；
- placeholder 仍可用于排版，但 production credit 始终为 0；
- 资产图谱导出、回读、复制和版本升级保持兼容。

### 主要代码入口

- `web/server/src/services/production-board-service.ts`
- `web/server/src/services/production-board-repair-service.ts`
- `web/server/src/services/seedance-asset-library-service.ts`
- `web/server/src/services/seedance-asset-reuse-service.ts`
- `web/server/src/services/seedance-asset-review-service.ts`
- `web/server/src/services/gears-delivery-service.ts`
- `web/client/src/views/ProjectDetail.vue`

## 12. 阶段 4：真实 GEARS 图片执行闭环（15%）

### 前置条件

需要用户或部署环境提供：

- `GEARS_EXECUTION_WORKER_API_BASE_URL`；
- API token；
- callback base URL；
- callback secret；
- 可调用的真实图片 Provider；
- 单次和总费用上限；
- 允许提交外部任务的明确授权。

凭据不得写入仓库、日志、截图或交接文档。没有这些条件时，阶段 4 只能做 capability preflight，不能伪造完成。

### 执行顺序

1. 能力探测与安全 preflight；
2. 只选择 E1/E10/E20 作为 pilot；
3. 先生成角色主参考图；
4. 再生成核心场景和道具；
5. 人工审核通过后再生成 storyboard；
6. 记录真实 job ID、模型、prompt hash、费用、耗时、文件 hash 和 callback；
7. 只有真实文件、授权状态和人工审核均通过时授予 production credit；
8. 验证幂等、超时、重试和重复 callback。

### Definition of Done

- capability preflight `ready_for_submit=true`；
- E1/E10/E20 所需角色、场景、道具和 storyboard 取得真实图片文件；
- 所有文件有可验证 MIME、字节数、SHA-256、provider identity 和审计历史；
- 0 个 SVG placeholder 被计作真实素材；
- 0 个重复 job，callback 重放不会重复入账；
- 费用和耗时可汇总；
- 真实图片经授权与人工视觉审核，production credit coverage 达到 100%。

## 13. 阶段 5：真实视觉 QA 与连续性修复（10%）

### 质量维度

- 人脸身份、年龄、性别、体态；
- 服装、配色和阶段变化；
- 道具形制、手持关系和左右手；
- 地点结构、时代风格和地域特征；
- 表情、构图、视觉焦点和镜头可读性；
- 皮影文化细节与原创悬疑机制的边界；
- 相邻镜头动作、视线、屏幕方向和光线连续性；
- 图片可达性、授权和人工审核。

### 修复闭环

```text
真实回片
  → 自动技术检查
  → 资产身份/连续性检查
  → 人工视觉与文化审核
  → 定向重生成或选择版本
  → 再审核
  → production eligible
```

### Definition of Done

- E1/E10/E20 代表镜头身份/服装/道具/地点一致性 ≥ 95%；
- 0 个 blocker 级文化或历史错误；
- Production Board QA ≥ 90；
- 0 个 unresolved continuity blocker；
- 复杂 prompt 超阈值时已拆镜头，不用一句超长 prompt 硬生成；
- 所有最终选中资产有 reviewer、review note 和时间戳。

## 14. 阶段 6：视频、音频与最终成片（10%）

### 执行顺序

1. 将已审核 storyboard 和参考资产转成时间分段 Seedance prompt；
2. E1 先做完整视频 pilot；
3. 检查动作、运镜、角色漂移、道具变形、口型和镜头衔接；
4. 完成配音、环境音、音乐、字幕和标题卡；
5. 完成最终装配和可回滚 release；
6. E1 通过后再做 E10/E20；
7. 三集通过后才扩大到完整 20 集。

### Definition of Done

- E1/E10/E20 均有真实可播放视频；
- 镜头 prompt 保持脚本、视觉、摄影、素材和 Provider 字段分层；
- 口型、动作和角色一致性达到人工评审阈值；
- 字幕时间轴、配音、音乐和标题卡可复核；
- final assemble 产物有文件 hash、费用、版本和回滚记录；
- 不能以 dry-run、任务 submitted 或 local acceptance 代替最终媒体文件。

## 15. 阶段 7：市场盲评与 10/20/30 集验收（3%）

### 文本验收

- required 人物、规则、反派和代价覆盖 100%；
- premise coverage ≥ 90；
- 100% 分集有 hook/conflict/cost/turn/cliffhanger；
- 无通用人物替换；
- 无 exact 重复首场；
- 真人盲评钩子、人物、对白、推进、反转和结尾平均 ≥ 4/5。

### 图片验收

- 所需媒体资产均为真实文件；
- production credit coverage 100%；
- 代表镜头身份/服装/道具/地点一致性 ≥ 95%；
- 0 个 blocker 文化问题；
- 人工视觉评审通过。

### 系列验收

- 重新运行 10/20/30 集；
- 每个规模抽取前、中、后三集做真实资产检查；
- 20 集《皮影诡戏：守灯人》作为固定压力样本；
- 增加第二季续作测试，验证人物状态、世界规则、资产和伏笔继承；
- 市场参考只使用公开、合法、可引用的观察，不复制具体 IP 角色、台词或画面。

## 16. 阶段 8：稳定性、成本、恢复与发布（2%）

### 实施项

- 10/20/30 集并发与队列压力；
- Provider 限流、超时、部分失败和回调乱序；
- 幂等提交、重复回调、断点续跑和人工重试；
- 每集文本/图片/视频/音频费用与耗时；
- 失败率、返工率、人工审核时长和吞吐看板；
- 凭据轮换、callback 签名、敏感日志脱敏；
- 最终 release、rollback 和灾难恢复演练；
- 运行手册、验收报告和发布清单。

### Definition of Done

- 至少完成一次真实部分失败恢复演练；
- 0 个重复生产扣费由幂等错误造成；
- 实际费用与 Provider 账单可对账；
- 能从中断状态继续而不重跑已完成资产；
- 发布清单明确区分本地能力、真实 Provider 能力和人工审核状态。

## 17. 测试矩阵

| 层级 | 必测内容 | 关键退出条件 |
| --- | --- | --- |
| Schema/类型 | premise contract、audit v2、stable asset IDs | 兼容旧项目，非法状态 fail closed |
| 单元测试 | 抽取、忠实度、去重、资产绑定、回调幂等 | 固定 fixture 全通过 |
| 服务测试 | 系列 plan → episode → audit → ledger | 删除核心 anchor 必须失败 |
| 路由测试 | series save/load、audit、repair、asset/job routes | 权限、错误码和状态一致 |
| 前端测试 | Series Studio、Project Detail、自动化和证据展示 | 用户能看到真实阻塞，不显示假 100 |
| 10/20/30 压力 | 长系列、账本、差异化和恢复 | 0 漂移、0 exact 重复首场 |
| 真实 GEARS E2E | submit、poll、callback、retry、artifact | 真实文件、真实费用、幂等通过 |
| 真人评审 | 编剧、导演、文化、视觉 | 达到本文阈值并记录 reviewer |

每个实施切片的最小验证顺序：

1. 新增失败测试；
2. 运行直接相关测试；
3. 实现最小修复；
4. 再跑直接相关测试；
5. 跑受影响服务测试；
6. `npm run check`；
7. `npm run build`；
8. `git diff --check`；
9. 高风险或用户可见流程再跑 Playwright；
10. 只有准备封板时才跑全量回归。

执行目录为 `web/`。应优先使用现有 npm scripts，不绕过项目配置。真实 Provider 测试必须在费用和授权边界内单独运行。

## 18. 第一轮开发的精确切片

新对话不要从真实图片接入开始。第一轮只完成以下闭环：

### Slice A：失败 fixture 与 premise contract

- 为《皮影诡戏：守灯人》创建固定 fixture；
- 写出当前实现会失败的角色/规则/反派/代价测试；
- 新建 `SeriesPremiseContract` 和抽取/规范化模块；
- 让系列 plan 持久化 contract；
- 保证旧系列项目可兼容读取。

### Slice B：忠实度审计 v2

- 新建逐条证据审计；
- required anchor 缺失时 hard fail；
- 前端分开显示结构分和忠实度分；
- 结构 100、忠实度失败时总状态明确为“不通过”。

### Slice C：生成链消费合同

- `buildCharacterArcs`、`buildPlotThreads`、`buildEpisodes` 和 episode blueprint 消费 contract；
- 移除固定人物/拆迁模板污染；
- E1/E10/E20 保留沈砚、林灯与午夜规则；
- 定向修复不能引入新的通用人物替换。

第一轮完成后，下一阶段计划进度可达到 **25%**（阶段 0 的 5% + 阶段 1 的 20%），但只有全部 Definition of Done 和回归证据均满足时才能计入。

### 18.1 阶段 0–1 实施记录（2026-07-20）

状态：**已完成并计入 25%**。本轮没有调用真实文本模型、GEARS 或其他媒体 Provider，没有新增真实图片、视频、音频、费用或人工审核证据。

已完成：

- 建立固定 fixture `shadow-puppetry-keeper-series-fixture.ts`，锁定沈砚、林灯、午夜皮影戏、二十条规则、记忆抹除、开发商、盗谱者及事实/原创机制边界；
- 先运行失败测试，旧实现稳定失败于角色规划缺少“林灯”，随后按 TDD 完成最小实现；
- 新增 `series-premise-contract/v1`，支持显式输入、自动抽取、证据原文、required 锚点、禁止替换和文化 truth mode；
- 新增独立 `ai-comic-series-premise-fidelity-audit/v2`，与结构审计 v1、商业文本审计和生产就绪保持独立；required 人物、规则或对抗力量缺失以及旧模板污染都会 hard fail；
- 系列 plan、人物弧、线索、20 集计划、episode blueprint、正文、分场和 GEARS 本地交付单元均消费 premise contract；
- E1/E10/E20 自动回归保留全部锁定设定，且不再出现“少女/阿湘/拆迁”旧模板；三个代表集的首场正文 exact 文本互不相同；
- 保存、读取、复制和重建均会持久化或兼容补建 premise contract，并重算 fidelity audit；旧系列数据缺字段时采取 fail-closed 审计而不是抛错；
- Series Studio 新增独立“设定忠实度硬门禁”面板，展示四类覆盖率、逐条证据和失败分集，并可滚动定位到对应分集；结构审计通过不能覆盖忠实度失败。

新增主要文件：

- `web/server/src/services/ai-comic-series-premise-contract-service.ts`
- `web/server/src/services/ai-comic-series-fidelity-service.ts`
- `web/server/src/__tests__/fixtures/shadow-puppetry-keeper-series-fixture.ts`
- `web/server/src/__tests__/ai-comic-series-premise-contract.test.ts`

验证证据：

- 红灯：`ai-comic-series-premise-contract.test.ts` 在旧实现上失败，实际人物为“沈砚/关键见证者/对照角色”，缺少“林灯”；
- 绿灯：新增定向回归 4/4；相关 outline service 5/5；相关 API 回归 3/3；
- 全量 Web server：158 个文件中 157 通过、1 条件跳过；1381 项中 1379 通过、2 条件跳过、0 失败；
- `npm run check`、完整 server/client `npm run build`、`git diff --check` 全通过；
- 前端浏览器目视冒烟未执行：环境没有可用的 Playwright CLI，临时下载安装请求被安全审查拒绝；这不影响 TypeScript 和生产构建证据，但不得误报为已完成前端目视验收。

进度更新：

- 原软件整改计划：98.8% → 98.8%；
- 下一阶段市场级计划：0% → 25%；
- 真实图片：0 个已验证；
- 真实视频：0 个已验证；
- 此记录形成时阶段 2 尚未开始；最新阶段 2 工程实施与未完成边界见下节，不能把机器商业门禁通过表述为真人商业质量通过。

### 18.2 阶段 2 工程实施记录（2026-07-20）

状态：**工程切片已实现，正式阶段验收未完成，暂不新增 20% 权重。** 本轮没有调用真实文本模型、GEARS 或其他媒体 Provider，没有新增真实图片、视频、音频、费用或真人审核证据。

已完成：

- 新增 `ai-comic-episode-commercial-beats/v1`，每集显式记录前 3 秒钩子、本集目标、外部压力、失败代价、中段翻转、人物选择、状态变化、结尾追问、开场对白、场景功能序列和标志组合；
- 新增独立 `ai-comic-series-commercial-quality-audit/v1` 与 `ai-comic-series-diversity-report/v1`，不复用结构分或 premise fidelity 分冒充商业质量；
- 统一 commercial profile 管理规则悬疑、非遗舞台救援和连续剧叙事行为，生成 prompt、本地正文、blueprint、保存、读取、复制和重建链路全部消费商业合同；
- 增加首场标准化 exact hash、相邻 token overlap、开场对白骨架、场景功能序列、钩子类型连续重复、地点/人物/动作标志组合连续使用检测，并将校准阈值固化到测试；
- 将人物状态改为显式五级变化阶梯，使 20 集中每 1–3 集都有可追踪变化；E1/E10/E20 的首场钩子、对白与功能序列保持差异；
- 新增失败维度定向修复端点 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/repair-commercial-quality`；修复只修改受影响 `commercial_beats`，无改善或 premise fidelity 破坏时拒绝成功，已生成受影响集会被标记为需重新生成；
- Series Studio 新增独立“商业文本机器门禁”面板，可展示机器分、跨集差异化、exact 重复、逐集问题与真人盲评维度；机器通过时仍显式显示“真人盲评：待评审”；
- 新增 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/commercial-quality-human-review`：只有机器门禁通过且 E1/中集/终集完整故事文件真实可读取、分集身份匹配后，才接受同一 reviewer 的完整七维盲评；服务端记录提交时间，同一 reviewer 重提会替换旧分而不虚增人数；入口使用 `review:operate` 权限，并拒绝缺维度、非盲评或越界分数；
- 新增 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-commercial-blind-review-package`：只有 machine gate、premise fidelity 与 E1/中集/终集材料均通过后才生成匿名包；导出端点同样使用 `review:operate` 权限；
- 新增 `ai-comic-series-blind-review-service.ts`，将材料拆为可交给 reviewer 的匿名 markdown/结构化包与不得外发的 operator-only manifest。reviewer 包不含项目 ID、系列标题、story ID、引擎/模型、机器分或“用户原创故事种子”等来源提示，保留按开篇/中段/终局排序的正文、分场证据、七维空白评分表和事实/口述/传说/戏剧机制的文化边界规则；
- reviewer 包以当前商业内容指纹生成稳定候选编号和 SHA-256；重复导出同一内容得到同一凭证。评分提交必须同时匹配当前候选编号与包哈希，串包、改稿后的旧包或伪造哈希由服务端拒绝；
- 真人盲评会绑定当前系列商业文本指纹与代表集 story ID；计划改稿或代表集重生成后，旧评分自动进入 `stale`，`passed` 被撤销并要求重新盲评，不能把旧版本评分沿用到新版本；
- Studio 增加“导出匿名盲评包”和“导入已完成的真人盲评”：导出时生成 reviewer markdown、reviewer 回执 JSON 模板与“仅内部映射”JSON，并把候选编号/哈希带入表单；回执导入仍强制 reviewer ID、候选编号、包 SHA-256、七项 1–5 分与盲评声明。文案要求评审在 Studio 外完成，避免机器分、候选来源或他人分数污染盲评；导出和导入均不会自动提交任何分数；
- 旧系列缺少 `commercial_beats` 时可在保存/读取时兼容补建；编辑分集计划会清除陈旧商业节拍并由后端重建，避免旧合同与新文本错配。

验证证据：

- 红灯：`ai-comic-series-commercial-quality.test.ts` 在接入实现前失败，20 集均缺少 `commercial_beats`；
- 红灯补充：在新增匿名导出端点前，API 用例按预期返回 404；随后以最小实现推进到绿灯；
- 绿灯：商业质量定向测试 5/5；与 premise contract 合跑 9/9；相关 outline service 5/5；新增修复 API 1/1；匿名包导出与绑定提交 API 合跑 2/2；错配 SHA-256 返回 400，同一内容重复导出的候选编号与哈希稳定；
- 匿名性回归确认 reviewer 可见包与 markdown 不含系列标题、项目/story ID、机器分字段、本地引擎名或用户来源短语；内部映射独立保存在 operator manifest；
- 污染样本会因缺少失败代价或首场 exact 重复 hard fail；修复测试证明只改第 2 集商业节拍且分数真实改善；旧数据缺字段保存/读取可自动补建；
- 全量 Web server：159 个文件中 158 通过、1 条件跳过；1388 项中 1386 通过、2 条件跳过、0 失败；
- `npm run check`、完整 server/client `npm run build` 均通过；
- Codex 内置浏览器真实操作 Series Studio，创建本地项目 `20260720-series-ujl3atax`：20/20 集商业节拍完整、机器门禁 100/100、跨集差异化 100、首场 exact 重复 0、premise fidelity 100/100；真人 reviewer 为 0 且状态保持待评审，浏览器控制台无页面 error。
- 补充创建本地项目 `20260720-series-u33w6lc0` 验证真人盲评入口：代表集未生成时显示“请先生成第1、2、3集完整分镜”且导入表单不出现；通过页面依次生成三集后门禁自动开放，七个维度、reviewer ID、盲评声明和禁用态提交按钮均可见。首次视觉检查发现三列布局裁切意见框，随后改为自适应双列并复核无裁切、无页面 error；验收过程中未填写或提交虚构真人分数。
- 匿名包补充 UI 验收创建本地项目 `20260720-series-nkgxnglt`：0/3 集时导出与评分入口计数均为 0；切换到代表集齐备的 `20260720-series-u33w6lc0` 后，“导出匿名盲评包”和导入区均出现，候选编号、SHA-256 字段为空且未误填，页面布局无裁切、控制台无 error。本轮未点击下载、未填写或提交虚构真人分数；导出内容与哈希行为由上述 API 回归覆盖。
- 目标项目 `20260720-series-ujl3atax`《皮影诡戏：守灯人》已通过本地 canonical 生成端点补齐 E1/E10/E20，内部 story ID 分别为 `20260720-story-a3ok150ff859`、`20260720-story-a3h18acb7642`、`20260720-story-a3l60ac49d5e`；没有调用外部文本模型或媒体 Provider。
- 对目标项目实际调用匿名导出端点成功：候选编号 `候选-21097EAA`，包哈希 `sha256:eca2280a8dc800d1a2d94df184564c91d880cce8d71fd4c342e88fd174119161`；样本 A/B/C 分别对应开篇/中段/终局，各 5 场、正文 518/513/555 字符，七维评分表完整，`origin_hidden=true`、`machine_scores_included=false`、`source_engine_included=false`。这证明材料已可交付，不代表已有真人评分；当前 reviewer 数仍为 0。
- 全量回归曾发现 legacy series 缺少 `episodes` 数组时指纹计算抛错；修复为空数组兼容后，两个原失败用例定向 2/2 通过，并再次完成 159 文件全量回归 0 失败。

进度与未完成边界：

- 原软件整改计划：98.8% → 98.8%；
- 下一阶段市场级计划：25% → 25%；
- 真实图片：0 个已验证；真实视频：0 个已验证；
- 阶段 2 尚缺真实盲评：至少覆盖钩子、人物、对白、推进、反转、结尾、文化可信度七项，整体平均须 ≥ 4/5，且任一关键维度不得低于 3/5；
- 当前代码中的合成评分仅用于合同测试，不是真人证据；取得合法 reviewer 结果并校准机器阈值前，不得把阶段 2 标记完成，也不得进入“已达到市场水平”的表述。

### 18.3 阶段 2 结构化真人回执闭环（2026-07-21）

状态：**回执传递工程已完成，真人执行仍未发生，阶段权重保持 25%。** 本轮没有调用外部文本模型、GEARS 或媒体 Provider，没有新增费用、真实图片、视频或真人审核证据。

已完成：

- 匿名包新增 `ai-comic-series-blind-review-response/v1` reviewer-safe 回执模板；固定携带候选编号、评审包 SHA-256、七个唯一维度、空分数/意见、Reviewer ID、`blind=true` 与三项独立盲评声明，不包含项目、story、引擎或机器分信息；
- Studio 导出现在产生三份职责分离文件：交给 reviewer 的匿名 markdown、交给 reviewer 填写的评审回执 JSON、仅操作者保存的内部映射 JSON；内部映射仍明确禁止外发；
- Studio 新增“导入 reviewer 回执 JSON”，限制 128 KB，校验 schema、候选编号、SHA-256、Reviewer ID、`blind=true`、七维完整性与唯一性、1–5 整数分、意见长度和三项声明；有效文件只预填表单，不自动提交；
- 若 Studio 当前已绑定候选编号或包哈希，导入不同候选/不同哈希会立即拒绝；切换系列项目时会清空旧回执，避免跨项目残留；
- 任何低于 4 分的维度必须给出可定位意见。该规则同时进入前端可提交状态与服务端 Zod 请求合同，不能通过绕过 UI 提交无意见低分；
- 选择无效文件时，旧 Reviewer ID、分数、意见和盲评确认会先清空，保存按钮保持禁用，避免“导入失败却误提交上一份回执”；
- 保存仍由操作者复核后显式触发；服务端继续重算当前匿名包并校验候选编号/哈希，文件导入本身不授予真人信用。

验证证据：

- 红灯 1：API 先因缺少 `reviewer_response_template` 按预期失败；加入最小实现后转绿；
- 红灯 2：低分无意见请求原先返回 200；加入服务端规则后稳定返回 400；
- 定向 API：`commercial quality|blind human review` 2/2 通过；匿名可见文本回归同时覆盖 response template 与 template JSON，不含系列标题、项目/story ID、机器分、引擎名或用户来源短语；
- `npm run check` 通过：可见文案审计、server TypeScript、client Vue TypeScript 全部通过；完整 server/client `npm run build` 通过；
- 全量 Web server：159 个文件中 158 通过、1 条件跳过；1388 项中 1386 通过、2 条件跳过、0 失败；
- Codex 内置浏览器创建三集本地项目 `20260720-series-m85pa54u` 并生成完整代表集：有效临时回执导入后 Reviewer ID、候选编号、SHA-256 与七维 `3/4/4/4/4/4/4` 正确预填；后续交互收口为操作者还需手动勾选复核声明，保存按钮才可用。页面始终显示 `0 真人 reviewer`，未点击保存，未写入合成评分；
- 同一页面导入 `human_reviewer=false` 且低分无意见的临时回执时，声明错误可见、保存按钮禁用；随后有效回执可重新载入。临时测试文件已删除，页面控制台无 error。

进度与边界：

- 原软件整改计划：98.8% → 98.8%；
- 下一阶段市场级计划：25% → 25%；
- 真人 reviewer：0；真实图片：0 个已验证；真实视频：0 个已验证；
- 现在的唯一阶段 2 封板缺口是把 reviewer markdown 与回执模板交给真实评审、取得可核验结果并回填；模板、自动测试和 UI 烟测不计真人证据。

### 18.4 阶段 2 真人盲评界面简化（2026-07-21）

状态：**交互已经收口为三步操作向导；随后真实回执已保存，最终封板证据见 18.5。**

已完成：

- 原先同时展开的导出、文件说明、导入、绑定字段和七维手工表单，改为“1. 导出并发送 → 2. 只导入回执 JSON → 3. 复核并保存”的编号向导；当前步骤使用高亮状态，未到达的保存步骤保持锁定；
- 步骤 1 明确区分两份发给评审人的文件与一份仅操作者保存的内部映射；步骤 2 明确说明只选择一个填写完成的 JSON，Markdown 在文件窗口中显示灰色属于预期行为；
- 七维评分、Reviewer ID、候选编号和 SHA-256 只在回执校验成功后以只读复核卡展示，不再默认铺满复杂的手工录入表；
- Studio 会单独识别 Reviewer ID 为空、七维分数全部为空的原始回执模板：步骤 2 改为黄色操作指引，明确要求把匿名 Markdown 与 JSON 一并交给真实评审人，并列出身份、七维分数/低分意见和三项声明；步骤 3 同时显示阻塞原因，不再只抛出“Reviewer ID 为空”的孤立错误；
- 黄色指引新增“打开匿名评审填写页”入口；空白模板在同一浏览器会自动带入独立页面，评审人也可手动选择收到的 JSON。填写页只显示匿名候选编号与评审包 SHA-256，不显示项目名称、候选来源或机器评分；
- 独立填写页提供 Reviewer ID、七维 1–5 分、逐维意见与三项真人盲评声明。低于 4 分时意见必填，所有条件满足后才允许在浏览器本地下载完成版 JSON；页面不调用提交 API、不写项目，并持续提示“下载回执不等于已计入真人评审”；
- 导入成功后不再自动完成操作者确认，必须人工勾选“已复核独立真人盲评”才能保存；导入和勾选前均不授予真人 reviewer 信用；
- 页面启动顺序调整为优先加载 URL 指定的系列项目，叙事目录、已保存列表与 GEARS 诊断并行后台加载；真实页面从长时间空白/默认表单状态改为约 2 秒内出现项目及盲评向导。

验证证据：

- 新增自包含 Playwright 用例 `ai-comic-series-human-review-workflow.spec.ts`：先观察到旧界面缺少填写页入口的失败，再验证单 JSON 空白模板自动带入、Reviewer ID 与七维表单、低分意见、三项声明、完成版 JSON 下载及内容、返回 Studio 后有效回执只读复核，以及操作者未勾选时保存按钮禁用；1/1 通过；
- `npm run check`、完整 server/client `npm run build` 通过；最终文案调整后 client `vue-tsc --noEmit`、可见文案审计与 client production build 再次通过；
- Codex 内置浏览器在真实项目 `20260720-series-ujl3atax` 上确认三步层级、文件职责、灰色 Markdown 解释和锁定状态清晰可见；独立填写页完成全页视觉验收，桌面端七维双栏、声明区与下载阻塞提示均正常。未向真实项目导入或保存任何合成真人评分。

### 18.5 阶段 2 正式封板与阶段 3 稳定视觉身份图谱（2026-07-21）

状态：**阶段 2 已正式完成并计入 20%，下一阶段市场级计划从 25% 提升到 45%；阶段 3 只完成首个工程切片，15% 权重尚未计入。** 本轮没有调用外部文本模型、GEARS 或媒体 Provider，没有新增费用、真实图片或视频。

阶段 2 封板证据：

- 目标项目 `20260720-series-ujl3atax` 已持久化真人盲评：reviewer `a001`，候选 `候选-21097EAA`，状态 `completed`，七个维度均为 4/5，整体平均 4、最低维度 4、`passed=true`；
- 回执绑定当前商业文本内容指纹及 E1/E10/E20 的三个 story ID，保存后重新读取仍可见，没有把导入动作、空白模板或测试 fixture 计作真人信用；
- 机器门禁、跨集差异化、premise fidelity 与真人阈值同时通过，满足阶段 2 Definition of Done；该证据只代表一位真人 reviewer 的首轮验收，不宣称覆盖编剧、导演、文化等多角色市场评审。

阶段 3 首个工程切片：

- 新增 `ai-comic-series-visual-bible/v1` 与独立构建服务，为角色、服装、地点、道具生成基于类型与名称的稳定系列身份 ID；相同内容重复构建、项目保存/读取、显式重建与项目复制均保持身份稳定；
- 视觉圣经记录世界时代/地域、世界规则、文化边界、定义缺口、E1/E10/E20 代表集绑定和生产信用；内部提示语不会被误识别成道具身份；
- Series Bible 与 Seedance 素材报告现在携带同一视觉圣经。素材引用映射到 `series_identity_id`，镜头携带 `required_series_identity_ids`，为后续真实回片、跨镜头连续性与人工审核提供稳定主键；
- Studio 新增“系列视觉圣经与稳定身份图谱”面板，直接显示稳定身份数、待定义数、代表集覆盖率、生产信用、缺失字段和可重建入口；placeholder、未授权素材和未通过人工审核的媒体继续不计生产信用；
- 已对真实项目执行重建并持久化：共 14 个稳定身份，覆盖沈砚、林灯、开发商、盗谱者四个锁定人物、对应四套主服装、5 个生产地点与守灯道具；E1/E10/E20 的角色/服装/地点/道具类型覆盖率均为 100%，Seedance 素材报告中每集 9/9 镜头至少映射一个系列身份；
- 当前 14/14 身份仍缺少可审批的完整视觉定义，0/14 取得真实生产信用，真实图片和视频仍为 0。因此阶段 3 尚未完成，也没有计入其 15% 权重。

验证证据：

- 新增视觉圣经服务测试按轻量 TDD 先因模块不存在失败，再转为 1/1 通过；
- `outline-service` 定向回归覆盖保存/读取/导出、显式重建持久化、项目复制稳定 ID 和 Seedance 素材报告映射，相关用例通过；
- Playwright `ai-comic-series-human-review-workflow.spec.ts` 1/1 通过，并覆盖 Studio 新增视觉圣经摘要；
- Codex 内置浏览器在真实项目页面核验 14 个稳定身份、E1/E10/E20 的 100% 身份覆盖与 0 生产信用，面板布局和缺口提示可见；
- `npm run check` 通过可见文案审计、server TypeScript 与 client Vue TypeScript；server/client 完整生产构建通过；`git diff --check` 通过。

下一步中的结构化定义与人工审批入口已在 18.6 完成；尚需由用户或真实视觉 reviewer 填写并批准定义、补齐世界规则视觉映射，并继续保持 Provider 与 placeholder 边界。

### 18.6 阶段 3 结构化视觉定义与人工审批（2026-07-21）

状态：**阶段 3 的第二个工程切片已完成，阶段权重仍不计入，下一阶段市场级计划保持 45%。** 本轮没有调用外部文本模型、GEARS 或媒体 Provider，没有新增费用、真实图片或视频，也没有代替用户填写或批准任何视觉事实。

已完成：

- 每个稳定身份新增按类型区分的结构化必填字段：人物为年龄区间、体态、脸部特征、发型、性别/代词；服装为主服装细节、色彩方案、阶段变化；地点为空间结构、主光源、材质与色彩；道具为形制/尺寸、材质与颜色、归属与状态变化；
- 视觉定义可保存草稿，但“批准”必须满足字段完整、Reviewer ID、复核说明和真人逐项确认；审批绑定身份源设定 SHA-256，角色/规则来源变化后旧批准自动标为 `stale`，不能静默沿用；
- 新增受保护的视觉定义写入端点与 Studio 编辑器。用户可逐个查看稳定 ID、填写字段、保存草稿或明确批准；空字段时批准按钮禁用，服务端仍独立 fail-closed，不依赖前端按钮；
- 生产信用现在同时要求：结构化视觉定义已批准、真实文件 SHA-256 校验、版权授权、真人媒体审核通过和 reviewer 身份。即使真实媒体审核已通过，只要定义未批准，也继续记 0；
- 图谱不再把“关键见证者”“对照角色”等通用占位名称升级为生产身份；开发商、盗谱者来自锁定对抗力量，获得真实语义的稳定人物和服装 ID，并与原本未映射的 Seedance 人物素材建立关联；
- 对真实项目重建后仍为 14 个稳定身份，但组成已校正为 4 个锁定人物、4 套主服装、5 个地点和 1 个守灯道具。开发商、盗谱者资产均取得 `series_identity_id`；E1/E10/E20 共 27/27 镜头至少映射一个稳定身份；定义完整 0/14、人工批准 0/14、生产信用 0/14。

验证证据：

- 结构化定义测试先因缺少字段模型失败，补最小实现后转绿；源设定变化导致审批失效、通用占位角色被排除、锁定对抗力量进入图谱、未批准定义不计生产信用均已纳入同一服务回归，2/2 通过；
- `outline-service` 保存/读取用例覆盖不完整审批拒绝、完整审批持久化、重新读取和磁盘 JSON 保留，1/1 通过；
- 真实项目故意提交空字段审批返回 HTTP 400 与 `VALIDATION_ERROR`，明确列出年龄、体态、脸部、发型、性别/代词缺口；项目没有被写入虚构定义；
- Playwright `ai-comic-series-human-review-workflow.spec.ts` 扩展覆盖编辑器展开、必填字段、批准禁用态与盲评原流程，1/1 通过；
- Codex 内置浏览器在真实项目核验 14 个身份、0/14 定义、0/14 审批、0 生产信用，并展开沈砚编辑器确认字段、真人声明和禁用态布局；未填写或保存任何虚构值。

尚未完成：

- 由用户或真实视觉 reviewer 对 14 个身份填写可追溯定义并逐项批准；
- 世界规则的视觉符号、触发条件和审批仍只有缺口提示，尚无独立编辑/批准闭环；
- 服装、道具目前有稳定身份与镜头绑定，但 Seedance 素材库的独立图片引用类型仍需扩展；
- 未获得 endpoint、token、callback、费用与版权授权前，不执行外部 Provider，也不把 placeholder 计作真实资产。

## 19. 主要文件与模块导航

### 系列与质量

- `web/server/src/services/ai-comic-series-service.ts`
- `web/server/src/services/ai-comic-series-commercial-profile.ts`
- `web/server/src/services/ai-comic-series-commercial-quality-service.ts`
- `web/server/src/services/ai-comic-series-diversity-service.ts`
- `web/server/src/services/ai-comic-series-blind-review-service.ts`
- `web/server/src/services/ai-comic-series-visual-bible-service.ts`
- `web/server/src/services/ai-comic-series-premise-contract-service.ts`
- `web/server/src/services/ai-comic-series-fidelity-service.ts`
- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/genre-story-profiles.ts`
- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/professional-ai-comic-drama-pipeline-service.ts`
- `web/server/src/services/professional-ai-comic-drama-quality-service.ts`
- `web/server/src/services/professional-ai-comic-drama-revision-service.ts`
- `web/server/src/repositories/series-project-repository.ts`
- `web/server/src/platform/types.ts`

### 前端与路由

- `web/client/src/views/AiComicSeriesStudio.vue`
- `web/client/src/views/AiComicBlindReviewForm.vue`
- `web/client/src/views/ProjectDetail.vue`
- `web/server/src/routes/outline.ts`
- `web/server/src/routes/projects.ts`

### Production Board、资产与 GEARS

- `web/server/src/services/production-board-service.ts`
- `web/server/src/services/production-board-repair-service.ts`
- `web/server/src/services/production-board-export-service.ts`
- `web/server/src/services/seedance-asset-library-service.ts`
- `web/server/src/services/seedance-asset-placeholder-service.ts`
- `web/server/src/services/seedance-asset-reuse-service.ts`
- `web/server/src/services/seedance-asset-upload-service.ts`
- `web/server/src/services/seedance-asset-review-service.ts`
- `web/server/src/services/gears-delivery-service.ts`
- `web/server/src/services/gears-execution-service.ts`
- `web/server/src/services/gears-provider-asset-handoff-service.ts`
- `web/server/src/services/gears-webhook-service.ts`
- `web/server/src/routes/gears-callback.ts`

### 优先测试文件

- `web/server/src/__tests__/professional-ai-comic-drama-pipeline.test.ts`
- `web/server/src/__tests__/ai-comic-series-premise-contract.test.ts`
- `web/server/src/__tests__/ai-comic-series-commercial-quality.test.ts`
- `web/server/src/__tests__/ai-comic-series-visual-bible.test.ts`
- `web/server/src/__tests__/outline-service.test.ts`
- `web/e2e/ai-comic-series-human-review-workflow.spec.ts`
- `web/server/src/__tests__/story-blueprint-genre-quality.test.ts`
- `web/server/src/__tests__/genre-story-profiles.test.ts`
- `web/server/src/__tests__/series-project-repository.test.ts`
- `web/server/src/__tests__/production-board-export-service.test.ts`
- `web/server/src/__tests__/seedance-asset-library-service.test.ts`
- `web/server/src/__tests__/seedance-asset-review-service.test.ts`
- `web/server/src/__tests__/gears-execution-service.test.ts`
- `web/server/src/__tests__/gears-callback-service.test.ts`

## 20. 外部依赖与阻塞处理

### 20.1 可以直接推进

- premise contract；
- 忠实度审计；
- 跨集重复检测；
- 角色/视觉圣经；
- series asset graph；
- 前端证据展示；
- 真人盲评提交、校验与持久化；
- 本地测试与导出。

### 20.2 需要用户/环境提供

- 真实 GEARS worker endpoint 和 token；
- callback 可达地址与 secret；
- Provider 账户和模型权限；
- 真实调用预算；
- 编剧、导演、文化和视觉评审人员或明确的审核安排。

如果外部条件未提供，继续推进可离线完成的阶段 0–3，并把阶段 4 标记为 blocked by configuration；不得用更多 placeholder 把它报成完成。

## 21. 工作区与 Git 交接

- 当前分支：`codex/story-agent-manifest-integrity-20260718`；
- 当前 HEAD：`4fadfb6b`；
- 工作区包含此前连续开发的未提交修改和新增文件；
- 已有修改属于项目成果，下一对话不得 reset、checkout、清理或覆盖；
- 新对话应先运行 `git status --short`，再只编辑与当前切片直接相关的文件；
- 当前文档创建不代表代码已实现；
- 除非用户明确要求，不要擅自 commit 或 push；
- 若用户要求提交，先检查 diff、测试证据和目标分支，再提交并推送当前分支。

当前 dirty worktree 的主要范围包括：原审查文档、系列服务、剧情生成、GEARS delivery、Production Board、项目服务、revision safety、相关测试，以及 Seedance 资产库/占位/复用/上传/审核等新增模块。以实际 `git status` 为准。

## 22. 重要证据与本地地址

### 文档

- `docs/story-agent-comprehensive-functional-review-and-development-plan-20260719.md`
- `docs/story-agent-frontend-text-series-gears-full-flow-test-20260720.md`

### 截图

- `output/playwright/series-scale-20260720/ai-comic-series-30-episodes.png`
- `output/playwright/series-scale-20260720/heritage-promo-shadow-puppetry-production-board.png`
- `output/playwright/series-scale-20260720/.playwright-cli/page-2026-07-20T07-45-31-842Z.png`

### 本地页面

- `http://localhost:5174/`
- `http://localhost:5174/ai-comic-series/new?seriesProjectId=20260720-series-t5nmqjtt`
- `http://localhost:5174/projects/20260720-story-a3if04edcf1c--ai_comic_drama`

本地 URL 只在对应 dev server 和临时数据仍存在时有效。新对话必须先启动/探测服务，不得假设地址仍在线。

## 23. 永久禁止误报的边界

- 15 片型结构覆盖 ≠ 15 片型专业成稿；
- 10/20/30 集生成成功 ≠ 长剧集内容达到商业质量；
- 结构审计 100 ≠ 用户设定忠实度通过；
- 本地生成 ≠ 外部模型生成；
- SVG placeholder ≠ AI 真实图片；
- provider payload/dry-run ≠ Provider 已执行；
- GEARS submitted/mock ledger ≠ 外部媒体回片；
- production material 100 ≠ 真实资产完整；
- readiness 分数 ≠ 成片完成度；
- callback schema 测试 ≠ 真实 callback 已到达；
- 机器分 ≠ 编剧、导演、文化与视觉真人评审；
- 有视频 URL ≠ 文件真实可达、已授权并通过人工审核；
- 市场榜单观察 ≠ 可以复制受版权保护的角色、剧情或画面。

## 24. 新对话可直接使用的启动提示词

```text
请阅读并严格以此文档作为主交接：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md

同时按需参考：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-comprehensive-functional-review-and-development-plan-20260719.md
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-frontend-text-series-gears-full-flow-test-20260720.md

现在开始下一阶段开发。使用 china-culture-story-agent、china-culture-screenwriting、gears-seedance-delivery 和 superpowers-lite 技能。

先检查当前 branch、HEAD、git status 和已有 dirty workspace，保护所有已有用户改动，不要 reset、checkout、清理或覆盖无关文件。当前软件整改进度基线为 98.8%，新的“市场级内容与真实媒体”计划进度基线为 45%；每轮推进后必须同时汇报这两个百分比和新增证据。

阶段 0–2 已完成并计入 45%。目标项目 `20260720-series-ujl3atax` 已保存 reviewer `a001` 对候选 `候选-21097EAA` 的真人盲评，七维均为 4/5，整体与最低分均为 4，并绑定当前内容指纹和 E1/E10/E20 story ID。不得重写、伪造或用 fixture 替代该证据；内容改变导致回执 stale 时必须重新盲评。

阶段 3“系列视觉圣经与稳定资产图谱”已落地两个工程切片：真实项目已有 14 个稳定身份（沈砚、林灯、开发商、盗谱者、四套服装、5 个地点、守灯道具），E1/E10/E20 的身份类型覆盖均为 100%，27/27 镜头已有稳定身份映射；Studio 已能逐项填写定义、保存草稿和真人批准，审批绑定源指纹，未批准定义不计生产信用。但当前定义完整 0/14、人工批准 0/14、生产信用 0/14，真实图片与视频仍为 0。下一轮优先：
1. 先读取持久化的 `visual_bible`，保护现有稳定 ID 和空白待定状态；不要自动填充或批准用户未确认的年龄、性别代词、体态、面部、发型、服装细节或地域符号；
2. 为世界规则增加与身份定义同等级的结构化视觉符号、触发条件、源指纹和人工审批闭环，并绑定到 E1/E10/E20 镜头；
3. 扩展 Seedance 素材库的服装、道具独立引用类型，使四类身份都能获得真实文件、授权和媒体审核，但在真实材料到达前保持生产信用 0；
4. 若用户提供已确认视觉设定，可指导其在 Studio 逐项填写并由真实 reviewer 批准；不能代填、猜测或用测试数据写入正式项目；
5. 继续新增失败测试覆盖规则映射 stale、服装/道具素材引用、待定字段 fail-closed 和三集镜头绑定；
6. 只有稳定身份定义、世界规则映射、代表集绑定、视觉连续性规则与人工审批达到阶段 3 Definition of Done，才能把 15% 计入，不能按代码量提前从 45% 提升到 60%；真实 GEARS 仍属于阶段 4，缺少 endpoint、token、callback、费用授权和版权来源时不得调用外部 Provider。

遵循轻量 TDD：失败测试 → 最小实现 → 定向回归 → npm run check → npm run build → git diff --check；用户可见高风险流程再跑 Playwright。不要用 mock、placeholder 或结构分声称真实图片/商业质量完成。真实 GEARS 接入留到阶段 4，除非已经取得 endpoint、token、callback 配置和费用授权。

完成后更新交接文档的实施记录和百分比。除非我明确要求，不要自行 commit 或 push。
```

## 25. 下一轮汇报模板

每轮最终汇报使用以下固定口径：

```text
本轮完成：
- ...

验证证据：
- 定向测试：...
- 全量/类型检查/构建：...
- 前端或真实 Provider：...

进度：
- 原软件整改计划：98.8% → X%
- 下一阶段市场级计划：Y% → Z%
- 真实图片：已验证 N 个 / 计划 N 个
- 真实视频：已验证 N 个 / 计划 N 个

仍未完成：
- ...

不得误报：
- 本轮是否调用真实模型/Provider；
- 是否取得真实文件、费用和人工审核证据。
```

本文建立时的历史基线：**原软件整改计划 98.8%；下一阶段市场级计划 0%；真实图片 0 个已验证；真实视频 0 个已验证。**

2026-07-20 阶段 0–1 完成后的当前基线：**原软件整改计划 98.8%；下一阶段市场级计划 25%；真实图片 0 个已验证；真实视频 0 个已验证。**

2026-07-20 阶段 2 工程切片完成后的当前基线：**原软件整改计划 98.8%；下一阶段市场级计划仍为 25%（真人盲评未完成，阶段 2 权重未计入）；真实图片 0 个已验证；真实视频 0 个已验证。**

2026-07-21 阶段 2 正式封板与阶段 3 两个工程切片后的当前基线：**原软件整改计划 98.8%；下一阶段市场级计划 45%；稳定系列身份 14 个；E1/E10/E20 身份类型覆盖率均为 100%，27/27 镜头有身份映射；完整视觉定义 0/14；人工批准 0/14；生产信用 0/14；真实图片 0 个已验证；真实视频 0 个已验证；阶段 3 权重尚未计入。**
