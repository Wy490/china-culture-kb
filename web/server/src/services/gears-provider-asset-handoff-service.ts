import type {
  GearsProviderAssetHandoffAuditRecord,
  GearsProviderAssetInput,
  MediaArtifactHumanReviewStatus,
  MediaArtifactRightsStatus,
  SeedanceAssetModality,
} from '@shared/types.js';
import type { GearsExecutionSubmitUnit } from './gears-execution-service.js';

export interface GearsProviderAssetSource {
  asset_id: string;
  label: string;
  modality: SeedanceAssetModality;
  file_url?: string;
  provider?: string;
  provider_asset_id?: string;
  content_sha256?: string;
  rights_status?: MediaArtifactRightsStatus;
  authorization_reference?: string;
  human_review_status?: MediaArtifactHumanReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  production_credit_granted: boolean;
}

export type GearsProviderAssetHandoffResult =
  | {
      ok: true;
      units: GearsExecutionSubmitUnit[];
      provider_asset_input_count: number;
    }
  | {
      ok: false;
      message: string;
      details: {
        source_unit_id: string;
        missing_asset_ids: string[];
        issues: Array<{ asset_id: string; reason: string }>;
      };
    };

interface RequiredAssetSlot {
  asset_id: string;
  label: string;
  modality: SeedanceAssetModality;
  reference_slot: string;
}

/**
 * Resolves only production-approved assets into provider-safe inputs. This is a
 * syntactic handoff check: no URL is fetched and signed URL query parameters are
 * never copied into the persisted audit record.
 */
export function attachGearsProviderAssetHandoffs(input: {
  units: GearsExecutionSubmitUnit[];
  assets: GearsProviderAssetSource[];
  verified_at: string;
}): GearsProviderAssetHandoffResult {
  const assetsById = new Map(input.assets.map(asset => [asset.asset_id, asset]));
  let providerAssetInputCount = 0;
  const units: GearsExecutionSubmitUnit[] = [];

  for (const unit of input.units) {
    const providerInputs: GearsProviderAssetInput[] = [];
    const audits: GearsProviderAssetHandoffAuditRecord[] = [];
    const issues: Array<{ asset_id: string; reason: string }> = [];
    for (const slot of uniqueRequiredSlots(requiredAssetSlots(unit.payload))) {
      const asset = assetsById.get(slot.asset_id);
      const resolved = asset ? resolveProviderAssetInput(asset, slot, input.verified_at) : undefined;
      if (!asset) {
        issues.push({ asset_id: slot.asset_id, reason: 'asset is absent from the project media library' });
      } else if (typeof resolved === 'string') {
        issues.push({ asset_id: slot.asset_id, reason: resolved });
      } else if (resolved) {
        providerInputs.push(resolved.input);
        audits.push(resolved.audit);
      }
    }
    if (issues.length) {
      return {
        ok: false,
        message: `GEARS provider asset handoff failed for source unit "${unit.source_unit_id}"`,
        details: {
          source_unit_id: unit.source_unit_id,
          missing_asset_ids: issues.map(issue => issue.asset_id),
          issues,
        },
      };
    }
    providerAssetInputCount += providerInputs.length;
    units.push({
      ...unit,
      payload: providerInputs.length
        ? { ...unit.payload, provider_asset_inputs: providerInputs }
        : { ...unit.payload },
      provider_asset_handoffs: audits,
    });
  }

  return { ok: true, units, provider_asset_input_count: providerAssetInputCount };
}

function requiredAssetSlots(payload: Record<string, unknown>): RequiredAssetSlot[] {
  if (!Array.isArray(payload.asset_slots)) return [];
  return payload.asset_slots.flatMap(value => {
    if (!isRecord(value) || value.required !== true) return [];
    const assetId = stringValue(value.asset_id);
    const label = stringValue(value.label);
    const referenceSlot = stringValue(value.reference_slot);
    const modality = value.modality;
    if (!assetId || !label || !referenceSlot || !isSeedanceAssetModality(modality)) return [];
    return [{ asset_id: assetId, label, reference_slot: referenceSlot, modality }];
  });
}

