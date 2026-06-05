// web/server/src/routes/system.ts — System info routes (provinces, types)

import { Router } from 'express';
import { mcpReadAllProvinceFiles, mcpParseEntries } from '../services/mcp-proxy.js';
import { success } from '@shared/types.js';
import type { ProvinceInfo, TypeInfo, GenerationType } from '@shared/types.js';

export const systemRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/system/provinces — list provinces with entry counts
// ---------------------------------------------------------------------------

systemRouter.get('/provinces', async (_req, res, next) => {
  try {
    const provinceFiles = await mcpReadAllProvinceFiles();
    const provinces: ProvinceInfo[] = [];

    for (const [provinceName, content] of provinceFiles) {
      const entries = mcpParseEntries(content, provinceName);
      provinces.push({ name: provinceName, entry_count: entries.length });
    }

    // Sort by name for consistent ordering
    provinces.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    res.json(success(provinces));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/types — entry type → generation type mapping table
// ---------------------------------------------------------------------------

const TYPE_GENERATION_MAP: TypeInfo[] = [
  { name: '历史人物', recommended_generation_types: ['character_story'], description: '以人物为核心的叙事故事' },
  { name: '神话传说', recommended_generation_types: ['character_story', 'scene_short'], description: '兼具人物叙事与场景演绎' },
  { name: '民间故事', recommended_generation_types: ['character_story'], description: '以故事人物为核心的叙事' },
  { name: '非遗', recommended_generation_types: ['culture_promo'], description: '非物质文化遗产文化推广' },
  { name: '地方戏曲', recommended_generation_types: ['culture_promo'], description: '戏曲文化推广展示' },
  { name: '节庆习俗', recommended_generation_types: ['culture_promo'], description: '节庆文化推广展示' },
  { name: '饮食文化', recommended_generation_types: ['culture_promo'], description: '饮食文化推广展示' },
  { name: '传统工艺', recommended_generation_types: ['culture_promo'], description: '工艺文化推广展示' },
  { name: '名胜古迹', recommended_generation_types: ['scene_short', 'culture_promo'], description: '场景短剧与文化推广' },
  { name: '地方掌故', recommended_generation_types: ['character_story', 'scene_short'], description: '兼具叙事与场景演绎' },
  { name: '宗教信仰', recommended_generation_types: ['scene_short', 'culture_promo'], description: '场景演绎与文化推广' },
  { name: '民俗活动', recommended_generation_types: ['culture_promo'], description: '民俗文化推广展示' },
];

systemRouter.get('/types', (_req, res) => {
  res.json(success(TYPE_GENERATION_MAP));
});