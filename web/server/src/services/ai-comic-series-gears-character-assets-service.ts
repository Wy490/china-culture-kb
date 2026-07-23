import {
  ErrorCodes,
  fail,
  success,
} from '@shared/types.js';
import { createHash } from 'node:crypto';
import type {
  AiComicSeriesGearsCharacterAssetLocalTestResult,
  AiComicSeriesPlan,
  AiComicSeriesProjectDetail,
  AiComicSeriesVisualBible,
  AiComicSeriesVisualIdentity,
  ApiResponse,
  GearsCharacterAssetBootstrapCharacter,
  GearsCharacterAssetBootstrapRequest,
} from '@shared/types.js';
import {
  downloadGearsWorkbenchMedia,
  requestGearsCharacterAssetBootstrap,
} from './gears-workbench-connector.js';
import {
  getAiComicSeriesProject,
  uploadAiComicSeriesSeedanceAssetFile,
} from './ai-comic-series-service.js';

function field(identity: AiComicSeriesVisualIdentity, fieldId: string): string {
  return identity.definition_fields.find(item => item.field_id === fieldId)?.value.trim() ?? '';
}

function ageRange(value: string): GearsCharacterAssetBootstrapCharacter['age_range'] {
  const age = Number(value.match(/\d+/)?.[0]);
  if (!Number.isFinite(age)) return '青年';
  if (age < 13) return '儿童';
  if (age < 18) return '少年';
  if (age < 35) return '青年';
  if (age < 60) return '中年';
  return '老年';
}

function gender(value: string): GearsCharacterAssetBootstrapCharacter['gender'] {
  if (value.includes('女')) return '女';
  if (value.includes('男')) return '男';
  if (value.includes('其他')) return '其他';
  return '未指定';
}

function rolePosition(
  identity: AiComicSeriesVisualIdentity,
  plan: AiComicSeriesPlan,
): GearsCharacterAssetBootstrapCharacter['role_position'] {
  if (identity.source === 'premise_antagonist') return '反派';
  const role = plan.main_characters.find(item => item.name === identity.label)?.role ?? '';
  return role.includes('主角') ? '主角' : '配角';
}

function ensureApproved(
  identity: AiComicSeriesVisualIdentity | undefined,
  label: string,
): AiComicSeriesVisualIdentity {
  if (!identity || identity.definition_status !== 'ready' || identity.approval.status !== 'approved') {
    throw new Error(`${label} 必须先完成视觉定义并由真人批准`);
  }
  return identity;
}

export function buildGearsCharacterAssetBootstrapEnvelope(
  projectId: string,
  plan: AiComicSeriesPlan,
  visualBible: AiComicSeriesVisualBible,
): GearsCharacterAssetBootstrapRequest {
  const characters = visualBible.identities.filter(item => item.kind === 'character');
  if (characters.length === 0) throw new Error('Visual Bible 没有可生成的人物身份');
  const payload = characters.map(character => {
    ensureApproved(character, character.label);
    const costume = ensureApproved(
      visualBible.identities.find(item => (
        item.kind === 'costume' && item.parent_identity_id === character.identity_id
      )),
      `${character.label}主服装`,
    );
    const appearanceFeatures = [
      field(character, 'body_type'),
      field(character, 'facial_features'),
      field(character, 'hairstyle'),
      character.definition_notes.trim(),
    ].filter(Boolean).join('\n');
    const clothing = [
      field(costume, 'garment_details'),
      field(costume, 'color_palette'),
      field(costume, 'phase_changes'),
    ].filter(Boolean).join('\n');
    if (!appearanceFeatures || !clothing) {
      throw new Error(`${character.label} 的人物外观或主服装定义为空`);
    }
    return {
      identity_id: character.identity_id,
      definition_fingerprint: character.definition_fingerprint,
      name: character.label,
      role_position: rolePosition(character, plan),
      species_type: '人类' as const,
      ethnicity: ['东亚'] as ['东亚'],
      gender: gender(field(character, 'gender_pronouns')),
      age_range: ageRange(field(character, 'age_range')),
      appearance_features: appearanceFeatures,
      clothing,
      background_oneliner: character.canonical_description,
    };
  });
  const sourceFingerprint = `sha256:${createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')}`;
  return {
    schema_version: 'story-agent-character-asset-bootstrap/v1',
    idempotency_key: `story-agent:${projectId}:character-assets:${sourceFingerprint.slice(7)}`,
    source: {
      source_system: 'story-agent',
      project_id: projectId,
      version_id: `character-assets-${sourceFingerprint.slice(7, 19)}`,
      source_fingerprint: sourceFingerprint,
    },
    character_style_pack_id: 'realistic',
    generation_mode: 'local_test',
    characters: payload,
  };
}

