import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import {
  buildStoryAgentVisualAssetPressureReceiptEvidenceBundle,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.js'
import {
  parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
  verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

const webRoot = resolve(import.meta.dirname, '..', '..')
function webRelativePath(path: string, label: string): string {
  const value = relative(webRoot, path).replaceAll('\\', '/')
  if (!value || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new Error(`${label} must stay beneath the web root`)
  }
  return value
}

const receiptPath = resolve(
  webRoot,
  argumentValue('--receipt')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json',
)
const descriptorPath = resolve(
  webRoot,
  argumentValue('--descriptor')
    ?? 'server/scripts/'
      + 'story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json',
)
const outputPath = resolve(
  webRoot,
  argumentValue('--output')
    ?? 'generated/story-agent-visual-asset-pressure-evidence/'
      + 'imagegen-20260726-batch3-receipt-evidence-bundle.json',
)
const receiptRelativePath = webRelativePath(receiptPath, 'receipt path')
const descriptorRelativePath = webRelativePath(
  descriptorPath,
  'descriptor path',
)
const outputRelativePath = webRelativePath(outputPath, 'output path')
if (!outputRelativePath.startsWith('generated/')) {
  throw new Error('evidence bundle output must stay beneath web/generated')
}
if (receiptPath === outputPath) {
  throw new Error('receipt and evidence bundle output paths must be distinct')
}

const [receiptBytes, descriptorBytes] = await Promise.all([
  readFile(receiptPath),
  readFile(descriptorPath),
])
const receipt = JSON.parse(receiptBytes.toString('utf8')) as unknown
const descriptor = parseStoryAgentVisualAssetPressureReceiptEvidenceDescriptor(
  JSON.parse(descriptorBytes.toString('utf8')) as unknown,
)
if (basename(outputPath) !== descriptor.bundle_file_name) {
  throw new Error('evidence bundle output file name differs from descriptor')
}
const bundle = await buildStoryAgentVisualAssetPressureReceiptEvidenceBundle({
  receipt,
  receipt_bytes: receiptBytes,
  web_root: webRoot,
})
const outputBytes = Buffer.from(`${JSON.stringify(bundle)}\n`)
const descriptorVerification =
  await verifyStoryAgentVisualAssetPressureReceiptEvidenceDescriptor({
    descriptor,
    receipt_bytes: receiptBytes,
    bundle_bytes: outputBytes,
  })
if (descriptorVerification.status !== 'verified') {
  throw new Error(
    `evidence descriptor blocked export: ${
      descriptorVerification.blockers.join(',')}`,
  )
}
await mkdir(dirname(outputPath), { recursive: true })
let outputStatus: 'created' | 'verified_existing' = 'created'
try {
  await writeFile(outputPath, outputBytes, { flag: 'wx' })
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  const existing = await readFile(outputPath)
  if (!existing.equals(outputBytes)) {
    throw new Error('existing evidence bundle differs; refusing to overwrite')
  }
  outputStatus = 'verified_existing'
}
console.log(JSON.stringify({
  schema_version:
    'story-agent-visual-asset-pressure-receipt-evidence-export/v1',
  status: outputStatus,
  batch_id: bundle.batch_id,
  receipt_path: receiptRelativePath,
  descriptor_path: descriptorRelativePath,
  descriptor_status: descriptorVerification.status,
  output_path: outputRelativePath,
  output_sha256: sha256(outputBytes),
  output_byte_length: outputBytes.length,
  ...bundle.summary,
  machine_validation_only: true,
  image_provider_invoked_by_server: false,
  rights_granted: false,
  human_review_performed: false,
  external_artifact_uploaded: false,
  video_generation_performed: false,
  production_credit_granted: false,
}, null, 2))
