# china-culture-kb 剧情化故事生成功能开发文档

> 版本：v0.1  
> 日期：2026-06-03  
> 面向执行者：Claude Code  
> 目标项目：`D:/china-culture-kb`  
> 下游项目：`D:/grears v2`  
> 核心目标：让 `china-culture-kb` 从“文化资料/解说稿生成”升级为“调用知识库内容生成有剧情的故事”，并输出可供 `grears v2` 使用的短版 `script_text`。

---

## 1. 问题背景

当前使用 `china-culture-kb` 生成“周敦颐——濂溪莲影中的理学开山”时，生成结果更像：

- 人物传记；
- 文化解说稿；
- 事件资料整理；
- 分点式故事大纲；
- 文化元素和可信度说明。

这些内容有资料价值，但不是用户需要的“有剧情的故事”。

用户真正需要的是：

```text
知识库条目
  ↓
提取可剧情化事件
  ↓
选择一个主事件
  ↓
构建剧情骨架：主角目标 / 阻力 / 抉择 / 代价 / 结果
  ↓
生成有场面、有动作、有对白、有冲突的故事正文
  ↓
输出给 grears v2 继续生成 AI 影视脚本和分镜
```

---

## 2. 核心结论

当前功能缺少一层关键能力：

```text
知识库条目 → 剧情事件提取 → 戏剧结构化 → 故事正文生成
```

不能直接让模型“根据周敦颐条目生成故事”，否则模型会自然输出人物传记和文化解说。

必须让系统先做：

1. 从完整知识库条目中提取“可剧情化事件”；
2. 选择最适合改编成故事的一个核心事件；
3. 把事件转成戏剧结构；
4. 再生成连续故事正文；
5. 最后压缩成给 GEARS 使用的 5-15 秒 `script_text`。

---

## 3. 产品目标

### 3.1 一句话目标

实现 `kb_generate_story`：输入文化条目名后，系统调用知识库完整条目，自动选择一个最适合剧情化改编的核心事件，生成一篇有剧情的故事正文，并同时输出 `grears v2` 可消费的短版 `script_text`。

### 3.2 不是本功能目标

本功能不负责：

- 生成人物图；
- 生成场景图；
- 生成分镜图；
- 生成视频；
- 自动创建 GEARS 人物资产；
- 自动创建 GEARS 场景资产；
- 自动创建完整 GEARS Recipe。

本功能只负责：

- 知识库检索；
- 事件提取；
- 剧情结构化；
- 故事正文生成；
- GEARS 短版脚本文本输出。

---

## 4. 为什么当前结果不是故事

当前周敦颐实验结果的结构类似：

```text
故事核心
主角
冲突
转折
结尾
文化元素
不可误写
可信度边界
叙事场景设计
整体叙事节奏
全局隐喻
```

这些是“创作分析”或“故事策划案”，不是“故事正文”。

它缺少真正剧情故事必须具备的要素：

- 一个明确正在发生的场景；
- 一个主角此刻想要达成的目标；
- 一个具体阻力；
- 一个必须立刻做出的选择；
- 选择带来的代价；
- 人物动作；
- 人物对白；
- 情绪推进；
- 一个可视化结尾画面。

---

## 5. 正确的剧情生成逻辑

### 5.1 不要生成整个人物传记

错误方向：

```text
请根据周敦颐条目生成故事。
```

这种指令会让模型输出：

- 一生时间线；
- 生平介绍；
- 思想贡献；
- 文化意义；
- 多事件罗列。

正确方向：

```text
请从周敦颐条目中选出最适合戏剧化改编的一个事件，
围绕这个事件生成一个有剧情的故事。
```

### 5.2 对周敦颐的事件优先级

周敦颐条目中，适合剧情化的事件可以排序如下：

1. **南安拒签冤案**：最强剧情冲突，适合短剧和影视化；
2. **分宁断案**：适合断案、推理、明断主题；
3. **端州两砚**：适合廉洁主题，冲突较弱但有象征性；
4. **南康种莲写《爱莲说》**：适合诗意文人故事，偏抒情；
5. **月岩悟道**：偏意象和传说，不适合强剧情，可作为开场、回忆或视觉隐喻。

### 5.3 南安拒签冤案的剧情结构示例

