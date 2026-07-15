import {
  accessSync,
  appendFileSync,
  closeSync,
  constants,
  lstatSync,
  openSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, isAbsolute } from 'node:path';
import type { Request } from 'express';
import {
  PRODUCT_ROLE_PERMISSIONS,
  type ProductAccessActor,
  type ProductAccessAuditEvent,
  type ProductAccessContext,
  type ProductAccessMode,
  type ProductAccessReadiness,
  type ProductAuthenticationMethod,
  type ProductFeatureFlag,
  type ProductLoginHandoff,
  type ProductPermission,
  type ProductResourceBinding,
  type ProductResourceOwnership,
  type ProductResourceType,
  type ProductSignedSessionPayload,
} from '@shared/product-access.js';
import { isProductRoleId, type ProductRoleId } from '@shared/product-navigation.js';

interface ProductAccessRegistryActor extends ProductAccessActor {
  token_sha256: string;
  status: 'active' | 'revoked';
  session_not_before: number;
}

interface ProductAccessRegistryResult {
  configured: boolean;
  valid: boolean;
  actors: ProductAccessRegistryActor[];
  resourceBindings: ProductResourceBinding[];
  issues: string[];
}

export interface ProductAccessResolution {
  mode: ProductAccessMode;
  production_enforced: boolean;
  actor: ProductAccessActor | null;
  authenticated: boolean;
  authentication_method: ProductAuthenticationMethod;
  reason: string;
}

interface SignedSessionIssuerConfig {
  configured: boolean;
  valid: boolean;
  issuer: string;
  audience: string;
  secret: string;
  issues: string[];
}

interface SignedSessionVerification {
  actorId: string | null;
  reason: string;
  issuedAt?: number;
}

interface ProductLoginConfig {
  configured: boolean;
  valid: boolean;
  rawUrl: string;
  relative: boolean;
  issues: string[];
}

interface DurableAuditLifecycleConfig {
  configured: boolean;
  valid: boolean;
  mode: 'size_external_retention' | null;
  maxBytes: number | null;
  retentionDays: number | null;
  issues: string[];
}

export interface DurableAuditPathInspection {
  configured: boolean;
  absolute: boolean;
  writable: boolean;
  issues: string[];
}

const ACCESS_AUDIT_MEMORY_LIMIT = 500;
const ACCESS_AUDIT_EVENTS: ProductAccessAuditEvent[] = [];
const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;
const KNOWN_FEATURE_FLAGS: readonly ProductFeatureFlag[] = ['internal_story_tools'];
const KNOWN_RESOURCE_TYPES: readonly ProductResourceType[] = ['story_project', 'series_project'];
const RESOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,180}(?:--[a-z_]+)?$/;
const SIGNED_SESSION_PREFIX = 'sa1';
const SIGNED_SESSION_MAX_TTL_SECONDS = 86_400;
const SIGNED_SESSION_CLOCK_SKEW_SECONDS = 60;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,160}$/;
const ACTOR_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,160}$/;
const BASE64URL_PATTERN = /^[a-zA-Z0-9_-]+$/;

