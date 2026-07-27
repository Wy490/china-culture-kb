import { readFile, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import {
  preflightStoryAgentVisualAssetPressureReceiptEvidence,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-preflight-service.js'
import {
  parseStoryAgentVisualAssetPressureBatchRegistry,
} from '../src/services/story-agent-visual-asset-pressure-batch-registry-service.js'

const MAX_REGISTRY_FILE_BYTES = 1024 * 1024
const MAX_DESCRIPTOR_FILE_BYTES = 128 * 1024
const MAX_RECEIPT_FILE_BYTES = 4 * 1024 * 1024
const MAX_BUNDLE_FILE_BYTES = 180 * 1024 * 1024

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const webRoot = resolve(import.meta.dirname, '..', '..')

function webRelativePath(path: string, label: string): string {
  const value = relative(webRoot, path).replaceAll('\\', '/')
  if (!value || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new Error(`${label} must stay beneath the web root`)
  }
  return value
}

async function requireBoundedFile(
  path: string,
  maximumBytes: number,
  label: string,
): Promise<void> {
  const value = await stat(path)
  if (!value.isFile() || value.size > maximumBytes) {
    throw new Error(`${label} is missing or exceeds its preflight limit`)
  }
}

const registryPath = resolve(
  webRoot,
  argumentValue('--registry')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch-registry.json',
)
const registryRelativePath = webRelativePath(registryPath, 'registry path')
await requireBoundedFile(
  registryPath,
  MAX_REGISTRY_FILE_BYTES,
  'registry file',
)
const registry = parseStoryAgentVisualAssetPressureBatchRegistry(
  JSON.parse((await readFile(registryPath)).toString('utf8')) as unknown,
)
const batchId = argumentValue('--batch-id') ?? 'imagegen-20260726-batch3'
const batch = registry.batches.find(item => item.batch_id === batchId)
if (
  !batch
  || batch.receipt_status !== 'sealed'
  || !batch.receipt_path
  || !batch.evidence_descriptor_path
) {
  throw new Error('preflight batch must be registered with sealed evidence')
}
const registeredDescriptorPath = resolve(
  webRoot,
  batch.evidence_descriptor_path,
)
const registeredReceiptPath = resolve(webRoot, batch.receipt_path)
const descriptorPath = resolve(
  webRoot,
  argumentValue('--descriptor') ?? batch.evidence_descriptor_path,
)
const receiptPath = resolve(
  webRoot,
  argumentValue('--receipt') ?? batch.receipt_path,
)
if (
  descriptorPath !== registeredDescriptorPath
  || receiptPath !== registeredReceiptPath
) {
  throw new Error('preflight receipt and descriptor must match the registry')
}
const descriptorRelativePath = webRelativePath(descriptorPath, 'descriptor path')
const receiptRelativePath = webRelativePath(receiptPath, 'receipt path')

await Promise.all([
  requireBoundedFile(
    descriptorPath,
    MAX_DESCRIPTOR_FILE_BYTES,
    'descriptor file',
  ),
  requireBoundedFile(receiptPath, MAX_RECEIPT_FILE_BYTES, 'receipt file'),
])
const [descriptorBytes, receiptBytes] = await Promise.all([
  readFile(descriptorPath),
  readFile(receiptPath),
])
let descriptor: unknown
try {
  descriptor = JSON.parse(descriptorBytes.toString('utf8')) as unknown
} catch {
  descriptor = null
}
const parsedDescriptor = descriptor && typeof descriptor === 'object'
  && !Array.isArray(descriptor)
  ? descriptor as Record<string, unknown>
  : {}
const bundlePath = resolve(
  webRoot,
  argumentValue('--bundle')
    ?? `generated/story-agent-visual-asset-pressure-evidence/${
      String(parsedDescriptor.bundle_file_name ?? '')}`,
)
await requireBoundedFile(bundlePath, MAX_BUNDLE_FILE_BYTES, 'bundle file')
const bundleBytes = await readFile(bundlePath)
const result = await preflightStoryAgentVisualAssetPressureReceiptEvidence({
  descriptor,
  receipt_bytes: receiptBytes,
  bundle_bytes: bundleBytes,
  bundle_file_name: basename(bundlePath),
})
console.log(JSON.stringify({
  ...result,
  registry_path: registryRelativePath,
  descriptor_path: descriptorRelativePath,
  receipt_path: receiptRelativePath,
  image_provider_invoked_by_server: false,
  evidence_files_written: false,
}, null, 2))
if (result.status === 'blocked') process.exitCode = 1
