# Story Agent 开发交接（2026-07-29）

> 工作目录：`/Users/wuyu/Desktop/china-culture-kb`
>
> 当前分支：`codex/story-agent-manifest-integrity-20260718`
>
> 功能基线：`183b122a feat(story-agent): add reference-inspired generation recipes`
>
> 交接提交：以本地 `git log -1 --oneline` 为准
>
> 详细历史：`docs/story-agent-development-handoff-20260725.md`

## 1. 当前产品定位

Story Agent 是面向中国文化题材的 AI 影视前置创作系统。当前产品边界为：

```text
主题 / 大纲 / 授权原作
  → 中国文化知识检索
  → 故事蓝图与完整文本
  → 场景、分镜与生产段落
  → GEARS / Seedance 提示词与图片资产需求
  → Codex 图片资产
  → 前置制作交付包
  → 外部 AI 视频模型
```

系统当前不在内部生成最终视频，不把外部视频模型的成功冒充为本系统完成，也不把
fixture、record-replay、机器比较或 `not_run` 记作真人审核、法律确认或 production
credit。

## 2. 创作模型

用户的“类型－题材－风格”理解基本正确，完整模型是：

```text
创作路径
× 成片类型
× 题材与素材
× 叙事结构
× 表现风格
× 创作 / 生产约束
```

各层职责：

1. 创作路径：原创单片、资料/原作改编、机构命题、系列漫剧。
2. 成片类型：决定做成什么片。
3. 题材与素材：决定讲什么，包括主题、大纲、地域、中国文化知识和合法参考材料。
4. 叙事结构：决定故事如何展开。
5. 表现风格：决定如何视听呈现。
6. 创作约束：事实模式、文化准确性、受众、传播目标、时长、优先级、严格度和交付要求。

当前 15 种成片类型：

```text
剧情故事类
  人物故事 / 历史剧情短片 / 神话传说故事 / AI 漫剧单片 / 儿童故事片

宣传推广类
  文化宣传片 / 非遗工艺宣传片 / 城市文旅宣传片 / 竖屏短视频

讲解教育类
  微纪录片 / 知识讲解视频 / 宣讲片 / 教育培训片

场景空间类
  场景短片 / 山水意境片
```

当前 11 种表现形式：

```text
影视叙事 / 纪实风格 / 主持讲述 / 旁白蒙太奇 / 竖屏短剧
AI 漫剧 / 2D 动画 / 水墨风格 / 儿童动画 / 展陈风格 / 社媒快切
```

## 3. 文本层创作逻辑

文本层不是一次调用直接写完整剧本，而是逐层把文化素材变成可生产文本：

```text
输入解析
  → 创作合同
  → 知识检索与可信度约束
  → StoryBlueprint
  → full_text
  → scene_breakdown / StoryScene
  → GearsSegment
  → visual_prompt / segment_prompt_hint
```

### 3.1 输入与创作合同

系统先确定：

- 创作用途和创作路径；
- 成片类型、表现形式、叙事结构、时长；
- 题材、地域、时代、受众和传播目标；
- 原创虚构、素材启发、原作改编、事实重构或机构审定模式；
- 剧情/资料优先级与类型严格度。

创作合同用于限制后续生成，避免把历史资料、用户指令和创作虚构混为一体。

### 3.2 中国文化知识层

知识库可提供地域历史、人物事件、民俗礼仪、非遗技艺、服饰器物、建筑空间、
思想观念和文化符号。知识不是直接拼接成剧本，而是转成：

- 世界构建条件；
- 人物可执行动作；
- 场景和道具细节；
- 冲突成立的历史/礼俗原因；
- 需要核验或避免确定化表达的事实边界。

### 3.3 故事蓝图与完整文本

`StoryBlueprint` 先解决人物、目标、阻力、升级、选择、代价和文化行动，再生成：

- 故事梗概、人物小传；
- 分幕/分集大纲；
- 场景文本、动作、对白和旁白；
- 情绪变化、转场、节奏；
- 集尾悬念或宣传落点。

不同类型会调用不同叙事结构库，不应使用同一套三幕模板覆盖全部 15 种成片类型。

### 3.4 生产化拆解

`scene_breakdown` / `StoryScene` 把全文转成结构化场景，记录：

