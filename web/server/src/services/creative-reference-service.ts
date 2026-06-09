// web/server/src/services/creative-reference-service.ts — Creative Reference Library MVP
// Reads local style-pack JSON files from references/creative/style-packs/
// MVP: no upload UI, only local file reading

import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import type {
  StylePack,
  VideoType,
  PresentationStyle,
  StoryStructureType,
} from '@shared/types.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function referencesRoot(): string {
  return process.env.REFERENCES_ROOT || resolve(import.meta.dirname, '..', '..', '..', '..', '..', 'references', 'creative');
}

function stylePacksDir(): string {
  return resolve(referencesRoot(), 'style-packs');
}

// ---------------------------------------------------------------------------
// Read a style pack by ID
// ---------------------------------------------------------------------------

export async function getStylePack(stylePackId: string): Promise<StylePack | null> {
  const filePath = resolve(stylePacksDir(), `${stylePackId}.json`);
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as StylePack;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// List all style packs
// ---------------------------------------------------------------------------

export async function listStylePacks(): Promise<StylePack[]> {
  const dir = stylePacksDir();
  let files: string[];
  try { files = await readdir(dir); } catch { return []; }

  const packs: StylePack[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = resolve(dir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      packs.push(JSON.parse(content) as StylePack);
    } catch { continue; }
  }
  return packs;
}

// ---------------------------------------------------------------------------
// Find compatible style packs for given video_type / presentation_style / story_structure
// ---------------------------------------------------------------------------

export async function findCompatibleStylePacks(
  videoType: VideoType,
  presentationStyle: PresentationStyle,
  storyStructure?: StoryStructureType,
): Promise<StylePack[]> {
  const allPacks = await listStylePacks();

  return allPacks.filter(pack => {
    const vtMatch = pack.compatible_video_types.includes(videoType);
    const psMatch = pack.compatible_presentation_styles.includes(presentationStyle);
    const ssMatch = storyStructure ? pack.compatible_story_structures.includes(storyStructure) : true;
    return vtMatch && psMatch && ssMatch;
  });
}