function booleanEnvironment(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

export function inspectDurableAuditPath(pathValue: string | undefined): DurableAuditPathInspection {
  const path = pathValue?.trim() ?? '';
  if (!path) {
    return { configured: false, absolute: false, writable: false, issues: ['durable_audit_path_missing'] };
  }
  const absolute = isAbsolute(path);
  const issues: string[] = absolute ? [] : ['durable_audit_path_not_absolute'];
  let writable = false;
  try {
    const target = lstatSync(path);
    if (target.isSymbolicLink()) {
      issues.push('durable_audit_path_symlink_forbidden');
    } else if (!target.isFile()) {
      issues.push('durable_audit_path_not_regular_file');
    } else {
      accessSync(path, constants.W_OK);
      writable = true;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      try {
        accessSync(dirname(path), constants.W_OK);
        writable = true;
      } catch {
        issues.push('durable_audit_parent_not_writable');
      }
    } else {
      issues.push('durable_audit_path_not_writable');
    }
  }
  return {
    configured: true,
    absolute,
    writable: absolute && writable && issues.length === 0,
    issues,
  };
}

function integerEnvironment(name: string, minimum: number, maximum: number): number | null {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function durableAuditLifecycleConfig(): DurableAuditLifecycleConfig {
  const rawMode = process.env.STORY_AGENT_ACCESS_AUDIT_ROTATION_MODE?.trim() ?? '';
  const rawMaxBytes = process.env.STORY_AGENT_ACCESS_AUDIT_MAX_BYTES?.trim() ?? '';
  const rawRetentionDays = process.env.STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS?.trim() ?? '';
  const configured = Boolean(rawMode || rawMaxBytes || rawRetentionDays);
  if (!configured) {
    return {
      configured: false,
      valid: false,
      mode: null,
      maxBytes: null,
      retentionDays: null,
      issues: ['durable_audit_lifecycle_missing'],
    };
  }
  const mode = rawMode === 'size_external_retention' ? rawMode : null;
  const maxBytes = integerEnvironment('STORY_AGENT_ACCESS_AUDIT_MAX_BYTES', 1024, 1_073_741_824);
  const retentionDays = integerEnvironment('STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS', 1, 3650);
  const issues = [
    ...(!mode ? ['durable_audit_rotation_mode_invalid'] : []),
    ...(maxBytes === null ? ['durable_audit_max_bytes_invalid'] : []),
    ...(retentionDays === null ? ['durable_audit_retention_days_invalid'] : []),
  ];
  return { configured, valid: issues.length === 0, mode, maxBytes, retentionDays, issues };
}

function appendDurableAccessAudit(path: string, line: string, lifecycle: DurableAuditLifecycleConfig): boolean {
  const lockPath = `${path}.rotation.lock`;
  let lockDescriptor: number | null = null;
  try {
    lockDescriptor = openSync(lockPath, 'wx', 0o600);
    if (lifecycle.valid && lifecycle.maxBytes !== null) {
      let currentBytes = 0;
      try {
        currentBytes = statSync(path).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (currentBytes > 0 && currentBytes + Buffer.byteLength(line, 'utf8') > lifecycle.maxBytes) {
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
        renameSync(path, `${path}.${timestamp}.${randomUUID()}.archive.jsonl`);
      }
    }
    appendFileSync(path, line, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  } finally {
    if (lockDescriptor !== null) {
      try {
        closeSync(lockDescriptor);
      } catch {
        // The append result already fails closed when opening or writing fails.
      }
      try {
        unlinkSync(lockPath);
      } catch {
        // A leftover lock fails future writes closed for operator recovery.
      }
    }
  }
}

export function isDurableProductAccessAuditRequired(): boolean {
  return process.env.NODE_ENV === 'production' || booleanEnvironment('STORY_AGENT_ACCESS_AUDIT_REQUIRED');
}

export function getProductAccessMode(): ProductAccessMode {
  const configured = process.env.STORY_AGENT_ACCESS_MODE?.trim().toLowerCase();
  if (process.env.NODE_ENV === 'production') {
    if (configured === 'disabled' && booleanEnvironment('STORY_AGENT_ALLOW_INSECURE_PRODUCTION_ACCESS')) {
      return 'disabled';
    }
    return 'required';
  }
  return configured === 'required' ? 'required' : 'disabled';
}

function productionAccessEnforced(mode = getProductAccessMode()): boolean {
  return process.env.NODE_ENV === 'production' && mode === 'required';
}

function signedSessionIssuerConfig(): SignedSessionIssuerConfig {
  const issuer = process.env.STORY_AGENT_SESSION_ISSUER?.trim() ?? '';
  const audience = process.env.STORY_AGENT_SESSION_AUDIENCE?.trim() ?? '';
  const secret = process.env.STORY_AGENT_SESSION_HMAC_SECRET ?? '';
  const configured = Boolean(issuer || audience || secret);
  const issues: string[] = [];
  if (!configured) {
    issues.push('signed_session_issuer_missing');
  } else {
    if (!issuer || issuer.length > 300 || /\s/.test(issuer)) {
      issues.push('signed_session_issuer_invalid');
    }
    if (!audience || audience.length > 200 || /\s/.test(audience)) {
      issues.push('signed_session_audience_invalid');
    }
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      issues.push('signed_session_hmac_secret_too_short');
    }
  }
  return {
    configured,
    valid: configured && issues.length === 0,
    issuer,
    audience,
    secret,
    issues,
  };
}

function productionStaticTokensAllowed(): boolean {
  return booleanEnvironment('STORY_AGENT_ALLOW_STATIC_TOKENS_IN_PRODUCTION');
}

function productLoginConfig(): ProductLoginConfig {
  const rawUrl = process.env.STORY_AGENT_LOGIN_URL?.trim() ?? '';
  if (!rawUrl) {
    return { configured: false, valid: false, rawUrl, relative: false, issues: ['login_handoff_missing'] };
  }
  const relative = rawUrl.startsWith('/') && !rawUrl.startsWith('//');
  const issues: string[] = [];
  try {
    const parsed = new URL(rawUrl, 'https://story-agent.invalid');
    if (/\p{Cc}/u.test(rawUrl) || rawUrl.includes('\\') || parsed.hash) {
      issues.push('login_handoff_url_invalid');
    }
    if (relative) {
      if (parsed.origin !== 'https://story-agent.invalid') issues.push('login_handoff_url_invalid');
    } else {
      const localHttp = process.env.NODE_ENV !== 'production'
        && parsed.protocol === 'http:'
        && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
      if (parsed.protocol !== 'https:' && !localHttp) issues.push('login_handoff_https_required');
      if (parsed.username || parsed.password) issues.push('login_handoff_embedded_credentials_forbidden');
    }
  } catch {
    issues.push('login_handoff_url_invalid');
  }
  return { configured: true, valid: issues.length === 0, rawUrl, relative, issues: [...new Set(issues)] };
}

export function sanitizeProductReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const candidate = value.trim();
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /\p{Cc}/u.test(candidate)
    || candidate.length > 1000
  ) return '/';
  try {
    const parsed = new URL(candidate, 'https://story-agent.invalid');
    if (parsed.origin !== 'https://story-agent.invalid') return '/';
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (decodedPath.startsWith('//') || decodedPath.includes('\\') || /\p{Cc}/u.test(decodedPath)) return '/';
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalized.startsWith('/access-required') ? '/' : normalized;
  } catch {
    return '/';
  }
}

export function getProductLoginHandoff(returnToValue: unknown): ProductLoginHandoff {
  const mode = getProductAccessMode();
  const config = productLoginConfig();
  const returnTo = sanitizeProductReturnTo(returnToValue);
  let redirectUrl: string | null = null;
  if (config.valid) {
    const parsed = new URL(config.rawUrl, 'https://story-agent.invalid');
    parsed.searchParams.set('return_to', returnTo);
    redirectUrl = config.relative
      ? `${parsed.pathname}${parsed.search}`
      : parsed.toString();
  }
  return {
    schema_version: 'story-agent-product-login-handoff/v1',
    mode,
    login_required: mode === 'required',
    provider_configured: config.configured,
    provider_valid: config.valid,
    redirect_url: redirectUrl,
    return_to: returnTo,
    return_to_parameter: 'return_to',
    session_cookie: {
      name: 'story_agent_session',
      http_only: true,
      same_site: 'Lax',
      secure_required_in_production: true,
    },
    blockers: config.valid ? [] : config.issues,
    request_role_headers_trusted: false,
    real_login_verified: false,
    real_credit_granted: false,
  };
}

function isSignedSessionPayload(value: unknown): value is ProductSignedSessionPayload {
  const payload = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  return Boolean(
    payload
    && payload.schema_version === 'story-agent-product-signed-session/v1'
    && typeof payload.session_id === 'string'
    && SESSION_ID_PATTERN.test(payload.session_id)
    && typeof payload.actor_id === 'string'
    && ACTOR_ID_PATTERN.test(payload.actor_id)
    && typeof payload.issuer === 'string'
    && typeof payload.audience === 'string'
    && typeof payload.issued_at === 'number'
    && Number.isInteger(payload.issued_at)
    && typeof payload.expires_at === 'number'
    && Number.isInteger(payload.expires_at),
  );
}

function safeBufferEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifySignedSession(token: string, config: SignedSessionIssuerConfig): SignedSessionVerification {
  if (!config.valid) {
    return { actorId: null, reason: config.issues[0] ?? 'signed_session_issuer_invalid' };
  }
  const parts = token.split('.');
  if (
    parts.length !== 3
    || parts[0] !== SIGNED_SESSION_PREFIX
    || !parts[1]
    || !BASE64URL_PATTERN.test(parts[1])
    || !parts[2]
    || !BASE64URL_PATTERN.test(parts[2])
  ) {
    return { actorId: null, reason: 'signed_session_format_invalid' };
  }
  const signingInput = `${SIGNED_SESSION_PREFIX}.${parts[1]}`;
  const expectedSignature = createHmac('sha256', config.secret).update(signingInput).digest();
  let suppliedSignature: Buffer;
  let payload: unknown;
  try {
    suppliedSignature = Buffer.from(parts[2], 'base64url');
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
  } catch {
    return { actorId: null, reason: 'signed_session_encoding_invalid' };
  }
  if (!safeBufferEqual(expectedSignature, suppliedSignature)) {
    return { actorId: null, reason: 'signed_session_signature_invalid' };
  }
  if (!isSignedSessionPayload(payload)) {
    return { actorId: null, reason: 'signed_session_payload_invalid' };
  }
  if (payload.issuer !== config.issuer || payload.audience !== config.audience) {
    return { actorId: null, reason: 'signed_session_scope_invalid' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.issued_at > now + SIGNED_SESSION_CLOCK_SKEW_SECONDS) {
    return { actorId: null, reason: 'signed_session_not_yet_valid' };
  }
  if (payload.expires_at <= now) {
    return { actorId: null, reason: 'signed_session_expired' };
  }
  if (
    payload.expires_at <= payload.issued_at
    || payload.expires_at - payload.issued_at > SIGNED_SESSION_MAX_TTL_SECONDS
  ) {
    return { actorId: null, reason: 'signed_session_lifetime_invalid' };
  }
  return { actorId: payload.actor_id, reason: 'signed_session_verified', issuedAt: payload.issued_at };
}

function parseFeatureFlags(value: unknown): ProductFeatureFlag[] | null {
  if (!Array.isArray(value)) return [];
  const flags = value.filter((item): item is ProductFeatureFlag => (
    typeof item === 'string' && KNOWN_FEATURE_FLAGS.includes(item as ProductFeatureFlag)
  ));
  return flags.length === value.length ? [...new Set(flags)] : null;
}

function parseRegistry(): ProductAccessRegistryResult {
  const raw = process.env.STORY_AGENT_ACCESS_REGISTRY_JSON?.trim();
  if (!raw) return {
    configured: false,
    valid: false,
    actors: [],
    resourceBindings: [],
    issues: ['access_registry_missing'],
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      configured: true,
      valid: false,
      actors: [],
      resourceBindings: [],
      issues: ['access_registry_json_invalid'],
    };
  }

  const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const rawActors = Array.isArray(record?.actors) ? record.actors : [];
  const issues: string[] = [];
  const actors: ProductAccessRegistryActor[] = [];
  const resourceBindings: ProductResourceBinding[] = [];

  if (record?.schema_version !== 'story-agent-product-access-registry/v1') {
    issues.push('access_registry_schema_version_invalid');
  }
  if (!Array.isArray(record?.actors) || rawActors.length === 0) {
    issues.push('access_registry_actors_missing');
  }

  for (const [index, value] of rawActors.entries()) {
    const actor = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
    const role = typeof actor?.role === 'string' && isProductRoleId(actor.role) ? actor.role : null;
    const featureFlags = parseFeatureFlags(actor?.enabled_feature_flags);
    const tokenSha256 = typeof actor?.token_sha256 === 'string' ? actor.token_sha256.toLowerCase() : '';
    const sessionNotBefore = actor?.session_not_before === undefined ? 0 : actor.session_not_before;
    if (
      !actor
      || typeof actor.actor_id !== 'string'
      || !actor.actor_id.trim()
      || typeof actor.display_name !== 'string'
      || !actor.display_name.trim()
      || typeof actor.organization_id !== 'string'
      || !actor.organization_id.trim()
      || !role
      || !TOKEN_HASH_PATTERN.test(tokenSha256)
      || (actor.status !== 'active' && actor.status !== 'revoked')
      || typeof sessionNotBefore !== 'number'
      || !Number.isSafeInteger(sessionNotBefore)
      || sessionNotBefore < 0
      || featureFlags === null
    ) {
      issues.push(`access_registry_actor_invalid:${index}`);
      continue;
    }
    actors.push({
      actor_id: actor.actor_id.trim(),
      display_name: actor.display_name.trim(),
      organization_id: actor.organization_id.trim(),
      role,
      token_sha256: tokenSha256,
      status: actor.status,
      session_not_before: sessionNotBefore,
      enabled_feature_flags: featureFlags,
    });
  }

  if (new Set(actors.map(actor => actor.actor_id)).size !== actors.length) {
    issues.push('access_registry_actor_id_duplicate');
  }
  if (new Set(actors.map(actor => actor.token_sha256)).size !== actors.length) {
    issues.push('access_registry_token_hash_duplicate');
  }

  const rawResourceBindings = record?.resource_bindings;
  if (rawResourceBindings !== undefined && !Array.isArray(rawResourceBindings)) {
    issues.push('access_registry_resource_bindings_invalid');
  }
  if (Array.isArray(rawResourceBindings)) {
    const actorsById = new Map(actors.map(actor => [actor.actor_id, actor]));
    for (const [index, value] of rawResourceBindings.entries()) {
      const binding = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
      const resourceType = typeof binding?.resource_type === 'string'
        && KNOWN_RESOURCE_TYPES.includes(binding.resource_type as ProductResourceType)
        ? binding.resource_type as ProductResourceType
        : null;
      const memberActorIds = Array.isArray(binding?.member_actor_ids)
        && binding.member_actor_ids.every(item => typeof item === 'string' && item.trim())
        ? [...new Set(binding.member_actor_ids.map(item => String(item).trim()))]
        : null;
      const resourceId = typeof binding?.resource_id === 'string' ? binding.resource_id.trim() : '';
      const organizationId = typeof binding?.organization_id === 'string' ? binding.organization_id.trim() : '';
      const ownerActorId = typeof binding?.owner_actor_id === 'string' ? binding.owner_actor_id.trim() : '';
      const referencedActorIds = memberActorIds ? [ownerActorId, ...memberActorIds] : [];
      const referencedActorsValid = referencedActorIds.every(actorId => {
        const actor = actorsById.get(actorId);
        return actor && actor.organization_id === organizationId;
      });
      if (
        !binding
        || binding.schema_version !== 'story-agent-product-resource-ownership/v1'
        || !resourceType
        || !RESOURCE_ID_PATTERN.test(resourceId)
        || !organizationId
        || !ownerActorId
        || memberActorIds === null
        || !referencedActorsValid
      ) {
        issues.push(`access_registry_resource_binding_invalid:${index}`);
        continue;
      }
      resourceBindings.push({
        schema_version: 'story-agent-product-resource-ownership/v1',
        resource_type: resourceType,
        resource_id: resourceId,
        organization_id: organizationId,
        owner_actor_id: ownerActorId,
        member_actor_ids: memberActorIds,
      });
    }
  }
  if (new Set(resourceBindings.map(binding => `${binding.resource_type}:${binding.resource_id}`)).size !== resourceBindings.length) {
    issues.push('access_registry_resource_binding_duplicate');
  }

  return { configured: true, valid: issues.length === 0, actors, resourceBindings, issues };
}

export function getRegisteredProductResourceBinding(
  resourceType: ProductResourceType,
  resourceId: string,
): ProductResourceBinding | null {
  const registry = parseRegistry();
  if (!registry.valid) return null;
  const binding = registry.resourceBindings.find(item => (
    item.resource_type === resourceType && item.resource_id === resourceId
  ));
  return binding ? { ...binding, member_actor_ids: [...binding.member_actor_ids] } : null;
}

export function listRegisteredProductResourceBindings(): ProductResourceBinding[] {
  const registry = parseRegistry();
  if (!registry.valid) return [];
  return registry.resourceBindings.map(binding => ({
    ...binding,
    member_actor_ids: [...binding.member_actor_ids],
  }));
}

export function validateProductResourceOwnershipAgainstRegistry(
  ownership: ProductResourceOwnership,
): string[] {
  const registry = parseRegistry();
  if (!registry.valid) return registry.issues.length ? [...registry.issues] : ['access_registry_invalid'];
  const issues: string[] = [];
  for (const actorId of [ownership.owner_actor_id, ...ownership.member_actor_ids]) {
    const actor = registry.actors.find(item => item.actor_id === actorId);
    if (!actor) {
      issues.push(`resource_ownership_actor_unknown:${actorId}`);
    } else if (actor.status !== 'active') {
      issues.push(`resource_ownership_actor_revoked:${actorId}`);
    } else if (actor.organization_id !== ownership.organization_id) {
      issues.push(`resource_ownership_actor_organization_mismatch:${actorId}`);
    }
  }
  return [...new Set(issues)];
}

function localDevelopmentActor(): ProductAccessActor {
  const configuredRole = process.env.STORY_AGENT_LOCAL_ROLE?.trim();
  const role: ProductRoleId = configuredRole && isProductRoleId(configuredRole)
    ? configuredRole
    : 'administrator';
  const enabledFeatureFlags = process.env.STORY_AGENT_LOCAL_FEATURE_FLAGS?.split(',')
    .map(value => value.trim())
    .filter((value): value is ProductFeatureFlag => KNOWN_FEATURE_FLAGS.includes(value as ProductFeatureFlag))
    ?? [];
  return {
    actor_id: 'local-development',
    display_name: 'Local development bypass',
    organization_id: 'local',
    role,
    enabled_feature_flags: enabledFeatureFlags.length ? [...new Set(enabledFeatureFlags)] : ['internal_story_tools'],
  };
}

function bearerToken(req: Request): string | null {
  const authorization = req.header('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (match?.[1] && match[1].length <= 4096) return match[1];
  const cookieHeader = req.header('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== 'story_agent_session') continue;
    try {
      const value = decodeURIComponent(valueParts.join('='));
      if (value && value.length <= 4096) return value;
    } catch {
      return null;
    }
  }
  return null;
}

function safeHashEqual(leftHex: string, rightHex: string): boolean {
  if (!TOKEN_HASH_PATTERN.test(leftHex) || !TOKEN_HASH_PATTERN.test(rightHex)) return false;
  return timingSafeEqual(Buffer.from(leftHex, 'hex'), Buffer.from(rightHex, 'hex'));
}

function publicActor(actor: ProductAccessRegistryActor): ProductAccessActor {
  return {
    actor_id: actor.actor_id,
    display_name: actor.display_name,
    organization_id: actor.organization_id,
    role: actor.role,
    enabled_feature_flags: actor.enabled_feature_flags,
  };
}

export function resolveProductAccess(req: Request): ProductAccessResolution {
  const mode = getProductAccessMode();
  if (mode === 'disabled') {
    return {
      mode,
      production_enforced: false,
      actor: localDevelopmentActor(),
      authenticated: false,
      authentication_method: 'local_bypass',
      reason: 'access_mode_disabled_local_bypass',
    };
  }

  const registry = parseRegistry();
  if (!registry.valid) {
    return {
      mode,
      production_enforced: productionAccessEnforced(mode),
      actor: null,
      authenticated: false,
      authentication_method: 'static_registry_token',
      reason: registry.issues[0] ?? 'access_registry_invalid',
    };
  }
  const token = bearerToken(req);
  if (!token) {
    return {
      mode,
      production_enforced: productionAccessEnforced(mode),
      actor: null,
      authenticated: false,
      authentication_method: 'static_registry_token',
      reason: 'access_token_missing',
    };
  }

  if (token.startsWith(`${SIGNED_SESSION_PREFIX}.`)) {
    const verification = verifySignedSession(token, signedSessionIssuerConfig());
    if (!verification.actorId) {
      return {
        mode,
        production_enforced: productionAccessEnforced(mode),
        actor: null,
        authenticated: false,
        authentication_method: 'signed_session',
        reason: verification.reason,
      };
    }
    const actor = registry.actors.find(item => item.actor_id === verification.actorId);
    if (!actor) {
      return {
        mode,
        production_enforced: productionAccessEnforced(mode),
        actor: null,
        authenticated: false,
        authentication_method: 'signed_session',
        reason: 'signed_session_actor_unknown',
      };
    }
    if (actor.status !== 'active') {
      return {
        mode,
        production_enforced: productionAccessEnforced(mode),
        actor: null,
        authenticated: false,
        authentication_method: 'signed_session',
        reason: 'access_actor_revoked',
      };
    }
    if (verification.issuedAt === undefined || verification.issuedAt < actor.session_not_before) {
      return {
        mode,
        production_enforced: productionAccessEnforced(mode),
        actor: null,
        authenticated: false,
        authentication_method: 'signed_session',
        reason: 'signed_session_revoked',
      };
    }
    return {
      mode,
      production_enforced: productionAccessEnforced(mode),
      actor: publicActor(actor),
      authenticated: true,
      authentication_method: 'signed_session',
      reason: verification.reason,
    };
  }
  if (productionAccessEnforced(mode) && !productionStaticTokensAllowed()) {
    return {
      mode,
      production_enforced: true,
      actor: null,
      authenticated: false,
      authentication_method: 'static_registry_token',
      reason: 'production_static_access_token_forbidden',
    };
  }
  const tokenSha256 = createHash('sha256').update(token).digest('hex');
  const actor = registry.actors.find(item => safeHashEqual(item.token_sha256, tokenSha256));
  if (!actor) {
    return {
      mode,
      production_enforced: productionAccessEnforced(mode),
      actor: null,
      authenticated: false,
      authentication_method: 'static_registry_token',
      reason: 'access_token_unknown',
    };
  }
  if (actor.status !== 'active') {
    return {
      mode,
      production_enforced: productionAccessEnforced(mode),
      actor: null,
      authenticated: false,
      authentication_method: 'static_registry_token',
      reason: 'access_actor_revoked',
    };
  }
  return {
    mode,
    production_enforced: productionAccessEnforced(mode),
    actor: publicActor(actor),
    authenticated: true,
    authentication_method: 'static_registry_token',
    reason: 'access_actor_resolved',
  };
}

export function getProductAccessContext(req: Request): ProductAccessContext {
  const resolution = resolveProductAccess(req);
  return {
    schema_version: 'story-agent-product-access-context/v1',
    mode: resolution.mode,
    production_enforced: resolution.production_enforced,
    authenticated: resolution.authenticated,
    authentication_method: resolution.authentication_method,
    actor: resolution.actor,
    permissions: resolution.actor ? [...PRODUCT_ROLE_PERMISSIONS[resolution.actor.role]] : [],
    request_role_headers_trusted: false,
    credit_boundary: 'access control does not grant human review, professional pass or signed release credit',
  };
}

export function getProductAccessReadiness(): ProductAccessReadiness {
  const mode = getProductAccessMode();
  const registry = parseRegistry();
  const durableAudit = inspectDurableAuditPath(process.env.STORY_AGENT_ACCESS_AUDIT_JSONL);
  const durableAuditLifecycle = durableAuditLifecycleConfig();
  const durableAuditRequired = isDurableProductAccessAuditRequired();
  const signedSession = signedSessionIssuerConfig();
  const staticTokensAllowedInProduction = productionStaticTokensAllowed();
  const login = productLoginConfig();
  const blockers = [
    ...(mode !== 'required' ? ['access_mode_not_required'] : []),
    ...(!registry.configured ? ['access_registry_missing'] : []),
    ...(registry.configured && !registry.valid ? registry.issues : []),
    ...(registry.actors.filter(actor => actor.status === 'active').length === 0 ? ['active_actor_missing'] : []),
    ...(!durableAudit.configured ? ['durable_access_audit_missing'] : []),
    ...(durableAudit.configured && !durableAudit.writable ? durableAudit.issues : []),
    ...(!durableAuditLifecycle.configured ? ['durable_audit_lifecycle_missing'] : []),
    ...(durableAuditLifecycle.configured && !durableAuditLifecycle.valid ? durableAuditLifecycle.issues : []),
    ...(!signedSession.configured ? ['signed_session_issuer_missing'] : []),
    ...(signedSession.configured && !signedSession.valid ? signedSession.issues : []),
    ...(staticTokensAllowedInProduction ? ['production_static_token_escape_hatch_active'] : []),
    ...(!login.configured ? ['login_handoff_missing'] : []),
    ...(login.configured && !login.valid ? login.issues : []),
  ];
  return {
    schema_version: 'story-agent-product-access-readiness/v1',
    mode,
    production_enforced: productionAccessEnforced(mode),
    registry_configured: registry.configured,
    registry_valid: registry.valid,
    active_actor_count: registry.actors.filter(actor => actor.status === 'active').length,
    registered_resource_count: registry.resourceBindings.length,
    token_hash_only: true,
    signed_session_issuer_configured: signedSession.configured,
    signed_session_issuer_valid: signedSession.valid,
    signed_session_max_ttl_seconds: SIGNED_SESSION_MAX_TTL_SECONDS,
    signed_session_actor_revocation_supported: true,
    actors_with_session_not_before_count: registry.actors.filter(actor => actor.session_not_before > 0).length,
    real_session_revocation_verified: false,
    static_tokens_allowed_in_production: staticTokensAllowedInProduction,
    login_handoff_configured: login.configured,
    login_handoff_valid: login.valid,
    real_user_login_verified: false,
    resource_ownership_enforced: mode === 'required',
    durable_audit_configured: durableAudit.configured,
    durable_audit_path_absolute: durableAudit.absolute,
    durable_audit_path_writable: durableAudit.writable,
    durable_audit_rotation_mode: durableAuditLifecycle.mode,
    durable_audit_rotation_configured: durableAuditLifecycle.valid,
    durable_audit_max_bytes: durableAuditLifecycle.maxBytes,
    durable_audit_retention_days: durableAuditLifecycle.retentionDays,
    durable_audit_archives_deleted_by_application: false,
    durable_audit_required: durableAuditRequired,
    ready_for_production: mode === 'required'
      && registry.valid
      && signedSession.valid
      && login.valid
      && blockers.length === 0,
    blockers,
    request_role_headers_trusted: false,
    real_credit_granted: false,
  };
}

function requestId(req: Request): string {
  const supplied = req.header('x-request-id')?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

export function recordProductAccessAudit(input: {
  req: Request;
  resolution: ProductAccessResolution;
  decision: ProductAccessAuditEvent['decision'];
  reason: string;
  permission: ProductPermission;
  featureFlag?: ProductFeatureFlag;
  resourceType?: ProductResourceType;
  resourceId?: string;
  resourceOrganizationId?: string;
}): ProductAccessAuditEvent {
  const event: ProductAccessAuditEvent = {
    schema_version: 'story-agent-product-access-audit-event/v1',
    event_id: randomUUID(),
    occurred_at: new Date().toISOString(),
    request_id: requestId(input.req),
    access_mode: input.resolution.mode,
    decision: input.decision,
    reason: input.reason,
    authentication_method: input.resolution.authentication_method,
    ...(input.resolution.actor ? {
      actor_id: input.resolution.actor.actor_id,
      organization_id: input.resolution.actor.organization_id,
      role: input.resolution.actor.role,
    } : {}),
    method: input.req.method,
    path: `${input.req.baseUrl}${input.req.path}`,
    required_permission: input.permission,
    ...(input.featureFlag ? { required_feature_flag: input.featureFlag } : {}),
    ...(input.resourceType ? { resource_type: input.resourceType } : {}),
    ...(input.resourceId ? { resource_id: input.resourceId } : {}),
    ...(input.resourceOrganizationId ? { resource_organization_id: input.resourceOrganizationId } : {}),
    durable_written: false,
    real_credit_granted: false,
  };
  const durableAudit = inspectDurableAuditPath(process.env.STORY_AGENT_ACCESS_AUDIT_JSONL);
  const lifecycle = durableAuditLifecycleConfig();
  const durablePath = process.env.STORY_AGENT_ACCESS_AUDIT_JSONL?.trim();
  if (
    durablePath
    && durableAudit.writable
    && (!isDurableProductAccessAuditRequired() || lifecycle.valid)
  ) {
    event.durable_written = appendDurableAccessAudit(
      durablePath,
      `${JSON.stringify({ ...event, durable_written: true })}\n`,
      lifecycle,
    );
  }
  ACCESS_AUDIT_EVENTS.push(event);
  if (ACCESS_AUDIT_EVENTS.length > ACCESS_AUDIT_MEMORY_LIMIT) {
    ACCESS_AUDIT_EVENTS.splice(0, ACCESS_AUDIT_EVENTS.length - ACCESS_AUDIT_MEMORY_LIMIT);
  }
  return event;
}

export function listProductAccessAuditEvents(limit = 100): ProductAccessAuditEvent[] {
  const safeLimit = Math.max(1, Math.min(ACCESS_AUDIT_MEMORY_LIMIT, Math.floor(limit)));
  return ACCESS_AUDIT_EVENTS.slice(-safeLimit).reverse();
}

export function resetProductAccessAuditForTests(): void {
  ACCESS_AUDIT_EVENTS.splice(0, ACCESS_AUDIT_EVENTS.length);
}
