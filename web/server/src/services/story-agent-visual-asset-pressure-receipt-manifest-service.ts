import type { AiComicPacingProfile } from '@shared/types.js';
import {
  parseStoryAgentVisualAssetPressureBatchReceipt,
  type StoryAgentVisualAssetPressureBatchReceipt,
} from './story-agent-visual-asset-pressure-batch-receipt-service.js';

type JsonObject = Record<string, unknown>;

type VisualIdentity = {
  identity_id: string;
  kind: 'character' | 'costume' | 'location' | 'prop';
  label: string;
};

export type StoryAgentVisualAssetPressurePreparationCatalog = {
  schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1';
  preparation_revision: number;
  seeds: Array<{
    seed_id: string;
    series_title: string;
    primary_character: string;
    outline: string;
    episode_count: number;
    duration_range_sec: {
      min: number;
      max: number;
    };
    pacing_profile: AiComicPacingProfile;
    style_family: string;
    series_project_id: string;
    visual_identities: VisualIdentity[];
  }>;
};

const PACING_PROFILES = new Set<AiComicPacingProfile>([
  'fast_hook',
  'balanced_drama',
  'slow_burn',
  'mystery_cliffhanger',
]);
const IDENTITY_KINDS = new Set<VisualIdentity['kind']>([
  'character',
  'costume',
  'location',
  'prop',
]);

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

export function parseStoryAgentVisualAssetPressurePreparationCatalog(
  value: unknown,
): StoryAgentVisualAssetPressurePreparationCatalog {
  const input = asObject(value, 'preparation catalog');
  if (
    input.schema_version
    !== 'story-agent-visual-asset-pressure-batch-preparation/v1'
  ) {
    throw new Error(
      `unsupported preparation catalog schema: ${String(input.schema_version ?? '')}`,
    );
  }
  if (!Array.isArray(input.seeds) || input.seeds.length < 1) {
    throw new Error('preparation catalog must declare at least one seed');
  }
  const seedIds = new Set<string>();
  const seeds = input.seeds.map((rawSeed, seedIndex) => {
    const seed = asObject(rawSeed, `preparation seeds[${seedIndex}]`);
    const seedId = requiredString(seed.seed_id, `preparation seeds[${seedIndex}] seed_id`);
    if (seedIds.has(seedId)) {
      throw new Error(`duplicate preparation seed_id: ${seedId}`);
    }
    seedIds.add(seedId);
    const duration = asObject(
      seed.duration_range_sec,
      `${seedId} duration_range_sec`,
    );
    const min = positiveInteger(duration.min, `${seedId} duration min`);
    const max = positiveInteger(duration.max, `${seedId} duration max`);
    if (min > max) {
      throw new Error(`${seedId} duration range is invalid`);
    }
    if (
      typeof seed.pacing_profile !== 'string'
      || !PACING_PROFILES.has(seed.pacing_profile as AiComicPacingProfile)
    ) {
      throw new Error(`${seedId} pacing_profile is unsupported`);
    }
    if (!Array.isArray(seed.visual_identities)) {
      throw new Error(`${seedId} visual_identities must be an array`);
    }
    const identityIds = new Set<string>();
    const visualIdentities = seed.visual_identities.map((rawIdentity, identityIndex) => {
      const identity = asObject(
        rawIdentity,
        `${seedId} visual_identities[${identityIndex}]`,
      );
      const identityId = requiredString(
        identity.identity_id,
        `${seedId} visual identity_id`,
      );
      if (identityIds.has(identityId)) {
        throw new Error(`${seedId} duplicate visual identity_id: ${identityId}`);
      }
      identityIds.add(identityId);
      if (
        typeof identity.kind !== 'string'
        || !IDENTITY_KINDS.has(identity.kind as VisualIdentity['kind'])
      ) {
        throw new Error(`${seedId} visual identity kind is unsupported`);
      }
      return {
        identity_id: identityId,
        kind: identity.kind as VisualIdentity['kind'],
        label: requiredString(identity.label, `${seedId} visual identity label`),
      };
    });
    return {
      seed_id: seedId,
      series_title: requiredString(seed.series_title, `${seedId} series_title`),
      primary_character: requiredString(
        seed.primary_character,
        `${seedId} primary_character`,
      ),
      outline: requiredString(seed.outline, `${seedId} outline`),
      episode_count: positiveInteger(seed.episode_count, `${seedId} episode_count`),
      duration_range_sec: { min, max },
      pacing_profile: seed.pacing_profile as AiComicPacingProfile,
      style_family: requiredString(seed.style_family, `${seedId} style_family`),
      series_project_id: requiredString(
        seed.series_project_id,
        `${seedId} series_project_id`,
      ),
      visual_identities: visualIdentities,
    };
  });
  return {
    schema_version: 'story-agent-visual-asset-pressure-batch-preparation/v1',
    preparation_revision: positiveInteger(
      input.preparation_revision,
      'preparation_revision',
    ),
    seeds,
  };
}

