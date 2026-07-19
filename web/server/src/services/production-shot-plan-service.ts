import type {
  GearsDeliveryPackage,
  GearsDeliveryUnit,
  ProductionShot,
  ProductionShotPlan,
  StoryGenerateResult,
} from '@shared/types.js';

/**
 * A GEARS delivery unit is the atomic production unit. Its canonical shot id
 * must therefore be stable across Seedance, boards, asset bindings and ledgers.
 */
export function canonicalShotIdForUnit(unitId: string): string {
  return `shot-${unitId.trim()}`;
}

export function buildProductionShotPlan(
  story: Pick<StoryGenerateResult, 'storyId'>,
  delivery: Pick<GearsDeliveryPackage, 'units'>,
): ProductionShotPlan {
  const shots = delivery.units.map(unit => productionShotFromDeliveryUnit(unit));
  const seen = new Set<string>();
  for (const shot of shots) {
    if (seen.has(shot.shot_id)) {
      throw new Error(`Duplicate canonical shot_id "${shot.shot_id}" in GEARS delivery`);
    }
    seen.add(shot.shot_id);
  }
  return {
    schema_version: 'production-shot-plan/v2',
    storyId: story.storyId,
    shots,
  };
}

export function productionShotFromDeliveryUnit(unit: GearsDeliveryUnit): ProductionShot {
  const canonicalShotId = canonicalShotIdForUnit(unit.unit_id);
  if (unit.shot_id && unit.shot_id !== canonicalShotId) {
    throw new Error(`GEARS unit "${unit.unit_id}" has non-canonical shot_id "${unit.shot_id}"`);
  }
  return {
    shot_id: unit.shot_id ?? canonicalShotId,
    source_scene_id: unit.source_scene_id,
    source_unit_id: unit.unit_id,
  };
}

/**
 * V1 stored scene-level ids (for example `shot-2`). A scene can now contain
 * several delivery units, so migration expands that legacy reference to each
 * deterministically ordered canonical shot belonging to the source scene.
 */
export function migrateV1ShotIds(legacyShotIds: string[], plan: ProductionShotPlan): string[] {
  const byId = new Set(plan.shots.map(shot => shot.shot_id));
  const migrated = legacyShotIds.flatMap(legacyShotId => {
    if (byId.has(legacyShotId)) return [legacyShotId];
    const sceneMatch = /^shot-(\d+)$/.exec(legacyShotId.trim());
    if (!sceneMatch) return [];
    const sceneId = Number(sceneMatch[1]);
    return plan.shots
      .filter(shot => shot.source_scene_id === sceneId)
      .map(shot => shot.shot_id);
  });
  return [...new Set(migrated)];
}
