import { storyGeneratedRoot } from '../src/platform/story-storage-root.js'
import {
  runStoryGenerationAttemptAuditCrashSmoke,
  StoryGenerationAttemptAuditCrashSmokeError,
} from '../src/services/story-generation-attempt-audit-crash-smoke-service.js'

const args = process.argv.slice(2)
const workDir = args.length === 2 && args[0] === '--work-dir' ? args[1] : undefined

if (!workDir) {
  console.log(JSON.stringify({
    schema_version: 'story-generation-attempt-audit-crash-smoke/v1',
    status: 'failed',
    reason: 'invalid_arguments',
    report_payload_absolute_path_exposed: false,
    shell_invocation_arguments_in_scope: false,
    recommended_npm_silent_invocation: true,
    automatic_repair_invoked: false,
    destructive_action_invoked: false,
  }, null, 2))
  process.exitCode = 1
} else {
  try {
    const report = await runStoryGenerationAttemptAuditCrashSmoke({
      workDir,
      activeGeneratedRoot: storyGeneratedRoot(),
    })
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    console.log(JSON.stringify({
      schema_version: 'story-generation-attempt-audit-crash-smoke/v1',
      status: 'failed',
      reason: error instanceof StoryGenerationAttemptAuditCrashSmokeError
        ? error.code
        : 'unexpected_failure',
      report_payload_absolute_path_exposed: false,
      shell_invocation_arguments_in_scope: false,
      recommended_npm_silent_invocation: true,
      automatic_repair_invoked: false,
      destructive_action_invoked: false,
    }, null, 2))
    process.exitCode = 1
  }
}
