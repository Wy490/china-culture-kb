import { CultureEntry, ScriptType } from '../types.js';

interface SceneSkeleton {
  title: string;
  entrySource: string;
  location?: string;
  culturalNote?: string;
}

const SCENE_TEMPLATES: Record<ScriptType, string[]> = {
  '纪录片': ['开场', '历史背景', '传承现状', '专家采访', '结尾'],
  '短剧': ['起幕', '冲突', '高潮', '化解', '尾声'],
  '动画': ['引入', '冒险/挑战', '转折', '解决', '寓意'],
  '文化解说': ['开场', '习俗概述', '地域差异', '现代演变', '总结'],
};

const DEFAULT_DURATIONS: Record<ScriptType, string> = {
  '纪录片': '30分钟',
  '短剧': '单集20分钟',
  '动画': '单集15分钟',
  '文化解说': '20分钟',
};

function distributeScenes(entries: CultureEntry[], scriptType: ScriptType): SceneSkeleton[] {
  const sceneTitles = SCENE_TEMPLATES[scriptType];

  if (entries.length === 1) {
    const entry = entries[0];
    return sceneTitles.map(title => ({
      title,
      entrySource: entry.name,
      location: entry.relatedLocations[0]?.name,
      culturalNote: entry.culturalSignificance.slice(0, 80),
    }));
  }

  // Multi-entry: distribute 2-3 scenes per entry, cycling through entries
  const scenes: SceneSkeleton[] = [];
  const perEntry = Math.max(2, Math.floor(sceneTitles.length / entries.length));

  for (let i = 0; i < entries.length; i++) {
    const startScene = Math.floor(i * sceneTitles.length / entries.length);
    const endScene = Math.min(startScene + perEntry, sceneTitles.length);
    for (let s = startScene; s < endScene && scenes.length < sceneTitles.length; s++) {
      scenes.push({
        title: sceneTitles[s],
        entrySource: entries[i].name,
        location: entries[i].relatedLocations[0]?.name,
        culturalNote: entries[i].culturalSignificance.slice(0, 80),
      });
    }
  }

  // Fill remaining scenes with last entry
  while (scenes.length < sceneTitles.length) {
    const lastEntry = entries[entries.length - 1];
    scenes.push({
      title: sceneTitles[scenes.length],
      entrySource: lastEntry.name,
      location: lastEntry.relatedLocations[0]?.name,
      culturalNote: lastEntry.culturalSignificance.slice(0, 80),
    });
  }

  return scenes;
}

export function formatScript(
  entries: CultureEntry[],
  scriptType: ScriptType,
  title: string,
  targetDuration: string,
  date: string,
): string {
  const duration = targetDuration || DEFAULT_DURATIONS[scriptType];
  const scenes = distributeScenes(entries, scriptType);
  const entryNames = entries.map(e => e.name).join('、');

  const lines: string[] = [
    `# ${title}`,
    '',
    '## 元信息',
    `- **脚本类型**：${scriptType}`,
    `- **涉及条目**：${entryNames}`,
    `- **目标时长**：${duration}`,
    `- **生成日期**：${date}`,
    '',
    '## 角色列表',
    '（由 Claude Code 根据条目故事梗概填充）',
    '',
    '## 场景列表',
    '',
  ];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    lines.push(`### 场景${i + 1}：${scene.title}`);
    lines.push(`- **时间**：（待填充）`);
    lines.push(`- **地点**：${scene.location || '（待填充）'}`);
    lines.push(`- **视觉描述**：（待填充）`);
    lines.push(`- **对话/解说词**：（待填充）`);
    lines.push(`- **文化注释**：${scene.culturalNote || '（待填充）'}`);
    lines.push(`- **来源追溯**：← ${scene.entrySource}`);
    lines.push('');
  }

  // Cultural annotation summary
  lines.push('## 文化注释汇总');
  lines.push('');
  for (const entry of entries) {
    lines.push(`- **${entry.name}**：${entry.culturalSignificance}`);
  }
  lines.push('');

  // Source traceability table
  lines.push('## 来源追溯表');
  lines.push('');
  lines.push('| 脚本元素 | 来源条目 | 来源章节 |');
  lines.push('|----------|----------|----------|');
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    lines.push(`| 场景${i + 1}：${scene.title} | ${scene.entrySource} | 文化意义 |`);
  }
  lines.push('');

  return lines.join('\n');
}

export function deriveTitle(entryNames: string[]): string {
  if (entryNames.length === 1) return entryNames[0];
  return entryNames.join('·') + '——文化脚本';
}

export { SCENE_TEMPLATES, DEFAULT_DURATIONS };