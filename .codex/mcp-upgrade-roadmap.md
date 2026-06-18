# Story Agent MCP Upgrade Roadmap

The current `china-culture-kb` MCP server is useful for knowledge-base search and file-writing, but Story Agent work now needs MCP tools that expose the newer web Story Agent pipeline.

Detailed implementation phases, acceptance criteria, and per-tool checklists are tracked in `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`.

## Current State

Existing story/script tools:

- `kb_generate_script`: builds an older script skeleton from entry names.
- `kb_generate_story`: writes caller-provided `story_text` to `scripts/{script_type}/{title}.md`.

These tools do not yet:

- repair story output
- export GEARS delivery packages
- generate Seedance prompts

## Target Tool Set

### `kb_generate_story_blueprint`

Purpose: return the structured middle layer before text generation.

Status: implemented as a read-only MCP tool with a lightweight MCP-local genre profile summary.

Input:

- `entry_name`
- `video_type`
- `presentation_style`
- `story_structure`
- `target_duration`
- optional `user_outline`
- optional `region_hint`

Output:

- `StoryBlueprint`
- selected `GenreStoryProfile` summary
- missing source or quality warnings

Implementation target:

- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/genre-story-profiles.ts`
- `mcp-server/src/tools/generate-story-blueprint.ts`

### `kb_validate_genre_story`

Purpose: validate whether a story result matches the selected type.

Status: implemented as a read-only MCP tool with MCP-local lightweight checks aligned to the Web quality report shape.

Input:

- `project_id`, `story_id`, or `story_json`
- optional `include_repair_actions`

Output:

- base dramatic quality report
- genre score and pass/fail
- missing required elements
- weak beats
- forbidden patterns found
- repair actions

Implementation target:

- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/quality-workflow-service.ts`
- `mcp-server/src/tools/validate-genre-story.ts`

### `kb_repair_story`

Purpose: create or execute a repair pass for a weak story.

Status: implemented. `auto_apply=false` returns a dry-run plan; `auto_apply=true` safely writes a new version only when the caller provides `project_id` and `repaired_story_json`.

Input:

- `project_id`, `story_json`, or `story_id`
- optional `repaired_story_json` for safe apply
- optional `user_instruction`
- optional `max_actions`
- optional `include_markdown`
- optional `auto_apply`

Output:

- quality snapshot
- source issues
- repair actions
- target scenes
- risk notes
- optional update result and after-quality snapshot when applied

Implementation target:

- `web/server/src/services/story-repair-service.ts`
- `web/server/src/services/quality-repair-service.ts`

### `kb_generate_gears_delivery`

Purpose: convert a story/project version into a GEARS-ready package.

Input:

- `story_id` or `project_id`
- optional `version_id`

Output:

- delivery package
- units
- assets
- validation notes

Implementation target:

- `web/server/src/services/gears-delivery-service.ts`
- `web/server/src/services/project-service.ts`

### `kb_generate_seedance_prompt`

Purpose: convert one scene or GEARS unit into a Seedance prompt.

Input:

- `story_id` or `project_id`
- `scene_id` or `segment_id`
- `duration_sec`
- optional reference asset roles
- optional language: `zh` or `en`

Output:

- Seedance prompt
- asset role list
- duration and safety checks

Implementation target:

- `.codex/skills/gears-seedance-delivery/references/gears-seedance-contract.md`
- later: shared service under `web/server/src/services/seedance-prompt-service.ts`

### `kb_get_project_context`

Purpose: retrieve the current editable project state for an agent.

Status: implemented as a read-only MCP tool.

Input:

- `project_id`
- optional `include_versions`
- optional `include_exports`

Output:

- project metadata
- current story snapshot
- version list
- continuity notes

Implementation target:

- `web/server/src/services/project-service.ts`
- `mcp-server/src/tools/get-project-context.ts`

### `kb_update_project_version`

Purpose: save an agent-produced patch as a new project version.

Status: implemented as a controlled write MCP tool.

Input:

- `project_id`
- `change_type`
- `change_target`
- `snapshot_json`
- optional `user_instruction`

Output:

- new `version_id`
- updated project metadata
- changed scene ids
- preserved fields
- quality summary

Guardrails:

- always append a new project version
- do not overwrite old version snapshots
- do not write `data/provinces/*.md`
- do not overwrite `web/generated/stories/{video_type}/{storyId}.json`

Implementation target:

- `web/server/src/services/project-service.ts`

## Implementation Order

1. Add read-only tools first (implemented):
   - `kb_get_project_context`
   - `kb_generate_story_blueprint`
   - `kb_validate_genre_story`
2. Add delivery helpers (implemented):
   - `kb_generate_gears_delivery`
   - `kb_generate_seedance_prompt`
3. Add mutation tools last:
   - `kb_repair_story(auto_apply=false)` (implemented)
   - `kb_update_project_version` (implemented)
   - `kb_repair_story(auto_apply=true, requires repaired_story_json)` (implemented)

## Guardrails

- Keep MCP tool schemas small and explicit.
- Return structured JSON text consistently.
- Do not let MCP tools write `data/provinces/*.md` unless the tool is explicitly an entry intake/write tool.
- Prefer read-only MCP tools for analysis and validation.
- Keep web API behavior and MCP behavior aligned by sharing service functions rather than duplicating logic.
- Add tests for each tool before depending on it in agent workflows.
