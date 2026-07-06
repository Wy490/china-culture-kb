import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDomainPackProductionHealthReport,
  getDomainPackProductionHealthToolResult,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPackHealthToolResult,
} from './production-health-reports.js';

let tmpRoot = '';
let dataRoot = '';
const previousKbRoot = process.env.KB_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-production-health-reports-'));
  dataRoot = path.join(tmpRoot, 'data');
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('production health reports', () => {
  it('fails closed when production pack and Domain Pack files are missing', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthReport();
    const domainPackHealth = getDomainPackProductionHealthReport();

    expect(productionMaterialPackHealth).toMatchObject({
      schema_version: 'production-material-pack-health/v1',
      status: 'failed',
      pack_count: 0,
      covered_required_video_types: [],
      production_ready_core_video_types: [],
    });
    expect(productionMaterialPackHealth.required_video_types).toHaveLength(8);
    expect(productionMaterialPackHealth.missing_required_video_types).toEqual(productionMaterialPackHealth.required_video_types);
    expect(productionMaterialPackHealth.issues).toHaveLength(8);
    expect(productionMaterialPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'heritage_promo',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'explainer_video',
      }),
    ]));

    expect(domainPackHealth).toMatchObject({
      schema_version: 'domain-pack-production-health/v1',
      status: 'failed',
      domain_id: 'china_culture',
      version: 'unknown',
      pack_count: 0,
      production_pack_count: 0,
      covered_required_pack_ids: [],
      production_ready_pack_ids: [],
    });
    expect(domainPackHealth.required_pack_ids).toHaveLength(8);
    expect(domainPackHealth.missing_required_pack_ids).toEqual(domainPackHealth.required_pack_ids);
    expect(domainPackHealth.issues).toHaveLength(8);
    expect(domainPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'heritage_process_pack',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'explainer_knowledge_structure_pack',
      }),
    ]));
  });

  it('renders markdown for standalone MCP health tool results by default', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthToolResult();
    const domainPackHealth = getDomainPackProductionHealthToolResult();

    expect(productionMaterialPackHealth.status).toBe('failed');
    expect(productionMaterialPackHealth.markdown).toContain('Production Material Pack Health');
    expect(productionMaterialPackHealth.markdown).toContain('missing_required_video_types');
    expect(productionMaterialPackHealth.markdown).toContain('heritage_promo');

    expect(domainPackHealth.status).toBe('failed');
    expect(domainPackHealth.markdown).toContain('Domain Pack Production Health');
    expect(domainPackHealth.markdown).toContain('missing_required_pack_ids');
    expect(domainPackHealth.markdown).toContain('heritage_process_pack');

    expect(getProductionMaterialPackHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();
    expect(getDomainPackProductionHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();
  });
});
