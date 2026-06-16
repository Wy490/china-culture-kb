# Story Agent Contract

## File Map

- Shared types and schemas:
  - `web/shared/types.ts`
  - `web/shared/schemas.ts`
- Main generation and persistence:
  - `web/server/src/services/story-service.ts`
  - `web/server/src/services/project-service.ts`
  - `web/server/src/services/story-regenerate-service.ts`
- Prompt/model bridge:
  - `web/server/src/services/story-generation-prompt.ts`
  - `web/server/src/services/story-generation-model.ts`
  - `web/server/src/services/story-repair-service.ts`
- Genre structure:
  - `web/server/src/services/genre-story-profiles.ts`
  - `web/server/src/services/story-blueprint-service.ts`
  - `web/server/src/services/genre-quality-service.ts`
  - `web/server/src/services/dramatic-story.ts`
- Delivery:
  - `web/server/src/services/gears-delivery-service.ts`
  - `web/server/src/services/gears-webhook-service.ts`
- MCP:
  - `mcp-server/src/tools/generate-story.ts`
  - `mcp-server/src/tools/generate-script.ts`
  - `mcp-server/src/index.ts`
  - `mcp-server/src/tools/get-project-context.ts`
  - `mcp-server/src/tools/generate-story-blueprint.ts`
  - `mcp-server/src/tools/validate-genre-story.ts`

## Generation Contract

Use this shape when implementing new Story Agent behavior:

```text
EntryDetail / user material
  -> resolve video_type, presentation_style, story_structure
  -> resolve GenreStoryProfile
  -> build StoryBlueprint
  -> build prompt package or local fallback
  -> generate full_text
  -> derive scene_breakdown
  -> derive gears_segments
  -> validate genre and delivery readiness
  -> repair or return actionable report
  -> save story and project version
```

## Architecture Rules

- `GenreStoryProfile` is the single source for type promises, required elements, forbidden patterns, scene rules, GEARS rules, and repair guidance.
- `StoryBlueprint` is the bridge between knowledge material and generated prose. Put central question, protagonist, beats, evidence boundaries, and type-specific requirements there.
- `full_text` should read like final audience-facing story or script text, not a planning outline.
- `scene_breakdown` should be structured enough to edit or regenerate a single scene.
- `gears_segments` should be delivery-ready, with script text and prompt hints that do not depend on hidden context.
- Project files represent editable story state. Generated story files can remain immutable snapshots.

## Validation Targets

Check the smallest relevant layer:

- Schema/type changes: shared schema tests and route tests.
- Prompt changes: prompt package tests.
- Genre logic: blueprint and genre quality tests.
- Story output shape: story service or dramatic story tests.
- Repair loop: story repair and quality workflow tests.
- Project/version behavior: project service tests.
- Frontend display: component or browser smoke check when UI changes.

## Common Failure Modes

- New genre rules added only in prompt text but not in validation.
- UI labels added without shared type/schema support.
- `visual_prompt` polluted with analysis, source notes, or quality instructions.
- Generated story saved as knowledge-base fact.
- Repair changes `full_text` but leaves stale scenes or GEARS segments.
- Local fallback and external model path drift apart.
