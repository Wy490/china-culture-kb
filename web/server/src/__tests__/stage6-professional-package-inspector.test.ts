import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ProfessionalTextPackage } from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage6RevisionsRouter } from '../routes/stage6-revisions.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';
import {
  getStage6ProfessionalPackageInspectorWorkspace,
  inspectStage6ProfessionalPackage,
} from '../services/stage6-professional-package-inspector-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const executionRoot = path.join(repoRoot, 'web/generated/stage6-revisions');

function revisionablePackage(): ProfessionalTextPackage {
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'character_story',
    package_id: 'package-real-001',
    project_id: 'real-project-001',
    now: '2026-07-12T02:00:00.000Z',
  });
  pkg.status = 'draft';
  pkg.full_text = '真实可修订初稿。人物进入现场，发现阻力并作出选择。';
  pkg.sequence_beats = [{
    beat_id: 'beat-1', order: 1, title: '选择', purpose: '建立人物命题', visible_action: '人物进入现场',
    conflict_discovery_or_instruction: '发现阻力', emotional_or_information_turn: '作出选择', evidence_ids: [],
  }];
  pkg.scene_breakdown = [{
    scene_id: 1, title: '现场', duration_sec: 30, location: '现场', time_of_day: '日', dramatic_function: '建立命题',
    plot: '人物发现阻力', key_action: '人物作出选择', characters: ['主角'], visual_prompt: '人物进入现场', camera_suggestion: '中景',
    cultural_note: '待核验',
  }];
  pkg.delivery_text_package.script_text = pkg.full_text;
  pkg.delivery_text_package.scene_units = [{
    scene_id: 1, script_text: pkg.full_text, visual_action: '人物作出选择', camera_intent: '中景', sound_intent: '同期声',
    continuity_notes: ['现场连续'], evidence_boundary_notes: ['待核验'],
  }];
  return pkg;
}

describe('Stage 6 ProfessionalTextPackage inspector', () => {
  it('returns a schema-valid skeleton that remains blocked and distinguishes source-file from canonical hashes', () => {
    const workspace = getStage6ProfessionalPackageInspectorWorkspace({
      videoType: 'landscape_mood',
      now: '2026-07-12T02:00:00.000Z',
    });

    expect(workspace.schema_version).toBe('story-agent-stage6-professional-package-inspector-workspace/v1');
    expect(workspace.selected_video_type).toBe('landscape_mood');
    expect(workspace.policy).toMatchObject({
      dry_run_only: true,
      input_files_are_not_persisted: true,
      p0_readiness_can_be_granted: false,
      canonical_hash_is_p0_source_file_hash: false,
      self_reported_professional_pass_is_credit: false,
    });
    expect(workspace.template_inspection).toMatchObject({
      schema_valid: true,
      p0_package_gate_passed: false,
      p0_readiness_granted: false,
      execution_started: false,
      verified_real_revision_credit: false,
      professional_passed: false,
    });
    expect(workspace.template_inspection.source_file_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(workspace.template_inspection.canonical_package_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(workspace.template_inspection.source_file_sha256).not.toBe(workspace.template_inspection.canonical_package_sha256);
  });

  it('passes only the P0 package subset while rejecting self-reported professional credit', () => {
    const pkg = revisionablePackage();
    pkg.quality_report.professional_passed = true;
    const raw = `${JSON.stringify(pkg, null, 2)}\n`;
    const result = inspectStage6ProfessionalPackage({
      request: {
        raw_json: raw,
        expected_project_id: 'real-project-001',
        expected_video_type: 'character_story',
      },
      now: '2026-07-12T02:00:00.000Z',
    });

    expect(result.source_file_sha256).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(result.schema_valid).toBe(true);
    expect(result.p0_package_gate_passed).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.package_summary.source_claimed_professional_passed).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'self_reported_professional_pass_excluded', blocking: false, gate: 'credit',
    }));
    expect(result).toMatchObject({
      input_persisted: false,
      p0_readiness_granted: false,
      execution_started: false,
      verified_real_revision_credit: false,
      professional_passed: false,
    });
  });

  it('returns structured blockers for malformed requests and invalid JSON', () => {
    expect(inspectStage6ProfessionalPackage({ request: {} }).issues[0].code).toBe('inspection_request_invalid');
    const invalidJson = inspectStage6ProfessionalPackage({
      request: { raw_json: '{', expected_project_id: 'real-project-001', expected_video_type: 'character_story' },
    });
    expect(invalidJson.schema_valid).toBe(false);
    expect(invalidJson.issues.map(item => item.code)).toContain('package_json_invalid');
    expect(invalidJson.professional_passed).toBe(false);
  });

  it('exposes template and validation routes without any persist or execute endpoint', async () => {
    const existedBefore = existsSync(executionRoot);
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage6-revisions', createStage6RevisionsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);

    const workspace = await request.get('/api/stage6-revisions/package-inspector?video_type=children_story');
    expect(workspace.status).toBe(200);
    expect(workspace.body.data.selected_video_type).toBe('children_story');
    const response = await request.post('/api/stage6-revisions/package-inspector/validate').send({
      raw_json: JSON.stringify(workspace.body.data.template),
      expected_project_id: '',
      expected_video_type: 'children_story',
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ input_persisted: false, p0_readiness_granted: false, professional_passed: false });
    expect((await request.post('/api/stage6-revisions/package-inspector/persist').send({})).status).toBe(404);
    expect((await request.post('/api/stage6-revisions/package-inspector/execute').send({})).status).toBe(404);
    expect(existsSync(executionRoot)).toBe(existedBefore);
  });
});
