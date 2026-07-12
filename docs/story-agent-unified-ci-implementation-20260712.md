# Story Agent 统一 CI 实现（2026-07-12）

## 结论

Story Agent 已建立一个统一、无付费模型调用的 CI 入口：

```bash
node scripts/story-agent-ci.mjs --mode local
```

GitHub Actions 使用 `--mode ci`。两个模式执行相同的合同、测试、构建、lint、Stage 6 和治理审计；区别只在工作区检查：

- `local`：要求 P4 文件清单未 stale，并保持暂存文件为 0。
- `ci`：要求验证过程不修改已跟踪文件，适用于干净 checkout。

## 安全与信用边界

Runner 会删除继承的 `STORY_GEN_COMMAND`、`STORY_GEN_COMMAND_ARGS` 和 `STORY_GEN_PROVIDER`，并固定：

```text
STORY_GEN_LOCAL_ONLY=1
STORY_AGENT_CI=1
```

运行前还会核对 P0/P3 fail-closed policy 和当前零付费模型、零真实修订、零专业通过检查点。CI、fixture、simulation、fallback、prepared 或 blocked 状态均不计真实修订、真人桌读或专业通过。

## 覆盖范围

统一入口依次执行：

1. Web 可见文案审计与 TypeScript 检查。
2. Web Server 全量测试和 Web 生产构建。
3. MCP 全量测试、TypeScript build 和知识库 lint。
4. Stage 6 P0 readiness、P1 batch status、P3 exit audit stale-check。
5. 专业文本能力审计与历史治理检查。
6. `git diff --check` 和对应模式的工作区不变性检查。

可用以下命令只查看计划，不执行测试：

```bash
node scripts/story-agent-ci.mjs --mode local --list
node scripts/story-agent-ci.mjs --mode ci --list
```

## GitHub Actions

`.github/workflows/story-agent-ci.yml` 在 pull request、`main` 和 `codex/**` push 上运行，使用 Node.js 22、两份锁文件和 `npm ci`。权限固定为 `contents: read`，不包含 secrets、模型凭据、部署或写回权限。

统一 CI 只证明仓库合同与自动化检查可重复，不代表任何真实项目、真实模型输出、真人评审或专业质量通过。
