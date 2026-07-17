---
name: superpowers-lite
description: Lightweight engineering workflow that preserves proportional TDD, root-cause debugging, and evidence-based completion without forcing brainstorming, worktrees, subagents, or repeated full CI. Use for ongoing implementation, bug fixes, refactors, cross-repository integration, long autonomous coding sessions, or when a full Superpowers-style process is slowing delivery.
---

# Superpowers Lite

Advance engineering work with the lightest workflow that safely proves the requested outcome. Preserve user, repository, security, and domain-skill constraints; this skill changes process intensity, not authority.

## Select the mode

Default to **Lite**. Upgrade only when a concrete risk requires it.

| Mode | Use when | Required process |
| --- | --- | --- |
| Lite | The outcome is clear, local, reversible, and covered by existing patterns | Audit once, make one bounded change, run targeted checks, report evidence |
| Standard | The change crosses modules or repositories, alters a shared contract, or has several dependent steps | Keep a short plan, test contract boundaries, run affected builds/E2E, then one full gate |
| Strict | The action is destructive, security-sensitive, paid, externally visible, migrates real data, changes production authority, or remains unclear after inspection | Pause for missing authority, use explicit red/green evidence, add rollback/preflight, run full gates and independent review when available |

Do not let Strict mode grant permission for an action the user did not authorize.

## Run the smallest complete loop

1. Read the active handoff, repository instructions, applicable domain skills, and current Git state once.
2. State one bounded outcome and the evidence that will prove it.
3. Inspect the narrowest relevant code and tests. Reuse existing contracts and helpers.
4. Apply proportional testing:
   - New behavior, bug fixes, safety boundaries, and shared contracts: observe a relevant failing test first, then implement the minimum fix.
   - Mechanical refactors, documentation, generated metadata, and configuration-only edits: edit directly, then run parsers, type checks, diff checks, or focused tests.
5. Diagnose failures before changing code. Separate product defects from sandbox, fixture, credential-name, port, or database-initialization failures.
6. Verify in increasing scope and stop when evidence matches risk.
7. Update machine reports and handoff only after behavior is stable.
8. Report outcome, evidence, worktree state, next action, and external blockers.

## Control context and audit cost

- Treat the latest handoff as the startup snapshot. Do not read prior handoffs or entire long-term plans unless the current slice needs their policy or history.
- Route into long documents with headings, `rg`, and narrow line ranges. Load only the relevant section and its directly required contract.
- Within one continuous conversation, reuse a fresh branch/remote/P4 baseline until repository state changes. A user message such as “继续” resumes the current slice; it does not restart the audit.
- Use the P4 JSON summary for whole-worktree ownership. Inspect full diffs only for files touched by the current slice or an actual overlap/conflict.
- Audit every repository in the current slice. For repositories not changed by the slice, report the last fresh baseline and refresh only status/staged state at final handoff.
- Batch independent read-only checks and avoid repeating the same file read, status command, or validation result.

## Timebox interactive turns

- Target roughly 10–15 minutes for a normal Lite turn and finish one verified behavior boundary.
- If another independent slice or an unchanged full gate would extend the turn, hand off the completed slice and name the next command instead of silently bundling more work.
- For Standard work, provide a checkpoint after the first verified contract boundary; reserve end-to-end and full gates for the milestone checkpoint.
- Continue across multiple slices only when the user explicitly requests sustained autonomous work, monitoring, or “do not stop” behavior.
- Treat timeboxes as reporting boundaries, not permission to skip safety checks or claim incomplete work as complete.

## Keep validation proportional

- Run targeted tests during iteration.
- Run the affected typecheck/build after the targeted tests pass.
- Run cross-repository E2E only for a changed cross-repository contract.
- Run the full repository or unified gate once per completed implementation milestone.
- Do not run a milestone-level full gate merely because a new conversation started or the user said “继续”.
- After evidence-only documentation changes, rerun only the affected parser, governance, inventory, diff, and no-stage checks. Do not repeat an unchanged full suite.
- Never claim completion from an old result after code affecting that result changed.

## Avoid process drag

- Do not require brainstorming when the user already supplied a concrete design or next step.
- Do not write a large implementation plan for one reversible slice; a short working plan is enough.
- Do not create a worktree, subagent, review round, or new document unless it materially reduces risk or the user/repository requires it.
- Do not reopen settled decisions after every test run.
- Do not ask for clarification when repository evidence supports one safe, reversible assumption.
- Do not expand scope merely because adjacent cleanup is visible; record the next bounded slice.
- Do not count files, tests, fixtures, readiness, fake credentials, or dry-runs as real business completion.

## Handle autonomous sessions

- Continue through safe in-scope work while a useful next step remains.
- Send concise progress updates during long commands or at meaningful boundaries.
- Batch independent read-only audits and checks when possible.
- Preserve dirty worktrees and unrelated user changes.
- Stop only for missing authority, irreversible choices, external credentials/materials, or a blocker that safe local work cannot bypass.

## Cross-repository and delivery boundaries

- Audit branch, HEAD, remotes, status, diff, staged state, and relevant baselines in each repository that the current slice will edit. Reuse that audit until its state changes.
- Use isolated databases, fake credentials, dry-run interfaces, and local fixtures for contract proof.
- Keep local readiness separate from real provider calls, paid spend, public artifacts, human approval, releases, and production migrations.
- Verify both sides of a changed contract and run one representative cross-repository E2E.

## Completion checklist

Before finishing, confirm only what applies:

- Targeted behavior tests pass.
- Affected typecheck/build passes.
- Required cross-repository E2E passes.
- One milestone-level full gate passes.
- Machine reports and handoff match current files.
- `git diff --check` passes.
- Staged state and both worktrees are reported honestly.
- External blockers and real-credit boundaries remain explicit.
