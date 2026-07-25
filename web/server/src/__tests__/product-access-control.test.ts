import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { success } from '@shared/types.js';
import type {
  ProductFeatureFlag,
  ProductPermission,
  ProductRoleId,
  ProductSignedSessionPayload,
} from '@shared/product-access.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { errorHandler } from '../middleware/error-handler.js';
import {
  getProductAccessContext,
  getProductAccessMode,
  getProductAccessReadiness,
  getProductLoginHandoff,
  listProductAccessAuditEvents,
  resetProductAccessAuditForTests,
} from '../services/product-access-service.js';
import { getProductResourceOwnershipAuditReport } from '../services/product-resource-access-service.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import { createStage7GoldenCardsRouter } from '../routes/stage7-golden-cards.js';
import { createStage8BlindReviewRouter } from '../routes/stage8-blind-review.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';
import { storiesRouter } from '../routes/stories.js';
import { outlineRouter } from '../routes/outline.js';
import { projectsRouter } from '../routes/projects.js';
import { systemRouter } from '../routes/system.js';
import {
  generateAiComicSeriesPlan,
  saveAiComicSeriesProject,
} from '../services/ai-comic-series-service.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const ENVIRONMENT_NAMES = [
  'NODE_ENV',
  'STORY_AGENT_ACCESS_MODE',
  'STORY_AGENT_ALLOW_INSECURE_PRODUCTION_ACCESS',
  'STORY_AGENT_ACCESS_REGISTRY_JSON',
  'STORY_AGENT_ACCESS_AUDIT_JSONL',
  'STORY_AGENT_ACCESS_AUDIT_REQUIRED',
  'STORY_AGENT_ACCESS_AUDIT_ROTATION_MODE',
  'STORY_AGENT_ACCESS_AUDIT_MAX_BYTES',
  'STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS',
  'STORY_AGENT_SESSION_ISSUER',
  'STORY_AGENT_SESSION_AUDIENCE',
  'STORY_AGENT_SESSION_HMAC_SECRET',
  'STORY_AGENT_ALLOW_STATIC_TOKENS_IN_PRODUCTION',
  'STORY_AGENT_LOGIN_URL',
  'STORY_AGENT_RESOURCE_MIGRATION_WRITE_ENABLED',
  'STORY_AGENT_RESOURCE_MIGRATION_AUDIT_JSONL',
  'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_WRITE_ENABLED',
  'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_AUDIT_JSONL',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_WRITE_ENABLED',
  'STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_AUDIT_JSONL',
  'WEB_GENERATED_ROOT',
] as const;
const ORIGINAL_ENVIRONMENT = Object.fromEntries(ENVIRONMENT_NAMES.map(name => [name, process.env[name]]));

interface TestActor {
  token: string;
  actor_id: string;
  role: ProductRoleId;
  enabled_feature_flags?: ProductFeatureFlag[];
  status?: 'active' | 'revoked';
  organization_id?: string;
  session_not_before?: number;
}

interface TestResourceBinding {
  resource_type: 'story_project' | 'series_project';
  resource_id: string;
  organization_id: string;
  owner_actor_id: string;
  member_actor_ids?: string[];
}

function tokenSha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function configureRequiredAccess(actors: TestActor[], resourceBindings: TestResourceBinding[] = []): void {
  process.env.NODE_ENV = 'test';
  process.env.STORY_AGENT_ACCESS_MODE = 'required';
  delete process.env.STORY_AGENT_ACCESS_AUDIT_JSONL;
  delete process.env.STORY_AGENT_ACCESS_AUDIT_REQUIRED;
  process.env.STORY_AGENT_ACCESS_REGISTRY_JSON = JSON.stringify({
    schema_version: 'story-agent-product-access-registry/v1',
    actors: actors.map(actor => ({
      actor_id: actor.actor_id,
      display_name: actor.actor_id,
      organization_id: actor.organization_id ?? 'test-organization',
      role: actor.role,
      token_sha256: tokenSha256(actor.token),
      status: actor.status ?? 'active',
      ...(actor.session_not_before === undefined ? {} : { session_not_before: actor.session_not_before }),
      enabled_feature_flags: actor.enabled_feature_flags ?? [],
    })),
    resource_bindings: resourceBindings.map(binding => ({
      schema_version: 'story-agent-product-resource-ownership/v1',
      ...binding,
      member_actor_ids: binding.member_actor_ids ?? [],
    })),
  });
}

function protectedRequest(
  permission: ProductPermission,
  featureFlag?: ProductFeatureFlag,
): supertest.Agent {
  const app = express();
  app.get(
    '/protected',
    requireProductAccess(permission, featureFlag ? { feature_flag: featureFlag } : {}),
    (req, res) => res.json(success(getProductAccessContext(req))),
  );
  return supertest(app);
}

function bearer(token: string): string {
  return `Bearer ${token}`;
}

const TEST_SESSION_ISSUER = 'https://identity.test/story-agent';
const TEST_SESSION_AUDIENCE = 'story-agent-web';
const TEST_SESSION_SECRET = 'test-session-hmac-secret-at-least-32-bytes-long';

function configureSignedSessionIssuer(): void {
  process.env.STORY_AGENT_SESSION_ISSUER = TEST_SESSION_ISSUER;
  process.env.STORY_AGENT_SESSION_AUDIENCE = TEST_SESSION_AUDIENCE;
  process.env.STORY_AGENT_SESSION_HMAC_SECRET = TEST_SESSION_SECRET;
  process.env.STORY_AGENT_LOGIN_URL = 'https://identity.test/login';
  delete process.env.STORY_AGENT_ALLOW_STATIC_TOKENS_IN_PRODUCTION;
}

function configureAccessAuditLifecycle(maxBytes = 1024): void {
  process.env.STORY_AGENT_ACCESS_AUDIT_ROTATION_MODE = 'size_external_retention';
  process.env.STORY_AGENT_ACCESS_AUDIT_MAX_BYTES = String(maxBytes);
  process.env.STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS = '30';
}

