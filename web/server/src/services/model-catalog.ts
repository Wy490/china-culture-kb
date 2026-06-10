import type { AIModelProfile } from '@shared/types.js';

const MODEL_PROFILES: AIModelProfile[] = [
  {
    id: 'claude_sonnet',
    label: 'Claude Sonnet',
    description: '平衡速度和质感，适合大多数故事生成与局部重写场景',
    runtime: 'claude',
    model: 'sonnet',
    recommended: true,
    capabilities: ['story_generation', 'scene_regeneration'],
  },
  {
    id: 'claude_opus',
    label: 'Claude Opus',
    description: '更偏创作质量，适合重要项目、细腻情绪和复杂结构改写',
    runtime: 'claude',
    model: 'opus',
    capabilities: ['story_generation', 'scene_regeneration'],
  },
  {
    id: 'codex_gpt55',
    label: 'GPT-5.5',
    description: '适合结构清晰、执行稳定的重写任务，也方便后续扩展全文生成',
    runtime: 'codex',
    model: 'gpt-5.5',
    capabilities: ['story_generation', 'scene_regeneration'],
  },
];

export function listModelProfiles(): AIModelProfile[] {
  return MODEL_PROFILES;
}

export function getRecommendedModelProfile(): AIModelProfile {
  return MODEL_PROFILES.find(profile => profile.recommended) ?? MODEL_PROFILES[0];
}

export function getModelProfileById(id: string | undefined): AIModelProfile | undefined {
  if (!id) return undefined;
  return MODEL_PROFILES.find(profile => profile.id === id);
}

export function resolveModelProfile(id: string | undefined): AIModelProfile {
  return getModelProfileById(id) ?? getRecommendedModelProfile();
}
