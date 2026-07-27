import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import {
  auditStoryAgentVisualAssetPressureReceiptRegistry,
} from '../src/services/story-agent-visual-asset-pressure-receipt-registry-audit-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const registryPath = resolve(
  webRoot,
  argumentValue('--registry')
    ?? 'server/scripts/story-agent-visual-asset-pressure-batch-registry.json',
)
const registryRelativePath = relative(webRoot, registryPath).replaceAll('\\', '/')
if (
  !registryRelativePath
  || isAbsolute(registryRelativePath)
  || registryRelativePath === '..'
  || registryRelativePath.startsWith('../')
) {
  throw new Error('registry path must stay beneath the web root')
}

const registry = JSON.parse(await readFile(registryPath, 'utf8')) as unknown
const audit = await auditStoryAgentVisualAssetPressureReceiptRegistry({
  registry,
  web_root: webRoot,
})
console.log(JSON.stringify({
  ...audit,
  registry_path: registryRelativePath,
}, null, 2))
if (audit.status !== 'verified') process.exitCode = 1