```json
{
  "dramatic_event": "南安拒签冤案",
  "protagonist": "周敦颐",
  "protagonist_goal": "阻止一个不该死的囚犯被处死",
  "opponent_or_pressure": "知军王湜坚持判死，上级权力施压",
  "obstacle": "周敦颐只是司理参军，官位低于王湜",
  "stakes": "抗命可能丢官，顺从则会害死无辜之人",
  "choice": "周敦颐掷下任命文书，准备辞官抗命",
  "turning_point": "他说出“为上官杀人，以媚于人，吾不为也！”",
  "ending_image": "死刑文书被撤回，堂外雨声渐停，莲叶上的水珠没有沾泥",
  "historical_constraints": [
    "南安拒签冤案为《宋史》记载",
    "核心台词不可改写",
    "具体对话、雨夜、堂审细节可作为影视化创作"
  ]
}
```

---

## 6. 新增核心概念：Dramatic Event

### 6.1 定义

`Dramatic Event` 是从知识库条目中提取出的“可剧情化核心事件”。

一个合格的 Dramatic Event 必须具备：

- 主角；
- 目标；
- 阻力；
- 冲突；
- 选择；
- 代价；
- 结果；
- 可视化场景。

### 6.2 数据结构

建议新增：

```ts
export interface DramaticEvent {
  event_name: string;
  source_entry: string;
  protagonist: string;
  protagonist_goal: string;
  opponent_or_pressure: string;
  obstacle: string;
  stakes: string;
  choice: string;
  turning_point: string;
  ending_image: string;
  scene_location: string;
  scene_time: string;
  key_dialogue?: string;
  historical_constraints: string[];
  fiction_allowed: string[];
  credibility_note: string;
}
```

### 6.3 事件评分规则

从知识库条目中可能提取多个事件，需要评分选择。

建议评分维度：

| 维度 | 分数 | 说明 |
|---|---:|---|
| 是否有明确冲突 | 0-3 | 权力压迫、道德选择、敌我对抗、时间压力 |
| 是否有明确主角目标 | 0-2 | 主角要救人、断案、守节、寻找、选择 |
| 是否有代价 | 0-2 | 丢官、失名、死亡、亲情破裂、信仰动摇 |
| 是否有可视化场景 | 0-2 | 公堂、江边、山洞、祠堂、战场、工坊 |
| 是否有关键动作或台词 | 0-2 | 掷印、抱石、断案、刺绣、登楼、题字 |
| 文化代表性 | 0-2 | 是否能代表该条目的文化精神 |

优先选择总分最高的事件。

---

## 7. Story Seed 升级

原 Story Seed 不能只包含文化元素和可信度，必须增加剧情字段。

### 7.1 新版 Story Seed

```json
{
  "title": "周敦颐——理学开山鼻祖",
  "source_entry": "data/provinces/湖南.md#周敦颐——理学开山鼻祖",
  "selected_event": {
    "event_name": "南安拒签冤案",
    "protagonist": "周敦颐",
    "protagonist_goal": "阻止一个不该死的囚犯被处死",
    "opponent_or_pressure": "知军王湜坚持判死",
    "obstacle": "周敦颐官位低，抗命可能丢官",
    "stakes": "一条人命与自己的仕途",
    "choice": "掷下任命文书，准备辞官",
    "turning_point": "为上官杀人，以媚于人，吾不为也",
    "ending_image": "雨停后，军署外莲叶清亮，死刑文书被撤回"
  },
  "facts": [
    "周敦颐曾任南安军司理参军",
    "知军王湜坚持判一囚犯死刑",
    "周敦颐据理力争并准备辞官",
    "王湜最终改判"
  ],
  "fiction_allowed": [
    "具体天气",
    "堂审气氛",
    "非核心对白",
    "人物动作",
    "莲叶意象"
  ],
  "do_not_misrepresent": [
    "不可改写核心台词",
    "不可把虚构细节写成史实",
    "不可把周敦颐写成追逐权势的人"
  ],
  "credibility_note": "核心事件见《宋史》相关记载；具体场景和部分对白为影视化改编。"
}
```

---

## 8. 生成输出结构

`kb_generate_story` 应输出两个版本：

### 8.1 完整剧情故事

用于用户阅读、后续改编和长文本创作。

建议长度：

- 默认 800-1500 中文字；
- 可通过参数调整。

字段：

```json
{
  "story_title": "南安雨夜",
  "full_story": "一篇完整剧情故事正文...",
  "dramatic_event": "南安拒签冤案",
  "source_entry": "周敦颐——理学开山鼻祖",
  "cultural_constraints": [],
  "credibility_note": ""
}
```

### 8.2 GEARS 短版故事

用于 `grears v2` 的 `script_text`。

建议长度：

- 5 秒：40-80 字；
- 10 秒：80-160 字；
- 15 秒：120-260 字。

字段：