function uniqueRequiredSlots(slots: RequiredAssetSlot[]): RequiredAssetSlot[] {
  const byId = new Map<string, RequiredAssetSlot>();
  for (const slot of slots) if (!byId.has(slot.asset_id)) byId.set(slot.asset_id, slot);
  return [...byId.values()];
}

function resolveProviderAssetInput(
  asset: GearsProviderAssetSource,
  slot: RequiredAssetSlot,
  verifiedAt: string,
): { input: GearsProviderAssetInput; audit: GearsProviderAssetHandoffAuditRecord } | string {
  if (!asset.production_credit_granted) {
    return 'asset lacks verified immutable bytes, rights authorization, or approved human review';
  }
  const contentSha256 = asset.content_sha256?.trim().toLowerCase();
  if (!contentSha256 || !/^[a-f0-9]{64}$/.test(contentSha256)) return 'asset content_sha256 is not verified';
  const authorizationReference = asset.authorization_reference?.trim();
  if (asset.rights_status !== 'authorized' || !authorizationReference) return 'asset rights are not authorized';
  const reviewerId = asset.reviewer_id?.trim();
  const reviewedAt = asset.reviewed_at?.trim();
  if (asset.human_review_status !== 'approved' || !reviewerId || !reviewedAt) {
    return 'asset does not have an attributable approved human visual review';
  }

  const publicUrl = publicHttpsUrl(asset.file_url);
  if (publicUrl) {
    return {
      input: {
        schema_version: 'gears-provider-asset-input/v1',
        asset_id: asset.asset_id,
        label: asset.label || slot.label,
        modality: asset.modality,
        reference_slot: slot.reference_slot,
        content_sha256: contentSha256,
        rights_authorization_reference: authorizationReference,
        human_reviewer_id: reviewerId,
        human_reviewed_at: reviewedAt,
        transport: { kind: 'https_url', url: publicUrl.toString() },
      },
      audit: {
        schema_version: 'gears-provider-asset-handoff-audit/v1',
        asset_id: asset.asset_id,
        content_sha256: contentSha256,
        reference_slot: slot.reference_slot,
        transport_kind: 'https_url',
        url_origin: publicUrl.origin,
        verified_at: verifiedAt,
      },
    };
  }

  const provider = asset.provider?.trim();
  const providerAssetId = asset.provider_asset_id?.trim();
  if (provider && provider !== 'local_upload' && providerAssetId && !looksLikePlaceholder(providerAssetId)) {
    return {
      input: {
        schema_version: 'gears-provider-asset-input/v1',
        asset_id: asset.asset_id,
        label: asset.label || slot.label,
        modality: asset.modality,
        reference_slot: slot.reference_slot,
        content_sha256: contentSha256,
        rights_authorization_reference: authorizationReference,
        human_reviewer_id: reviewerId,
        human_reviewed_at: reviewedAt,
        transport: { kind: 'provider_asset', provider, provider_asset_id: providerAssetId },
      },
      audit: {
        schema_version: 'gears-provider-asset-handoff-audit/v1',
        asset_id: asset.asset_id,
        content_sha256: contentSha256,
        reference_slot: slot.reference_slot,
        transport_kind: 'provider_asset',
        provider,
        provider_asset_id: providerAssetId,
        verified_at: verifiedAt,
      },
    };
  }
  return 'asset has no public HTTPS URL or non-local provider asset ID';
}

function publicHttpsUrl(value: string | undefined): URL | undefined {
  if (!value?.trim() || looksLikePlaceholder(value)) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || !publicHostname(url.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function publicHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost') return false;
  if (['.local', '.internal', '.invalid', '.test', '.localhost'].some(suffix => hostname.endsWith(suffix))) return false;
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) return false;
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = parts;
    if (first === 10 || first === 127 || first === 0 || (first === 169 && second === 254)) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
  }
  return true;
}

function looksLikePlaceholder(value: string): boolean {
  return /[<>]|placeholder|replace[-_ ]?me|example\.(?:com|net|org)/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSeedanceAssetModality(value: unknown): value is SeedanceAssetModality {
  return value === 'image' || value === 'video' || value === 'audio';
}