function canonicalAssetId(label: string): string {
  const key = label.trim();
  const ascii = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `seedance-asset-character-${ascii || 'item'}-${hash.toString(36)}`;
}

export async function runAiComicSeriesGearsCharacterAssetLocalTest(
  seriesProjectId: string,
): Promise<ApiResponse<AiComicSeriesGearsCharacterAssetLocalTestResult>> {
  const project = await getAiComicSeriesProject(seriesProjectId);
  if (!project.ok || !project.data) return project as ApiResponse<never>;
  const visualBible = project.data.visual_bible;
  if (!visualBible) {
    return fail(ErrorCodes.VALIDATION_ERROR, '系列项目尚未建立 Visual Bible');
  }
  let envelope: GearsCharacterAssetBootstrapRequest;
  try {
    envelope = buildGearsCharacterAssetBootstrapEnvelope(
      seriesProjectId,
      project.data.plan,
      visualBible,
    );
  } catch (err) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      err instanceof Error ? err.message : 'Visual Bible 人物资产合同构建失败',
    );
  }

  for (const character of envelope.characters) {
    const assetId = canonicalAssetId(character.name);
    const existing = project.data.seedance_asset_library?.items.find(item => item.asset_id === assetId);
    if (existing?.content_sha256 && existing.provider !== 'gears_local_test') {
      return fail(
        ErrorCodes.VALIDATION_ERROR,
        `人物“${character.name}”已有非测试图片；local_test 不会覆盖真实资产`,
      );
    }
  }

  const gears = await requestGearsCharacterAssetBootstrap(envelope);
  if (!gears.ok || !gears.data) return gears as ApiResponse<never>;
  const downloaded = [];
  for (const item of gears.data.characters) {
    const media = await downloadGearsWorkbenchMedia(item.media_url, item.content_sha256);
    if (!media.ok || !media.data) return media as ApiResponse<never>;
    downloaded.push({ item, media: media.data });
  }

  let latestDetail: AiComicSeriesProjectDetail = project.data;
  const importedAssets = [];
  let reusedAssetCount = 0;
  for (const { item, media } of downloaded) {
    const assetId = canonicalAssetId(item.name);
    const existing = latestDetail.seedance_asset_library?.items.find(asset => (
      asset.asset_id === assetId
    ));
    if (
      existing
      && existing.provider === 'gears_local_test'
      && existing.content_sha256 === item.content_sha256
      && existing.identity_binding?.series_identity_id === item.identity_id
      && existing.identity_binding.visual_definition_fingerprint === item.definition_fingerprint
    ) {
      importedAssets.push(existing);
      reusedAssetCount += 1;
      continue;
    }
    const uploaded = await uploadAiComicSeriesSeedanceAssetFile(seriesProjectId, {
      asset_id: assetId,
      label: item.name,
      kind: 'character',
      description: 'GEARS 本地无 API 闭环测试件；不是真实人物资产，不计 production credit。',
      series_identity_id: item.identity_id,
      file: {
        original_filename: `${item.name}-${item.base_sheet_version_id}-gears-local-test.png`,
        mime_type: media.mime_type,
        buffer: media.buffer,
      },
      trusted_source: {
        provider: 'gears_local_test',
        provider_asset_id: `${item.gears_character_id}:${item.base_sheet_version_id}`,
        prompt_sha256: item.prompt_sha256,
        model: item.model,
      },
    });
    if (!uploaded.ok || !uploaded.data) return uploaded as ApiResponse<never>;
    latestDetail = uploaded.data.detail;
    importedAssets.push(uploaded.data.asset);
  }
  return success({
    schema_version: 'ai-comic-series-gears-character-assets-local-test-result/v1',
    detail: latestDetail,
    gears_result: gears.data,
    imported_assets: importedAssets,
    imported_asset_count: importedAssets.length - reusedAssetCount,
    reused_asset_count: reusedAssetCount,
    external_provider_call_count: 0,
    production_credit_count: 0,
    local_test_only: true,
  });
}