```json
{
  "gears_payload": {
    "script_text": "南安军署雨声沉沉。周敦颐看着案上的死刑文书，迟迟不肯落笔。王湜冷声催促，他却取下任命文书掷在案上：“为上官杀人，以媚于人，吾不为也。”堂内死寂，朱笔最终划去了死刑二字。",
    "target_duration": 10,
    "panel_count": 6,
    "recipe_metadata": {
      "source": "china-culture-kb",
      "source_entry": "data/provinces/湖南.md#周敦颐——理学开山鼻祖",
      "dramatic_event": "南安拒签冤案",
      "cultural_constraints": [
        "保留周敦颐拒签冤案的核心事实",
        "保留原始核心台词",
        "具体雨夜和堂审细节为影视化创作"
      ],
      "credibility_note": "核心事件见《宋史》相关记载；具体场景为影视化改编。"
    }
  }
}
```

---

## 9. 生成 Prompt 设计

### 9.1 核心 Prompt 要求

必须明确告诉模型：

```text
你不是在写文化解说，也不是写人物传记。
你要基于知识库资料，生成一个有剧情的影视故事。

必须满足：
1. 只选择一个核心事件，不要写人物一生。
2. 故事必须有主角、目标、阻力、冲突、抉择、结果。
3. 必须写成正在发生的场景，而不是概括说明。
4. 必须包含人物动作、环境、对白和情绪变化。
5. 可以虚构具体动作和非核心对白，但不能改变史实锚点。
6. 输出故事正文，不要输出“故事核心、主角、冲突、转折”这些分析栏目。

禁止输出：
- 人物介绍
- 文化解说
- 条目摘要
- 分点大纲
- 创作分析
```

### 9.2 完整故事生成 Prompt 模板

```text
你是一位历史剧情短片编剧。请基于下列知识库资料，写一篇有剧情的故事正文。

注意：你不是在写文化解说，也不是在写人物传记。

【核心事件】
{{dramatic_event}}

【主角】
{{protagonist}}

【主角目标】
{{protagonist_goal}}

【阻力】
{{opponent_or_pressure}}

【代价】
{{stakes}}

【关键选择】
{{choice}}

【转折点】
{{turning_point}}

【结尾画面】
{{ending_image}}

【史实锚点】
{{facts}}

【可影视化虚构】
{{fiction_allowed}}

【不可误写】
{{do_not_misrepresent}}

写作要求：
1. 只写这个事件，不要写人物一生。
2. 写成连续故事正文，不要分点。
3. 必须有场景、动作、对白、冲突和结尾画面。
4. 可以加入环境描写和非核心对白。
5. 不得改写核心史实和核心台词。
6. 不要输出资料说明、文化解说、人物介绍或创作分析。

输出 JSON：
{
  "story_title": "",
  "full_story": "",
  "dramatic_event": "",
  "credibility_note": ""
}
```

### 9.3 GEARS 短版生成 Prompt 模板

```text
请把下列完整故事压缩成适合 AI 影视 Agent 使用的 {{target_duration}} 秒短故事。

要求：
1. 只保留一个核心场景。
2. 保留主角、冲突、关键动作、核心台词和结果。
3. 字数控制在 {{word_count_range}} 中文字。
4. 不写背景介绍。
5. 不写文化解说。
6. 输出可以直接作为 GEARS 的 script_text。

完整故事：
{{full_story}}

输出 JSON：
{
  "script_text": "",
  "target_duration": {{target_duration}},
  "panel_count": {{panel_count}}
}
```

---

## 10. 模块改造建议

当前 `mcp-server` 是 TypeScript 项目，已有：

```text
mcp-server/src/tools/generate-script.ts
mcp-server/src/tools/generate-story.ts
mcp-server/src/tools/get-entry-detail.ts
mcp-server/src/lib/markdown.ts
mcp-server/src/types.ts
```

### 10.1 不建议继续复用 `kb_generate_script`

`kb_generate_script` 当前定位是：

```text
从知识库条目生成脚本骨架（纪录片/短剧/动画/文化解说），供 Claude Code 填充内容
```

它只适合生成栏目式脚本框架，不适合剧情故事。

### 10.2 建议重做 `kb_generate_story`

`kb_generate_story` 应成为真正的剧情故事生成工具。

建议新增或重构：

```text
mcp-server/src/story-generation/
  dramatic-event.ts
  story-seed.ts
  prompt-builder.ts
  validator.ts
  exporter.ts

mcp-server/src/tools/generate-story.ts
```

### 10.3 必须使用完整条目

实现要求：

```text
使用 getFullEntryDetail 读取完整条目，不要只使用 search 摘要。
```

原因：

当前 `generate-script.ts` 里对条目的处理类似：

```ts
story: '（待从完整条目中提取）'
culturalSignificance: '（待从完整条目中提取）'
```

