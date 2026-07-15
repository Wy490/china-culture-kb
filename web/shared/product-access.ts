import type { ProductFeatureFlag, ProductRoleId } from './product-navigation.js';

export type { ProductFeatureFlag, ProductRoleId } from './product-navigation.js';

export type ProductAccessMode = 'disabled' | 'required';

export type ProductResourceType = 'story_project' | 'series_project';

export type ProductAuthenticationMethod =
  | 'local_bypass'
  | 'static_registry_token'
  | 'signed_session';

export interface ProductSignedSessionPayload {
  schema_version: 'story-agent-product-signed-session/v1';
  session_id: string;
  actor_id: string;
  issuer: string;
  audience: string;
  issued_at: number;
  expires_at: number;
}

export interface ProductResourceOwnership {
  schema_version: 'story-agent-product-resource-ownership/v1';
  organization_id: string;
  owner_actor_id: string;
  member_actor_ids: string[];
}

export interface ProductResourceBinding extends ProductResourceOwnership {
  resource_type: ProductResourceType;
  resource_id: string;
}

export type ProductPermission =
  | 'story:create'
  | 'project:read'
  | 'project:write'
  | 'material:review'
  | 'material:operations'
  | 'material:sign'
  | 'production:read'
  | 'production:write'
  | 'production:operate'
  | 'review:read'
  | 'review:blind'
  | 'review:operate'
  | 'review:sign'
  | 'release:operate'
  | 'system:operate'
  | 'access:audit:read';

export const PRODUCT_ROLE_PERMISSIONS: Readonly<Record<ProductRoleId, readonly ProductPermission[]>> = {
  creator: ['story:create', 'project:read', 'project:write', 'production:read', 'production:write'],
  research_editor: ['project:read', 'material:review', 'material:operations', 'review:read', 'review:operate'],
  director_reviewer: [
    'project:read',
    'production:read',
    'production:write',
    'production:operate',
    'review:read',
    'review:blind',
    'review:operate',
    'review:sign',
  ],
  cultural_fact_reviewer: [
    'project:read',
    'material:review',
    'material:operations',
    'material:sign',
    'review:read',
    'review:blind',
    'review:operate',
    'review:sign',
  ],
  production_operator: [
    'project:read',
    'project:write',
    'production:read',
    'production:write',
    'production:operate',
    'review:read',
    'review:operate',
    'material:operations',
    'release:operate',
  ],
  administrator: [
    'story:create',
    'project:read',
    'project:write',
    'material:review',
    'material:operations',
    'material:sign',
    'production:read',
    'production:write',
    'production:operate',
    'review:read',
    'review:blind',
    'review:operate',
    'review:sign',
    'release:operate',
    'system:operate',
    'access:audit:read',
  ],
};

export interface ProductAccessActor {
  actor_id: string;
  display_name: string;
  organization_id: string;
  role: ProductRoleId;
  enabled_feature_flags: ProductFeatureFlag[];
}

export interface ProductAccessContext {
  schema_version: 'story-agent-product-access-context/v1';
  mode: ProductAccessMode;
  production_enforced: boolean;
  authenticated: boolean;
  authentication_method: ProductAuthenticationMethod;
  actor: ProductAccessActor | null;
  permissions: ProductPermission[];
  request_role_headers_trusted: false;
  credit_boundary: 'access control does not grant human review, professional pass or signed release credit';
}

export interface ProductAccessReadiness {
  schema_version: 'story-agent-product-access-readiness/v1';
  mode: ProductAccessMode;
  production_enforced: boolean;
  registry_configured: boolean;
  registry_valid: boolean;
  active_actor_count: number;
  registered_resource_count: number;
  token_hash_only: true;
  signed_session_issuer_configured: boolean;
  signed_session_issuer_valid: boolean;
  signed_session_max_ttl_seconds: number;
  signed_session_actor_revocation_supported: true;
  actors_with_session_not_before_count: number;
  real_session_revocation_verified: false;
  static_tokens_allowed_in_production: boolean;
  login_handoff_configured: boolean;
  login_handoff_valid: boolean;
  real_user_login_verified: false;
  resource_ownership_enforced: boolean;
  durable_audit_configured: boolean;
  durable_audit_path_absolute: boolean;
  durable_audit_path_writable: boolean;
  durable_audit_rotation_mode: 'size_external_retention' | null;
  durable_audit_rotation_configured: boolean;
  durable_audit_max_bytes: number | null;
  durable_audit_retention_days: number | null;
  durable_audit_archives_deleted_by_application: false;
  durable_audit_required: boolean;
  ready_for_production: boolean;
  blockers: string[];
  request_role_headers_trusted: false;
  real_credit_granted: false;
}

