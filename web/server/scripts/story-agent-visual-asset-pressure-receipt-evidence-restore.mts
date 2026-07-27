import { readFile, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import {
  restoreStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js'
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
  verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js'

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
function webRelativePath(path: string, label: string): string {
  const value = relative(webRoot, path).replaceAll('\\', '/')
  if (!value || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new Error(`${label} must stay beneath the web root`)
  }
  return value
}
const receiptRelativePath = webRelativePath(receiptPath, 'receipt path')
const descriptorPath = resolve(
  webRoot,
  argumentValue('--descriptor')
    ?? 'server/scripts/'
      + 'story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json',
)
const descriptorRelativePath = webRelativePath(
  descriptorPath,
  'descriptor path',
)
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
const [receiptBytes, descriptorBytes, bundleBytes] = await Promise.all([
  readFile(receiptPath),
  readFile(descriptorPath),
  readFile(bundlePath),
])
const descriptor = parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
  JSON.parse(descriptorBytes.toString('utf8')) as unknown,
)
if (basename(bundlePath) !== descriptor.bundle_file_name) {
  throw new Error('evidence bundle file name differs from descriptor')
}
const descriptorVerification =
  await verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
    descriptor,
    receipt_bytes: receiptBytes,
    bundle_bytes: bundleBytes,
  })
if (descriptorVerification.status !== 'verified') {
  throw new Error(
    `evidence descriptor blocked restore: ${
      descriptorVerification.blockers.join(',')}`,
  )
}
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
  descriptor_path: descriptorRelativePath,
  descriptor_status: descriptorVerification.status,
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
