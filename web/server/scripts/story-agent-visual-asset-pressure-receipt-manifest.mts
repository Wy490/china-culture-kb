import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../src/services/story-agent-visual-asset-pressure-batch-receipt-service.js'
import {
  buildStoryAgentVisualAssetPressureReceiptBackedManifest,
} from '../src/services/story-agent-visual-asset-pressure-receipt-manifest-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function requiredArgument(name: string): string {
  const value = argumentValue(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}

const webRoot = resolve(import.meta.dirname, '..', '..')
function webPathArgument(name: string): string {
  const path = resolve(webRoot, requiredArgument(name))
  const relativePath = relative(webRoot, path).replaceAll('\\', '/')
  if (
    !relativePath
    || isAbsolute(relativePath)
    || relativePath === '..'
    || relativePath.startsWith('../')
  ) {
    throw new Error(`${name} must stay beneath the web root`)
  }
  return path
}

const catalogPath = webPathArgument('--catalog')
const outputPath = webPathArgument('--output')
const styleMapPath = webPathArgument('--style-map-output')
const receiptPath = webPathArgument('--receipt')
if (new Set([catalogPath, outputPath, styleMapPath, receiptPath]).size !== 4) {
  throw new Error('catalog, receipt, manifest, and style-map paths must be distinct')
}
const [catalogValue, receiptValue] = await Promise.all([
  readFile(catalogPath, 'utf8'),
  readFile(receiptPath, 'utf8'),
])
const catalog = JSON.parse(catalogValue) as unknown
const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
  JSON.parse(receiptValue) as unknown,
)
const receiptVerification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
  receipt,
  web_root: webRoot,
})
if (receiptVerification.status !== 'sealed') {
  throw new Error(
    `immutable receipt blocked: ${receiptVerification.blockers.join(', ')}`,
  )
}
const built = buildStoryAgentVisualAssetPressureReceiptBackedManifest({
  catalog,
  receipt,
})
await Promise.all([
  mkdir(dirname(outputPath), { recursive: true }),
  mkdir(dirname(styleMapPath), { recursive: true }),
])
await Promise.all([
  writeFile(outputPath, `${JSON.stringify(built.manifest, null, 2)}\n`, 'utf8'),
  writeFile(styleMapPath, `${JSON.stringify(built.style_map, null, 2)}\n`, 'utf8'),
])
console.log(JSON.stringify({
  manifest_path: outputPath,
  style_map_path: styleMapPath,
  seed_count: built.summary.seed_count,
  asset_count: built.summary.manifest_asset_count,
  unique_content_sha256_count: built.summary.unique_content_sha256_count,
  receipt_path: receiptPath,
  receipt_status: receiptVerification.status,
}, null, 2))
