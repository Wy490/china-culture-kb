# Agent Bridge 配置指南

这份文档说明如何把 Web 端的故事生成和场景重写接口接到你本机可用的 Agent CLI。

## 1. 全文生成 Agent Bridge

后端现在的全文生成链路已经支持两层：

1. **本地结构化 fallback**
   没有配置外部模型时，继续使用当前的内置故事引擎（dramatic-story / memory-mosaic）。

2. **命令行模型 adapter**
   如果配置了 `STORY_GEN_COMMAND`，后端会把全文生成的 prompt package 通过 stdin 发送给外部命令，并要求它返回一个 JSON 对象（包含 title, logline, theme, full_text, scene_breakdown 等字段）。

   当 adapter 成功时，后端会把模型返回的创意内容合并到本地结构骨架上（场次时长、panel_count 等结构性信息由本地引擎保证）。
   当 adapter 失败或超时时，后端直接使用本地引擎的完整输出作为 fallback。

仓库已经提供了一个现成桥接脚本：

- [web/server/scripts/story-generate-agent-bridge.mjs](/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/story-generate-agent-bridge.mjs)

这个桥接脚本会：

- 读取后端送来的 prompt package
- 调用本机 `claude` 或 `codex exec`
- 要求模型只返回故事 JSON
- 把结果返回给后端 adapter

### 返回格式

外部 Agent 最终必须产出如下 JSON：

```json
{
  "title": "故事标题",
  "logline": "一句概括性故事前提",
  "theme": "主题描述",
  "full_text": "完整叙事文本",
  "scene_breakdown": [
    {
      "scene_id": 1,
      "title": "场次标题",
      "plot": "剧情描述（≥10字）",
      "key_action": "关键动作",
      "conflict": "冲突描述（可选）",
      "dialogue_or_narration": "对白或旁白（可选）",
      "visual_prompt": "画面提示（可选）",
      "camera_suggestion": "镜头建议（可选）",
      "characters": ["人物1", "人物2"],
      "cultural_note": "文化注释（可选）"
    }
  ],
  "cultural_constraints": ["约束1", "约束2"],
  "credibility_note": "可信度与核实说明",
  "visual_symbols": ["视觉符号1"],
  "core_message": "核心信息",
  "slogan_or_key_sentence": "口号或关键句",
  "argument_points": ["论证要点1"],
  "atmosphere": "氛围描述"
}
```

只有 `title, logline, theme, full_text, scene_breakdown, cultural_constraints, credibility_note` 是必填。其余字段视成片类型可选。

### 推荐接法：Claude

启动 server 前设置：

```bash
export STORY_GEN_PROVIDER=command_json
export STORY_GEN_COMMAND=node
export STORY_GEN_COMMAND_ARGS='["/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/story-generate-agent-bridge.mjs"]'

export STORY_GEN_AGENT=claude
export STORY_GEN_AGENT_CLAUDE_PATH=/opt/homebrew/bin/claude
export STORY_GEN_AGENT_MODEL=sonnet
```

如果 `claude` 需要额外启动参数，也可以加：

```bash
export STORY_GEN_AGENT_CLAUDE_ARGS='["--bare"]'
```

### 可选接法：Codex

```bash
export STORY_GEN_PROVIDER=command_json
export STORY_GEN_COMMAND=node
export STORY_GEN_COMMAND_ARGS='["/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/story-generate-agent-bridge.mjs"]'

export STORY_GEN_AGENT=codex
export STORY_GEN_AGENT_CODEX_PATH="/Applications/Codex.app/Contents/Resources/codex"
```

如果要给 `codex exec` 附加参数：

```bash
export STORY_GEN_AGENT_CODEX_ARGS='["--model","gpt-5.5"]'
```

### 全文生成环境变量一览

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `STORY_GEN_PROVIDER` | 模型适配器类型 | `command_json` |
| `STORY_GEN_COMMAND` | 要执行的命令 | 无（未配置则走本地 fallback） |
| `STORY_GEN_COMMAND_ARGS` | 命令参数（JSON 数组或空格分隔） | `[]` |
| `STORY_GEN_COMMAND_TIMEOUT_MS` | 命令超时（毫秒） | `330000` |
| `STORY_GEN_AGENT` | Agent 类型：`claude` 或 `codex` | `claude` |
| `STORY_GEN_AGENT_MODEL` | 模型名称（如 `sonnet`, `opus`, `gpt-5.5`） | 无 |
| `STORY_GEN_AGENT_CLAUDE_PATH` | claude CLI 路径 | `claude` |
| `STORY_GEN_AGENT_CLAUDE_ARGS` | claude 附加参数（JSON 数组） | `[]` |
| `STORY_GEN_AGENT_CODEX_PATH` | codex CLI 路径 | `codex` |
| `STORY_GEN_AGENT_CODEX_ARGS` | codex 附加参数（JSON 数组） | `[]` |
| `STORY_GEN_AGENT_TIMEOUT_MS` | agent 超时（毫秒，桥接脚本内部） | `300000` |

