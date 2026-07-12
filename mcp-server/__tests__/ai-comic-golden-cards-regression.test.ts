import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSeedancePrompt } from '../src/tools/generate-seedance-prompt.js';

const INTERNAL_PROMPT_PATTERN =
  /(质量信号|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|知识库|用户大纲|生成优先级|资料显示|具体细节请核实来源|确证史实|分析|TODO|待补|本场景基于)/;

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const cardsPath = path.join(repoRoot, 'data', 'production-cards', 'ai-comic-drama-golden-cards.json');
const fixturesPath = path.join(repoRoot, 'data', 'production-cards', 'ai-comic-drama-golden-regression-fixtures.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('AI comic golden production card regression fixtures', () => {
  it('keeps sampled fixtures aligned with production cards and GEARS scene contracts', () => {
    const cards = readJson(cardsPath);
    const fixtures = readJson(fixturesPath);
    const cardIds = new Set(cards.cards.map((card: JsonRecord) => card.card_id));

    expect(fixtures.fixtures).toHaveLength(3);

    for (const fixture of fixtures.fixtures as JsonRecord[]) {
      const story = fixture.story;
      const scenes = story.scene_breakdown;
      const segments = story.gears_segments;
      const sceneIds = new Set(scenes.map((scene: JsonRecord) => scene.scene_id));

      expect(cardIds.has(fixture.card_id)).toBe(true);
      expect(story.story_blueprint.schema_version).toBe('story-blueprint/v1');
      expect(story.story_blueprint.evidence_boundaries.length).toBeGreaterThan(0);
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes.length).toBeLessThanOrEqual(5);
      expect(segments).toHaveLength(scenes.length);

      for (const scene of scenes as JsonRecord[]) {
        expect(scene.location).toBeTruthy();
        expect(scene.plot).toBeTruthy();
        expect(scene.key_action).toBeTruthy();
        expect(scene.visual_prompt).toBeTruthy();
        expect(scene.camera_suggestion).toBeTruthy();
        expect(scene.visual_prompt).not.toMatch(INTERNAL_PROMPT_PATTERN);
      }

      for (const segment of segments as JsonRecord[]) {
        expect(sceneIds.has(segment.source_scene_id)).toBe(true);
        expect(segment.script_text).toBeTruthy();
        expect(segment.segment_prompt_hint).toBeTruthy();
      }
    }
  });

  it('generates clean Seedance prompt packages from sampled regression stories', async () => {
    const fixtures = readJson(fixturesPath);

    for (const fixture of fixtures.fixtures as JsonRecord[]) {
      const story = fixture.story;
      const result = await generateSeedancePrompt({
        story_json: JSON.stringify(story),
        include_markdown: false,
      });

      expect(result.source).toBe('story_json');
      expect(result.validation_summary.shot_count).toBe(story.scene_breakdown.length);
      expect(result.validation_summary.over_limit).toBe(false);
      expect(result.package.shot_units).toHaveLength(story.scene_breakdown.length);
      expect(result.package.markdown).toBeUndefined();
      expect(result.package.validation_notes.join('\n')).not.toMatch(INTERNAL_PROMPT_PATTERN);

      for (const unit of result.package.shot_units) {
        expect(unit.characters.length).toBeGreaterThan(0);
        expect(unit.location).toBeTruthy();
        expect(unit.seedance_prompt).toContain('生成 ');
        expect(unit.seedance_prompt).toContain('AI漫剧/影视分镜');
        expect(unit.seedance_prompt).not.toMatch(INTERNAL_PROMPT_PATTERN);
        expect(unit.visual_prompt).not.toMatch(INTERNAL_PROMPT_PATTERN);
        expect(unit.material_validation.missing_required_slots).toEqual([]);
      }
    }
  });
});