- 时间、地点、人物；
- 场景目标、冲突、转折和结果；
- 动作、对白、旁白；
- 文化事实和连续性要求；
- 人物、服装、道具、环境等资产需求；
- 景别、构图、运镜、声音建议；
- 与前后场景的衔接。

`GearsSegment` 再把场景拆成适合图片和视频模型执行的有界生产段落。

### 3.5 质量检查与修复

当前质量链关注：

- 类型结构是否成立；
- 人物目标和因果是否清楚；
- 文化事实、时代和地域是否准确；
- 场景是否可视觉化；
- 人物、道具、空间是否连续；
- 时长和平台要求是否满足；
- 是否过度接近参考作品；
- 输出合同是否完整。

修复应优先局部处理失败字段或场景，不应无条件全篇重写。

## 4. 图片层与 GEARS 创作逻辑

GEARS 不只是“图片生成器”，而是文本到视觉生产之间的资产组织和交付层：

```text
StoryScene / GearsSegment
  → 视觉实体提取
  → 角色与世界视觉圣经
  → 资产 manifest
  → 图片生成请求
  → 图片导入、哈希与 receipt
  → 一致性 / provenance 检查
  → 分镜故事板和视频模型交付包
```

### 4.1 视觉实体提取

从文本中提取并分配稳定 ID：

- 人物、年龄、身份、外形；
- 服装、妆发和状态变化；
- 关键道具；
- 建筑、自然环境、时间、天气；
- 礼仪、纹样和文化符号；
- 当前动作、情绪、景别、构图和光线。

### 4.2 视觉圣经

视觉圣经约束：

- 角色标准造型和多状态变化；
- 服装颜色、材质、年代；
- 标志性道具；
- 场景空间关系；
- 色彩、光线、镜头和美术方向；
- 禁止出现的时代错误和视觉污染。

同一实体必须跨场景复用稳定身份，避免人物、服装、道具和空间漂移。

### 4.3 图片资产层级

预期资产包括：

- 人物设定图、多视图、表情和动作；
- 服装状态和核心道具；
- 场景概念图与环境空镜；
- 关键剧情帧；
- 分镜故事板；
- 首帧、参考帧和连续性图片；
- 宣传视觉或海报资产。

系统应先建立母资产，再派生镜头资产，不能让每个镜头从零随机生成。

### 4.4 图片提示词

图片提示词由以下部分组合：

```text
稳定实体身份
+ 时代与地域
+ 服装道具
+ 场景空间
+ 动作与情绪
+ 景别、机位、构图
+ 光线和美术方向
+ 连续性锚点
+ 禁止项
```

文化知识约束服饰、器物、建筑和礼仪；文本场景提供动作、情绪和镜头功能。

### 4.5 Provenance 与交付

图片请求、导入和交付链使用 manifest、SHA-256、receipt、evidence bundle、
descriptor 和 preflight。它们证明“生成了什么、从哪里导入、字节是否一致”，但不自动
证明版权、真人审核或 production 可用性。

最终交付给 Seedance 等外部视频模型的是：

- 对应剧情和场景目标；
- 人物、场景、道具图片；
- 首帧或关键帧；
- 动作、运镜、时长；
- 台词、旁白和声音建议；
- 连续性约束；
- `visual_prompt` / `segment_prompt_hint`。

## 5. 本轮完成：本地私有视频样本 P1-D1～D6

最近三个提交：

```text
2c2ac5ea feat(story-agent): add private video sample intake
0d72e2f6 feat(story-agent): bridge private video samples to mcp
3140160f feat(story-agent): surface private video samples in reference library
```

已经完成：

- 本地绝对路径视频 ingest；
- `ffprobe` 元数据读取；
- `ffmpeg` 缩略图和 16kHz 单声道 wav 派生；
- 本地 transcript 封存，只返回哈希和元数据；
- CLI、Web API、MCP 三个 canonical 入口；
- Reference Library 浏览器工作台；
- no-credit、no-upload、no-prompt-injection 治理状态。

固定边界：

- 原视频复制到 `references/creative/private-video-samples/`；
- 该目录已被 `.gitignore` 忽略；
- 记录不保存用户原始绝对路径；
- 原视频、音频、缩略图和 transcript 正文不进入 Git；
- 不上传第三方；
- 只有用户自有、已授权或公版样本才能进入后续人工分析；
- 当前没有用户真实样本，不得用合成 fixture 冒充。

## 6. 本轮完成：公开候选与非复制创作配方

提交：

