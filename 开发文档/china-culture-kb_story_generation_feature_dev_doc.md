# china-culture-kb 故事生成功能开发文档

> 版本：v0.1  
> 面向执行者：Claude Code  
> 目标项目：`D:/china-culture-kb`  
> 下游项目：`D:/grears v2`  
> 核心目标：让 `china-culture-kb` 负责基于中国文化知识库生成影视化故事文本，供 `grears v2` 继续生成 AI 影视脚本、分镜规划和故事板。

---

## 1. 需求定义

### 1.1 一句话需求

在 `china-culture-kb` 中实现“故事生成”能力：用户给定文化主题、条目名、地区、类型或关键词后，系统从知识库检索相关文化资料，生成一个适合输入 `grears v2` 的影视故事文本。

### 1.2 产品边界

`china-culture-kb` 只负责：

- 检索文化资料；
- 整理事实、传说、文化元素和禁忌；
- 生成故事；
- 输出适合 GEARS 使用的 `script_text`；
- 输出故事元数据、来源、可信度和文化约束。

`china-culture-kb` 不负责：

- 生成人物图；
- 生成场景图；
- 生成分镜图；
- 生成视频；
- 选择 GEARS 里的具体人物资产版本或场景资产版本。

这些由 `grears v2` 继续负责。

---

## 2. 目标链路

```text
用户输入文化主题
        ↓
china-culture-kb 检索条目
        ↓
提取文化事实 / 传说 / 人物 / 地点 / 禁忌
        ↓
生成故事种子 Story Seed
        ↓
生成影视化故事 script_text
        ↓
输出给 grears v2
        ↓
grears v2 生成剧本分类 / 分镜规划 / 镜头脚本 / 故事板
```

---

## 3. 核心产物

### 3.1 Story Seed

Story Seed 是 `china-culture-kb` 生成故事的中间结构。它不是最终剧本，而是“故事生成素材包”。

推荐结构：

```json
{
  "title": "屈原投江汨罗",
  "source_entry": "data/provinces/湖南.md#屈原投江汨罗——端午节起源",
  "province": "湖南",
  "region": "岳阳→汨罗",
  "culture_type": "神话传说",
  "credibility": "基本可靠",
  "facts": [
    "屈原为楚国诗人、政治家",
    "汨罗江与端午节起源叙事相关"
  ],
  "legend_elements": [
    "百姓划船寻找屈原遗体",
    "投米团保护遗体的民间传说"
  ],
  "cultural_elements": [
    "汨罗江",
    "楚国士大夫服饰",
    "竹简",
    "龙舟",
    "粽叶"
  ],
  "do_not_misrepresent": [
    "不要把所有端午传说细节写成正史",
    "托梦情节只能作为民间传说处理"
  ],
  "story_goal": "生成一个 10 秒左右的悲壮短片故事",
  "recommended_duration": 10,
  "recommended_panel_count": 6
}
```

### 3.2 Generated Story

Generated Story 是最终给 GEARS 使用的故事文本。

推荐结构：

```json
{
  "title": "汨罗暮色",
  "script_text": "暮色压低汨罗江面。屈原站在芦苇岸边，手中竹简被风吹开。他望向远处战火方向，轻声说：“楚虽破，心不可降。”江上传来百姓急促的呼喊，他抱石转身走向水光。",
  "target_duration": 10,
  "panel_count": 6,
  "source_entry": "data/provinces/湖南.md#屈原投江汨罗——端午节起源",
  "cultural_constraints": [
    "保留屈原、汨罗江、端午意象",
    "不要把民间托梦情节写成正史"
  ],
  "credibility_note": "正史记载与民间传说混合，影视文本中的对白为改编创作。"
}
```

### 3.3 GEARS 输入

`grears v2` 最核心需要的是：

```json
{
  "script_text": "...",
  "target_duration": 10,
  "panel_count": 6,
  "recipe_metadata": {
    "source": "china-culture-kb",
    "source_entry": "data/provinces/湖南.md#屈原投江汨罗——端午节起源",
    "cultural_constraints": [],
    "credibility_note": ""
  }
}
```