export function buildStoryAgentVisualAssetPressureReceiptBackedManifest(input: {
  catalog: unknown;
  receipt: unknown;
}) {
  const catalog = parseStoryAgentVisualAssetPressurePreparationCatalog(input.catalog);
  const receipt: StoryAgentVisualAssetPressureBatchReceipt =
    parseStoryAgentVisualAssetPressureBatchReceipt(input.receipt);
  const receiptAssets = new Map(
    receipt.assets.map(asset => [`${asset.seed_id}:${asset.role}`, asset]),
  );
  const catalogSeedIds = new Set(catalog.seeds.map(seed => seed.seed_id));
  for (const asset of receipt.assets) {
    if (!catalogSeedIds.has(asset.seed_id)) {
      throw new Error(`receipt has unknown seed_id: ${asset.seed_id}`);
    }
  }

  const assets: JsonObject[] = [];
  for (const seed of catalog.seeds) {
    const characterReceipt = receiptAssets.get(`${seed.seed_id}:character`);
    const worldReceipt = receiptAssets.get(`${seed.seed_id}:world`);
    if (!characterReceipt || !worldReceipt) {
      throw new Error(`${seed.seed_id}: immutable receipt roles are incomplete`);
    }
    const character = seed.visual_identities.find(identity => (
      identity.kind === 'character' && identity.label.includes(seed.primary_character)
    ));
    const costume = seed.visual_identities.find(identity => (
      identity.kind === 'costume' && identity.label.includes(seed.primary_character)
    ));
    const location = seed.visual_identities.find(
      identity => identity.kind === 'location',
    );
    const prop = seed.visual_identities.find(identity => identity.kind === 'prop');
    if (!character || !costume || !location) {
      throw new Error(`${seed.seed_id}: character, costume, or location identity missing`);
    }

    const common = {
      seed_id: seed.seed_id,
      outline: seed.outline,
      series_title: seed.series_title,
      series_project_id: seed.series_project_id,
      episode_count: seed.episode_count,
      duration_range_sec: seed.duration_range_sec,
      pacing_profile: seed.pacing_profile,
      required_visual_anchors: [character.label, location.label],
      forbidden_visual_anchors: [
        ...catalog.seeds
          .filter(candidate => candidate.seed_id !== seed.seed_id)
          .map(candidate => candidate.primary_character),
        '案卷',
      ],
    };
    assets.push({
      ...common,
      label: character.label,
      kind: 'character',
      source_path: characterReceipt.source_path,
      prompt_path: characterReceipt.prompt_path,
      provider_asset_id: characterReceipt.provider_asset_id,
      content_sha256: characterReceipt.content_sha256,
      prompt_sha256: characterReceipt.prompt_sha256,
    });
    for (const identity of [costume, location, prop].filter(
      (item): item is VisualIdentity => Boolean(item),
    )) {
      assets.push({
        ...common,
        label: identity.label,
        kind: identity.kind,
        source_path: worldReceipt.source_path,
        prompt_path: worldReceipt.prompt_path,
        provider_asset_id: worldReceipt.provider_asset_id,
        content_sha256: worldReceipt.content_sha256,
        prompt_sha256: worldReceipt.prompt_sha256,
        bind_remaining_shot_identities: identity.kind === 'location',
      });
    }
  }

  return {
    manifest: {
      schema_version: 'story-agent-cross-seed-image-asset-manifest/v1' as const,
      provider: receipt.provider,
      model: receipt.model,
      assets,
    },
    style_map: {
      schema_version: 'story-agent-visual-asset-pressure-style-map/v1' as const,
      style_families: Object.fromEntries(
        catalog.seeds.map(seed => [seed.seed_id, seed.style_family]),
      ),
    },
    summary: {
      batch_id: receipt.batch_id,
      seed_count: catalog.seeds.length,
      receipt_asset_count: receipt.assets.length,
      manifest_asset_count: assets.length,
      unique_content_sha256_count: new Set(
        assets.map(asset => asset.content_sha256),
      ).size,
    },
  };
}