```text
183b122a feat(story-agent): add reference-inspired generation recipes
```

已登记 10 条 `research_only + metadata_only` 来源：

- 豆瓣前三：《肖申克的救赎》《霸王别姬》《阿甘正传》；
- IMDb 前三：《肖申克的救赎》《教父》《蝙蝠侠：黑暗骑士》；
- D&AD 宣传片：Apple《Welcome Home》、Metro Trains《Dumb Ways to Die》、
  Nike《You Can't Stop Us》；
- 央视经典剧：1994 版《三国演义》、1987 版《红楼梦》。

电影榜单交集去重后为 5 部，所以资料库总数是 5 部电影、3 部宣传片、2 部电视剧。

所有候选：

- 没有下载原视频；
- 没有内容指纹；
- 不能创建合法分析任务；
- 没有 approved analysis、benchmark 或 style pack；
- 不能注入生成 prompt；
- 只保存公开页面链接、标题和研究理由。

当前 8 个抽象创作配方：

```text
feature_long_goal_payoff       长线目标与延迟回收
feature_epoch_character_mosaic 人物命运与时代拼图
feature_moral_pressure         权力压力与道德两难
promo_space_emotion            空间变化与情绪品牌片
promo_mnemonic_reveal          记忆旋律与结尾揭示
promo_collective_montage       群像动作与主题蒙太奇
series_strategy_chapters       历史权谋章回连续剧
series_ritual_relationships    礼俗群像关系连续剧
```

Story Studio 已增加“创作配方”选择器。应用配方会同步：

- `video_type`；
- `presentation_style`；
- `narrative_pattern_ids`；
- `story_priority`；
- `genre_strictness`；
- tone；
- communication goal。

生成配置不包含候选作品标题、角色、对白、情节、镜头、美术或音乐。

### 6.1 尚未闭环的配方能力

目前配方是前端参数组合器，还不是完整的一等生成合同：

- `recipe_id` 尚未随生成请求持久化；
- `reusable_mechanisms` / `avoid_copying` 尚未作为有界抽象约束进入生成请求；
- 项目版本、story-agent-run 和结果页尚未展示配方 provenance；
- 尚未根据题材、类型和创作路径自动推荐配方；
- 还没有 reference-free / recipe-assisted 的同输入质量对照。

这是无真实样本条件下的下一开发优先级。

## 7. 关键代码位置

```text
创作页面
web/client/src/views/StoryStudio.vue

15 种类型和 11 种表现形式
web/shared/types.ts

8 个创作配方
web/shared/reference-generation-recipes.ts

叙事结构目录和类型兼容关系
web/server/src/services/narrative-pattern-library.ts

配方合同测试
web/server/src/__tests__/reference-generation-recipes.test.ts

Reference Library 页面
web/client/src/views/ReferenceLibrary.vue

私有视频服务
web/server/src/services/reference-private-video-sample-service.ts

私有视频 API
web/server/src/routes/reference-library.ts

私有视频 MCP
mcp-server/src/tools/reference-private-video-samples.ts

公开研究元数据
references/creative/library/references/

详细历史交接
docs/story-agent-development-handoff-20260725.md
```

## 8. 当前验证状态

本轮已通过：

```text
reference generation recipes + narrative pattern library
  2 files / 12 tests passed

Web workspace lint
  server tsc + scripts tsc + client vue-tsc passed

Web production build
  server tsup + client vue-tsc/vite passed

Client visible-copy audit
  9 files / 17 checks passed

Browser smoke
  8 recipes rendered
  recipe application updated type/style/pattern/goal
  Reference Library rendered 10 research-only candidates

Repository audit
  10 candidate files are JSON only
  all research_only + metadata_only
  all without content fingerprint
  no local path or media extension leak
  git diff --check passed
```

浏览器控制台只有既有 `/favicon.ico` 404，不是本轮功能错误。

## 9. Git 与运行状态

交接时状态：

```text
branch: codex/story-agent-manifest-integrity-20260718
functional baseline: 183b122a
handoff HEAD: run git log -1 --oneline
remote: ahead 5
worktree: clean
push: not performed
```

交接时本机开发地址：

```text
Story Studio
http://localhost:15181/story/new

Reference Library
http://localhost:15181/reference-library

API
http://localhost:13006
```

