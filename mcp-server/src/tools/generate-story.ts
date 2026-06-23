import fs from 'node:fs/promises';
import path from 'node:path';
import { ScriptType, GenerateStoryResult } from '../types.js';
import { getKbRoot } from '../lib/provinces.js';
import { buildStoryCreationContract, renderCreationContractMarkdown } from './story-creation-contract.js';

interface GenerateStoryInput {
  title: string;
  story_text: string;
  entry_names: string;
  script_type: string;
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

export async function generateStory(input: GenerateStoryInput): Promise<GenerateStoryResult> {
  const scriptType = input.script_type as ScriptType;
  const title = input.title;
  const entryNames = input.entry_names.split(/[，,、]/).map(n => n.trim()).filter(Boolean);
  const date = new Date().toISOString().split('T')[0];
  const creationContract = buildStoryCreationContract({
    script_type: scriptType,
    entry_names: entryNames,
    output_mode: 'story_text',
    story_text: input.story_text,
    title,
    creation_use_case: input.creation_use_case,
    truth_mode: input.truth_mode,
    client_type: input.client_type,
    target_audience: input.target_audience,
    communication_goal: input.communication_goal,
  });

  // Format the complete story_text with metadata wrapper
  const fullStoryText = [
    `# ${title}`,
    '',
    `> 生成日期：${date} | 脚本类型：${scriptType} | 来源条目：${entryNames.join('、')}`,
    '',
    ...renderCreationContractMarkdown(creationContract),
    '',
    input.story_text,
  ].join('\n');

  // Write to scripts/ directory
  const scriptsRoot = getScriptsRoot();
  const typeDir = path.join(scriptsRoot, scriptType);
  await fs.mkdir(typeDir, { recursive: true });
  const filePath = path.join(typeDir, `${title}.md`);
  await fs.writeFile(filePath, fullStoryText, 'utf-8');

  return {
    filePath,
    title,
    scriptType,
    entryNames,
    storyText: fullStoryText,
    creation_contract: creationContract,
    material_sufficiency: creationContract.material_sufficiency,
  };
}