注意：GEARS 的完整 `RecipeCreate` 还需要 `character_refs`、`scene_ref`、`staging_pack_id`、`visual_pack_id`。本功能第一阶段只输出故事文本和元数据，不强行创建 GEARS recipe。

---

## 4. 推荐新增目录结构

在 `D:/china-culture-kb` 中新增：

```text
templates/
  story-generation-template.md
  story-seed-template.md

data/
  story-seeds/
    湖南/
      屈原投江汨罗.story-seed.md

generated/
  stories/
    湖南/
      屈原投江汨罗.generated-story.json

mcp-server/
  src/
    story_generation/
      __init__.py
      models.py
      retriever.py
      seed_builder.py
      prompt_builder.py
      generator.py
      exporter.py
      validators.py
```

如果当前 `mcp-server` 不是 Python 项目，Claude Code 应先查看现有技术栈，再按现有语言实现同等模块。不要强行换栈。

---

## 5. 数据模板

### 5.1 `templates/story-generation-template.md`

```md
# 故事生成模板

## 输入

- 文化主题：{{topic}}
- 地区：{{province_or_region}}
- 类型：{{culture_type}}
- 目标时长：{{target_duration}}
- 风格倾向：{{tone}}
- 严格程度：{{strictness}}

## 资料摘要

### 事实锚点
{{facts}}

### 传说元素
{{legend_elements}}

### 文化元素
{{cultural_elements}}

### 不可误写
{{do_not_misrepresent}}

### 来源与可信度
{{sources_and_credibility}}

## 生成要求

请基于以上资料生成一个适合 AI 影视 Agent 使用的短故事。

要求：

1. 故事必须适合 {{target_duration}} 秒短片。
2. 故事应为单场景或极少场景，避免长篇传记。
3. 必须保留核心文化元素。
4. 不得把待核实传说写成确定史实。
5. 可以创作具体动作、对白、镜头化细节，但必须标注为影视改编。
6. 输出只返回 JSON。

## 输出 JSON

```json
{
  "title": "",
  "logline": "",
  "script_text": "",
  "target_duration": 10,
  "panel_count": 6,
  "main_characters": [],
  "main_location": "",
  "cultural_constraints": [],
  "credibility_note": "",
  "source_entry": ""
}
```
```

### 5.2 `templates/story-seed-template.md`

```md
# {{title}} 故事种子

## 来源

- **source_entry**：
- **省份**：
- **地区**：
- **类型**：
- **可信度**：

## 事实锚点

-

## 传说元素

-

## 文化元素

-

## 不可误写

-

## 故事生成目标

- **推荐时长**：
- **推荐分镜格数**：
- **故事基调**：
- **目标受众**：

## 生成结果

```text
{{script_text}}
```
```

---

## 6. 模块设计

### 6.1 `models`

定义核心数据结构。

建议模型：

```python
class StoryGenerationRequest:
    topic: str
    province: str | None
    region: str | None
    culture_type: str | None
    target_duration: int = 10
    panel_count: int | None = None
    tone: str | None
    strictness: str = "balanced"

class KnowledgeEntry:
    title: str
    source_path: str
    province: str | None
    region: str | None
    culture_type: str | None
    summary: str
    story_outline: str
    cultural_meaning: str
    related_places: list[str]
    keywords: list[str]
    sources: list[str]
    credibility: str | None
    verification_notes: list[str]

class StorySeed:
    title: str
    source_entry: str
    facts: list[str]
    legend_elements: list[str]
    cultural_elements: list[str]
    do_not_misrepresent: list[str]
    recommended_duration: int
    recommended_panel_count: int

class GeneratedStory:
    title: str
    logline: str
    script_text: str
    target_duration: int
    panel_count: int
    source_entry: str
    cultural_constraints: list[str]
    credibility_note: str
```