新对话不要假设旧进程仍存活。需要时启动：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web
PORT=13006 \
VITE_DEV_PORT=15181 \
VITE_API_PROXY_TARGET=http://localhost:13006 \
VITE_STORY_AGENT_ROLE=administrator \
npm run dev
```

如果端口占用，先检查现有服务；不要未经确认杀死不明进程，也可以改用其他前端端口。

## 10. 下一开发优先级

### P1-E1 配方成为一等生成合同

建议测试驱动完成：

1. 扩展共享生成请求合同，增加可选 `reference_generation_recipe`：
   `recipe_id`、版本、抽象机制快照、禁仿边界和 payload SHA-256。
2. 服务端根据 canonical 配方目录重新解析，拒绝客户端篡改机制或禁仿内容。
3. 把配方约束编译为有界生成输入，只允许抽象机制，不允许研究候选标题或内容。
4. 在 project version、story-agent-run 和生成结果中记录配方 provenance。
5. UI 展示“使用了哪种机制”和“明确禁止复制什么”，但不展示参考作品作为仿写目标。
6. 添加篡改、未知 recipe id、类型不兼容和旧项目兼容测试。

### P1-E2 自动推荐而不是强制套用

根据创作路径、成片类型、题材、叙事目标和素材特征返回 1～3 个配方建议，并允许：

- 用户不使用配方；
- 用户查看建议原因；
- 用户手动切换；
- 机构/事实型任务优先真实性，不为套配方牺牲材料边界。

### P1-E3 配方效果对照

在不需要真实参考视频的前提下，用相同主题运行：

```text
reference-free
vs.
recipe-assisted
```

只比较机器可验证的结构、可视化程度、因果、连续性和合同完整度，不记真人偏好或
production credit。

### 真实样本到位后

用户提供合法真实样本并亲自确认权利后，才执行：

```text
private ingest
→ ffprobe / ffmpeg
→ 本地转写
→ operator evidence
→ 独立人工 analysis approval
→ 跨来源 benchmark
→ audited style pack
→ same-input comparison
```

没有真实样本时不得伪造 timecode、逐镜头观察、授权、人工批准或生产验收。

## 11. 常用验证命令

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm test -- reference-generation-recipes.test.ts narrative-pattern-library.test.ts

cd /Users/wuyu/Desktop/china-culture-kb/web
npm run lint
npm run build
npm run audit:copy -w client

cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
git status --short --branch
```

完成 P1-E1 里程碑后，再运行受影响的 generation request、project version、
story-agent-run、API 与 MCP 测试；不要每次小改都重复整套全量 CI。

## 12. 可复制到下一对话的启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-development-handoff-20260729.md

继续全力开发 china-culture-kb Story Agent。

当前分支应为 codex/story-agent-manifest-integrity-20260718，HEAD 应包含：
2c2ac5ea feat(story-agent): add private video sample intake
0d72e2f6 feat(story-agent): bridge private video samples to mcp
3140160f feat(story-agent): surface private video samples in reference library
183b122a feat(story-agent): add reference-inspired generation recipes

固定产品边界：
主题/大纲/授权原作 → 中国文化知识 → 故事蓝图与完整文本 → 场景/分镜/GearsSegment
→ GEARS/Seedance 提示词与图片需求 → Codex 图片资产 → 前置制作交付包。
外部 AI 视频模型负责最终运动画面，本系统当前不把视频生成冒充为已完成。

固定隐私和权利边界：
允许 ffmpeg/ffprobe 和本地转写；原视频、音频、缩略图和 transcript 正文不进入 Git、
不上传第三方；没有用户真实合法样本时，不得伪造授权、timecode、人工批准、benchmark、
style pack 或 production credit。

当前 10 条影视/宣传片/电视剧候选只是 research_only + metadata_only。
8 个创作配方只使用抽象机制，不得把候选作品角色、对白、情节、镜头、美术或音乐
注入生成。

下一优先级是 P1-E1：把创作配方从前端参数组合器升级为一等生成合同。
先写失败测试，再扩展共享请求合同；服务端必须 canonical 解析 recipe_id、拒绝篡改，
把 recipe id、版本、抽象机制快照、avoid-copying 边界和哈希持久化到 project version
与 story-agent-run，并在结果页展示 provenance。保持旧项目和无配方生成兼容。

完成后运行 targeted tests、Web lint/build/copy audit、git diff --check，更新本交接并创建
本地 commit。只有用户明确授权向 GitHub 传输仓库内容时才 push。
```
