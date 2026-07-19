#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = realpathSync(resolve(dirname(SCRIPT_PATH), ".."));
const REPORT_PATH = "data/reports/story-agent-p4-change-review-plan.json";
const SCHEMA_VERSION = "story-agent-p4-change-review-plan/v1";

const BATCHES = {
  shared_core: {
    order: 1,
    title: "共享合同、Story Agent 核心服务与测试",
    validation_commands: [
      "cd web && npm run check",
      "cd web/server && npx vitest run src/__tests__/api.test.ts src/__tests__/callback-auth.test.ts src/__tests__/product-access-control.test.ts src/__tests__/product-navigation.test.ts src/__tests__/project-workflow.test.ts src/__tests__/creation-contract-service.test.ts src/__tests__/dramatic-story-quality.test.ts src/__tests__/outline-service.test.ts src/__tests__/project-service.test.ts src/__tests__/quality-workflow-service.test.ts src/__tests__/story-blueprint-genre-quality.test.ts src/__tests__/professional-text-package-contract.test.ts src/__tests__/video-type-generation-matrix.test.ts",
      "cd web && npm run e2e:track-a",
    ],
  },
  professional_formats: {
    order: 2,
    title: "15 片型专业管线、质量与 benchmark",
    validation_commands: [
      "cd web/server && npx vitest run src/__tests__/professional-*-pipeline.test.ts src/__tests__/professional-benchmark-*.test.ts src/__tests__/professional-character-*.test.ts",
      "cd web && npm run check",
    ],
  },
  stage6: {
    order: 3,
    title: "Stage 6 输入、批次、工作台、退出审计与测试",
    validation_commands: [
      "cd web/server && npx vitest run src/__tests__/professional-multi-round-revision*.test.ts src/__tests__/stage6-*.test.ts",
      "npx tsx scripts/story-agent-stage6-real-input-intake.mts --check",
      "npx tsx scripts/story-agent-stage6-revision-batch.mts --check",
      "npx tsx scripts/story-agent-stage6-real-revision-exit-audit.mts --check",
      "cd web && npm run check && npm run build",
    ],
  },
  production_docs: {
    order: 4,
    title: "知识条目、生产卡、实现文档与长期蓝图",
    validation_commands: [
      "npm run kb:lint",
      "cd web && npm run build",
      "git diff --check",
    ],
  },
  governance: {
    order: 5,
    title: "历史治理、MCP、manifest、报告与维护脚本",
    validation_commands: [
      "node scripts/story-agent-governance-dry-run.mjs --check",
      "cd mcp-server && npm test",
      "cd mcp-server && npm run build",
      "npm run kb:lint",
      "git diff --check",
    ],
  },
};

const FINAL_VALIDATION_COMMANDS = [
  "cd web/server && npm test",
  "cd mcp-server && npm test && npm run build",
  "cd web && npm run check && npm run build",
  "npm run kb:lint",
  "node scripts/story-agent-p4-change-review-plan.mjs --check",
  "git diff --check",
  "test -z \"$(git diff --cached --name-only)\"",
];

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseStatus() {
  const fields = git(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { encoding: "buffer" },
  )
    .toString("utf8")
    .split("\0");
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const path = field.slice(3);
    let originalPath;
    if (/[RC]/.test(status)) {
      originalPath = fields[index + 1] || undefined;
      index += 1;
    }
    entries.push({ status, path, ...(originalPath ? { original_path: originalPath } : {}) });
  }
  return entries;
}

