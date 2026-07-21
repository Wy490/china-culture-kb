import type {
  ProjectSeedanceAssetPlaceholderItem,
  SeedanceAssetBindingItem,
  SeedanceAssetLibraryItem,
} from '@shared/types.js';
import {
  appendSeedanceAssetHistory,
  seedanceAssetHistoryEvent,
  seedanceAssetHistoryEventId,
} from './seedance-asset-history-service.js';

export interface SeedanceAssetPlaceholderPlan {
  filename: string;
  relativePath: string;
  localPath: string;
  description: string;
  svg: string;
}

export interface SeedanceAssetPlaceholderMaterialization {
  libraryAsset: SeedanceAssetLibraryItem;
  item: ProjectSeedanceAssetPlaceholderItem;
}

export function isSeedanceAssetPlaceholderCandidate(asset: SeedanceAssetBindingItem): boolean {
  return !asset.is_bound && Boolean(asset.reference_slot?.trim());
}

function slugifySeedanceAssetLabel(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 80);
  return encodeURIComponent(value.trim()).replace(/%/g, '').slice(0, 80) || 'asset';
}

function seedanceAssetPlaceholderFilename(asset: SeedanceAssetBindingItem): string {
  const slot = slugifySeedanceAssetLabel(asset.reference_slot ?? '').slice(0, 24) || 'slot';
  const label = slugifySeedanceAssetLabel(asset.label).slice(0, 40) || 'asset';
  return `placeholder-${slot}-${asset.kind}-${label}.svg`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clipSvgText(value: string, maxLength: number): string {
  const chars = [...value.trim().replace(/\s+/g, ' ')];
  if (chars.length <= maxLength) return chars.join('');
  return `${chars.slice(0, Math.max(0, maxLength - 3)).join('')}...`;
}

function seedanceAssetKindText(kind: SeedanceAssetBindingItem['kind']): string {
  const map: Record<SeedanceAssetBindingItem['kind'], string> = {
    character: '人物参考',
    location: '场景参考',
    prop: '道具参考',
    camera: '运镜参考',
    audio: '声音参考',
  };
  return map[kind];
}

function seedanceAssetRoleText(role: SeedanceAssetBindingItem['role']): string {
  const map: Record<SeedanceAssetBindingItem['role'], string> = {
    character_reference: '人物形象',
    location_reference: '场景氛围',
    prop_reference: '关键道具',
    camera_reference: '运镜节奏',
    music_reference: '音乐情绪',
    sound_reference: '声音设计',
  };
  return map[role];
}

function seedanceAssetPlaceholderPalette(kind: SeedanceAssetBindingItem['kind']): {
  background: string;
  accent: string;
  tint: string;
} {
  const map: Record<SeedanceAssetBindingItem['kind'], { background: string; accent: string; tint: string }> = {
    character: { background: '#f7efe1', accent: '#8a3f2b', tint: '#f0d4bd' },
    location: { background: '#e8f1ec', accent: '#285f52', tint: '#c9dfd5' },
    prop: { background: '#f3f0e8', accent: '#6d5428', tint: '#ded3b2' },
    camera: { background: '#ebeff5', accent: '#334f78', tint: '#ccd8e8' },
    audio: { background: '#f1edf5', accent: '#5f4674', tint: '#dacbe7' },
  };
  return map[kind];
}

function seedanceAssetPlaceholderDescription(asset: SeedanceAssetBindingItem): string {
  return [
    `Story Agent 自动生成的 Seedance 本地占位参考卡：${asset.reference_slot ?? '未分配槽位'} ${asset.label}`,
    asset.prompt_usage ? `用途：${asset.prompt_usage}` : undefined,
    '正式投产前可替换为定稿视觉参考文件。',
  ].filter(Boolean).join('；');
}

function renderSeedanceAssetPlaceholderSvg(input: {
  asset: SeedanceAssetBindingItem;
  projectTitle: string;
}): string {
  const { asset, projectTitle } = input;
  const palette = seedanceAssetPlaceholderPalette(asset.kind);
  const shotText = asset.source_shot_ids.length ? asset.source_shot_ids.join(' / ') : '未绑定镜头';
  const sceneText = asset.source_scene_ids.length ? asset.source_scene_ids.join(' / ') : '未绑定场景';
  const promptText = asset.prompt_usage || '按 Production Board 的 Seedance prompt 中对应 @ 槽位使用。';
  const lines = [
    `${asset.reference_slot ?? '未分配槽位'} 作为${seedanceAssetRoleText(asset.role)}`,
    `类型：${seedanceAssetKindText(asset.kind)} / ${asset.modality}`,
    `项目：${projectTitle}`,
    `镜头：${shotText}`,
    `场景：${sceneText}`,
    `用途：${promptText}`,
    '说明：这是本地占位参考卡，后续可替换为正式图片或平台素材 ID。',
  ].map(line => clipSvgText(line, 60));
  const lineNodes = lines.map((line, index) => (
    `<text x="96" y="${300 + index * 48}" class="body">${xmlEscape(line)}</text>`
  )).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <style>
      .title { font: 700 72px "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif; fill: #1f2933; }
      .subtitle { font: 600 34px "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif; fill: ${palette.accent}; }
      .body { font: 500 30px "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif; fill: #2f3a40; }
      .slot { font: 700 42px "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif; fill: #ffffff; }
    </style>
  </defs>
  <rect width="1280" height="720" fill="${palette.background}"/>
  <rect x="64" y="64" width="1152" height="592" rx="24" fill="#ffffff" opacity="0.78"/>
  <rect x="96" y="96" width="236" height="116" rx="16" fill="${palette.accent}"/>
  <text x="124" y="168" class="slot">${xmlEscape(asset.reference_slot ?? '@未分配')}</text>
  <circle cx="1072" cy="180" r="104" fill="${palette.tint}"/>
  <circle cx="1118" cy="226" r="54" fill="${palette.accent}" opacity="0.42"/>
  <text x="96" y="268" class="subtitle">Seedance Reference Card</text>
  <text x="360" y="150" class="title">${xmlEscape(clipSvgText(asset.label, 24))}</text>
  <text x="364" y="206" class="subtitle">${xmlEscape(seedanceAssetKindText(asset.kind))}</text>
  ${lineNodes}
</svg>
`;
}

export function buildSeedanceAssetPlaceholderPlan(input: {
  asset: SeedanceAssetBindingItem;
  projectId: string;
  projectTitle: string;
}): SeedanceAssetPlaceholderPlan {
  const filename = seedanceAssetPlaceholderFilename(input.asset);
  const relativePath = `production-board/seedance-assets/${filename}`;
  return {
    filename,
    relativePath,
    localPath: `projects/${input.projectId}/${relativePath}`,
    description: seedanceAssetPlaceholderDescription(input.asset),
    svg: renderSeedanceAssetPlaceholderSvg({
      asset: input.asset,
      projectTitle: input.projectTitle,
    }),
  };
}

export function seedanceAssetPlaceholderHistoryEventId(
  generatedAt: string,
  randomPart: string,
): string {
  return seedanceAssetHistoryEventId(generatedAt, randomPart);
}

export function buildSeedanceAssetPlaceholderMaterialization(input: {
  asset: SeedanceAssetBindingItem;
  plan: SeedanceAssetPlaceholderPlan;
  generatedAt: string;
  historyEventId: string;
  previousAsset?: SeedanceAssetLibraryItem;
  artifact: {
    absolutePath: string;
    byteSize: number;
    replaced: boolean;
  };
}): SeedanceAssetPlaceholderMaterialization {
  const libraryAsset: SeedanceAssetLibraryItem = {
    asset_id: input.asset.asset_id,
    kind: input.asset.kind,
    label: input.asset.label,
    modality: input.asset.modality,
    role: input.asset.role,
    reference_slot: input.asset.reference_slot,
    local_path: input.plan.localPath,
    original_filename: input.plan.filename,
    mime_type: 'image/svg+xml',
    size_bytes: input.artifact.byteSize,
    provider: 'story_agent_placeholder',
    provider_asset_id: `local:${input.plan.relativePath}`,
    upload_status: 'uploaded',
    upload_error: undefined,
    description: input.plan.description,
    updated_at: input.generatedAt,
  };
  const history = appendSeedanceAssetHistory(
    input.previousAsset,
    seedanceAssetHistoryEvent({
      asset: libraryAsset,
      eventType: 'placeholder_draft',
      createdAt: input.generatedAt,
      eventId: input.historyEventId,
      note: '自动生成 Seedance 本地占位参考卡',
    }),
  );
  return {
    libraryAsset: {
      ...libraryAsset,
      history,
    },
    item: {
      asset_id: input.asset.asset_id,
      label: input.asset.label,
      kind: input.asset.kind,
      modality: input.asset.modality,
      role: input.asset.role,
      reference_slot: input.asset.reference_slot,
      local_path: input.plan.localPath,
      relative_path: input.plan.relativePath,
      file_path: input.artifact.absolutePath,
      original_filename: input.plan.filename,
      mime_type: 'image/svg+xml',
      size_bytes: input.artifact.byteSize,
      status: input.artifact.replaced ? 'updated' : 'created',
      source_shot_ids: input.asset.source_shot_ids,
      source_scene_ids: input.asset.source_scene_ids,
    },
  };
}
