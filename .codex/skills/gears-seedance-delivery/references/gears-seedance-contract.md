# GEARS and Seedance Contract

## Field Separation

- `script_text`: audience-facing action, dialogue, or narration. No internal notes.
- `visual_prompt`: visible image ingredients only: location, period, character appearance, props, light, composition, atmosphere.
- `camera_suggestion`: shot size, camera movement, lens/angle, pacing.
- `segment_prompt_hint`: production guidance: type, style, rhythm, continuity, constraints, asset focus.
- `validation_notes`: issues for humans or agents. Never mix into prompts.

## GEARS Readiness

A GEARS unit should have:

- non-empty `script_text`
- concrete scene or shot focus
- required characters and assets
- visual prompt free of source summaries
- duration that matches the scene density
- continuity note when it depends on earlier/later scenes
- cultural boundary note if facts and dramatization are mixed

Reject or repair:

- placeholder text such as "文本待补"
- prompt fields containing "质量", "分析", "应该", "注意", "来源显示"
- segments that cannot be storyboarded because they only state theme
- missing character, prop, or location anchors

## Seedance Prompt Pattern

Use this pattern for 10-15 second outputs:

```text
0-3秒：主体、场景、初始动作、镜头。
3-7秒：冲突/动作推进、表情或道具变化、镜头运动。
7-12秒：关键转折或视觉高潮、声音设计。
12-15秒：收束画面、定格/余味/字幕。
风格：...
音效/音乐：...
```

For referenced assets, assign every asset:

```text
@图片1 作为人物形象参考
@图片2 作为场景氛围参考
@视频1 参考运镜和节奏
@音频1 参考背景音乐
```

## Seedance Constraints

- Keep total uploaded files within platform limits.
- Avoid realistic identifiable human face uploads.
- Do not overload 4-5 second clips with many scene changes.
- Avoid contradictory camera instructions.
- Use explicit sound design when emotion or action depends on rhythm.

## Story Agent Image Handoff

- The canonical preproduction export is
  `story-agent-seedance-preproduction-package/v1`.
- Required image work is exported as `image-generation-request/v1`; the
  application server records `provider_invoked=false`.
- Codex performs image generation, writes only beneath the declared run
  `outputs/` directory, and returns `image-generation-result/v1`.
- Import is fail-closed on run ID, request hash, prompt hash, path containment,
  MIME inspection, and recomputed content SHA-256.
- A delivered preproduction image must have a real local file, current asset
  mapping, and verified content hash. Rights and human review remain warnings and
  do not grant production credit automatically.
- Video generation remains outside the Story Agent boundary and is performed by
  the user in Seedance.

## Prompt Cleaning

Before delivery, remove:

- source citations from visual fields
- quality report text
- TODOs and placeholders
- internal field names
- abstract genre analysis
- claims that cannot be seen or heard

Keep:

- visible cultural objects
- concrete actions
- period/location cues
- shot rhythm
- emotion readable through behavior
