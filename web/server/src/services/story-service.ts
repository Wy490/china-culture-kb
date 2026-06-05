// web/server/src/services/story-service.ts — Story business logic
// plan, generate+store, list, get, gears-segments

import { resolve } from 'node:path';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { mcpGetFullEntryDetail, convertFullEntryDetail } from './mcp-proxy.js';
import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  EntryDetail,
  StoryPlanResult,
  RecommendedType,
  AvailableEvent,
  GenerationType,
  SupportedDuration,
  StoryGenerateRequest,
  StoryGenerateResult,
  GearsSegmentsResponse,
} from '@shared/types.js';

// ---------------------------------------------------------------------------
// Type → generation type routing (same map as system/types endpoint)
// ---------------------------------------------------------------------------

const TYPE_GENERATION_ROUTING: Record<string, GenerationType[]> = {
  '历史人物': ['character_story'],
  '神话传说': ['character_story', 'scene_short'],
  '民间故事': ['character_story'],
  '非遗': ['culture_promo'],
  '地方戏曲': ['culture_promo'],
  '节庆习俗': ['culture_promo'],
  '饮食文化': ['culture_promo'],
  '传统工艺': ['culture_promo'],
  '名胜古迹': ['scene_short', 'culture_promo'],
  '地方掌故': ['character_story', 'scene_short'],
  '宗教信仰': ['scene_short', 'culture_promo'],
  '民俗活动': ['culture_promo'],
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function generatedRoot(): string {
  // web/generated/stories is at project root level, next to data/
  // KB_ROOT points to .../data, so go up one and into web/generated/stories
  return resolve(kbRoot(), '..', 'web', 'generated', 'stories');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * slugify — create a short slug from Chinese text using character code sum → base36 hash.
 * Produces a deterministic, collision-resistant identifier.
 */
function slugify(text: string): string {
  let sum = 0;
  for (const ch of text) {
    sum += ch.charCodeAt(0);
  }
  return sum.toString(36);
}

/**
 * Generate a storyId in format YYYYMMDD-story-{hash36}
 */
function generateStoryId(entryName: string): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  // Combine entry name chars + random component for uniqueness
  const hashInput = entryName + String(Date.now());
  let sum = 0;
  for (const ch of hashInput) {
    sum += ch.charCodeAt(0);
  }
  // Add a small random offset to avoid collisions on same-day same-entry
  const hash36 = (sum + Math.floor(Math.random() * 100)).toString(36);
  return `${datePart}-story-${hash36}`;
}

/**
 * Extract bold-marked events from the story field.
 * Pattern: **event name** followed by ：or a description
 * Returns an array of event name strings.
 */
function extractBoldEvents(storyText: string): string[] {
  const events: string[] = [];
  // Match **text** patterns that appear as event headings in the story field
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(storyText)) !== null) {
    const eventName = match[1].trim();
    // Skip meta-fields like "省份", "地区", "类型" which are header fields, not events
    if (['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'].includes(eventName)) {
      continue;
    }
    events.push(eventName);
  }
  return events;
}

/**
 * Compute cultural risks from unverified points and credibility level.
 */
function computeCulturalRisks(entry: EntryDetail): string[] {
  const risks: string[] = [];

  // Low credibility → risk
  if (entry.credibility === '存疑') {
    risks.push('条目整体可信度存疑，需大量核实方可用于创作');
  }
  if (entry.credibility === '待核实') {
    risks.push('条目可信度待核实，核心情节可能缺乏佐证');
  }

  // Unverified points → risks
  for (const point of entry.unverifiedPoints) {
    risks.push(`待核实：${point}`);
  }

  return risks;
}

/**
 * Determine recommended duration based on entry type and event characteristics.
 * Simple heuristic for phase 1.
 */
function recommendDuration(entryType: string, eventCount: number): SupportedDuration {
  if (entryType === '历史人物' && eventCount >= 3) return '3分钟';
  if (entryType === '历史人物') return '1分钟';
  if (['非遗', '传统工艺', '饮食文化'].includes(entryType)) return '1分钟';
  if (['名胜古迹', '地方掌故'].includes(entryType)) return '1分钟';
  return '1分钟';
}

/**
 * Determine per-event recommended type based on entry type routing.
 */
function recommendEventType(entryType: string): GenerationType {
  const types = TYPE_GENERATION_ROUTING[entryType];
  if (!types || types.length === 0) return 'character_story';
  return types[0];
}

// ---------------------------------------------------------------------------
// planStory — preview recommendation for an entry
// ---------------------------------------------------------------------------

export async function planStory(entryName: string): Promise<ApiResponse<StoryPlanResult>> {
  const mcpDetail = await mcpGetFullEntryDetail(entryName);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entryName}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);
  const entryType = entry.type;

  // Determine recommended generation types from routing map
  const routedTypes = TYPE_GENERATION_ROUTING[entryType] || ['character_story'];

  // Build recommended_types list
  const recommendedTypes: RecommendedType[] = routedTypes.map((genType, index) => {
    const reasonMap: Record<string, string> = {
      character_story: `该条目类型"${entryType}"适合以人物/故事为核心的叙事`,
      culture_promo: `该条目类型"${entryType}"适合文化推广展示`,
      scene_short: `该条目类型"${entryType}"适合场景演绎短片`,
    };
    return {
      generation_type: genType,
      reason: reasonMap[genType] || `适合${genType}模式`,
      priority: index + 1,
    };
  });

  // Extract bold events from story field
  const boldEvents = extractBoldEvents(entry.story);

  // Build available_events list
  const availableEvents: AvailableEvent[] = boldEvents.map((eventName) => ({
    event: eventName,
    conflict_score: 7, // Default score for phase 1 — actual scoring TBD
    recommended_duration: recommendDuration(entryType, boldEvents.length),
    recommended_type: recommendEventType(entryType),
  }));

  // If no bold events found, provide a default
  if (availableEvents.length === 0) {
    availableEvents.push({
      event: '整体故事',
      conflict_score: 5,
      recommended_duration: recommendDuration(entryType, 0),
      recommended_type: recommendEventType(entryType),
    });
  }

  // Compute cultural risks
  const culturalRisks = computeCulturalRisks(entry);

  // Recommended duration
  const recommendedDuration = recommendDuration(entryType, boldEvents.length);

  return success({
    entry_name: entryName,
    entry_type: entryType,
    recommended_types: recommendedTypes,
    available_events: availableEvents,
    recommended_duration: recommendedDuration,
    cultural_risks: culturalRisks,
  });
}