### 调试建议

如果全文生成没有走外部 Agent，而是回退到本地逻辑，请先检查：

1. `STORY_GEN_COMMAND` 是否已设置
2. `STORY_GEN_COMMAND_ARGS` 是否指向桥接脚本
3. `STORY_GEN_AGENT` 是否为 `claude` 或 `codex`
4. 对应 CLI 是否已登录并可在终端正常执行

故事 `_request_meta` 里会额外写入：

- `model_provider: command_json`
- `model_used_fallback: false`
- 或 `model_used_fallback: true`, `model_fallback_reason: ...`

所以你可以直接从故事数据里判断这次是否真的用了外部 Agent。

---

## 2. Scene Regeneration Agent Bridge

后端现在的单场重写链路已经支持两层：

1. **本地结构化 fallback**
   没有配置外部模型时，继续使用当前内置的场景重写逻辑。

2. **命令行模型 adapter**
   如果配置了 `SCENE_REGEN_COMMAND`，后端会把场景重写上下文包通过 stdin 发送给外部命令，并要求它返回一个 JSON patch。

仓库已经提供了一个现成桥接脚本：

- [web/server/scripts/scene-regenerate-agent-bridge.mjs](/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/scene-regenerate-agent-bridge.mjs)

### 返回格式

外部 Agent 最终必须产出如下 JSON：

```json
{
  "plot": "重写后的场景正文",
  "key_action": "重写后的关键动作",
  "dialogue_or_narration": "重写后的对白或旁白",
  "conflict": "可选，新的冲突描述",
  "visual_prompt": "重写后的画面提示",
  "camera_suggestion": "重写后的镜头建议"
}
```

### 推荐接法：Claude

```bash
export SCENE_REGEN_PROVIDER=command_json
export SCENE_REGEN_COMMAND=node
export SCENE_REGEN_COMMAND_ARGS='["/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/scene-regenerate-agent-bridge.mjs"]'

export SCENE_REGEN_AGENT=claude
export SCENE_REGEN_AGENT_CLAUDE_PATH=/opt/homebrew/bin/claude
export SCENE_REGEN_AGENT_MODEL=sonnet
```

### 可选接法：Codex

```bash
export SCENE_REGEN_PROVIDER=command_json
export SCENE_REGEN_COMMAND=node
export SCENE_REGEN_COMMAND_ARGS='["/Users/wuyu/Desktop/china-culture-kb/web/server/scripts/scene-regenerate-agent-bridge.mjs"]'

export SCENE_REGEN_AGENT=codex
export SCENE_REGEN_AGENT_CODEX_PATH="/Applications/Codex.app/Contents/Resources/codex"
```

### 场景重写环境变量一览

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `SCENE_REGEN_PROVIDER` | 模型适配器类型 | `command_json` |
| `SCENE_REGEN_COMMAND` | 要执行的命令 | 无（未配置则走本地 fallback） |
| `SCENE_REGEN_COMMAND_ARGS` | 命令参数 | `[]` |
| `SCENE_REGEN_COMMAND_TIMEOUT_MS` | 命令超时（毫秒） | `180000` |
| `SCENE_REGEN_AGENT` | Agent 类型 | `claude` |
| `SCENE_REGEN_AGENT_MODEL` | 模型名称 | 无 |
| `SCENE_REGEN_AGENT_CLAUDE_PATH` | claude CLI 路径 | `claude` |
| `SCENE_REGEN_AGENT_CLAUDE_ARGS` | claude 附加参数 | `[]` |
| `SCENE_REGEN_AGENT_CODEX_PATH` | codex CLI 路径 | `codex` |
| `SCENE_REGEN_AGENT_CODEX_ARGS` | codex 附加参数 | `[]` |
| `SCENE_REGEN_AGENT_TIMEOUT_MS` | agent 超时（毫秒，桥接脚本内部） | `180000` |

### 调试建议

如果单场重写没有走外部 Agent，而是回退到本地逻辑，请先检查：

1. `SCENE_REGEN_COMMAND` 是否已设置
2. `SCENE_REGEN_COMMAND_ARGS` 是否指向桥接脚本
3. `SCENE_REGEN_AGENT` 是否为 `claude` 或 `codex`
4. 对应 CLI 是否已登录并可在终端正常执行

项目版本记录里的 `reference_trace` 会额外写入：

- `provider:...`
- `provider_output_applied`
- 或 `fallback:...`

所以你可以直接从项目版本数据里判断这次是否真的用了外部 Agent。
