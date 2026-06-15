---
name: china-culture-story-agent
description: Project workflow for developing or using the china-culture-kb Story Agent. Use when Codex works on story generation, type/genre profiles, StoryBlueprint, scene_breakdown, gears_segments, quality validation, repair loops, project versions, or MCP tools such as kb_generate_story and kb_generate_script in this repository.
---

# China Culture Story Agent

Use this skill to keep Story Agent work aligned with the project architecture instead of treating generation as one big prompt.

## Workflow

1. Read the relevant project code before changing behavior:
   - `web/shared/types.ts`
   - `web/shared/schemas.ts`
   - `web/server/src/services/story-service.ts`
   - `web/server/src/services/story-generation-prompt.ts`
   - `web/server/src/services/story-blueprint-service.ts`
   - `web/server/src/services/genre-story-profiles.ts`
   - `web/server/src/services/genre-quality-service.ts`
   - `web/server/src/services/dramatic-story.ts`
2. Treat the intended generation chain as:

```text
Knowledge entry / user material
  -> StoryBlueprint
  -> full_text
  -> scene_breakdown
  -> gears_segments
  -> quality report
  -> repair if needed
  -> project/version storage
```

3. Keep type-specific rules centralized in genre profiles. Avoid scattering new genre rules across UI labels, prompt text, fallback generation, and tests.
4. Add or update tests near the behavior being changed. Prefer narrow tests for schema, prompt package, blueprint, quality report, repair, and project persistence.
5. Do not write generated stories back to `data/provinces/*.md`; story work belongs under `web/generated` and project/version files.

## References

- Read `references/story-agent-contract.md` for the generation contract, file map, and validation expectations.
- For screenwriting content decisions, use the `china-culture-screenwriting` skill.
- For GEARS or Seedance handoff, use the `gears-seedance-delivery` skill.
