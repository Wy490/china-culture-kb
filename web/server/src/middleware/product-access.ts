import type { Request, RequestHandler } from 'express';
import { ErrorCodes, fail } from '@shared/types.js';
import {
  productRoleHasPermission,
  type ProductFeatureFlag,
  type ProductPermission,
  type ProductResourceBinding,
  type ProductResourceType,
} from '@shared/product-access.js';
import {
  getProductAccessContext,
  isDurableProductAccessAuditRequired,
  recordProductAccessAudit,
  resolveProductAccess,
} from '../services/product-access-service.js';
import {
  actorCanAccessProductResource,
  resolveProductResourceBinding,
} from '../services/product-resource-access-service.js';

type ProductResourceRequirement = {
  type: ProductResourceType;
  ids: (req: Request) => string | string[] | undefined | Promise<string | string[] | undefined>;
  required?: boolean;
};

type ProductAccessOptions = {
  feature_flag?: ProductFeatureFlag;
  resource?: ProductResourceRequirement;
};

function normalizedResourceIds(value: string | string[] | undefined): string[] {
  const values = typeof value === 'string' ? [value] : value ?? [];
  return [...new Set(values.map(item => item.trim()).filter(Boolean))];
}

export function requireProductAccess(
  permission: ProductPermission,
  options: ProductAccessOptions = {},
): RequestHandler {
  return async (req, res, next) => {
    const resolution = resolveProductAccess(req);
    if (!resolution.actor) {
      const audit = recordProductAccessAudit({
        req,
        resolution,
        decision: 'denied',
        reason: resolution.reason,
        permission,
        featureFlag: options.feature_flag,
        resourceType: options.resource?.type,
      });
      res.status(401).json(fail(
        ErrorCodes.ACCESS_UNAUTHENTICATED,
        'Authentication is required for this Story Agent task',
        { request_id: audit.request_id, reason: resolution.reason },
      ));
      return;
    }

    if (resolution.mode === 'required' && !productRoleHasPermission(resolution.actor.role, permission)) {
      const audit = recordProductAccessAudit({
        req,
        resolution,
        decision: 'denied',
        reason: 'required_permission_missing',
        permission,
        featureFlag: options.feature_flag,
        resourceType: options.resource?.type,
      });
      res.status(403).json(fail(
        ErrorCodes.ACCESS_FORBIDDEN,
        'The authenticated actor does not have permission for this Story Agent task',
        { request_id: audit.request_id, required_permission: permission },
      ));
      return;
    }

    if (
      resolution.mode === 'required'
      && options.feature_flag
      && !resolution.actor.enabled_feature_flags.includes(options.feature_flag)
    ) {
      const audit = recordProductAccessAudit({
        req,
        resolution,
        decision: 'denied',
        reason: 'required_feature_flag_missing',
        permission,
        featureFlag: options.feature_flag,
        resourceType: options.resource?.type,
      });
      res.status(403).json(fail(
        ErrorCodes.ACCESS_FORBIDDEN,
        'The authenticated actor does not have the required feature flag',
        { request_id: audit.request_id, required_feature_flag: options.feature_flag },
      ));
      return;
    }

    let auditedBinding: ProductResourceBinding | null = null;
    if (resolution.mode === 'required' && options.resource) {
      const resourceIds = normalizedResourceIds(await options.resource.ids(req));
      if (options.resource.required && resourceIds.length === 0) {
        const audit = recordProductAccessAudit({
          req,
          resolution,
          decision: 'denied',
          reason: 'resource_id_required',
          permission,
          featureFlag: options.feature_flag,
          resourceType: options.resource.type,
        });
        res.status(403).json(fail(
          ErrorCodes.ACCESS_RESOURCE_UNBOUND,
          'An explicitly bound project resource is required for this task',
          { request_id: audit.request_id, resource_type: options.resource.type },
        ));
        return;
      }

      for (const resourceId of resourceIds) {
        const resource = await resolveProductResourceBinding(options.resource.type, resourceId);
        if (!resource.binding) {
          const audit = recordProductAccessAudit({
            req,
            resolution,
            decision: 'denied',
            reason: resource.reason,
            permission,
            featureFlag: options.feature_flag,
            resourceType: options.resource.type,
            resourceId,
          });
          res.status(403).json(fail(
            ErrorCodes.ACCESS_RESOURCE_UNBOUND,
            'The requested project does not have a valid server-side ownership binding',
            { request_id: audit.request_id, resource_type: options.resource.type, resource_id: resourceId },
          ));
          return;
        }
        if (!actorCanAccessProductResource(resolution.actor, resource.binding)) {
          const audit = recordProductAccessAudit({
            req,
            resolution,
            decision: 'denied',
            reason: 'resource_actor_not_owner_or_member',
            permission,
            featureFlag: options.feature_flag,
            resourceType: options.resource.type,
            resourceId,
            resourceOrganizationId: resource.binding.organization_id,
          });
          res.status(403).json(fail(
            ErrorCodes.ACCESS_RESOURCE_FORBIDDEN,
            'The authenticated actor is not allowed to access this project resource',
            { request_id: audit.request_id, resource_type: options.resource.type, resource_id: resourceId },
          ));
          return;
        }
        auditedBinding ??= resource.binding;
      }
    }

    const audit = recordProductAccessAudit({
      req,
      resolution,
      decision: 'allowed',
      reason: auditedBinding ? 'resource_actor_authorized' : resolution.reason,
      permission,
      featureFlag: options.feature_flag,
      resourceType: auditedBinding?.resource_type,
      resourceId: auditedBinding?.resource_id,
      resourceOrganizationId: auditedBinding?.organization_id,
    });
    if (
      resolution.mode === 'required'
      && isDurableProductAccessAuditRequired()
      && !audit.durable_written
    ) {
      audit.decision = 'denied';
      audit.reason = 'durable_access_audit_unavailable';
      res.status(503).json(fail(
        ErrorCodes.ACCESS_AUDIT_UNAVAILABLE,
        'Durable access audit is required but unavailable',
        { request_id: audit.request_id },
      ));
      return;
    }
    res.locals.productAccess = getProductAccessContext(req);
    res.setHeader('x-story-agent-request-id', audit.request_id);
    next();
  };
}