这会导致故事生成缺少真正剧情材料。

---

## 11. MCP Tool 设计

### 11.1 工具名

```text
kb_generate_story
```

### 11.2 输入 Schema

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "preferred_event": "南安拒签冤案",
  "story_length": "medium",
  "target_duration": 10,
  "panel_count": 6,
  "tone": "庄重、紧张、克制",
  "output_gears_payload": true
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `entry_name` | 是 | 知识库条目名 |
| `preferred_event` | 否 | 用户指定核心事件；为空则自动选择 |
| `story_length` | 否 | `short / medium / long`，默认 medium |
| `target_duration` | 否 | GEARS 短版时长，5-15 秒 |
| `panel_count` | 否 | GEARS 分镜格数，合法值 4/6/8/9/10/12 |
| `tone` | 否 | 故事基调 |
| `output_gears_payload` | 否 | 是否输出 GEARS JSON |

### 11.3 输出 Schema

```json
{
  "story_title": "南安雨夜",
  "dramatic_event": {
    "event_name": "南安拒签冤案",
    "protagonist": "周敦颐",
    "protagonist_goal": "阻止一个不该死的囚犯被处死",
    "opponent_or_pressure": "知军王湜坚持判死",
    "obstacle": "周敦颐官位低，抗命可能丢官",
    "stakes": "一条人命与自己的仕途",
    "choice": "掷下任命文书，准备辞官",
    "turning_point": "为上官杀人，以媚于人，吾不为也",
    "ending_image": "雨停后，军署外莲叶清亮，死刑文书被撤回"
  },
  "full_story": "完整剧情故事正文...",
  "source": {
    "source_entry": "data/provinces/湖南.md#周敦颐——理学开山鼻祖",
    "credibility": "基本可靠",
    "sources": []
  },
  "constraints": {
    "cultural_constraints": [],
    "do_not_misrepresent": []
  },
  "gears_payload": {
    "script_text": "",
    "target_duration": 10,
    "panel_count": 6,
    "recipe_metadata": {}
  }
}
```

---

## 12. 周敦颐目标输出示例

### 12.1 完整故事示例

```text
南安军署的雨下了一夜。

案桌上压着一份死刑文书，墨迹未干。知军王湜看着周敦颐，声音低沉：“签了吧，上面要一个结果。”

周敦颐没有伸手。他翻过案卷，指尖停在供词空缺处：“律文不当死。”

堂下的囚犯伏在地上，肩背发抖。两旁吏员低着头，没有人说话。

王湜皱眉：“你只是司理参军。”

周敦颐慢慢取下自己的任命文书，放在死刑文书旁边。他的声音不高，却压过了檐外雨声：“为上官杀人，以媚于人，吾不为也。”

屋内一片死寂。

王湜看着那纸任命，终于移开目光。片刻后，他拿起朱笔，将死刑二字划去。

雨停时，周敦颐走出军署。阶下积水映着天光，一片莲叶从泥水边探出来，清亮得没有半点尘泥。
```

### 12.2 GEARS 短版示例

```json
{
  "script_text": "南安军署雨声沉沉。周敦颐看着案上的死刑文书，迟迟不肯落笔。王湜冷声催促，他却取下任命文书掷在案上：“为上官杀人，以媚于人，吾不为也。”堂内死寂，朱笔最终划去了死刑二字。",
  "target_duration": 10,
  "panel_count": 6
}
```

---

## 13. Claude Code 实施步骤

### Step 1：阅读现有项目

先查看：

```text
D:/china-culture-kb/CLAUDE.md
D:/china-culture-kb/data/provinces/湖南.md
D:/china-culture-kb/mcp-server/src/tools/generate-story.ts
D:/china-culture-kb/mcp-server/src/tools/generate-script.ts
D:/china-culture-kb/mcp-server/src/tools/get-entry-detail.ts
D:/china-culture-kb/mcp-server/src/lib/markdown.ts
D:/china-culture-kb/mcp-server/src/types.ts
```

确认：

- `getFullEntryDetail` 是否能正确读到完整条目；
- 中文编码是否正常；
- `generate-story.ts` 当前是否只是包裹用户传入的 `story_text`；
- `generate-script.ts` 是否仍只生成骨架。

### Step 2：修复完整条目读取

确保 `getFullEntryDetail("周敦颐——理学开山鼻祖")` 能返回：

- `summary`
- `story`
- `culturalSignificance`
- `relatedLocations`
- `sources`
- `credibility`
- `unverifiedPoints`
- `verificationMethod`

如果 Markdown 解析存在乱码字段名，应修正为真实中文标题：

