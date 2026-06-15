---
name: gears-seedance-delivery
description: GEARS and Seedance delivery workflow for china-culture-kb Story Agent outputs. Use when Codex converts full_text, scene_breakdown, StoryScene, GearsSegment, visual_prompt, segment_prompt_hint, or story projects into GEARS delivery packages, storyboard-ready units, or Jimeng Seedance 2.0 video prompts.
---

# GEARS Seedance Delivery

Use this skill at the handoff layer: after story content exists and needs to become production-ready scene, storyboard, GEARS, or Seedance material.

## Workflow

1. Start from structured story data, not free text when available:
   - `scene_breakdown`
   - `gears_segments`
   - project version snapshot
   - GEARS delivery package
2. Keep script content separate from generation prompts:
   - `script_text`: what happens, said or narrated.
   - `visual_prompt`: visible space, people, props, lighting, composition, mood.
   - `camera_suggestion`: shot size and movement.
   - `segment_prompt_hint`: production guidance, style, rhythm, constraints.
3. Clean prompt pollution. Remove analysis labels, source summaries, quality notes, and internal instructions from visual fields.
4. For Seedance, use explicit time segments for videos longer than 8 seconds and assign every `@` reference a role.
5. Validate duration, continuity, asset reuse, and whether the prompt is physically filmable.

## References

- Read `references/gears-seedance-contract.md` for field contracts, validation checks, and Seedance prompt patterns.
- Use `seedance-prompt-zh` or `seedance-prompt-en` for detailed Seedance syntax and platform constraints.
- Use `toonflow-production-workflow` when a task needs full production board, asset derivation, or storyboard supervision.