如果项目已经使用 TypeScript，则用 `zod` 或 TypeScript interface 实现同等结构。

### 6.2 `retriever`

职责：从知识库 Markdown 中检索相关条目。

支持输入：

- 条目名；
- 关键词；
- 省份；
- 地区；
- 类型。

检索顺序：

1. 优先搜索 `data/provinces/*.md`；
2. 再搜索 `data/regions`；
3. 再搜索 `indexes`；
4. 不做外网搜索，除非用户明确要求补充资料。

实现要求：

- 使用结构化 Markdown 解析优先；
- 如果暂时没有 Markdown AST，可先用标题分块；
- 一个条目块从 `## 条目名` 开始，到下一个 `---` 或下一个 `## ` 结束；
- 解析字段：简介、故事梗概、文化意义、相关地点、关键词、来源、可信度、待核实点。

### 6.3 `seed_builder`

职责：把 `KnowledgeEntry` 转成 `StorySeed`。

规则：

- `facts` 来自简介、故事梗概中有来源支撑的内容；
- `legend_elements` 来自神话、民间传说、待核实点；
- `cultural_elements` 来自关键词、相关地点、文化意义；
- `do_not_misrepresent` 来自待核实点和可信度说明；
- `recommended_duration` 默认 10；
- `recommended_panel_count` 默认 6。

### 6.4 `prompt_builder`

职责：把 Story Seed 装配成 LLM 可用 prompt。

硬规则：

- 不直接把整篇省份 Markdown 塞给模型；
- 只传当前条目的摘要和必要字段；
- 明确要求“输出 JSON”；
- 明确禁止把待核实内容写成史实；
- 明确目标时长和短片节奏。

### 6.5 `generator`

职责：调用 LLM 生成故事。

第一阶段可以做两种实现：

1. **无 LLM mock 实现**：基于模板生成一个简单故事，方便打通链路；
2. **真实 LLM 实现**：调用项目现有 LLM 接口。

如果 `china-culture-kb` 当前没有统一 LLM 适配器，先不要大规模引入复杂框架。可以先留接口：

```python
class StoryGenerator:
    def generate(request: StoryGenerationRequest) -> GeneratedStory:
        ...
```

### 6.6 `validators`

职责：校验生成结果是否能交给 GEARS。

校验规则：

- `script_text` 不为空；
- `target_duration` 必须 5-15；
- `panel_count` 如果存在，必须是 `4/6/8/9/10/12`；
- `script_text` 不宜过长，建议 50-300 中文字；
- 必须有 `source_entry`；
- 必须有 `credibility_note`；
- 如果包含待核实传说，必须在 `credibility_note` 说明；
- 不允许出现“来源证明了虚构对白”这类表述。

### 6.7 `exporter`

职责：导出给 GEARS 使用的 JSON。

推荐输出：

```json
{
  "script_text": "...",
  "target_duration": 10,
  "panel_count": 6,
  "recipe_metadata": {
    "source": "china-culture-kb",
    "source_entry": "...",
    "generated_story_title": "...",
    "cultural_constraints": [],
    "credibility_note": ""
  }
}
```

---

## 7. CLI 或 MCP 接口设计

根据 `D:/china-culture-kb/mcp-server` 现有结构选择 CLI 或 MCP tool。推荐先做 CLI，再接 MCP。

### 7.1 CLI 示例

```bash
kb-story generate --topic "屈原投江汨罗" --province "湖南" --duration 10 --panel-count 6
```

输出：

```json
{
  "title": "汨罗暮色",
  "script_text": "...",
  "target_duration": 10,
  "panel_count": 6,
  "source_entry": "data/provinces/湖南.md#屈原投江汨罗——端午节起源",
  "cultural_constraints": [],
  "credibility_note": ""
}
```

### 7.2 MCP tool 示例

工具名建议：

```text
kb_generate_story
```

输入 schema：

