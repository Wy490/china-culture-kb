import { describe, expect, it } from 'vitest';
import type { GearsDeliveryUnit } from '@shared/types.js';
import {
  buildProductionShotPlan,
  canonicalShotIdForUnit,
  migrateV1ShotIds,
} from '../services/production-shot-plan-service.js';

function makeUnit(unitId: string, sourceSceneId: number): GearsDeliveryUnit {
  return {
    unit_id: unitId,
    shot_id: canonicalShotIdForUnit(unitId),
    source_scene_id: sourceSceneId,
    scene_name: '同一场景',
    character_names: [],
    suggested_duration_sec: 12,
    suggested_panel_count: 6,
    beat_count: 1,
    script_text: `交付单元 ${unitId}`,
  };
}

describe('production-shot-plan-service', () => {
  it('builds shot-plan/v2 from GEARS units and deterministically expands v1 scene shot ids', () => {
    const plan = buildProductionShotPlan(
      { storyId: 'story-shot-plan' },
      { units: [makeUnit('1.1', 1), makeUnit('1.2', 1), makeUnit('2', 2)] },
    );

    expect(plan).toMatchObject({
      schema_version: 'production-shot-plan/v2',
      storyId: 'story-shot-plan',
    });
    expect(plan.shots.map(shot => shot.shot_id)).toEqual(['shot-1.1', 'shot-1.2', 'shot-2']);
    expect(migrateV1ShotIds(['shot-1', 'shot-2'], plan)).toEqual(['shot-1.1', 'shot-1.2', 'shot-2']);
  });

  it('fails closed on a non-canonical or duplicate shot identity', () => {
    expect(() => buildProductionShotPlan(
      { storyId: 'story-invalid-shot' },
      { units: [{ ...makeUnit('1', 1), shot_id: 'shot-wrong' }] },
    )).toThrow('non-canonical shot_id');

    expect(() => buildProductionShotPlan(
      { storyId: 'story-duplicate-shot' },
      { units: [makeUnit('1', 1), makeUnit('1', 1)] },
    )).toThrow('Duplicate canonical shot_id');
  });
});