function signedSession(
  actorId: string,
  overrides: Partial<ProductSignedSessionPayload> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: ProductSignedSessionPayload = {
    schema_version: 'story-agent-product-signed-session/v1',
    session_id: `session-${actorId}`,
    actor_id: actorId,
    issuer: TEST_SESSION_ISSUER,
    audience: TEST_SESSION_AUDIENCE,
    issued_at: now - 5,
    expires_at: now + 300,
    ...overrides,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `sa1.${encodedPayload}`;
  const signature = createHmac('sha256', TEST_SESSION_SECRET).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

afterEach(() => {
  for (const name of ENVIRONMENT_NAMES) {
    const value = ORIGINAL_ENVIRONMENT[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetProductAccessAuditForTests();
});

describe('product access configuration', () => {
  it('defaults production to required and refuses an insecure override without an explicit escape hatch', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORY_AGENT_ACCESS_MODE = 'disabled';
    delete process.env.STORY_AGENT_ALLOW_INSECURE_PRODUCTION_ACCESS;
    delete process.env.STORY_AGENT_ACCESS_REGISTRY_JSON;

    expect(getProductAccessMode()).toBe('required');
    const readiness = getProductAccessReadiness();
    expect(readiness.production_enforced).toBe(true);
    expect(readiness.ready_for_production).toBe(false);
    expect(readiness.blockers).toContain('access_registry_missing');

    process.env.STORY_AGENT_ALLOW_INSECURE_PRODUCTION_ACCESS = 'true';
    expect(getProductAccessMode()).toBe('disabled');
  });

  it('reports production ready only for a valid registry, signed-session issuer and durable audit', () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    configureSignedSessionIssuer();
    configureAccessAuditLifecycle();
    process.env.NODE_ENV = 'production';
    process.env.STORY_AGENT_ACCESS_AUDIT_JSONL = resolve(tmpdir(), 'story-agent-readiness-audit.jsonl');

    const readiness = getProductAccessReadiness();
    expect(readiness).toMatchObject({
      mode: 'required',
      production_enforced: true,
      registry_configured: true,
      registry_valid: true,
      active_actor_count: 1,
      registered_resource_count: 0,
      token_hash_only: true,
      signed_session_issuer_configured: true,
      signed_session_issuer_valid: true,
      signed_session_max_ttl_seconds: 86400,
      signed_session_actor_revocation_supported: true,
      actors_with_session_not_before_count: 0,
      real_session_revocation_verified: false,
      static_tokens_allowed_in_production: false,
      login_handoff_configured: true,
      login_handoff_valid: true,
      real_user_login_verified: false,
      resource_ownership_enforced: true,
      durable_audit_path_absolute: true,
      durable_audit_path_writable: true,
      durable_audit_rotation_mode: 'size_external_retention',
      durable_audit_rotation_configured: true,
      durable_audit_max_bytes: 1024,
      durable_audit_retention_days: 30,
      durable_audit_archives_deleted_by_application: false,
      ready_for_production: true,
      request_role_headers_trusted: false,
      real_credit_granted: false,
    });
    expect(JSON.stringify(readiness)).not.toContain('admin-secret');
  });

  it('keeps production readiness blocked when the durable audit target is relative or not writable', () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    configureSignedSessionIssuer();
    process.env.NODE_ENV = 'production';
    process.env.STORY_AGENT_ACCESS_AUDIT_JSONL = 'relative-access-audit.jsonl';

    const readiness = getProductAccessReadiness();
    expect(readiness).toMatchObject({
      durable_audit_configured: true,
      durable_audit_path_absolute: false,
      durable_audit_path_writable: false,
      ready_for_production: false,
    });
    expect(readiness.blockers).toContain('durable_audit_path_not_absolute');
  });

  it('keeps production readiness blocked when durable audit lifecycle values are incomplete or invalid', () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    configureSignedSessionIssuer();
    process.env.NODE_ENV = 'production';
    process.env.STORY_AGENT_ACCESS_AUDIT_JSONL = resolve(tmpdir(), 'story-agent-invalid-lifecycle-audit.jsonl');
    process.env.STORY_AGENT_ACCESS_AUDIT_ROTATION_MODE = 'application_retention';
    process.env.STORY_AGENT_ACCESS_AUDIT_MAX_BYTES = '512';
    process.env.STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS = '0';

    const readiness = getProductAccessReadiness();
    expect(readiness).toMatchObject({
      durable_audit_rotation_mode: null,
      durable_audit_rotation_configured: false,
      durable_audit_max_bytes: null,
      durable_audit_retention_days: null,
      durable_audit_archives_deleted_by_application: false,
      ready_for_production: false,
    });
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'durable_audit_rotation_mode_invalid',
      'durable_audit_max_bytes_invalid',
      'durable_audit_retention_days_invalid',
    ]));
  });

  it('builds a safe public login handoff without accepting an external return target', () => {
    process.env.STORY_AGENT_ACCESS_MODE = 'required';
    process.env.STORY_AGENT_LOGIN_URL = 'https://identity.test/login?client=story-agent';

    expect(getProductLoginHandoff('/projects?view=mine')).toMatchObject({
      mode: 'required',
      login_required: true,
      provider_configured: true,
      provider_valid: true,
      return_to: '/projects?view=mine',
      return_to_parameter: 'return_to',
      real_login_verified: false,
      real_credit_granted: false,
    });
    expect(getProductLoginHandoff('/projects?view=mine').redirect_url).toBe(
      'https://identity.test/login?client=story-agent&return_to=%2Fprojects%3Fview%3Dmine',
    );
    const external = getProductLoginHandoff('https://evil.example/steal');
    expect(external.return_to).toBe('/');
    expect(external.redirect_url).toBe('https://identity.test/login?client=story-agent&return_to=%2F');
    expect(getProductLoginHandoff('/%2f%2fevil.example/steal').return_to).toBe('/');
  });
});

