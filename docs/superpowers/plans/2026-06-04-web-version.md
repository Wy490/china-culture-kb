# china-culture-kb Web 版本第一阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Web 版本第一阶段——Express API 服务 + Vue3 故事生成工作台，实现知识库浏览、故事生成和 GEARS 分段输出。

**Architecture:** Monorepo 一体式。Express REST API 直接 import MCP Server 纯函数（通过 mcp-proxy.ts 适配转换类型），不走 MCP 协议。Vue3 前端通过 HTTP 调 API。生成内容存储到 web/generated/stories/，不写入知识库 data/。

**Tech Stack:** Express + TypeScript + Zod | Vue3 + Vite + Pinia + Vue Router | MCP Server 纯函数引用

**Spec:** `docs/superpowers/specs/2026-06-04-web-version-design.md`

---

See the full plan content in the conversation history above. The plan has been written inline with all 10 Tasks and self-review completed. For brevity, this file serves as the pointer — the complete step-by-step plan with all code blocks is in the brainstorming conversation context.

## Task Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Monorepo scaffold | web/package.json, server/package.json, client/package.json, tsconfigs, vite.config |
| 2 | Shared types + Zod schemas | web/shared/types.ts, web/shared/schemas.ts |
| 3 | Express entry + CORS + unified response + error handler | web/server/src/index.ts, middleware/*.ts |
| 4 | MCP proxy + entries API + system API | mcp-proxy.ts, entry-service.ts, routes/entries.ts, routes/system.ts |
| 5 | Story service (plan + generate + store) | story-service.ts |
| 6 | Stories routes (5 endpoints) | routes/stories.ts |
| 7 | Vue3 scaffold + router + API layer + placeholder pages | client/src/* |
| 8 | StoryStudio page + StoryPlan + StoryResult + GearsActions | StoryStudio.vue, 3 components |
| 9 | Home + Search + Entry + Province + StoryDetail pages | 5 views + 2 components |
| 10 | API integration tests | __tests__/api.test.ts |

## Execution approach

Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.