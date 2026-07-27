import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import {
  restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js'

const MAX_BUNDLE_FILE_BYTES = 180 * 1024 * 1024

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const receiptPath = resolve(
  webRoot,
  argumentValue('--receipt')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json',
)
const receiptRelativePath = relative(webRoot, receiptPath).replaceAll('\\', '/')
if (
  !receiptRelativePath
  || isAbsolute(receiptRelativePath)
  || receiptRelativePath === '..'
  || receiptRelativePath.startsWith('../')
) {
  throw new Error('receipt path must stay beneath the web root')
}
const bundlePath = resolve(
  webRoot,
  argumentValue('--bundle')
    ?? 'generated/story-agent-visual-asset-pressure-evidence/'
      + 'imagegen-20260726-batch3-receipt-evidence-bundle.json',
)
const bundleStats = await stat(bundlePath)
if (!bundleStats.isFile() || bundleStats.size > MAX_BUNDLE_FILE_BYTES) {
  throw new Error('evidence bundle file is missing or exceeds the restore limit')
}
const [receiptBytes, bundleBytes] = await Promise.all([
  readFile(receiptPath),
  readFile(bundlePath),
])
const result = await restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle({
  bundle: JSON.parse(bundleBytes.toString('utf8')) as unknown,
  receipt: JSON.parse(receiptBytes.toString('utf8')) as unknown,
  receipt_bytes: receiptBytes,
  web_root: webRoot,
})
console.log(JSON.stringify({
  schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-restore/v1',
  receipt_path: receiptRelativePath,
  ...result,
  machine_validation_only: true,
  image_provider_invoked_by_server: false,
  rights_granted: false,
  human_review_performed: false,
  external_artifact_download_verified_by_transport: false,
  video_generation_performed: false,
  production_credit_granted: false,
}, null, 2))
if (result.status === 'blocked') process.exitCode = 1