function baseBlobMap() {
  const fields = git(["ls-files", "-s", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0");
  const result = new Map();
  for (const field of fields) {
    if (!field) continue;
    const match = field.match(/^(\d+) ([0-9a-f]+) (\d)\t(.+)$/s);
    if (match && match[3] === "0") result.set(match[4], { mode: match[1], oid: match[2] });
  }
  return result;
}

function hashPath(path) {
  const absolute = resolve(REPO_ROOT, path);
  if (!existsSync(absolute)) return { exists: false };
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    const target = readFileSync(absolute);
    return {
      exists: true,
      kind: "symlink",
      size_bytes: stat.size,
      sha256: createHash("sha256").update(target).digest("hex"),
    };
  }
  if (!stat.isFile()) return { exists: true, kind: "other", size_bytes: stat.size };
  return {
    exists: true,
    kind: "file",
    size_bytes: stat.size,
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
  };
}

const FORMAT_PATTERN = /(ai-comic-drama|character-story|children-story|city-brand-promo|culture-promo|documentary-short|education-training|explainer-video|heritage-promo|historical-drama|landscape-mood|lecture-video|legend-story|scene-short|social-short)/;

function classify(path) {
  const lower = path.toLowerCase();

  if (
    lower.includes("stage6") ||
    lower.includes("multi-round-revision") ||
    lower.includes("stage6revisionworkspace") ||
    lower.includes("stage6-revisions")
  ) {
    return { batch: "stage6", reason: "Stage 6 contract, execution, workspace, evidence, or audit path" };
  }

  if (
    lower.startsWith("data/professional-benchmarks/") ||
    (lower.startsWith("web/") && (lower.includes("stage7-golden-card") || lower.includes("stage7goldencard") || lower.includes("stage7-material") || lower.includes("stage7material") || lower.includes("stage8-blind-review") || lower.includes("stage8blindreview") || lower.includes("stage8-finalization") || lower.includes("stage8finalization") || lower.includes("stage8-durable-release") || lower.includes("stage8durablerelease") || lower.includes("stage8-operations") || lower.includes("stage8operations") || lower.includes("durable-signed-release") || lower.includes("durablesignedrelease"))) ||
    FORMAT_PATTERN.test(lower) ||
    lower.includes("professional-benchmark") ||
    lower.includes("professional-character") ||
    lower.includes("professional-text-stage0") ||
    lower.includes("professional-text-capability") ||
    lower.includes("professional-text-creation-progress") ||
    lower.includes("professional-text-gap") ||
    lower.includes("professional-text-package") ||
    lower.includes("professional-text-contract") ||
    lower.includes("professional-text-pipeline") ||
    lower.includes("professional-text-quality") ||
    lower.includes("professional-text-revision")
  ) {
    return { batch: "professional_formats", reason: "Professional format pipeline, quality, revision, or benchmark path" };
  }

  if (
    lower.startsWith("web/shared/") ||
    lower.startsWith("web/client/") ||
    lower.startsWith("web/e2e/") ||
    lower.startsWith("web/server/src/routes/") ||
    lower.startsWith("web/server/src/repositories/") ||
    lower.startsWith("web/server/src/platform/") ||
    lower.startsWith("web/server/src/domains/") ||
    lower.startsWith("web/server/src/__tests__/") ||
    lower.includes("web/server/src/services/product-access") ||
    lower.includes("web/server/src/services/product-resource-access") ||
    lower === "web/server/src/services/gears-webhook-service.ts" ||
    lower === "web/server/src/services/gears-execution-service.ts" ||
    lower === "web/server/src/services/gears-workbench-audit-service.ts" ||
    lower === "web/server/src/services/gears-workbench-connector.ts" ||
    lower === "web/server/src/services/story-domain-safety-migration-service.ts" ||
    lower === "web/server/src/services/story-project-file-to-sqlite-migration-service.ts" ||
    lower === "web/server/src/services/story-storage-legacy-disposition-service.ts" ||
    lower === "web/server/src/services/production-readiness-portfolio-service.ts" ||
    lower === "web/server/src/services/production-readiness-automation.ts" ||
    lower === "web/server/src/services/production-material-pack-service.ts" ||
    lower === "web/server/src/services/production-material-readiness-service.ts" ||
    lower === "web/server/src/services/story-agent-mvp-status-service.ts" ||
    lower === "web/server/src/services/seedance-prompt-service.ts" ||
    lower === "web/server/src/services/entry-service.ts" ||
    lower === "web/server/src/services/mcp-proxy.ts" ||
    lower === "web/server/src/services/story-service.ts" ||
    lower === "web/server/src/services/ai-comic-series-service.ts" ||
    lower === "web/package.json" ||
    lower === "web/package-lock.json" ||
    lower === "web/server/package.json" ||
    lower === "web/playwright.config.ts" ||
    lower === "web/server/src/__tests__/api.test.ts" ||
    lower.includes("mao-growth-story-e2e") ||
    lower === "web/server/src/index.ts" ||
    lower.startsWith("web/server/src/middleware/") ||
    lower.includes("creation-contract") ||
    lower.includes("dramatic-story") ||
    lower.includes("genre-quality") ||
    lower.includes("genre-story-profile") ||
    lower.includes("outline-service") ||
    lower.includes("project-service") ||
    lower.includes("quality-workflow") ||
    lower.includes("story-blueprint") ||
    lower.includes("story-generation-model") ||
    lower.includes("video-type-generation-matrix") ||
    lower.includes("json-body") ||
    lower === "web/client/src/app.vue" ||
    lower === "web/client/src/router.ts" ||
    lower === "web/client/src/views/storystudio.vue"
  ) {
    return { batch: "shared_core", reason: "Shared contract, core Story Agent service, integration surface, or test" };
  }

  if (
    lower.startsWith("data/provinces/") ||
    lower.startsWith("data/production-cards/") ||
    lower.startsWith("data/production-packs/") ||
    lower.startsWith("docs/production-cards/") ||
    lower.startsWith("docs/") ||
    lower === "开发文档/installed-ai-tools.md" ||
    lower.startsWith("output/")
  ) {
    return { batch: "production_docs", reason: "Knowledge entry, production card, implementation document, blueprint, or review capture" };
  }

  if (
    lower === ".gitignore" ||
    lower.startsWith(".codex/skills/superpowers-lite/") ||
    lower.startsWith("mcp-server/") ||
    lower.startsWith(".github/workflows/") ||
    lower.startsWith("data/domain-packs/") ||
    lower.startsWith("data/reports/") ||
    lower.startsWith("web/generated/") ||
    lower.startsWith("scripts/") ||
    lower.includes("generated-health") ||
    lower.includes("governance") ||
    lower.includes("relink") ||
    lower.includes("archive") ||
    lower.includes("monitor-remediation") ||
    lower.includes("final-delivery-manifest-preflight") ||
    lower.includes("story-generation-attempt") ||
    lower.includes("story-generation-activity") ||
    lower.includes("gears-delivery") ||
    lower.includes("domain-pack")
  ) {
    return { batch: "governance", reason: "Governance, project workflow skill, MCP, report, manifest, domain pack, or maintenance script" };
  }

  return { batch: "hold", reason: "No deterministic P4 ownership rule; manual assignment required" };
}

function countBy(items, selector) {
  return Object.fromEntries(
    [...items.reduce((map, item) => {
      const key = selector(item);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildReport() {
  const blobs = baseBlobMap();
  const excludedPaths = [REPORT_PATH];
  const statusEntries = parseStatus().filter(({ path }) => !excludedPaths.includes(path));
  const files = statusEntries
    .map((entry) => {
      const tracked = entry.status !== "??";
      const staged = entry.status[0] !== " " && entry.status[0] !== "?";
      const classification = classify(entry.path);
      const base = blobs.get(entry.path);
      return {
        ...entry,
        tracked,
        staged,
        ...hashPath(entry.path),
        ...(base ? { base_git_mode: base.mode, base_blob_oid: base.oid } : {}),
        batch: classification.batch,
        classification_reason: classification.reason,
        overlap_sensitive: tracked,
        manual_hunk_review_required: tracked,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const stagedFiles = files.filter((file) => file.staged);
  const holdFiles = files.filter((file) => file.batch === "hold");
  const missingFiles = files.filter((file) => !file.exists);
  const batchDefinitions = Object.fromEntries(
    Object.entries(BATCHES).map(([id, definition]) => [
      id,
      {
        ...definition,
        file_count: files.filter((file) => file.batch === id).length,
        tracked_overlap_file_count: files.filter((file) => file.batch === id && file.tracked).length,
      },
    ]),
  );

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    scope: "P4 read-only dirty-worktree review inventory; preparation only, not authorization to stage or commit",
    safety_policy: {
      preserves_dirty_worktree: true,
      stages_files: false,
      commits_files: false,
      pushes_files: false,
      deletes_files: false,
      calls_paid_models: false,
      preparation_counts_as_real_revision: false,
      preparation_counts_as_professional_pass: false,
      tracked_changes_require_manual_hunk_review: true,
    },
    gate: {
      review_plan_ready: stagedFiles.length === 0 && holdFiles.length === 0 && missingFiles.length === 0,
      staging_authorized: false,
      commit_authorized: false,
      blockers: [
        ...(stagedFiles.length ? [`${stagedFiles.length} file(s) are already staged`] : []),
        ...(holdFiles.length ? [`${holdFiles.length} file(s) require manual batch assignment`] : []),
        ...(missingFiles.length ? [`${missingFiles.length} changed file(s) are missing from the worktree`] : []),
        "Tracked modifications require manual hunk-by-hunk overlap review before any future staging",
        "User authorization is required before any staging or commit action",
      ],
    },
    summary: {
      changed_file_count: files.length,
      tracked_changed_file_count: files.filter((file) => file.tracked).length,
      untracked_file_count: files.filter((file) => !file.tracked).length,
      staged_file_count: stagedFiles.length,
      tracked_overlap_file_count: files.filter((file) => file.overlap_sensitive).length,
      missing_file_count: missingFiles.length,
      hold_file_count: holdFiles.length,
      by_status: countBy(files, (file) => file.status),
      by_batch: countBy(files, (file) => file.batch),
    },
    batch_definitions: batchDefinitions,
    final_validation_commands: FINAL_VALIDATION_COMMANDS,
    excluded_paths: excludedPaths,
    files,
  };
}

function stableForCheck(report) {
  const clone = structuredClone(report);
  delete clone.generated_at;
  return JSON.stringify(clone);
}

function usage() {
  console.error("Usage: node scripts/story-agent-p4-change-review-plan.mjs --write|--check");
  process.exitCode = 2;
}

const mode = process.argv[2];
if (!mode || !["--write", "--check"].includes(mode) || process.argv.length !== 3) {
  usage();
} else {
  const report = buildReport();
  const absoluteReportPath = resolve(REPO_ROOT, REPORT_PATH);
  if (mode === "--write") {
    writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(
      `Wrote ${relative(REPO_ROOT, absoluteReportPath)}: ${report.summary.changed_file_count} files, ${report.summary.hold_file_count} holds, ${report.summary.staged_file_count} staged.`,
    );
  } else if (!existsSync(absoluteReportPath)) {
    console.error(`Missing ${REPORT_PATH}; run with --write first.`);
    process.exitCode = 1;
  } else {
    const stored = JSON.parse(readFileSync(absoluteReportPath, "utf8"));
    if (stableForCheck(stored) !== stableForCheck(report)) {
      console.error(`${REPORT_PATH} is stale; run with --write and review the diff.`);
      process.exitCode = 1;
    } else {
      console.log(
        `${REPORT_PATH} is current: ${report.summary.changed_file_count} files, ${report.summary.hold_file_count} holds, ${report.summary.staged_file_count} staged.`,
      );
    }
  }
}