// ---------------------------------------------------------------------------
// generateAndStoreStory — create story skeleton and store JSON file
// ---------------------------------------------------------------------------

export async function generateAndStoreStory(
  request: StoryGenerateRequest,
): Promise<ApiResponse<StoryGenerateResult>> {
  const { entry_name, generation_type, selected_event, target_video_duration, tone, output_gears_segments } = request;

  // Validate entry exists
  const mcpDetail = await mcpGetFullEntryDetail(entry_name);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entry_name}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);

  // Generate storyId
  const storyId = generateStoryId(entry_name);

  // Compute gears_segments_url (backend-generated, frontend never constructs)
  const gearsSegmentsUrl = `/api/stories/${storyId}/gears-segments`;

  // Build skeleton JSON — phase 1: metadata populated, content fields empty
  const storyData: StoryGenerateResult = {
    storyId,
    title: entry_name,
    generation_type,
    source_entry: entry_name,
    logline: '', // populated by frontend/Claude later
    theme: '', // populated later
    full_text: '', // populated later
    scene_breakdown: [], // populated later
    gears_segments: [], // populated later
    gears_segments_url: gearsSegmentsUrl,
    cultural_constraints: computeCulturalRisks(entry),
    credibility_note: entry.credibility,
    // Type-specific fields — populated later based on generation_type
    ...(generation_type === 'character_story' ? {
      characters: [],
      act_structure: [],
      protagonist_arc: [],
    } : {}),
    ...(generation_type === 'culture_promo' ? {
      visual_symbols: [],
      craft_or_ritual_process: '',
      modern_connection: '',
    } : {}),
    ...(generation_type === 'scene_short' ? {
      spatial_identity: '',
      visual_route: [],
      time_layer: '',
    } : {}),
    // Store request metadata for later content generation
    _request_meta: {
      selected_event: selected_event || null,
      target_video_duration: target_video_duration || null,
      tone: tone || null,
      output_gears_segments: output_gears_segments ?? true,
      entry_type: entry.type,
      created_at: new Date().toISOString(),
    },
  };

  // Ensure directory exists and write file
  const dirPath = resolve(generatedRoot(), generation_type);
  await mkdir(dirPath, { recursive: true });

  const filePath = resolve(dirPath, `${storyId}.json`);
  await writeFile(filePath, JSON.stringify(storyData, null, 2), 'utf-8');

  return success(storyData);
}

// ---------------------------------------------------------------------------
// listStories — scan generated stories directories
// ---------------------------------------------------------------------------

export async function listStories(
  generationType?: string,
): Promise<ApiResponse<Array<{ storyId: string; title: string; generation_type: string }>>> {
  const root = generatedRoot();
  const results: Array<{ storyId: string; title: string; generation_type: string }> = [];

  // Determine which directories to scan
  const typesToScan: string[] = generationType
    ? [generationType]
    : ['character_story', 'culture_promo', 'scene_short'];

  for (const typeDir of typesToScan) {
    const dirPath = resolve(root, typeDir);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      // Directory doesn't exist yet — no stories of this type
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = resolve(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        results.push({
          storyId: data.storyId || file.replace('.json', ''),
          title: data.title || '',
          generation_type: data.generation_type || typeDir,
        });
      } catch {
        // Skip malformed files
        continue;
      }
    }
  }

  return success(results);
}

// ---------------------------------------------------------------------------
// getStory — find and read a story JSON file
// ---------------------------------------------------------------------------

export async function getStory(storyId: string): Promise<ApiResponse<StoryGenerateResult>> {
  const root = generatedRoot();
  const typesToSearch = ['character_story', 'culture_promo', 'scene_short'];

  for (const typeDir of typesToSearch) {
    const filePath = resolve(root, typeDir, `${storyId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as StoryGenerateResult;
      return success(data);
    } catch {
      // Not in this directory, try next
      continue;
    }
  }

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);
}

// ---------------------------------------------------------------------------
// getGearsSegments — extract gears_segments from story, add schema_version
// ---------------------------------------------------------------------------

export async function getGearsSegments(storyId: string): Promise<ApiResponse<GearsSegmentsResponse>> {
  const storyResult = await getStory(storyId);

  if (!storyResult.ok || !storyResult.data) {
    return fail(ErrorCodes.GEARS_SEGMENTS_NOT_FOUND, `Gears segments for story "${storyId}" not found`);
  }

  const story = storyResult.data;
  const segments = story.gears_segments || [];

  // Compute total_duration_sec from segments
  const totalDurationSec = segments.reduce((sum, seg) => sum + seg.duration_sec, 0);

  const response: GearsSegmentsResponse = {
    schema_version: 'gears-segments/v1',
    storyId: story.storyId,
    title: story.title,
    total_duration_sec: totalDurationSec,
    segments,
  };

  return success(response);
}