describe('product access middleware', () => {
  it('denies a missing token and records a secret-free audit event', async () => {
    configureRequiredAccess([{ token: 'creator-secret', actor_id: 'creator-1', role: 'creator' }]);
    const response = await protectedRequest('production:read').get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('ACCESS_UNAUTHENTICATED');
    const [event] = listProductAccessAuditEvents();
    expect(event).toMatchObject({ decision: 'denied', reason: 'access_token_missing' });
    expect(JSON.stringify(event)).not.toContain('creator-secret');
    expect(JSON.stringify(event)).not.toContain(tokenSha256('creator-secret'));
  });

  it('ignores request-supplied role headers and evaluates the server registry role', async () => {
    configureRequiredAccess([{ token: 'creator-secret', actor_id: 'creator-1', role: 'creator' }]);
    const response = await protectedRequest('access:audit:read')
      .get('/protected')
      .set('authorization', bearer('creator-secret'))
      .set('x-story-agent-role', 'administrator');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCESS_FORBIDDEN');
    expect(listProductAccessAuditEvents()[0]).toMatchObject({ role: 'creator', reason: 'required_permission_missing' });
  });

  it('requires both role permission and internal feature flag', async () => {
    configureRequiredAccess([
      { token: 'operator-no-flag', actor_id: 'operator-1', role: 'production_operator' },
      {
        token: 'operator-with-flag',
        actor_id: 'operator-2',
        role: 'production_operator',
        enabled_feature_flags: ['internal_story_tools'],
      },
    ]);
    const request = protectedRequest('production:operate', 'internal_story_tools');

    const denied = await request.get('/protected').set('authorization', bearer('operator-no-flag'));
    expect(denied.status).toBe(403);
    expect(denied.body.error.details.required_feature_flag).toBe('internal_story_tools');

    const allowed = await request.get('/protected').set('authorization', bearer('operator-with-flag'));
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.actor).toMatchObject({ actor_id: 'operator-2', role: 'production_operator' });
    expect(allowed.body.data).not.toHaveProperty('token_sha256');
  });

  it('reserves reference analysis approval for material signers', async () => {
    configureRequiredAccess([
      { token: 'research-token', actor_id: 'research-1', role: 'research_editor' },
      { token: 'reviewer-token', actor_id: 'reviewer-1', role: 'cultural_fact_reviewer' },
    ]);
    const repoRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-reference-approval-access-'));
    try {
      const app = express();
      app.use(express.json());
      app.use('/api/reference-library', createReferenceLibraryRouter(repoRoot));
      app.use(errorHandler);
      const request = supertest(app);
      const path = '/api/reference-library/analyses/analysis-does-not-exist/approval';
      const body = {
        approved_by: 'reviewer-1',
        approved_at: '2026-07-25T09:00:00.000Z',
        confirmation: 'human_reviewed_reference_analysis',
      };

      const researchDenied = await request
        .post(path)
        .set('authorization', bearer('research-token'))
        .send(body);
      expect(researchDenied.status).toBe(403);
      expect(researchDenied.body.error.code).toBe('ACCESS_FORBIDDEN');

      const mismatchedReviewer = await request
        .post(path)
        .set('authorization', bearer('reviewer-token'))
        .send({ ...body, approved_by: 'another-reviewer' });
      expect(mismatchedReviewer.status).toBe(403);
      expect(mismatchedReviewer.body.error.code).toBe('ACCESS_FORBIDDEN');

      const reviewerAllowed = await request
        .post(path)
        .set('authorization', bearer('reviewer-token'))
        .send(body);
      expect(reviewerAllowed.status).toBe(404);
      expect(reviewerAllowed.body.error.code).toBe('REFERENCE_ANALYSIS_NOT_FOUND');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('accepts an opaque session cookie and rejects a revoked actor', async () => {
    configureRequiredAccess([
      { token: 'active-token', actor_id: 'active-creator', role: 'creator' },
      { token: 'revoked-token', actor_id: 'revoked-creator', role: 'creator', status: 'revoked' },
    ]);
    const request = protectedRequest('project:read');

    const allowed = await request.get('/protected').set('cookie', 'story_agent_session=active-token');
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.authenticated).toBe(true);

    const revoked = await request.get('/protected').set('authorization', bearer('revoked-token'));
    expect(revoked.status).toBe(401);
    expect(listProductAccessAuditEvents()[0].reason).toBe('access_actor_revoked');
  });

  it('verifies issuer-scoped signed sessions and rejects expiry, scope mismatch and tampering', async () => {
    configureRequiredAccess([{ token: 'static-token', actor_id: 'creator-1', role: 'creator' }]);
    configureSignedSessionIssuer();
    const request = protectedRequest('project:read');

    const allowed = await request.get('/protected')
      .set('authorization', bearer(signedSession('creator-1')));
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toMatchObject({
      authenticated: true,
      authentication_method: 'signed_session',
      actor: { actor_id: 'creator-1' },
    });

    const now = Math.floor(Date.now() / 1000);
    const expired = await request.get('/protected').set('authorization', bearer(signedSession('creator-1', {
      issued_at: now - 600,
      expires_at: now - 1,
    })));
    expect(expired.status).toBe(401);
    expect(expired.body.error.details.reason).toBe('signed_session_expired');

    const wrongScope = await request.get('/protected').set('authorization', bearer(signedSession('creator-1', {
      audience: 'another-service',
    })));
    expect(wrongScope.status).toBe(401);
    expect(wrongScope.body.error.details.reason).toBe('signed_session_scope_invalid');

    const valid = signedSession('creator-1');
    const parts = valid.split('.');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    const tampered = await request.get('/protected').set('authorization', bearer(parts.join('.')));
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.details.reason).toBe('signed_session_signature_invalid');
  });

  it('revokes actor sessions issued before the registry cutoff and accepts the exact boundary', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 30;
    configureRequiredAccess([{
      token: 'static-token',
      actor_id: 'creator-1',
      role: 'creator',
      session_not_before: cutoff,
    }]);
    configureSignedSessionIssuer();
    const request = protectedRequest('project:read');

    const revoked = await request.get('/protected').set('authorization', bearer(signedSession('creator-1', {
      issued_at: cutoff - 1,
      expires_at: now + 300,
    })));
    expect(revoked.status).toBe(401);
    expect(revoked.body.error.details.reason).toBe('signed_session_revoked');

    const boundary = await request.get('/protected').set('authorization', bearer(signedSession('creator-1', {
      issued_at: cutoff,
      expires_at: now + 300,
    })));
    expect(boundary.status).toBe(200);
    expect(boundary.body.data).toMatchObject({
      authenticated: true,
      authentication_method: 'signed_session',
      actor: { actor_id: 'creator-1' },
    });
    expect(boundary.body.data.actor).not.toHaveProperty('session_not_before');
    const staticCompatibility = await request
      .get('/protected')
      .set('authorization', bearer('static-token'));
    expect(staticCompatibility.status).toBe(200);
    expect(getProductAccessReadiness()).toMatchObject({
      signed_session_actor_revocation_supported: true,
      actors_with_session_not_before_count: 1,
      real_session_revocation_verified: false,
    });
  });

  it('rejects invalid actor session cutoffs without exposing them in the public actor contract', async () => {
    configureRequiredAccess([{
      token: 'static-token',
      actor_id: 'creator-1',
      role: 'creator',
      session_not_before: -1,
    }]);
    configureSignedSessionIssuer();

    const readiness = getProductAccessReadiness();
    expect(readiness.registry_valid).toBe(false);
    expect(readiness.blockers).toContain('access_registry_actor_invalid:0');
    expect(readiness.actors_with_session_not_before_count).toBe(0);
    const response = await protectedRequest('project:read')
      .get('/protected')
      .set('authorization', bearer(signedSession('creator-1')));
    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain('session_not_before');
  });

  it('fails closed for static registry tokens in production even when their hashes are registered', async () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    configureSignedSessionIssuer();
    process.env.NODE_ENV = 'production';
    process.env.STORY_AGENT_ACCESS_AUDIT_JSONL = resolve(tmpdir(), 'story-agent-static-token-denied.jsonl');

    const response = await protectedRequest('project:read')
      .get('/protected')
      .set('authorization', bearer('admin-secret'));
    expect(response.status).toBe(401);
    expect(response.body.error.details.reason).toBe('production_static_access_token_forbidden');
  });

  it('rotates durable audit without deleting archives and preserves an externally held lock', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-access-audit-'));
    const auditPath = resolve(root, 'access.jsonl');
    const lockPath = `${auditPath}.rotation.lock`;
    try {
      configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
      process.env.STORY_AGENT_ACCESS_AUDIT_REQUIRED = 'true';
      process.env.STORY_AGENT_ACCESS_AUDIT_JSONL = auditPath;
      configureAccessAuditLifecycle(1024);
      const request = protectedRequest('access:audit:read');

      for (let index = 0; index < 6; index += 1) {
        const response = await request
          .get('/protected')
          .set('authorization', bearer('admin-secret'))
          .set('x-request-id', `audit-rotation-${index}`);
        expect(response.status).toBe(200);
      }

      const auditFiles = (await readdir(root)).filter(name => name.endsWith('.jsonl')).sort();
      const archives = auditFiles.filter(name => name.endsWith('.archive.jsonl'));
      expect(archives.length).toBeGreaterThan(0);
      expect(auditFiles).toContain('access.jsonl');
      const durableEvents = (
        await Promise.all(auditFiles.map(name => readFile(resolve(root, name), 'utf8')))
      ).flatMap(raw => raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
      expect(durableEvents).toHaveLength(6);
      expect(durableEvents.every(event => event.durable_written === true)).toBe(true);
      expect(JSON.stringify(durableEvents)).not.toContain('admin-secret');
      expect(JSON.stringify(durableEvents)).not.toContain(tokenSha256('admin-secret'));

      await writeFile(lockPath, 'held-by-external-archiver');
      const unavailable = await request
        .get('/protected')
        .set('authorization', bearer('admin-secret'));
      expect(unavailable.status).toBe(503);
      expect(unavailable.body.error.code).toBe('ACCESS_AUDIT_UNAVAILABLE');
      expect(await readFile(lockPath, 'utf8')).toBe('held-by-external-archiver');
      expect(listProductAccessAuditEvents()[0]).toMatchObject({
        decision: 'denied',
        reason: 'durable_access_audit_unavailable',
        durable_written: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when durable audit is required but unavailable', async () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    process.env.STORY_AGENT_ACCESS_AUDIT_REQUIRED = 'true';
    delete process.env.STORY_AGENT_ACCESS_AUDIT_JSONL;

    const response = await protectedRequest('access:audit:read')
      .get('/protected')
      .set('authorization', bearer('admin-secret'));
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('ACCESS_AUDIT_UNAVAILABLE');
    expect(listProductAccessAuditEvents()[0]).toMatchObject({
      decision: 'denied',
      reason: 'durable_access_audit_unavailable',
    });
  });

  it('requires durable access audit by default in production', async () => {
    configureRequiredAccess([{ token: 'admin-secret', actor_id: 'admin-1', role: 'administrator' }]);
    configureSignedSessionIssuer();
    process.env.NODE_ENV = 'production';
    delete process.env.STORY_AGENT_ACCESS_AUDIT_REQUIRED;
    delete process.env.STORY_AGENT_ACCESS_AUDIT_JSONL;

    expect(getProductAccessReadiness().blockers).toContain('durable_access_audit_missing');
    const response = await protectedRequest('access:audit:read')
      .get('/protected')
      .set('authorization', bearer(signedSession('admin-1')));
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('ACCESS_AUDIT_UNAVAILABLE');
  });
});

describe('project resource ownership', () => {
  const projectId = '20260715-story-owner1--ai_comic_drama';

  function projectResourceRequest(): supertest.Agent {
    const app = express();
    app.get(
      '/projects/:projectId',
      requireProductAccess('project:read', {
        resource: {
          type: 'story_project',
          ids: req => req.params.projectId,
          required: true,
        },
      }),
      (_req, res) => res.json(success({ visible: true })),
    );
    return supertest(app);
  }

  it('allows only the owner, explicit members and same-organization administrator', async () => {
    configureRequiredAccess([
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      { token: 'member-token', actor_id: 'member-1', role: 'production_operator' },
      { token: 'outsider-token', actor_id: 'outsider-1', role: 'creator' },
      { token: 'admin-token', actor_id: 'admin-1', role: 'administrator' },
      {
        token: 'foreign-token',
        actor_id: 'foreign-1',
        role: 'administrator',
        organization_id: 'foreign-organization',
      },
    ], [{
      resource_type: 'story_project',
      resource_id: projectId,
      organization_id: 'test-organization',
      owner_actor_id: 'owner-1',
      member_actor_ids: ['member-1'],
    }]);
    const request = projectResourceRequest();

    expect((await request.get(`/projects/${projectId}`).set('authorization', bearer('owner-token'))).status).toBe(200);
    expect((await request.get(`/projects/${projectId}`).set('authorization', bearer('member-token'))).status).toBe(200);
    expect((await request.get(`/projects/${projectId}`).set('authorization', bearer('admin-token'))).status).toBe(200);

    const outsider = await request.get(`/projects/${projectId}`).set('authorization', bearer('outsider-token'));
    expect(outsider.status).toBe(403);
    expect(outsider.body.error.code).toBe('ACCESS_RESOURCE_FORBIDDEN');

    const foreign = await request.get(`/projects/${projectId}`).set('authorization', bearer('foreign-token'));
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe('ACCESS_RESOURCE_FORBIDDEN');
  });

  it('fails closed for an unbound project and records the resource in the audit event', async () => {
    configureRequiredAccess([{ token: 'owner-token', actor_id: 'owner-1', role: 'creator' }]);

    const response = await projectResourceRequest()
      .get(`/projects/${projectId}`)
      .set('authorization', bearer('owner-token'));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCESS_RESOURCE_UNBOUND');
    expect(listProductAccessAuditEvents()[0]).toMatchObject({
      reason: 'resource_binding_missing',
      resource_type: 'story_project',
      resource_id: projectId,
    });
  });

  it('fails closed when stored ownership conflicts with the server registry', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-resource-conflict-'));
    process.env.WEB_GENERATED_ROOT = root;
    configureRequiredAccess([
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      {
        token: 'foreign-token',
        actor_id: 'foreign-1',
        role: 'creator',
        organization_id: 'foreign-organization',
      },
    ], [{
      resource_type: 'story_project',
      resource_id: projectId,
      organization_id: 'test-organization',
      owner_actor_id: 'owner-1',
    }]);
    const projectDir = resolve(root, 'projects', projectId);
    await mkdir(projectDir, { recursive: true });
    await writeFile(resolve(projectDir, 'project.json'), JSON.stringify({
      access_control: {
        schema_version: 'story-agent-product-resource-ownership/v1',
        organization_id: 'foreign-organization',
        owner_actor_id: 'foreign-1',
        member_actor_ids: [],
      },
    }));
    try {
      const response = await projectResourceRequest()
        .get(`/projects/${projectId}`)
        .set('authorization', bearer('owner-token'));
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_RESOURCE_UNBOUND');
      expect(listProductAccessAuditEvents()[0].reason).toBe('resource_binding_conflict');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('builds a read-only migration manifest without guessing or writing legacy ownership', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-resource-audit-'));
    process.env.WEB_GENERATED_ROOT = root;
    const consistentId = '20260715-story-consistent1--ai_comic_drama';
    const storedOnlyId = '20260715-story-storedonly1--ai_comic_drama';
    const legacyId = '20260715-story-legacy1--ai_comic_drama';
    const unboundId = '20260715-story-unbound1--ai_comic_drama';
    const invalidId = '20260715-story-invalid1--ai_comic_drama';
    const conflictId = '20260715-story-conflict1--ai_comic_drama';
    const orphanId = '20260715-story-orphan1--ai_comic_drama';
    configureRequiredAccess([
      {
        token: 'admin-token',
        actor_id: 'admin-1',
        role: 'administrator',
        enabled_feature_flags: ['internal_story_tools'],
      },
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      {
        token: 'foreign-token',
        actor_id: 'foreign-1',
        role: 'creator',
        organization_id: 'foreign-organization',
      },
    ], [consistentId, legacyId, conflictId, orphanId].map(resourceId => ({
      resource_type: 'story_project' as const,
      resource_id: resourceId,
      organization_id: 'test-organization',
      owner_actor_id: 'owner-1',
    })));

    const owned = {
      schema_version: 'story-agent-product-resource-ownership/v1',
      organization_id: 'test-organization',
      owner_actor_id: 'owner-1',
      member_actor_ids: [],
    };
    const metadataById: Record<string, Record<string, unknown>> = {
      [consistentId]: { access_control: owned },
      [storedOnlyId]: { access_control: owned },
      [legacyId]: { title: 'Legacy project without stored ownership' },
      [unboundId]: { title: 'Unbound project' },
      [invalidId]: { access_control: { schema_version: 'invalid' } },
      [conflictId]: {
        access_control: {
          schema_version: 'story-agent-product-resource-ownership/v1',
          organization_id: 'foreign-organization',
          owner_actor_id: 'foreign-1',
          member_actor_ids: [],
        },
      },
    };
    for (const [resourceId, metadata] of Object.entries(metadataById)) {
      const directory = resolve(root, 'projects', resourceId);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'project.json'), JSON.stringify(metadata));
    }
    const legacyBefore = await readFile(resolve(root, 'projects', legacyId, 'project.json'), 'utf8');
    const unboundBefore = await readFile(resolve(root, 'projects', unboundId, 'project.json'), 'utf8');
    try {
      const report = await getProductResourceOwnershipAuditReport();
      expect(report).toMatchObject({
        read_only: true,
        discovered_resource_count: 7,
        access_enforcement_ready_count: 3,
        registry_managed_legacy_count: 1,
        unbound_count: 1,
        conflict_count: 1,
        invalid_metadata_count: 1,
        orphaned_registry_binding_count: 1,
        ready_for_enforced_access: false,
        ready_for_production: false,
        automatic_owner_assignment: false,
        writeback_performed: false,
        real_credit_granted: false,
      });
      expect(Object.fromEntries(report.items.map(item => [item.resource_id, item.status]))).toMatchObject({
        [consistentId]: 'consistent',
        [storedOnlyId]: 'stored_only',
        [legacyId]: 'registry_managed_legacy',
        [unboundId]: 'unbound',
        [invalidId]: 'invalid_metadata',
        [conflictId]: 'conflict',
        [orphanId]: 'orphaned_registry_binding',
      });
      const unbound = report.items.find(item => item.resource_id === unboundId)!;
      expect(unbound).toMatchObject({
        stored_ownership: null,
        registered_ownership: null,
        migration_action: 'assign_ownership_manually',
        automatic_owner_assignment: false,
        writeback_performed: false,
      });
      expect(report.migration_manifest).toMatchObject({
        read_only: true,
        action_count: 5,
        automatic_owner_assignment: false,
        writeback_performed: false,
      });
      expect(await readFile(resolve(root, 'projects', legacyId, 'project.json'), 'utf8')).toBe(legacyBefore);
      expect(await readFile(resolve(root, 'projects', unboundId, 'project.json'), 'utf8')).toBe(unboundBefore);

      const app = express();
      app.use('/api/system', systemRouter);
      const request = supertest(app);
      expect((await request.get('/api/system/resource-access-readiness')
        .set('authorization', bearer('owner-token'))).status).toBe(403);
      const admin = await request.get('/api/system/resource-access-readiness')
        .set('authorization', bearer('admin-token'));
      expect(admin.status).toBe(200);
      expect(admin.body.data).toMatchObject({ read_only: true, discovered_resource_count: 7 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('applies only explicitly reviewed, hash-locked ownership migrations behind the disabled-by-default write gate', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-resource-migrate-'));
    process.env.WEB_GENERATED_ROOT = root;
    const migratableId = '20260715-story-migrate1--ai_comic_drama';
    configureRequiredAccess([
      {
        token: 'admin-token',
        actor_id: 'admin-1',
        role: 'administrator',
        enabled_feature_flags: ['internal_story_tools'],
      },
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
    ]);
    const directory = resolve(root, 'projects', migratableId);
    await mkdir(directory, { recursive: true });
    const metadataPath = resolve(directory, 'project.json');
    const original = JSON.stringify({ project_id: migratableId, title: 'Explicit migration target' });
    await writeFile(metadataPath, original);
    const expectedSha256 = tokenSha256(original);
    const requestBody = {
      schema_version: 'story-agent-product-resource-ownership-migration-request/v1',
      migration_id: 'migration-review-0001',
      resource_type: 'story_project',
      resource_id: migratableId,
      expected_metadata_sha256: expectedSha256,
      ownership: {
        schema_version: 'story-agent-product-resource-ownership/v1',
        organization_id: 'test-organization',
        owner_actor_id: 'owner-1',
        member_actor_ids: [],
      },
      review_reference: 'OPS-OWNERSHIP-REVIEW-0001',
      operator_confirmation: 'ownership_reviewed',
    };
    const app = express();
    app.use(express.json());
    app.use('/api/system', systemRouter);
    app.use(errorHandler);
    const request = supertest(app);
    try {
      const roleDenied = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('owner-token'))
        .send(requestBody);
      expect(roleDenied.status).toBe(403);

      const dryRun = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send(requestBody);
      expect(dryRun.status).toBe(200);
      expect(dryRun.body.data).toMatchObject({
        dry_run: true,
        write_enabled: false,
        status_before: 'unbound',
        preflight_ready: true,
        applied: false,
        automatic_owner_assignment: false,
        ownership_overwrite_allowed: false,
        real_credit_granted: false,
      });
      expect(await readFile(metadataPath, 'utf8')).toBe(original);

      const hashConflict = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, expected_metadata_sha256: '0'.repeat(64) });
      expect(hashConflict.status).toBe(200);
      expect(hashConflict.body.data.blockers).toContain('resource_metadata_sha256_conflict');
      expect(await readFile(metadataPath, 'utf8')).toBe(original);

      const writeDisabled = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, dry_run: false });
      expect(writeDisabled.status).toBe(409);
      expect(writeDisabled.body.error.code).toBe('ACCESS_RESOURCE_MIGRATION_BLOCKED');
      expect(writeDisabled.body.error.details.blockers).toContain('resource_migration_write_disabled');
      expect(await readFile(metadataPath, 'utf8')).toBe(original);

      const auditDirectory = resolve(root, 'audit');
      await mkdir(auditDirectory, { recursive: true });
      const migrationAuditPath = resolve(auditDirectory, 'resource-migrations.jsonl');
      process.env.STORY_AGENT_RESOURCE_MIGRATION_WRITE_ENABLED = 'true';
      process.env.STORY_AGENT_RESOURCE_MIGRATION_AUDIT_JSONL = migrationAuditPath;
      const externalLockPath = `${metadataPath}.ownership-migration.lock`;
      await writeFile(externalLockPath, 'held-by-another-operator');
      const concurrent = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, dry_run: false });
      expect(concurrent.status).toBe(409);
      expect(concurrent.body.error.details.blockers).toContain('resource_migration_concurrent_operation');
      expect(await readFile(externalLockPath, 'utf8')).toBe('held-by-another-operator');
      await rm(externalLockPath);

      const applied = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, dry_run: false });
      expect(applied.status).toBe(200);
      expect(applied.body.data).toMatchObject({
        applied: true,
        idempotent_replay: false,
        durable_intent_written: true,
        durable_completion_written: true,
        blockers: [],
      });
      const migrated = JSON.parse(await readFile(metadataPath, 'utf8'));
      expect(migrated.access_control).toEqual(requestBody.ownership);
      expect(migrated.access_control_migration).toMatchObject({
        migration_id: requestBody.migration_id,
        migrated_by_actor_id: 'admin-1',
        review_reference: requestBody.review_reference,
        previous_metadata_sha256: expectedSha256,
        real_credit_granted: false,
      });
      const auditEvents = (await readFile(migrationAuditPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(auditEvents.map(event => event.phase)).toEqual(['intent', 'applied']);
      expect(auditEvents.every(event => event.automatic_owner_assignment === false)).toBe(true);

      const replay = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, dry_run: false });
      expect(replay.status).toBe(200);
      expect(replay.body.data).toMatchObject({
        applied: false,
        idempotent_replay: true,
        status_before: 'already_migrated',
      });
      expect((await readFile(migrationAuditPath, 'utf8')).trim().split('\n')).toHaveLength(2);

      const overwrite = await request.post('/api/system/resource-access-migrations')
        .set('authorization', bearer('admin-token'))
        .send({ ...requestBody, migration_id: 'migration-review-0002', dry_run: false });
      expect(overwrite.status).toBe(409);
      expect(overwrite.body.error.details.blockers).toContain('resource_ownership_overwrite_forbidden');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('exposes legacy domain-safety inventory and keeps migration dry-run protected by administrator access', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-domain-safety-route-'));
    process.env.WEB_GENERATED_ROOT = root;
    configureRequiredAccess([
      {
        token: 'admin-token',
        actor_id: 'admin-1',
        role: 'administrator',
        enabled_feature_flags: ['internal_story_tools'],
      },
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/system', systemRouter);
    app.use(errorHandler);
    const request = supertest(app);
    try {
      expect((await request.get('/api/system/story-domain-safety-migrations')
        .set('authorization', bearer('owner-token'))).status).toBe(403);
      const inventory = await request.get('/api/system/story-domain-safety-migrations')
        .set('authorization', bearer('admin-token'));
      expect(inventory.status).toBe(200);
      expect(inventory.body.data).toMatchObject({
        schema_version: 'story-domain-safety-migration-audit/v1',
        read_only: true,
        discovered_project_count: 0,
        writeback_performed: false,
        real_credit_granted: false,
      });

      const body = {
        schema_version: 'story-domain-safety-migration-request/v1',
        migration_id: 'domain-safety-route-0001',
        project_id: '20260716-story-missing1--character_story',
        expected_current_version_id: '20260716-story-missing1--character_story-v1',
        expected_story_sha256: '0'.repeat(64),
        expected_source_domain: 'china_culture',
        expected_source_entry: '周敦颐——理学开山鼻祖',
        review_reference: 'OPS-DOMAIN-SAFETY-ROUTE-0001',
        operator_confirmation: 'migration_scope_reviewed',
      };
      expect((await request.post('/api/system/story-domain-safety-migrations')
        .set('authorization', bearer('owner-token'))
        .send(body)).status).toBe(403);
      const dryRun = await request.post('/api/system/story-domain-safety-migrations')
        .set('authorization', bearer('admin-token'))
        .send(body);
      expect(dryRun.status).toBe(200);
      expect(dryRun.body.data).toMatchObject({
        schema_version: 'story-domain-safety-migration-result/v1',
        dry_run: true,
        applied: false,
        preflight_ready: false,
        real_credit_granted: false,
      });
      expect(dryRun.body.data.blockers).toEqual(expect.arrayContaining([
        'project_not_found',
        'domain_safety_migration_candidate_required',
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('protects the legacy storage disposition preflight with audit access and internal tooling', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-storage-disposition-route-'));
    process.env.WEB_GENERATED_ROOT = root;
    await mkdir(resolve(root, 'projects'), { recursive: true });
    configureRequiredAccess([
      {
        token: 'admin-token',
        actor_id: 'admin-1',
        role: 'administrator',
        enabled_feature_flags: ['internal_story_tools'],
      },
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/system', systemRouter);
    app.use(errorHandler);
    const request = supertest(app);
    try {
      expect((await request.get('/api/system/story-storage-legacy-disposition-preflight')).status).toBe(401);
      expect((await request.get('/api/system/story-storage-legacy-disposition-preflight')
        .set('authorization', bearer('owner-token'))).status).toBe(403);
      const preflight = await request.get('/api/system/story-storage-legacy-disposition-preflight')
        .set('authorization', bearer('admin-token'));
      expect(preflight.status).toBe(200);
      expect(preflight.body.data).toMatchObject({
        schema_version: 'story-storage-legacy-disposition-preflight/v1',
        read_only: true,
        automatic_action_count: 0,
        migration_performed: false,
        merge_performed: false,
        deletion_performed: false,
        writeback_performed: false,
        domain_safety_migration_performed: false,
        real_gears_seedance_delivery_credit_count: 0,
        counts_as_real_gears_seedance_delivery: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('protects file-to-SQLite repository preflight and defaults migration requests to dry-run', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-project-file-sqlite-route-'));
    process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
    process.env.STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_TARGET_PATH = resolve(root, 'target.sqlite3');
    configureRequiredAccess([
      {
        token: 'admin-token',
        actor_id: 'admin-1',
        role: 'administrator',
        enabled_feature_flags: ['internal_story_tools'],
      },
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/system', systemRouter);
    app.use(errorHandler);
    const request = supertest(app);
    try {
      expect((await request.get('/api/system/story-project-file-to-sqlite-migration')
        .set('authorization', bearer('owner-token'))).status).toBe(403);
      const preflight = await request.get('/api/system/story-project-file-to-sqlite-migration')
        .set('authorization', bearer('admin-token'));
      expect(preflight.status).toBe(200);
      expect(preflight.body.data).toMatchObject({
        schema_version: 'story-project-file-to-sqlite-migration-preflight/v1',
        source_provider: 'file',
        target_provider: 'sqlite',
        source_project_count: 0,
        blockers: ['file_repository_source_empty'],
        preflight_ready: false,
        source_writeback_performed: false,
        target_write_performed: false,
        production_persistence_ready: false,
        real_credit_granted: false,
      });
      const body = {
        schema_version: 'story-project-file-to-sqlite-migration-request/v1',
        migration_id: 'file-sqlite-route-0001',
        expected_source_logical_sha256: '0'.repeat(64),
        review_reference: 'OPS-FILE-SQLITE-ROUTE-0001',
        operator_confirmation: 'file_repository_snapshot_reviewed',
      };
      expect((await request.post('/api/system/story-project-file-to-sqlite-migration')
        .set('authorization', bearer('owner-token'))
        .send(body)).status).toBe(403);
      const dryRun = await request.post('/api/system/story-project-file-to-sqlite-migration')
        .set('authorization', bearer('admin-token'))
        .send(body);
      expect(dryRun.status).toBe(200);
      expect(dryRun.body.data).toMatchObject({
        schema_version: 'story-project-file-to-sqlite-migration-result/v1',
        dry_run: true,
        applied: false,
        idempotent_replay: false,
        source_writeback_performed: false,
        active_provider_changed: false,
        production_persistence_ready: false,
        real_credit_granted: false,
      });
      expect(dryRun.body.data.blockers).toEqual(expect.arrayContaining([
        'file_repository_source_empty',
        'file_repository_logical_sha256_conflict',
      ]));
      await expect(readFile(resolve(root, 'target.sqlite3'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('protects and filters the real project list route by resource ownership', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-resource-list-'));
    process.env.WEB_GENERATED_ROOT = root;
    const foreignProjectId = '20260715-story-foreign1--ai_comic_drama';
    configureRequiredAccess([
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      {
        token: 'foreign-token',
        actor_id: 'foreign-1',
        role: 'creator',
        organization_id: 'foreign-organization',
      },
    ], [
      {
        resource_type: 'story_project',
        resource_id: projectId,
        organization_id: 'test-organization',
        owner_actor_id: 'owner-1',
      },
      {
        resource_type: 'story_project',
        resource_id: foreignProjectId,
        organization_id: 'foreign-organization',
        owner_actor_id: 'foreign-1',
      },
    ]);
    const baseMeta = {
      current_story_id: '20260715-story-owner1',
      title: 'Owned project',
      source_domain: 'china_culture',
      source_entry: 'Test entry',
      video_type: 'ai_comic_drama',
      presentation_style: 'cinematic',
      status: 'draft',
      updated_at: '2026-07-15T00:00:00.000Z',
      scene_count: 0,
      has_gears_segments: false,
      credibility_note: 'Test only',
      logline: 'Test only',
      created_at: '2026-07-15T00:00:00.000Z',
      current_version_id: 'v1',
      version_count: 1,
    };
    for (const [id, title] of [[projectId, 'Owned project'], [foreignProjectId, 'Foreign project']] as const) {
      const directory = resolve(root, 'projects', id);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'project.json'), JSON.stringify({
        ...baseMeta,
        project_id: id,
        title,
      }));
    }
    const app = express();
    app.use('/api/projects', projectsRouter);
    const request = supertest(app);
    try {
      expect((await request.get('/api/projects')).status).toBe(401);
      const response = await request.get('/api/projects').set('authorization', bearer('owner-token'));
      expect(response.status).toBe(200);
      expect(response.body.data.map((item: { project_id: string }) => item.project_id)).toEqual([projectId]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('persists ownership on a newly saved series and preserves it on update', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-series-ownership-'));
    process.env.WEB_GENERATED_ROOT = root;
    const plan = await generateAiComicSeriesPlan({
      outline: '少年守护一项濒危传统技艺，在师友冲突中学会承担责任。',
      series_title: '资源所有权测试系列',
      episode_count: 2,
      episode_duration_range_sec: { min: 60, max: 90 },
      pacing_profile: 'balanced_drama',
      generation_scope: 'full_planning',
    });
    expect(plan.ok).toBe(true);
    const accessControl = {
      schema_version: 'story-agent-product-resource-ownership/v1' as const,
      organization_id: 'test-organization',
      owner_actor_id: 'owner-1',
      member_actor_ids: ['member-1'],
    };
    try {
      const created = await saveAiComicSeriesProject(
        { plan: plan.data! },
        { access_control: accessControl },
      );
      expect(created.ok).toBe(true);
      expect(created.data?.project.access_control).toEqual(accessControl);

      const updated = await saveAiComicSeriesProject({
        series_project_id: created.data!.project.series_project_id,
        plan: { ...plan.data!, series_title: '资源所有权测试系列·更新' },
      });
      expect(updated.data?.project.access_control).toEqual(accessControl);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('enforces ownership on real story and series detail routes before service lookup', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-resource-detail-'));
    process.env.WEB_GENERATED_ROOT = root;
    const storyId = '20260715-story-owner1';
    const seriesProjectId = '20260715-series-owner1';
    await mkdir(resolve(root, 'projects', projectId), { recursive: true });
    configureRequiredAccess([
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      { token: 'outsider-token', actor_id: 'outsider-1', role: 'creator' },
    ], [
      {
        resource_type: 'story_project',
        resource_id: projectId,
        organization_id: 'test-organization',
        owner_actor_id: 'owner-1',
      },
      {
        resource_type: 'series_project',
        resource_id: seriesProjectId,
        organization_id: 'test-organization',
        owner_actor_id: 'owner-1',
      },
    ]);
    const app = express();
    app.use('/api/stories', storiesRouter);
    app.use('/api/story-outline', outlineRouter);
    const request = supertest(app);
    try {
      expect((await request.get(`/api/stories/${storyId}`)).status).toBe(401);
      expect((await request.get(`/api/stories/${storyId}`).set('authorization', bearer('outsider-token'))).status).toBe(403);
      expect((await request.get(`/api/stories/${storyId}`).set('authorization', bearer('owner-token'))).status).toBe(404);

      expect((await request.get(`/api/story-outline/ai-comic-series-projects/${seriesProjectId}`)).status).toBe(401);
      expect((await request.get(`/api/story-outline/ai-comic-series-projects/${seriesProjectId}`)
        .set('authorization', bearer('outsider-token'))).status).toBe(403);
      expect((await request.get(`/api/story-outline/ai-comic-series-projects/${seriesProjectId}`)
        .set('authorization', bearer('owner-token'))).status).toBe(404);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('assigns the authenticated creator as owner of a newly generated story project', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-created-ownership-'));
    process.env.WEB_GENERATED_ROOT = root;
    configureRequiredAccess([
      { token: 'owner-token', actor_id: 'owner-1', role: 'creator' },
      { token: 'outsider-token', actor_id: 'outsider-1', role: 'creator' },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/stories', storiesRouter);
    app.use(errorHandler);
    const request = supertest(app);
    try {
      const generated = await request.post('/api/stories/generate')
        .set('authorization', bearer('owner-token'))
        .send({
          outline: '年轻修复师回到古城，用原创漫剧守护一座旧戏台。',
          original_user_query: '资源所有权测试故事',
          video_type: 'ai_comic_drama',
          creation_use_case: 'original_ai_comic',
          truth_mode: 'fictional_original',
          target_video_duration: '1分钟',
          output_gears_segments: false,
        });
      expect(generated.status).toBe(200);
      const storyId = generated.body.data.storyId as string;
      const generatedProjectId = generated.body.data.project_id as string;
      const rawMeta = JSON.parse(await readFile(
        resolve(root, 'projects', generatedProjectId, 'project.json'),
        'utf8',
      ));
      expect(rawMeta.access_control).toEqual({
        schema_version: 'story-agent-product-resource-ownership/v1',
        organization_id: 'test-organization',
        owner_actor_id: 'owner-1',
        member_actor_ids: [],
      });

      expect((await request.get(`/api/stories/${storyId}`).set('authorization', bearer('owner-token'))).status).toBe(200);
      const outsider = await request.get(`/api/stories/${storyId}`).set('authorization', bearer('outsider-token'));
      expect(outsider.status).toBe(403);
      expect(outsider.body.error.code).toBe('ACCESS_RESOURCE_FORBIDDEN');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('Stage 6-8 route isolation', () => {
  it('allows a creator to read revision work but denies the internal Stage 6 intake', async () => {
    configureRequiredAccess([{ token: 'creator-secret', actor_id: 'creator-1', role: 'creator' }]);
    const app = express();
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(REPO_ROOT));
    const request = supertest(app);

    const standard = await request.get('/api/stage6-revisions').set('authorization', bearer('creator-secret'));
    expect(standard.status).toBe(200);

    const internal = await request.get('/api/stage6-revisions/intake').set('authorization', bearer('creator-secret'));
    expect(internal.status).toBe(403);
  });

  it('aligns material review and release operations with their server-side roles', async () => {
    configureRequiredAccess([
      { token: 'creator-secret', actor_id: 'creator-1', role: 'creator' },
      { token: 'culture-secret', actor_id: 'culture-1', role: 'cultural_fact_reviewer' },
      { token: 'operator-secret', actor_id: 'operator-1', role: 'production_operator' },
    ]);
    const app = express();
    app.use('/api/stage7-golden-cards', createStage7GoldenCardsRouter(REPO_ROOT));
    app.use('/api/stage8-blind-review', createStage8BlindReviewRouter(REPO_ROOT));
    const request = supertest(app);

    const creatorReview = await request.get('/api/stage7-golden-cards/review-intake')
      .set('authorization', bearer('creator-secret'));
    expect(creatorReview.status).toBe(403);

    const culturalReview = await request.get('/api/stage7-golden-cards/review-intake')
      .set('authorization', bearer('culture-secret'));
    expect(culturalReview.status).toBe(200);

    const culturalRelease = await request.get('/api/stage8-blind-review/operations')
      .set('authorization', bearer('culture-secret'));
    expect(culturalRelease.status).toBe(403);

    const operatorRelease = await request.get('/api/stage8-blind-review/operations')
      .set('authorization', bearer('operator-secret'));
    expect(operatorRelease.status).toBe(200);
  });
});

describe('high-risk write isolation', () => {
  it('protects model generation, project mutation and review writeback before body validation', async () => {
    configureRequiredAccess([
      { token: 'creator-secret', actor_id: 'creator-1', role: 'creator' },
      { token: 'research-secret', actor_id: 'research-1', role: 'research_editor' },
      { token: 'culture-secret', actor_id: 'culture-1', role: 'cultural_fact_reviewer' },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/stories', storiesRouter);
    app.use('/api/story-outline', outlineRouter);
    app.use('/api/projects', projectsRouter);
    app.use('/api/system', systemRouter);
    app.use(errorHandler);
    const request = supertest(app);

    const researchGenerate = await request.post('/api/stories/generate')
      .set('authorization', bearer('research-secret'))
      .send({});
    expect(researchGenerate.status).toBe(403);
    const creatorGenerate = await request.post('/api/stories/generate')
      .set('authorization', bearer('creator-secret'))
      .send({});
    expect(creatorGenerate.status).toBe(400);

    const researchSeriesPlan = await request.post('/api/story-outline/ai-comic-series-plan')
      .set('authorization', bearer('research-secret'))
      .send({});
    expect(researchSeriesPlan.status).toBe(403);
    const creatorSeriesPlan = await request.post('/api/story-outline/ai-comic-series-plan')
      .set('authorization', bearer('creator-secret'))
      .send({});
    expect(creatorSeriesPlan.status).toBe(400);

    const researchDelete = await request.delete('/api/projects/missing-project')
      .set('authorization', bearer('research-secret'));
    expect(researchDelete.status).toBe(403);

    const creatorReviewWrite = await request.patch('/api/system/domain-pack-expansion-candidates/review-state')
      .set('authorization', bearer('creator-secret'))
      .send({});
    expect(creatorReviewWrite.status).toBe(403);
    const culturalReviewWrite = await request.patch('/api/system/domain-pack-expansion-candidates/review-state')
      .set('authorization', bearer('culture-secret'))
      .send({});
    expect(culturalReviewWrite.status).toBe(400);
  });
});
