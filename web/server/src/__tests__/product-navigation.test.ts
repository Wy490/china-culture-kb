import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRESERVED_STORY_AGENT_DEEP_ROUTES,
  PRODUCT_ROLES,
  PRODUCT_SECONDARY_NAVIGATION,
  PRODUCT_WORKSPACE_NAVIGATION,
  canAccessProductNavigationItem,
  productNavigationForWorkspace,
  productWorkspaceForPath,
} from '@shared/product-navigation.js';

describe('product navigation contract', () => {
  it('keeps exactly five user-facing primary workspaces without technical Stage or P labels', () => {
    expect(PRODUCT_WORKSPACE_NAVIGATION.map(item => item.label)).toEqual(['创作', '项目', '素材', '生产', '评审']);
    expect(PRODUCT_WORKSPACE_NAVIGATION).toHaveLength(5);
    expect(PRODUCT_WORKSPACE_NAVIGATION.some(item => /stage|\bP\d+/i.test(`${item.label} ${item.to}`))).toBe(false);
  });

  it('hides internal inspectors unless the internal tools feature flag is enabled', () => {
    const defaultProduction = productNavigationForWorkspace('production', {
      role: 'creator',
      enabled_feature_flags: [],
    });
    const internalProduction = productNavigationForWorkspace('production', {
      role: 'administrator',
      enabled_feature_flags: ['internal_story_tools'],
    });

    expect(defaultProduction.map(item => item.label)).toEqual([
      '项目生产',
      'Story Agent 运行',
      '修订与桌读',
    ]);
    expect(defaultProduction.every(item => !item.feature_flag)).toBe(true);
    expect(internalProduction.length).toBeGreaterThan(defaultProduction.length);
    expect(internalProduction.filter(item => item.feature_flag).every(item => item.feature_flag === 'internal_story_tools')).toBe(true);
  });

  it('defines six role views and requires both role permission and feature flag for internal tools', () => {
    expect(PRODUCT_ROLES.map(role => role.id)).toEqual([
      'creator',
      'research_editor',
      'director_reviewer',
      'cultural_fact_reviewer',
      'production_operator',
      'administrator',
    ]);

    const internalIntake = PRODUCT_SECONDARY_NAVIGATION.find(item => item.id === 'real_input_intake');
    expect(internalIntake).toBeDefined();
    expect(canAccessProductNavigationItem(internalIntake!, {
      role: 'administrator',
      enabled_feature_flags: [],
    })).toBe(false);
    expect(canAccessProductNavigationItem(internalIntake!, {
      role: 'creator',
      enabled_feature_flags: ['internal_story_tools'],
    })).toBe(false);
    expect(canAccessProductNavigationItem(internalIntake!, {
      role: 'administrator',
      enabled_feature_flags: ['internal_story_tools'],
    })).toBe(true);
  });

  it('gives each review role a focused task view without exposing unrelated release authority', () => {
    const culturalReview = productNavigationForWorkspace('review', {
      role: 'cultural_fact_reviewer',
      enabled_feature_flags: [],
    });
    const productionReview = productNavigationForWorkspace('review', {
      role: 'production_operator',
      enabled_feature_flags: [],
    });

    expect(culturalReview.map(item => item.id)).toEqual(['material_review', 'final_story_review']);
    expect(productionReview.map(item => item.id)).toEqual(['release_acceptance']);
  });

  it('maps deep links back to their task-oriented workspace', () => {
    expect(productWorkspaceForPath('/story/new')).toBe('creation');
    expect(productWorkspaceForPath('/projects/example')).toBe('projects');
    expect(productWorkspaceForPath('/knowledge/湖南')).toBe('materials');
    expect(productWorkspaceForPath('/story-agent/runs')).toBe('production');
    expect(productWorkspaceForPath('/story/stage6-exit-audit')).toBe('production');
    expect(productWorkspaceForPath('/story/stage8-operations')).toBe('review');
  });

  it('preserves every existing Stage 6-8 deep route while excluding them from primary navigation', () => {
    const routerSource = readFileSync(resolve(process.cwd(), '../client/src/router.ts'), 'utf8');
    expect(PRESERVED_STORY_AGENT_DEEP_ROUTES).toHaveLength(17);
    for (const path of PRESERVED_STORY_AGENT_DEEP_ROUTES) {
      expect(routerSource).toContain(`path: '${path}'`);
    }
    expect(PRODUCT_WORKSPACE_NAVIGATION.some(item => PRESERVED_STORY_AGENT_DEEP_ROUTES.includes(item.to))).toBe(false);
    expect(PRODUCT_SECONDARY_NAVIGATION.filter(item => item.feature_flag)).not.toHaveLength(0);
  });

  it('runs Track A E2E on isolated configurable ports without a fixed cookie URL', () => {
    const playwrightSource = readFileSync(resolve(process.cwd(), '../playwright.config.ts'), 'utf8');
    const viteSource = readFileSync(resolve(process.cwd(), '../client/vite.config.ts'), 'utf8');
    const e2eSource = readFileSync(resolve(process.cwd(), '../e2e/track-a.spec.ts'), 'utf8');
    const ciSource = readFileSync(resolve(process.cwd(), '../../scripts/story-agent-ci.mjs'), 'utf8');

    expect(playwrightSource).toContain("resolvePort('STORY_AGENT_E2E_CLIENT_PORT', 5173)");
    expect(playwrightSource).toContain("resolvePort('STORY_AGENT_E2E_SERVER_PORT', 3000)");
    expect(playwrightSource).toContain('VITE_API_PROXY_TARGET');
    expect(viteSource).toContain("resolvePort('VITE_DEV_PORT', 5173)");
    expect(viteSource).toContain("process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'");
    expect(e2eSource).toContain("domain: 'localhost'");
    expect(e2eSource).not.toContain("url: 'http://localhost:5173'");
    expect(ciSource).toContain("STORY_AGENT_E2E_CLIENT_PORT ??= '15173'");
    expect(ciSource).toContain("STORY_AGENT_E2E_SERVER_PORT ??= '13000'");
  });
});