```json
{
  "topic": "屈原投江汨罗",
  "province": "湖南",
  "region": "岳阳→汨罗",
  "culture_type": "神话传说",
  "target_duration": 10,
  "panel_count": 6,
  "tone": "悲壮、诗意",
  "strictness": "balanced"
}
```

输出 schema：

```json
{
  "story": {
    "title": "",
    "logline": "",
    "script_text": "",
    "target_duration": 10,
    "panel_count": 6
  },
  "source": {
    "source_entry": "",
    "credibility": "",
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

## 8. GEARS 对接方式

### 8.1 第一阶段：人工复制

最小可行方式：

1. 在 `china-culture-kb` 生成 `script_text`；
2. 用户把 `script_text` 复制到 GEARS 的剧本文本输入框；
3. GEARS 使用现有能力生成分镜脚本。

### 8.2 第二阶段：JSON 导入

`china-culture-kb` 导出：

```json
{
  "script_text": "...",
  "target_duration": 10,
  "panel_count": 6,
  "recipe_metadata": {
    "source": "china-culture-kb"
  }
}
```

`grears v2` 新增“从知识库故事导入”入口，填充 Recipe 表单中的故事文本、时长和格数。

### 8.3 第三阶段：一键生成脚本

未来链路：

```text
GEARS 前端选择“从中国文化知识库生成故事”
        ↓
调用 china-culture-kb MCP
        ↓
返回 story + gears_payload
        ↓
GEARS 创建 recipe
        ↓
