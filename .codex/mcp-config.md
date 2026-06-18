# china-culture-kb MCP Configuration

This project exposes one project-level MCP server: `china-culture-kb`.

Build it before use:

```bash
cd mcp-server
npm run build
```

## Codex on Mac

Add this block to `/Users/wuyu/.codex/config.toml`:

```toml
[mcp_servers.china-culture-kb]
type = "stdio"
command = "/opt/homebrew/bin/node"
args = ["mcp-server/dist/index.js"]
cwd = "/Users/wuyu/Desktop/china-culture-kb"
```

## Claude Code on Mac

Use this project path in Claude settings:

```json
{
  "mcpServers": {
    "china-culture-kb": {
      "command": "/opt/homebrew/bin/node",
      "args": ["mcp-server/dist/index.js"],
      "cwd": "/Users/wuyu/Desktop/china-culture-kb"
    }
  }
}
```

## Claude Code on Windows

Use the Windows workspace path:

```json
{
  "mcpServers": {
    "china-culture-kb": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "cwd": "d:/china-culture-kb"
    }
  }
}
```

## Current Tool Surface

The server currently exposes knowledge-base search, entry detail, source collection, source verification, article/video intake, script generation, story generation, region entry writing, index query, Story Agent project context, StoryBlueprint generation, genre quality validation, GEARS delivery packaging, Seedance prompt packaging, repair dry-run planning, and controlled project version updates.

Story Agent follow-up tools planned or recently added for this project:

- `kb_generate_story_blueprint` (implemented)
- `kb_validate_genre_story` (implemented)
- `kb_repair_story(auto_apply=false)` (implemented)
- `kb_repair_story(auto_apply=true, requires repaired_story_json)` (implemented)
- `kb_generate_gears_delivery` (implemented)
- `kb_generate_seedance_prompt` (implemented)
- `kb_get_project_context` (implemented)
- `kb_update_project_version` (implemented)

See `mcp-upgrade-roadmap.md` for the intended schema, implementation order, and guardrails.
