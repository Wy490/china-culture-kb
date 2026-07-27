import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  verifyStoryAgentVisualAssetPressureBatchReceipt,
} from '../src/services/story-agent-visual-asset-pressure-batch-receipt-service.js'

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

const receipt = parseStoryAgentVisualAssetPressureBatchReceipt(
  JSON.parse(await readFile(receiptPath, 'utf8')) as unknown,
)
const verification = await verifyStoryAgentVisualAssetPressureBatchReceipt({
  receipt,
  web_root: webRoot,
})
const summary = {
  schema_version: 'story-agent-visual-asset-pressure-batch-receipt-inspection/v1',
  inspected_at: new Date().toISOString(),
  receipt_path: receiptRelativePath,
  status: verification.status,
  batch_id: receipt.batch_id,
  provider: receipt.provider,
  model: receipt.model,
  seed_count: new Set(receipt.assets.map(asset => asset.seed_id)).size,
  asset_count: verification.asset_count,
  verified_asset_count: verification.verified_asset_count,
  role_counts: {
    character: receipt.assets.filter(asset => asset.role === 'character').length,
    world: receipt.assets.filter(asset => asset.role === 'world').length,
  },
  blockers: verification.blockers,
  machine_validation_only: true,
  image_provider_invoked_by_server: false,
  video_generation_performed: false,
  production_credit_granted: false,
}
console.log(JSON.stringify(summary, null, 2))
if (verification.status !== 'sealed') process.exitCode = 1
