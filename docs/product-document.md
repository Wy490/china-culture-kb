# 中国传统文化知识库 — 产品文档

> 版本：v1.0
> 日期：2026-06-09
> 作者：产品整理

---

## 1. 产品定位

**一句话描述**：从中国传统文化知识库到视频脚本的全链路生产平台——浏览知识库 → 生成剧情方案 → 输出 GEARS 分段脚本 → 衔接视频生产。

**核心用户**：

| 用户角色 | 核心诉求 |
|----------|----------|
| 内容创作者 | 从知识库条目快速生成可用的视频故事脚本 |
| 视频生产方（grears v2） | 拉取分段脚本，驱动分镜 → 故事板 → 视频产出 |
| 文化研究者 | 浏览、搜索、核实传统文化知识条目 |
| MCP 工具用户 | 通过 Claude Code 直接操作知识库（录入/搜索/核实/补充） |

**产品链路**：

```
知识库浏览 → 条目搜索 → 故事生成工坊 → 剧情方案输出 → GEARS 分段 → 视频生产
```

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│                    浏览器前端                         │
│               Vue3 + Vite SPA                        │
│  Home / Search / Province / Entry / StoryStudio      │
│                    / StoryDetail                      │
└────────────────────────┬────────────────────────────┘
                         │ HTTP REST / CORS
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Express API Server                   │
│              (localhost:3000/api)                     │
│                                                       │
│  routes/entries  ─→  entry-service ─→ mcp-proxy       │
│  routes/stories  ─→  story-service ─→ dramatic-story │
│  routes/outline  ─→  outline-service                  │
│  routes/system                                          │
└────────────────────────┬────────────────────────────┘
                         │ 直接 import 纯函数（不走 MCP 协议）
                         ↓
┌─────────────────────────────────────────────────────┐
│                  MCP Server 层                        │
│              14 个工具函数（纯函数，可复用）              │
│                                                       │
│  search / get-detail / match / supplement             │
│  collect / verify / fetch-article / fetch-video       │
│  add-entry / query-index / generate-script            │
└────────────────────────┬────────────────────────────┘
                         │ fs.readFile / fs.writeFile
                         ↓
