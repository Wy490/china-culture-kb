import fs from 'node:fs/promises';
import path from 'node:path';
import { CultureEntry, ScriptType, GenerateScriptResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';
import { formatScript, deriveTitle, SCENE_TEMPLATES, DEFAULT_DURATIONS } from '../lib/scripts.js';
import { getKbRoot } from '../lib/provinces.js';
import { buildStoryCreationContract, renderCreationContractMarkdown } from './story-creation-contract.js';

interface GenerateScriptInput {
  entry_names: string;
  script_type: string;
  target_duration?: string;
  title?: string;
  creation_use_case?: string;
  truth_mode?: string;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
}

function getScriptsRoot(): string {
  const kbRoot = getKbRoot();
  return path.resolve(kbRoot, '..', 'scripts');
}

function injectCreationContractSection(scriptMarkdown: string, contractLines: string[]): string {
  const marker = '\n## 角色列表';
  const section = `\n${contractLines.join('\n')}\n`;
  if (!scriptMarkdown.includes(marker)) return `${scriptMarkdown}\n${section}`;
  return scriptMarkdown.replace(marker, `${section}${marker}`);
}

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
  const entryNames = input.entry_names.split(/[，,、]/).map(n => n.trim()).filter(Boolean);
  const scriptType = input.script_type as ScriptType;
  const title = input.title || deriveTitle(entryNames);
  const targetDuration = input.target_duration || '';
  const date = new Date().toISOString().split('T')[0];

  // Find matching entries across all province files
  const allFiles = await readAllProvinceFiles();
  const foundEntries: CultureEntry[] = [];

  for (const [province, content] of allFiles) {
    const parsed = parseEntries(content, province);
    for (const entry of parsed) {
      if (entryNames.includes(entry.name)) {
        // SearchResult → partial CultureEntry (story and culturalSignificance not parsed by regex)
        foundEntries.push({
          name: entry.name,
          province: entry.province,
          region: entry.region,
          type: entry.type,
          summary: entry.summary,
          story: '（待从完整条目中提取）',
          culturalSignificance: '（待从完整条目中提取）',
          relatedLocations: [],
          keywords: entry.keywords,
          sources: [],
          credibility: entry.credibility,
          unverifiedPoints: [],
        });
      }
    }
  }

  if (foundEntries.length === 0) {
    throw new Error(`未找到匹配的条目：${entryNames.join('、')}`);
  }

  const creationContract = buildStoryCreationContract({
    script_type: scriptType,
    entry_names: entryNames,
    output_mode: 'script_skeleton',
    target_duration: targetDuration,
    title,
    creation_use_case: input.creation_use_case,
    truth_mode: input.truth_mode,
    client_type: input.client_type,
    target_audience: input.target_audience,
    communication_goal: input.communication_goal,
  });
  const scriptMarkdown = injectCreationContractSection(
    formatScript(foundEntries, scriptType, title, targetDuration, date),
    renderCreationContractMarkdown(creationContract),
  );

  const scriptsRoot = getScriptsRoot();
  const typeDir = path.join(scriptsRoot, scriptType);
  await fs.mkdir(typeDir, { recursive: true });
  const filePath = path.join(typeDir, `${title}.md`);
  await fs.writeFile(filePath, scriptMarkdown, 'utf-8');

  return {
    filePath,
    title,
    scriptType,
    entriesUsed: foundEntries.map(e => e.name),
    sceneCount: SCENE_TEMPLATES[scriptType]?.length ?? 5,
    targetDuration: targetDuration || DEFAULT_DURATIONS[scriptType],
    creation_contract: creationContract,
    material_sufficiency: creationContract.material_sufficiency,
    legacy_writer: true,
    canonical_tool: 'kb_story_agent_generate',
    counts_as_canonical_generation: false,
  };
}
