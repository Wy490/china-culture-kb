import { readFile, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import {
  preflightStoryAgentVisualAssetPressureReceiptEvidence,
} from '../src/services/story-agent-visual-asset-pressure-receipt-evidence-preflight-service.js'

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

const descriptorPath = resolve(
  webRoot,
  argumentValue('--descriptor')
    ?? 'server/scripts/'
      + 'story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json',
)
const receiptPath = resolve(
  webRoot,
  argumentValue('--receipt')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json',
)
const bundlePath = resolve(
  webRoot,
  argumentValue('--bundle')
    ?? 'generated/story-agent-visual-asset-pressure-evidence/'
      + 'imagegen-20260726-batch3-receipt-evidence-bundle.json',
)
const descriptorRelativePath = webRelativePath(descriptorPath, 'descriptor path')
const receiptRelativePath = webRelativePath(receiptPath, 'receipt path')

await Promise.all([
  requireBoundedFile(
    descriptorPath,
    MAX_DESCRIPTOR_FILE_BYTES,
    'descriptor file',
  ),
  requireBoundedFile(receiptPath, MAX_RECEIPT_FILE_BYTES, 'receipt file'),
  requireBoundedFile(bundlePath, MAX_BUNDLE_FILE_BYTES, 'bundle file'),
])
const [descriptorBytes, receiptBytes, bundleBytes] = await Promise.all([
  readFile(descriptorPath),
  readFile(receiptPath),
  readFile(bundlePath),
])
let descriptor: unknown
try {
  descriptor = JSON.parse(descriptorBytes.toString('utf8')) as unknown
} catch {
  descriptor = null
}
const result = await preflightStoryAgentVisualAssetPressureReceiptEvidence({
  descriptor,
  receipt_bytes: receiptBytes,
  bundle_bytes: bundleBytes,
  bundle_file_name: basename(bundlePath),
})
console.log(JSON.stringify({
  ...result,
  descriptor_path: descriptorRelativePath,
  receipt_path: receiptRelativePath,
  image_provider_invoked_by_server: false,
  evidence_files_written: false,
}, null, 2))
if (result.status === 'blocked') process.exitCode = 1