```text
### 简介
### 故事梗概
### 文化意义
### 相关地点
### 关键词
### 来源
### 可信度
### 核实方法
### 可信度与核实
### 待核实点
```

### Step 3：新增 Dramatic Event 提取

新增：

```text
mcp-server/src/story-generation/dramatic-event.ts
```

实现：

```ts
export function extractDramaticEvents(entry: FullEntryDetail): DramaticEvent[]
export function selectBestDramaticEvent(events: DramaticEvent[], preferredEvent?: string): DramaticEvent
```

第一阶段可以用规则实现，不必上 LLM。

对历史人物条目，优先识别这些关键词：

```text
断案
拒签
冤案
掷印
辞官
力争
改判
清廉
抗命
殉国
流放
登楼
写下
悟道
```

### Step 4：新增 Story Seed 构建

新增：

```text
mcp-server/src/story-generation/story-seed.ts
```

实现：

```ts
export function buildDramaticStorySeed(entry: FullEntryDetail, event: DramaticEvent): DramaticStorySeed
```

### Step 5：新增 Prompt Builder

新增：

```text
mcp-server/src/story-generation/prompt-builder.ts
```

实现：

```ts
export function buildFullStoryPrompt(seed: DramaticStorySeed): string
export function buildGearsScriptPrompt(fullStory: string, targetDuration: number, panelCount: number): string
```

Prompt 必须包含禁止项：

```text
禁止输出人物介绍、文化解说、条目摘要、分点大纲、创作分析。
```

### Step 6：重构 `generate-story.ts`

新流程：

```text
entry_name
  ↓
getFullEntryDetail
  ↓
extractDramaticEvents
  ↓
selectBestDramaticEvent
  ↓
buildDramaticStorySeed
  ↓
generate full_story
  ↓
compress to gears script_text
  ↓
validate
  ↓
write output file
```

输出文件建议：

```text
D:/故事原型/{story_title}.md
```

或项目内：

```text
D:/china-culture-kb/generated/stories/{entry_name}.generated-story.json
```

### Step 7：新增校验器

新增：

```text
mcp-server/src/story-generation/validator.ts
```

校验：

- `full_story` 不能包含“故事核心 / 主角 / 冲突 / 转折 / 文化元素”等栏目；
- `full_story` 不能是分点大纲；
- `full_story` 必须包含至少一处对白标记；
- `full_story` 必须包含核心事件名或关键台词；
- `gears_payload.script_text` 不为空；
- `target_duration` 必须 5-15；
- `panel_count` 必须是 4/6/8/9/10/12；
- 必须包含 `source_entry` 和 `credibility_note`。

### Step 8：测试

至少新增测试：

```text
mcp-server/src/__tests__/generate-story.test.ts
```

测试项：

- 能读取周敦颐完整条目；
- 能提取南安拒签冤案；
- 指定 `preferred_event=南安拒签冤案` 时优先使用该事件；
- 生成结果不是大纲；
- 生成结果包含对白；
- 生成结果包含 GEARS payload；
- `panel_count` 非法时报错；
- 条目不存在时报明确错误。

---

## 14. 验收标准

### 14.1 基础验收

输入：

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "preferred_event": "南安拒签冤案",
  "target_duration": 10,
  "panel_count": 6
}
```

必须输出：

- 一篇连续故事正文；
- 不是文化解说；
- 不是人物传记；
- 不是分点大纲；
- 有公堂/军署等具体场景；
- 有周敦颐和王湜之间的冲突；
- 有核心台词；
- 有结尾画面；
- 有 `gears_payload.script_text`。

### 14.2 GEARS 联调验收

把 `gears_payload.script_text` 复制到 `grears v2` 后：

- GEARS 能完成剧本分类；
- GEARS 能生成分镜规划；
- 分镜能体现周敦颐拒签冤案；
- 不变成周敦颐一生传记；
- 不丢失核心台词和核心冲突。

---

## 15. 第一阶段不做的事

第一阶段不要做：

- 不做长篇小说生成；
- 不做多人物群像；
- 不做跨条目复杂融合；
- 不做自动创建 GEARS 角色；
- 不做自动创建 GEARS 场景；
- 不做图片生成；
- 不做视频生成；
- 不做外网资料扩写。

---

## 16. 最终原则

`china-culture-kb` 要生成故事，关键不是“资料更多”，而是“剧情结构更明确”。

每次生成都要先回答：

```text
这个故事发生在哪一刻？
主角此刻想要什么？
谁或什么阻止他？
他必须付出什么代价？
他做了什么选择？
最后画面是什么？
```

只有回答完这些问题，模型才会从“文化解说”转向“剧情故事”。