GEARS 生成分镜脚本
```

---

## 9. 故事生成规则

### 9.1 短片故事规则

生成给 GEARS 的故事必须符合：

- 单一核心事件；
- 1-3 个主要人物；
- 1 个主要场景；
- 1 个清晰情绪弧线；
- 1 个有画面感的结尾；
- 适合 5-15 秒表达；
- 不写成长篇传记；
- 不堆砌背景资料。

### 9.2 script_text 长度建议

| 时长 | 建议字数 | 推荐格数 |
|---|---:|---:|
| 5 秒 | 40-80 字 | 4 |
| 10 秒 | 80-160 字 | 6 |
| 15 秒 | 120-260 字 | 8 / 9 / 10 |

### 9.3 可信度规则

故事中内容分三层：

1. **事实层**：来自正史、官方资料、地方志、非遗名录；
2. **传说层**：来自民间故事、神话、地方口述；
3. **改编层**：为了影视表达新增的动作、对白、节奏。

输出中必须说明：

```text
影视对白和具体动作是改编创作，不作为史实来源。
```

### 9.4 不可生成的内容

- 不得伪造来源；
- 不得把待核实内容写成正史；
- 不得随意改写真实历史人物核心立场；
- 不得混淆古今地名；
- 不得混合多个地区版本，除非用户要求；
- 不得把民族、宗教、祭祀仪式娱乐化或猎奇化；
- 不得生成与文化条目无关的泛古风故事。

---

## 10. 示例

### 10.1 输入

```json
{
  "topic": "屈原投江汨罗",
  "province": "湖南",
  "target_duration": 10,
  "panel_count": 6,
  "tone": "悲壮、诗意",
  "strictness": "balanced"
}
```

### 10.2 输出

```json
{
  "title": "汨罗暮色",
  "logline": "暮色中，屈原在百姓呼喊声里抱石走向汨罗江。",
  "script_text": "暮色压低汨罗江面。屈原站在芦苇岸边，手中竹简被风吹开。他望向远处战火方向，轻声说：“楚虽破，心不可降。”江上传来百姓急促的呼喊，他抱石转身走向水光。",
  "target_duration": 10,
  "panel_count": 6,
  "source_entry": "data/provinces/湖南.md#屈原投江汨罗——端午节起源",
  "cultural_constraints": [
    "保留屈原、汨罗江、楚国士大夫、端午意象",
    "托梦和粽子细节只能作为民间传说，不得写成正史"
  ],
  "credibility_note": "屈原与汨罗江叙事有文献和非遗资料支撑；具体对白和动作是影视改编。"
}
```

---

## 11. Claude Code 实施步骤

Claude Code 应按以下顺序实现。

### Step 1：阅读现有项目

先查看：

```text
D:/china-culture-kb/README.md
D:/china-culture-kb/CLAUDE.md
D:/china-culture-kb/templates/entry-template.md
D:/china-culture-kb/mcp-server
D:/china-culture-kb/data/provinces/湖南.md
```

确认：

- 项目语言；
- MCP server 技术栈；
- 是否已有检索工具；
- 是否已有视频录入工具；
- 是否已有 LLM 调用方式。

### Step 2：新增模板

新增：

```text
templates/story-generation-template.md
templates/story-seed-template.md
```

### Step 3：实现条目检索

实现：

```text
story_generation/retriever
```

能力：

- 按标题查；
- 按关键词查；
- 按省份查；
- 返回最相关条目；
- 解析条目字段。

### Step 4：实现 Story Seed 构建

实现：

```text
story_generation/seed_builder
```

把知识条目转成结构化 Story Seed。

### Step 5：实现故事生成

实现：

```text
story_generation/generator
```

优先打通 mock 版本：

```text
从条目简介 + 故事梗概 + 文化元素拼出一个短 script_text
```

再接入真实 LLM。

### Step 6：实现校验器

实现：

```text
story_generation/validators
```

校验 GEARS 可消费性。

### Step 7：实现导出

实现：

```text
story_generation/exporter
```

输出：

```text
generated/stories/{省份}/{条目名}.generated-story.json
```

### Step 8：接 CLI 或 MCP

根据现有项目结构选择：

- CLI：`kb-story generate`
- MCP tool：`kb_generate_story`

优先 MCP，因为后续 GEARS / Claude / Codex 可以直接调用。

### Step 9：写测试

至少覆盖：

- 屈原投江汨罗能检索；
- 能构建 Story Seed；
- 能生成 `script_text`；
- 输出 `target_duration` 合法；
- 输出 `panel_count` 合法；
- 输出包含 `source_entry`；
- 待核实点进入 `cultural_constraints` 或 `credibility_note`；
- 不存在条目时返回明确错误。

---

## 12. 验收标准

### 12.1 功能验收

- 输入“屈原投江汨罗”能生成一个故事；
- 输出包含 `script_text`；
- `script_text` 可以直接粘到 GEARS；
- 输出包含来源条目；
- 输出包含文化约束；
- 输出 JSON 结构稳定；
- 不编造来源；
- 不把待核实内容写成史实。

### 12.2 与 GEARS 联调验收

把 `script_text` 放入 GEARS 后：

- GEARS 能完成剧本分类；
- GEARS 能生成分镜规划；
- 分镜没有明显违背文化约束；
- 故事仍保留原文化条目的核心元素。

---

## 13. 第一阶段不做的事

第一阶段不要做：

- 不做自动创建 GEARS 人物资产；
- 不做自动创建 GEARS 场景资产；
- 不做图片生成；
- 不做视频生成；
- 不做跨省复杂多版本融合；
- 不做大规模外网爬取；
- 不做长篇剧本生成。

这些放到第二阶段。

---

## 14. 第二阶段方向

第一阶段完成后再扩展：

1. 从故事自动提取主角建议；
2. 从故事自动提取场景建议；
3. 自动推荐 GEARS 调度包和视觉包；
4. 在 GEARS 中新增“从知识库生成故事并创建 Recipe”；
5. 支持同一文化条目生成多个风格版本；
6. 支持严格史实版、神话传说版、儿童动画版、纪录片版。

---

## 15. 最终结论

本功能的核心不是让 `china-culture-kb` 变成影视制作系统，而是让它成为 GEARS 的“文化故事上游”。

最小闭环是：

```text
文化条目 → Story Seed → script_text → GEARS 分镜脚本
```

Claude Code 实现时应优先保证：

- 检索准确；
- 来源清楚；
- 故事短而可拍；
- 输出 JSON 稳定；
- GEARS 能直接消费 `script_text`。

