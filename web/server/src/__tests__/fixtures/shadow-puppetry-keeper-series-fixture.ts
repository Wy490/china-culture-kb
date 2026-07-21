import type { AiComicSeriesPlanRequest } from '@shared/types.js';

export const SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE: AiComicSeriesPlanRequest = {
  outline: [
    '当代非遗悬疑《皮影诡戏：守灯人》。',
    '主角沈砚与林灯共同调查一座只在午夜开演的皮影戏台。',
    '戏台流传二十条规则，违反规则的人会被抹去记忆；沈砚已经忘掉一次关键相遇，林灯保留着证明两人曾并肩调查的灯票。',
    '开发商以改造街区为名逼迫戏班交出戏台，盗谱者则混在戏班里寻找失传灯谱，两股力量共同压缩调查时间。',
    '皮影制作、表演、灯幕与操偶技艺按可核实的非遗事实呈现；午夜规则、记忆抹除和失传灯谱明确属于原创悬疑机制。',
    '每集必须保留沈砚、林灯、午夜皮影规则、记忆代价、开发商与盗谱者，并以强钩子、强反转和具体结尾追问推进。',
  ].join('\n'),
  series_title: '皮影诡戏：守灯人',
  episode_count: 20,
  episode_duration_range_sec: { min: 60, max: 120 },
  pacing_profile: 'mystery_cliffhanger',
  generation_scope: 'full_planning',
};

export const SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS = {
  characters: ['沈砚', '林灯'],
  world_rules: ['午夜', '二十条规则', '记忆', '抹去'],
  antagonistic_forces: ['开发商', '盗谱者'],
} as const;

export const SHADOW_PUPPETRY_KEEPER_FORBIDDEN_TEMPLATE_ANCHORS = [
  '阿湘',
  '祖父机关谱',
  '拆除告示',
  '修复旧戏台',
] as const;