┌─────────────────────────────────────────────────────┐
│            知识库 Markdown 文件                        │
│              data/provinces/*.md                      │
│           34 省份 · 87 条目 · 12 类型                  │
└─────────────────────────────────────────────────────┘

生成故事写入：
  web/generated/stories/{video_type}/{storyId}.json
```

### 2.2 技术栈

| 层 | 技术 | 说明 |
|---|---| ---|
| 前端 | Vue 3 + Vite + Vue Router + Pinia | SPA，客户端渲染 |
| 后端 | Express 5 + TypeScript (ESM) | REST API |
| 校验 | Zod | 输入校验中间件 |
| MCP 联用 | 直接 import 纯函数 | 通过 mcp-proxy.ts 适配，不走 MCP 协议 |
| 数据存储 | Markdown 文件 | 知识库事实条目与 AI 生成内容严格分离 |
| 故事存储 | JSON 文件 | `web/generated/stories/{video_type}/` |
| CORS | cors 中间件 | CORS_ORIGINS 环境变量控制白名单 |

### 2.3 关键设计原则

1. **产品语义驱动**：API 和前端围绕"浏览 → 生成 → 输出"链路设计，不是 MCP 工具一一映射
2. **AI 内容与事实分离**：生成故事存 `web/generated/stories/`，不写入知识库 `data/provinces/`
3. **共享类型独立定义**：`web/shared/types.ts` 独立定义 Web API 类型，不复用 MCP 旧类型
4. **前端不拼接 URL**：storyId 和 gears_segments_url 由后端统一返回
5. **格式版本可演进**：gears-segments 返回 `schema_version`，下游可做版本兼容

---

## 3. 知识库内容

### 3.1 内容范围

| 指标 | 数值 |
|------|------|
| 覆盖省份 | 34（含港澳台） |
| 有效条目 | 87 |
| 最丰富省份 | 湖南（65 条目，3,524 行） |
| 已有生成故事 | 20 个 JSON 文件 |

### 3.2 条目类型分布

| 类型 | 数量 | 说明 |
|------|------|------|
| 地方掌故 | 31 | 最丰富类型 |
| 历史人物 | 23 | 第二丰富 |
| 名胜古迹 | 19 | 第三丰富 |
| 非遗 | 5 | |
| 神话传说 | 3 | |
| 节庆习俗 | 2 | |
| 间故事 | 2 | |
| 饮食文化 | 1 | |
| 地方戏曲 | 1 | |
| 传统工艺 / 宗教信仰 / 民俗活动 | 0 | 已定义，尚无条目 |

### 3.3 条目字段结构

每个知识库条目包含 11 个必填字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| 名称 | 条目标题 | `周敦颐——理学开山鼻祖` |
| 省份 | 现代行政区划省名 | `湖南` |
| 地区 | 市→县箭头格式 | `湖南→永州→道县` |
| 类型 | 12 种类型之一 | `历史人物` |
| 简介 | 一段摘要 | |
| 故事梗概 | ≤25行（人物）/ ≤30行（名胜）/ ≤20行（其他） | |
| 文化意义 | 对当地文化的影响 | |
| 相关地点 | JSON 数组 | |
| 关键词 | 逗号分隔 | |
| 来源 | 质量 A/B/C/D 分级标注 | |
| 可信度与核实 | 交叉认证评级 + 核实方式 | `基本可靠（A级《史记》+B级汨罗非遗）` |
| 待核实点 | JSON 数组 | |

### 3.4 来源质量分级

| 级别 | 定义 | 示例 |
|------|------|------|
| A级 | 正史/一手文献 | 《史记》《宋史》，人物本人著作，考古报告 |
| B级 | 官方认定 | 国家级非遗名录，全国重点文保，地方志 |
| C级 | 二手学术 | 学术专著，专业论文，权威百科 |
| D级 | 民间口述 | 民间传说，地方口述传统 |

### 3.5 可信度等级

| 可信度 | 交叉认证要求 |
|--------|-------------|
| 可靠 | ≥2个A级来源互相佐证 |
| 基本可靠 | ≥1个A级 + ≥1个B/C级来源 |
| 待核实 | 仅C/D级来源，或单一A级无佐证 |
| 存疑 | 仅D级来源且内容自相矛盾 |

---

## 4. 核心功能

### 4.1 知识库浏览与搜索

**页面**：首页 `/`、搜索 `/search`、省份 `/province/:name`、条目 `/entry?name=xxx`

| 功能 | 说明 |
|------|------|
| 省份浏览 | 34 省份网格，每省条目数 |
| 关键词搜索 | 支持 keywords / type / province / region 组合筛选 |
| 条目详情 | 完整内容渲染（梗概、文化意义、来源、可信度） |
| 可信度可视化 | 颜色编码（可靠=绿 / 基本可靠=蓝 / 待核实=黄 / 存疑=红） |
| 快捷生成按钮 | 条目详情页底部提供 5 种视频类型的快捷生成入口 |

### 4.2 视频方案工坊（核心功能）

**页面**：`/story/new` — 左右分栏布局

**三种输入模式**：

| 模式 | 输入方式 | 适用场景 |
|------|----------|----------|
| 词条模式 | 输入关键词 → 自动匹配知识库词条 | 已有明确条目，单条目生成 |
| 主题模式 | 输入创作主题 → 大纲分析 → 知识组合包匹配 | 有创作方向但需知识支撑 |
| 大纲模式 | 输入故事大纲 → 分析提取 → 多条目匹配 | 有完整构思，需多条目支撑 |

**词条模式流程**：

```
输入关键词 → 自动匹配(kb/entries/match) → 选择词条 → 预览推荐(/stories/plan)
→ 选择事件/类型 → 生成剧情方案(/stories/generate)
```

**主题/大纲模式流程**：

```
输入主题/大纲 → 大纲分析(/story-outline/analyze) → 提取知识需求
→ 知识匹配(/entries/multi-match) → 选择条目组合 → 生成剧情方案
```

### 4.3 成片类型体系

**15 种 VideoType，分 4 组**：

| 组 | 类型 | 默认时长 | 默认表现形式 |
|----|------|----------|-------------|
| 剧情故事类 | character_story（人物故事） | 3分钟 | cinematic（影视叙事） |
| | historical_drama（历史剧情） | 5分钟 | cinematic |
| | legend_story（传说故事） | 3分钟 | cinematic |
| | ai_comic_drama（AI漫剧） | 3分钟 | ai_comic（AI漫剧） |
| | children_story（儿童故事） | 5分钟 | cinematic |
| 宣传推广类 | culture_promo（文化宣传） | 1分钟 | documentary（纪实风格） |
| | heritage_promo（非遗宣传） | 3分钟 | documentary |
| | city_brand_promo（城市文旅） | 1分钟 | cinematic |
| | social_short（竖屏短视频） | 30秒 | fast_cut（快节奏剪辑） |
| 讲解教育类 | documentary_short（微纪录） | 5分钟 | documentary |
| | explainer_video（知识讲解） | 3分钟 | lecture_style（讲台风格） |
| | lecture_video（宣讲片） | 10分钟 | lecture_style |
| | education_training（教育培训） | 15分钟 | lecture_style |
| 场景空间类 | scene_short（场景短片） | 1分钟 | cinematic |
| | landscape_mood（山水意境） | 1分钟 | ink_style（水墨风格） |

**11 种 PresentationStyle**：

| 风格 | 说明 |
|------|------|
| cinematic（影视叙事） | 传统影视叙事手法 |
| documentary（纪实风格） | 纪实手法，强调真实性 |
| ai_comic（AI漫剧） | AI 驱动漫剧风格 |
| ink_style（水墨风格） | 中国传统水墨画风 |
| fast_cut（快节奏剪辑） | 快节奏、碎片化剪辑 |
| lecture_style（讲台风格） | 演讲/讲台式呈现 |
| immersive（沉浸体验） | 360°沉浸式体验 |
| interactive（互动叙事） | 交互式叙事结构 |
| micro_doc（微纪实） | 微型纪实风格 |
| story_stage（舞台叙事） | 戏剧舞台风格 |
| visual_poetry（视觉诗） | 视觉诗意表达 |

### 4.4 故事生成管线

**完整生成流程（6 步）**：

```
① 解析 VideoType → ② 确定主条目 → ③ 选择中心事件（冲突评分）
→ ④ 生成戏剧内容 → ⑤ 质量校验 → ⑥ 存盘返回
```

**中心事件选择算法**：

从条目故事梗概中提取加粗事件，对每个事件计算冲突评分：

| 评分维度 | 加分关键词 | 说明 |
|----------|-----------|------|
| 冲突 boost | 对抗、拒绝、冲突、矛盾 | 核心戏剧冲突 |
| 选择关键词 | 选择、抉择、决定 | 主角主动选择 |
| 逆转关键词 | 逆转、翻盘、反转 | 情节转折 |
| 权力关键词 | 降职、贬、驱逐 | 权力变动 |
| 结果关键词 | 牺牲、殉国、殉、投 | 高烈度结局 |
| 减分 | 生平、经历、简介、综述 | 非戏剧性描述减分 |

**戏剧内容模板引擎**：

根据事件关键词匹配不同的戏剧模板：

| 事件类型 | 模板函数 | 适用关键词 |
|----------|----------|-----------|
| 拒签/断案类 | buildRefuseTemplate | 拒签、断案、拒、执法 |
| 投江/殉国类 | buildSacrificeTemplate | 投江、殉国、殉、牺牲 |
| 起义/革命类 | buildRevolutionTemplate | 起义、革命、暴动 |
| 通用类 | buildGenericTemplate | 其他事件 |

**质量校验 7 项**：

| 校验项 | 说明 |
|--------|------|
| hasCentralEvent | 有中心事件 |
| hasConflict | 有冲突描述 |
| hasProtagonistChoice | 主角有主动选择 |
| hasSceneAction | 场次有具体动作 |
| hasClimax | 有高潮场次 |
| hasEndingTheme | 结尾有主题升华 |
| isNotBiographySummary | 不是传记流水账 |

---

## 5. 故事输出格式

### 5.1 StoryGenerateResult 完整结构

```json
{
  "storyId": "20260609-story-5xhh",
  "title": "拒签冤案",
  "generation_type": "character_story",
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "source_entry": "周敦颐——理学开山鼻祖",
  "logline": "一句概括性故事前提",
  "theme": "主题：XX | 冲突：XX | 情感：XX",
  "full_text": "完整叙事文本（分段渲染）",

  "scene_breakdown": [
    {
      "scene_id": 1,
      "title": "场次标题",
      "duration_sec": 12,
      "location": "地点",
      "time_of_day": "时间",
      "dramatic_function": "钩子开场",
      "plot": "剧情描述",
      "key_action": "关键动作",
      "characters": ["人物1", "人物2"],
      "visual_prompt": "视觉描述",
      "camera_suggestion": "镜头建议",
      "cultural_note": "文化注释",
      "conflict": "冲突描述",
      "dialogue_or_narration": "对话/旁白",
      "source_entries": ["知识库条目1"],
      "factual_basis": "史实依据",
      "fictionalized_elements": "影视化创作部分"
    }
  ],

  "gears_segments": [
    {
      "segment_id": 1,
      "source_scene_id": 1,
      "duration_sec": 12,
      "panel_count": 6,
      "script_text": "分段脚本文本",
      "purpose": "钩子开场",
      "visual_focus": ["地点", "视觉元素1", "视觉元素2"],
      "cultural_constraints": ["文化约束1"],
      "video_type": "character_story",
      "presentation_style": "cinematic",
      "segment_prompt_hint": "人物故事/影视叙事风格提示: ...",
      "source_entries": ["知识库条目1"]
    }
  ],

  "gears_segments_url": "/api/stories/20260609-story-5xhh/gears-segments",

  "characters": [
    { "name": "周敦颐", "role": "主角", "description": "...", "arc": "..." }
  ],
  "act_structure": [
    { "act": 1, "beat": "钩子", "scene_ids": [1], "purpose": "建立危机" }
  ],
  "protagonist_arc": {
    "starting_state": "...", "turning_point": "...", "resolution": "..."
  },

  "cultural_constraints": ["不可将月岩悟道写成史实"],
  "credibility_note": "基本可靠（A级+B级交叉佐证）",

  "knowledge_pack": {
    "primary_entries": [...],
    "supporting_entries": [...],
    "missing_needs": [...],
    "overall_confidence": 0.85
  },

  "quality_report": {
    "hasCentralEvent": true,
    "hasConflict": true,
    "hasProtagonistChoice": true,
    "hasSceneAction": true,
    "hasClimax": true,
    "hasEndingTheme": true,
    "isNotBiographySummary": true,
    "passed": true,
    "issues": []
  }
}
```

### 5.2 类型特有字段

不同 VideoType 产出不同的附加字段：

| VideoType | 特有字段 |
|-----------|---------|
| character_story | characters, act_structure, protagonist_arc, dialogue |
| ai_comic_drama | dialogue（场景对白） |
| culture_promo / heritage_promo / city_brand_promo | visual_symbols, craft_or_ritual_process, modern_connection, core_message, slogan_or_key_sentence |
| scene_short / landscape_mood | spatial_identity, visual_route, time_layer, atmosphere |
| explainer_video / lecture_video / education_training | argument_points, knowledge_outline |
| documentary_short | source_quotes, field_notes |

### 5.3 故事存储

| 规则 | 说明 |
|------|------|
| 存储路径 | `web/generated/stories/{video_type}/{storyId}.json` |
| storyId 格式 | `{YYYYMMDD}-story-{hash36}` |
| 不可变性 | 生成后无法修改或重新生成同一 storyId |
| 内部字段 | `_request_meta` 仅用于存盘，API 返回时剥离 |

---

## 6. REST API 总览

### 6.1 统一响应格式

```json
// 成功
{ "ok": true, "data": {...}, "error": null }

// 失败
{ "ok": false, "data": null, "error": { "code": "ENTRY_NOT_FOUND", "message": "未找到条目" } }
```

### 6.2 错误码

| 错误码 | 说明 |
|--------|------|
| ENTRY_NOT_FOUND | 条目未找到 |
| INVALID_GENERATION_TYPE | generation_type 不合法 |
| INVALID_DURATION | 时长不在支持范围 |
| STORY_GENERATION_FAILED | 故事生成失败 |
| STORY_NOT_FOUND | 已生成故事未找到 |
| GEARS_SEGMENTS_NOT_FOUND | 分段数据未找到 |
| VALIDATION_ERROR | 输入校验失败 |
| INTERNAL_ERROR | 服务内部错误 |

### 6.3 核心 API

#### 条目 `/api/entries`

| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/entries/search` | GET | 搜索知识库条目 | keywords, type, province, region |
| `/api/entries/detail` | GET | 条目完整详情 | name（query 参数） |
| `/api/entries/match` | POST | 语义匹配（故事创作） | query, limit |
| `/api/entries/multi-match` | POST | 多条目匹配（大纲驱动） | outline, knowledge_needs, limit_per_need |

#### 故事 `/api/stories`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/stories/plan` | POST | 预览推荐（推荐类型/事件/时长/风险） |
| `/api/stories/generate` | POST | 生成完整故事 |
| `/api/stories` | GET | 已生成故事列表 |
| `/api/stories/:storyId` | GET | 获取完整故事 |
| `/api/stories/:storyId/gears-segments` | GET | GEARS 专用分段脚本 |

#### 大纲 `/api/story-outline`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/story-outline/analyze` | POST | 大纲分析（提取人物/时代/冲突/知识需求） |

#### 系统 `/api/system`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/system/provinces` | GET | 34 省份列表 + 条目统计 |
| `/api/system/types` | GET | 类型枚举 + VideoType 路由推荐 |

### 6.4 故事生成请求参数

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "generation_type": "character_story",
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "selected_event": "南安拒签冤案",
  "target_video_duration": "3分钟",
  "tone": "庄重、紧张、克制",
  "output_gears_segments": true,
  "original_user_query": "周敦颐拒签冤案故事",
  "outline": "（大纲模式时提供）",
  "knowledge_pack": { "（大纲模式时提供）" }
}
```

---

## 7. GEARS 分段脚本格式

### 7.1 GearsSegment 结构

GEARS 分段是故事输出中面向视频生产的核心结构。每个故事包含 5 个分段，1:1 映射场次。

```json
{
  "segment_id": 1,
  "source_scene_id": 1,
  "duration_sec": 12,
  "panel_count": 6,
  "script_text": "南安军司理参军署，深夜。周敦颐面对一桩冤案，案卷上的人命与上司的命令形成对峙。",
  "purpose": "钩子开场",
  "visual_focus": ["南安军司理参军署", "案卷", "雨夜石阶"],
  "cultural_constraints": ["家属和雨夜为影视化创作"],
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "segment_prompt_hint": "人物故事/影视叙事风格提示: 影视叙事手法，场景1聚焦周敦颐面对冤案的选择",
  "source_entries": ["周敦颐——理学开山鼻祖"]
}
```

### 7.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| segment_id | number | 分段序号（1-based） |
| source_scene_id | number | 对应场次 ID（当前 = segment_id） |
| duration_sec | number | 分段时长（秒） |
| panel_count | 4\|6\|8\|9\|10\|12 | 分镜面板数，由时长映射 |
| script_text | string | 分段脚本文本（核心生产输入） |
| purpose | string | 戏剧功能标签（钩子开场/发展/转折/高潮/结尾） |
| visual_focus | string[] | 视觉焦点元素（最多 3 个） |
| cultural_constraints | string[] | 文化约束/可信度警告 |
| video_type | string | 成片类型标识 |
| presentation_style | string | 表现形式标识 |
| segment_prompt_hint | string | 风格+场景提示文本 |
| source_entries | string[] | 来源知识库条目 |

### 7.3 panel_count 时长映射

| duration_sec | panel_count |
|-------------|-------------|
| 12-20 | 6 |
| 25 | 8 |
| 30 | 9 |
| 36-50 | 10 |
| 60-120 | 12 |

### 7.4 script_text 组成规则

当前格式：`{location}, {time_of_day}. {plot(≤80字)}. {dialogue_or_narration(如有)}. [{camera_suggestion}]`

示例产出：
```
南安军司理参军署，深夜。周敦颐面对一桩冤案，案卷上的人命与上司的命令形成对峙。近距离特写：案卷上的签名空白处。
```

### 7.5 GEARS 专用 API 响应

`GET /api/stories/:storyId/gears-segments`

```json
{
  "ok": true,
  "data": {
    "schema_version": "gears-segments/v2",
    "storyId": "20260609-story-5xhh",
    "title": "拒签冤案",
    "total_duration_sec": 186,
    "segments": [...]
  }
}
```

---

## 8. GEARS 接入模式建议

### 8.1 当前状态

当前 GEARS 接入仅停留在"手工搬运"层面：

- 前端 GearsActions 组件提供复制 JSON、导出文件、复制单段脚本
- "发送到 GEARS v2"按钮为占位状态（disabled）
- grears v2 需手动通过 API 拉取分段数据

### 8.2 接入模式建议

根据 grears v2 的不同使用场景和技术能力，建议以下 **三种接入模式**，可按阶段逐步启用：

---

#### 模式 A：API 拉取模式（推荐首选，最低接入成本）

**适用场景**：grears v2 作为独立前端/工具，主动从知识库平台拉取分段数据。

**接入方式**：

```
grears v2 前端/后端
       │
       │  GET /api/stories/:storyId/gears-segments
       │  （带上 schema_version 做版本兼容）
       ↓
知识库 API Server (localhost:3000)
```

**接入步骤**：

1. grears v2 通过故事列表 `GET /api/stories` 发现可用故事
2. 选择目标故事，调用 `GET /api/stories/:storyId/gears-segments`
3. 根据 `schema_version` 判断字段兼容性（v2 新增了 video_type / presentation_style / segment_prompt_hint / source_entries）
4. 从 `segments[]` 中提取 `script_text` + `panel_count` + `visual_focus` 驱动分镜生产
5. 用 `cultural_constraints` 做内容合规校验

**优势**：
- 接入成本最低，只需 HTTP GET 请求
- 无需改动知识库平台代码
- schema_version 机制支持版本演进

**局限**：
- 依赖 CORS 白名单配置
- 故事生成是同步阻塞的（第一阶段），拉取时故事已生成完毕

**CORS 配置建议**：

```env
# 知识库平台侧
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://grears-v2-host:port

# grears v2 侧请求时无需特殊 header，标准 GET 即可
```

---

#### 模式 B：Webhook 推送模式（推荐第二阶段）

**适用场景**：故事生成完成后，主动通知 grears v2 有新内容可用，避免 grears 反复轮询。

**接入方式**：

```
知识库平台（故事生成完成）
       │
       │  POST https://grears-v2-host/api/webhook/story-ready
       │  Body: { storyId, title, video_type, gears_segments_url, total_duration_sec }
       ↓
grears v2 后端（接收通知 → 拉取详细分段）
       │
       │  GET /api/stories/:storyId/gears-segments
       ↓
知识库 API Server（返回完整分段数据）
```

**需要新增**：

| 改动 | 位置 | 说明 |
|------|------|------|
| Webhook 配置 | 知识库平台环境变量 | `GEARS_WEBHOOK_URL=https://grears-v2-host/api/webhook/story-ready` |
| 故事生成后触发 | story-service.ts | `generateAndStoreStory()` 完成后异步 POST webhook |
| grears v2 webhook 端点 | grears v2 后端 | 接收通知 → 拉取分段 → 入队生产 |

**Webhook 通知体**：

```json
{
  "event": "story_ready",
  "storyId": "20260609-story-5xhh",
  "title": "拒签冤案",
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "gears_segments_url": "/api/stories/20260609-story-5xhh/gears-segments",
  "total_duration_sec": 186,
  "panel_count_total": 48,
  "timestamp": "2026-06-09T10:30:00Z"
}
```

**优势**：
- 实时通知，grears v2 无需轮询
- 解耦两个系统，知识库平台只管生成和通知
- 支持批量生产场景（多个故事排队）

**局限**：
- 需要两端协同开发
- Webhook 失败时需要重试机制

**重试策略建议**：

| 策略 | 说明 |
|------|------|
| 最大重试次数 | 3 次 |
| 重试间隔 | 5s → 15s → 45s（指数退避） |
| 失败后 | 记录到 `web/generated/webhook_failures.log`，grears v2 仍可手动拉取 |

---

#### 模式 C：深度集成模式（推荐第三阶段，长期方向）

**适用场景**：grears v2 与知识库平台深度耦合，实现故事生成 → 分镜 → 故事板 → 视频产出全链路自动化。

**接入方式**：

```
用户在 StoryStudio 生成故事
       │
       │  POST /api/stories/generate（output_gears_segments=true）
       ↓
知识库平台生成故事 + 分段
       │
       │  ① Webhook 通知 grears v2
       │  ② grears v2 拉取分段 → 自动入队生产
       │  ③ 生产完成后回调知识库平台
       ↓
grears v2 完成视频产出
       │
       │  POST /api/gears-callback/video-ready
       │  Body: { storyId, video_url, status, thumbnail_url }
       ↓
知识库平台更新故事状态
       │  story.status = "video_ready"
       │  story.video_url = "..."
```

**需要新增**：

| 改动 | 位置 | 说明 |
|------|------|------|
| 故事状态字段 | shared/types.ts | StoryGenerateResult 新增 `status` 字段（draft → gears_ready → producing → video_ready） |
| 回调端点 | 知识库平台 API | `POST /api/gears-callback/video-ready` 接收 grears v2 产出通知 |
| 前端状态展示 | StoryResult.vue / StoryDetail.vue | 根据状态显示"等待生产"/"生产中"/"视频就绪" |
| 视频预览嵌入 | StoryDetail.vue | 当 video_url 可用时嵌入视频播放器 |
| 批量生成 API | 知识库平台 | `POST /api/stories/batch-generate` 支持多条目批量生成 |
| 生产队列 | grears v2 | 接收分段 → 排队 → 自动生产 → 回调完成 |

**故事状态流转**：

```
draft（刚生成，分段数据已就绪）
  → gears_ready（已推送到 grears v2）
  → producing（grears v2 正在生产视频）
  → video_ready（视频产出完成，可预览）
  → published（已发布到目标平台）
```

**优势**：
- 全链路自动化，用户从生成到看到成品视频一站式完成
- 状态可追踪，前端实时显示生产进度
- 支持批量场景（如一个省份的多个条目批量产出宣传片）

**局限**：
- 两端深度耦合，开发成本最高
- 需要异步任务管理（故事生成 + 视频生产都可能耗时较长）
- 需要错误处理和人工干预机制

---

### 8.3 三种模式对比

| 维度 | 模式 A（API 拉取） | 模式 B（Webhook 推送） | 模式 C（深度集成） |
|------|-------------------|----------------------|-------------------|
| 接入成本 | ⭐ 最低 | ⭐⭐ 中等 | ⭐⭐⭐ 最高 |
| 实时性 | 手动触发 | 自动通知 | 全链路自动化 |
| 两端耦合度 | 松耦合 | 中耦合 | 紧耦合 |
| 适用阶段 | 第一阶段（现在） | 第二阶段 | 第三阶段（长期） |
| grears v2 改动量 | 仅需 HTTP 客户端 | 需新增 webhook 端点 | 需新增回调 + 状态管理 |
| 知识库平台改动量 | 无 | 新增 webhook 发送 | 新增回调端点 + 状态字段 |
| 用户体验 | 手工搬运 | 半自动 | 全自动 |

### 8.4 推荐实施路线

```
第一阶段（当前）
  └── 模式 A：grears v2 通过 GET /api/stories/:storyId/gears-segments 拉取
      └── 前端 GearsActions 组件保留，作为调试/预览工具
      └── CORS_ORIGINS 加入 grears v2 的 origin

第二阶段（1-2个月后）
  └── 模式 B：新增 GEARS_WEBHOOK_URL 环境变量
      └── 故事生成完成后自动推送通知
      └── grears v2 接收通知后自动拉取分段
      └── 前端显示"已推送到 GEARS v2"状态

第三阶段（3-6个月后）
  └── 模式 C：故事状态流转（draft → video_ready）
      └── grears v2 回调通知视频产出完成
      └── 前端嵌入视频预览
      └── 批量生成 + 批量生产
```

### 8.5 GEARS 分段数据使用建议

**grears v2 消费分段数据的推荐方式**：

| 字段 | 使用方式 | 优先级 |
|------|----------|--------|
| `script_text` | 核心输入 → 驱动分镜文本生成 | P0 必需 |
| `panel_count` | 决定每段面板数 → 故事板布局 | P0 必需 |
| `visual_focus` | 视觉锚点 → 分镜画面元素 | P0 必需 |
| `duration_sec` | 分段时长 → 动画/视频节奏控制 | P0 必需 |
| `purpose` | 戏剧功能 → 场次情绪色彩标注 | P1 辅助 |
| `segment_prompt_hint` | 风格提示 → AI 生成画面时的风格约束 | P1 辅助 |
| `video_type` | 类型标识 → 选择对应画面模板库 | P1 辅助 |
| `presentation_style` | 表现形式 → 选择分镜风格模板 | P2 参考 |
| `cultural_constraints` | 合规校验 → 防止 AI 产出违反文化约束的画面 | P1 辅助 |
| `source_entries` | 来源追踪 → 可回溯到知识库条目核实 | P2 参考 |

**script_text 质量改进建议**（面向 grears v2 生产效果）：

当前 script_text 由模板引擎生成，存在以下问题：

| 问题 | 当前表现 | 改进方向 |
|------|----------|----------|
| 文本模板化 | 格式固定，缺乏叙事多样性 | 引入 LLM 生成（可选接入 Claude API） |
| 视觉描述不够具体 | "案卷上的人命与上司的命令"偏抽象 | 增加 visual_prompt 拆解为具体画面元素 |
| panel_count 纯时长映射 | 不考虑内容复杂度 | 引入内容密度评分，动态调整面板数 |
| cultural_constraints 过泛 | "具体细节请核实来源"是通用模板 | 按 segment 提取具体不可误写内容 |
| 情绪/色调缺标注 | 仅 purpose 标注功能 | 增加 mood/color_palette 字段 |

**建议新增字段（schema_version 升级至 v3 时考虑）**：

```json
{
  "mood": "紧张、压抑",
  "color_palette": ["深灰", "冷蓝", "暗红"],
  "audio_hint": "低沉弦乐+雨声环境音",
  "transition_to_next": "节奏加速→冲突爆发"
}
```

---

## 9. 前端页面总览

| 路径 | 页面 | 核心功能 |
|------|------|----------|
| `/` | 首页 | Hero + 搜索栏 + 统计 + 最近故事 + 省份网格 |
| `/search` | 搜索页 | 关键词/类型/省份组合筛选 + EntryCard 结果 |
| `/province/:name` | 省份页 | 条目按类型分组展示 |
| `/entry?name=xxx` | 条目详情 | 完整内容 + 可信度可视化 + 生成快捷按钮 |
| `/story/new` | 视频方案工坊 | 三模式输入 + 参数配置 + 生成结果展示 |
| `/story/:storyId` | 故事详情 | 已生成故事完整展示 + GEARS 操作 |

---

## 10. MCP 工具能力（保留不变）

MCP Server 提供 14 个工具，供 Claude Code 直接调用：

| 工具 | 能力 |
|------|------|
| kb_search | 关键词/类型/省份/地区搜索 |
| kb_match | 语义匹配（故事创作分析） |
| kb_get_entry_detail | 条目完整详情 |
| kb_supplement | 三维度补充（版本差异/同地同类/关联网络） |
| kb_collect | 搜集故事+创建来源+写入条目 |
| kb_add_entry / kb_add_region_entry | 写入条目 |
| kb_verify_source | 来源可信度核查 |
| kb_fetch_article / kb_fetch_video | 网页/视频内容抓取 |
| kb_ingest_video | B站视频一键录入 |
| kb_generate_script | 脚本骨架生成 |
| kb_generate_story | 故事文本生成 |
| kb_query_index | 类型/关键词/地区聚合查询 |

**MCP 约束**：Web 端只 import `mcp-server/src/tools/*` 和 `mcp-server/src/lib/*` 中的纯函数，禁止 import `mcp-server/src/index.ts`。

---

## 11. 当前局限与改进方向

| 局限 | 说明 | 改进方向 |
|------|------|----------|
| 知识库分布不均 | 湖南 65 条目占 75%，16 省份空白 | 需持续录入各省份内容 |
| script_text 模板化 | 当前由程序拼接，缺乏叙事多样性 | 可接入 LLM 生成 |
| 分段 = 场次 1:1 | 无法拆分长场次或合并短场次 | 引入智能分段逻辑 |
| 故事不可修改 | 生成后无法编辑或重新生成 | 增加故事编辑/版本管理 |
| 无用户认证 | 第一阶段无认证 | 第二阶段考虑简单认证 |
| panel_count 固定映射 | 不考虑内容复杂度 | 引入内容密度评分 |
| GEARS 接入手动 | 仅复制/导出 JSON | 按第 8 节路线逐步自动化 |
| 无异步任务 | 故事生成同步阻塞 | 第二阶段引入 job 接口 |
| 前端无 Pinia store | 所有状态局部管理 | 引入全局 store 管理故事状态 |

---

## 附录 A：GEARS 接入模式速查

### 模式 A — API 拉取（现在可用）

```
1. grears v2 调用 GET /api/stories（发现故事列表）
2. 选择 storyId，调用 GET /api/stories/:storyId/gears-segments
3. 根据 schema_version 做版本兼容
4. 从 segments[] 提取 script_text + panel_count + visual_focus → 驱动生产
5. 用 cultural_constraints 做合规校验
```

### 模式 B — Webhook 推送（第二阶段）

```
1. 知识库平台配置 GEARS_WEBHOOK_URL
2. 故事生成完成 → POST webhook 通知 grears v2
3. grears v2 收到通知 → GET 拉取详细分段
4. 自动入队生产
```

### 模式 C — 深度集成（第三阶段）

```
1. 用户在 StoryStudio 生成故事
2. Webhook 推送 + grears v2 自动拉取
3. grears v2 生产视频 → 回调知识库平台
4. 前端显示状态流转 + 视频预览
5. 支持批量生成 + 批量生产
```

---

## 附录 B：schema_version 演进历史

| 版本 | 变更 |
|------|------|
| v1 | 初始设计：segment_id, source_scene_id, duration_sec, panel_count, script_text, purpose, visual_focus, cultural_constraints |
| v2（当前） | 新增：video_type, presentation_style, segment_prompt_hint, source_entries |
| v3（规划） | 计划新增：mood, color_palette, audio_hint, transition_to_next |