export interface ProductLoginHandoff {
  schema_version: 'story-agent-product-login-handoff/v1';
  mode: ProductAccessMode;
  login_required: boolean;
  provider_configured: boolean;
  provider_valid: boolean;
  redirect_url: string | null;
  return_to: string;
  return_to_parameter: 'return_to';
  session_cookie: {
    name: 'story_agent_session';
    http_only: true;
    same_site: 'Lax';
    secure_required_in_production: true;
  };
  blockers: string[];
  request_role_headers_trusted: false;
  real_login_verified: false;
  real_credit_granted: false;
}

export type ProductResourceOwnershipAuditStatus =
  | 'consistent'
  | 'stored_only'
  | 'registry_managed_legacy'
  | 'unbound'
  | 'conflict'
  | 'invalid_metadata'
  | 'orphaned_registry_binding';

export type ProductResourceOwnershipMigrationAction =
  | 'none'
  | 'persist_registered_ownership'
  | 'assign_ownership_manually'
  | 'resolve_binding_conflict_manually'
  | 'repair_invalid_metadata_manually'
  | 'remove_or_restore_orphaned_binding_manually';

export interface ProductResourceOwnershipAuditItem {
  resource_type: ProductResourceType;
  resource_id: string;
  status: ProductResourceOwnershipAuditStatus;
  stored_ownership: ProductResourceOwnership | null;
  registered_ownership: ProductResourceOwnership | null;
  access_enforcement_ready: boolean;
  migration_action: ProductResourceOwnershipMigrationAction;
  blockers: string[];
  automatic_owner_assignment: false;
  writeback_performed: false;
}

export interface ProductResourceOwnershipMigrationManifest {
  schema_version: 'story-agent-product-resource-ownership-migration-manifest/v1';
  generated_at: string;
  read_only: true;
  automatic_owner_assignment: false;
  writeback_performed: false;
  action_count: number;
  actions: ProductResourceOwnershipAuditItem[];
  credit_boundary: 'migration audit is machine evidence only and grants no human review, professional pass or signed release credit';
}

export interface ProductResourceOwnershipAuditReport {
  schema_version: 'story-agent-product-resource-ownership-audit/v1';
  generated_at: string;
  read_only: true;
  discovered_resource_count: number;
  access_enforcement_ready_count: number;
  registry_managed_legacy_count: number;
  unbound_count: number;
  conflict_count: number;
  invalid_metadata_count: number;
  orphaned_registry_binding_count: number;
  ready_for_enforced_access: boolean;
  ready_for_production: boolean;
  blockers: string[];
  items: ProductResourceOwnershipAuditItem[];
  migration_manifest: ProductResourceOwnershipMigrationManifest;
  automatic_owner_assignment: false;
  writeback_performed: false;
  real_credit_granted: false;
}

export interface ProductResourceOwnershipMigrationRecord {
  schema_version: 'story-agent-product-resource-ownership-migration-record/v1';
  migration_id: string;
  migrated_at: string;
  migrated_by_actor_id: string;
  review_reference: string;
  previous_metadata_sha256: string;
  real_credit_granted: false;
}

export interface ProductResourceOwnershipMigrationRequest {
  schema_version: 'story-agent-product-resource-ownership-migration-request/v1';
  migration_id: string;
  resource_type: ProductResourceType;
  resource_id: string;
  expected_metadata_sha256: string;
  ownership: ProductResourceOwnership;
  review_reference: string;
  operator_confirmation: 'ownership_reviewed';
  dry_run: boolean;
}

export interface ProductResourceOwnershipMigrationResult {
  schema_version: 'story-agent-product-resource-ownership-migration-result/v1';
  evaluated_at: string;
  migration_id: string;
  resource_type: ProductResourceType;
  resource_id: string;
  requested_by_actor_id: string;
  requested_by_organization_id: string;
  dry_run: boolean;
  write_enabled: boolean;
  status_before: ProductResourceOwnershipAuditStatus | 'already_migrated';
  expected_metadata_sha256: string;
  actual_metadata_sha256: string | null;
  resulting_metadata_sha256: string | null;
  blockers: string[];
  preflight_ready: boolean;
  applied: boolean;
  idempotent_replay: boolean;
  durable_intent_written: boolean;
  durable_completion_written: boolean;
  automatic_owner_assignment: false;
  ownership_overwrite_allowed: false;
  real_credit_granted: false;
}

export interface ProductAccessAuditEvent {
  schema_version: 'story-agent-product-access-audit-event/v1';
  event_id: string;
  occurred_at: string;
  request_id: string;
  access_mode: ProductAccessMode;
  decision: 'allowed' | 'denied';
  reason: string;
  authentication_method: ProductAuthenticationMethod;
  actor_id?: string;
  organization_id?: string;
  role?: ProductRoleId;
  method: string;
  path: string;
  required_permission: ProductPermission;
  required_feature_flag?: ProductFeatureFlag;
  resource_type?: ProductResourceType;
  resource_id?: string;
  resource_organization_id?: string;
  durable_written: boolean;
  real_credit_granted: false;
}

export function productRoleHasPermission(role: ProductRoleId, permission: ProductPermission): boolean {
  return PRODUCT_ROLE_PERMISSIONS[role].includes(permission);
}
