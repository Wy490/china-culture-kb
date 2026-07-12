import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const cardsPath = path.join(repoRoot, 'data', 'production-cards', 'documentary-short-golden-cards.json');
const fixturesPath = path.join(repoRoot, 'data', 'production-cards', 'documentary-short-golden-regression-fixtures.json');

const INTERNAL_PROMPT_PATTERN =
  /(质量报告|来源说明|内部字段名|来源条目|生成优先级|资料显示|具体细节请核实来源|确证史实|分析|TODO|待补)/;
const YUEYANG_FALSE_PRESENCE_PATTERN =
  /(范仲淹(登上|站在|来到|亲临)岳阳楼|范仲淹在岳阳楼(现场)?(写|作|撰写))/;
const TRAUMA_UNSAFE_PATTERN =
  /(血腥特写|施暴细节|暴力复现画面|虚构幸存者证词|伪造证词|娱乐化表达|猎奇画面)/;
const WUCHANG_FLATTENED_FIRST_SHOT_PATTERN =
  /(第一枪(就是|确定是|毫无争议|唯一答案)|10 月 9 日起义|计划泄露当天起义|真实战斗影像)/;

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function filled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.every(item => typeof item === 'string' ? item.trim().length > 0 : Boolean(item));
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function sceneAudienceText(scene: JsonRecord): string {
  return [
    scene.title,
    scene.location,
    scene.plot,
    scene.key_action,
    scene.visual_prompt,
    scene.camera_suggestion,
    scene.dialogue_or_narration,
  ].filter(Boolean).join('\n');
}

describe('documentary short golden production cards', () => {
  it('fills required documentary fields with site, source, B-roll, and reconstruction boundaries', () => {
    const data = readJson(cardsPath);

    expect(data.video_type).toBe('documentary_short');
    expect(data.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(data.cards).toHaveLength(10);

    for (const card of data.cards as JsonRecord[]) {
      expect(card.field_completion.filled_required_field_count).toBe(data.required_fields.length);
      expect(card.field_completion.missing_required_fields).toEqual([]);

      for (const field of data.required_fields as string[]) {
        expect(filled(card.material_fields[field]), `${card.card_id} missing ${field}`).toBe(true);
      }

      expect(card.material_fields.real_world_site_or_object.length).toBeGreaterThanOrEqual(3);
      expect(card.material_fields.source_quotes_or_source_cues.length).toBeGreaterThanOrEqual(3);
      expect(card.material_fields.b_roll_plan.length).toBeGreaterThanOrEqual(5);
      expect(card.material_fields.reconstruction_boundary.length).toBeGreaterThanOrEqual(3);
      expect(card.material_fields.what_must_not_be_claimed.length).toBeGreaterThanOrEqual(4);
      expect(card.evidence_boundaries.forbidden_claims.length).toBeGreaterThan(0);
    }
  });

  it('keeps sampled documentary fixtures aligned with card ids and GEARS segments', () => {
    const cards = readJson(cardsPath);
    const fixtures = readJson(fixturesPath);
    const cardIds = new Set(cards.cards.map((card: JsonRecord) => card.card_id));

    expect(fixtures.fixtures).toHaveLength(3);

    for (const fixture of fixtures.fixtures as JsonRecord[]) {
      const documentary = fixture.documentary;
      const scenes = documentary.scene_breakdown;
      const segments = documentary.gears_segments;
      const sceneIds = new Set(scenes.map((scene: JsonRecord) => scene.scene_id));

      expect(cardIds.has(fixture.card_id)).toBe(true);
      expect(documentary.video_type).toBe('documentary_short');
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes.length).toBeLessThanOrEqual(5);
      expect(segments).toHaveLength(scenes.length);
      expect(documentary.quality_report.known_gaps.length).toBeGreaterThan(0);
      expect(documentary.quality_report.human_review_required).toBe(true);

      for (const scene of scenes as JsonRecord[]) {
        expect(scene.location).toBeTruthy();
        expect(scene.plot).toBeTruthy();
        expect(scene.key_action).toBeTruthy();
        expect(scene.visual_prompt).toBeTruthy();
        expect(scene.camera_suggestion).toBeTruthy();
        expect(sceneAudienceText(scene)).not.toMatch(INTERNAL_PROMPT_PATTERN);
      }

      for (const segment of segments as JsonRecord[]) {
        expect(sceneIds.has(segment.source_scene_id)).toBe(true);
        expect(segment.script_text).toBeTruthy();
        expect(segment.segment_prompt_hint).toBeTruthy();
      }
    }
  });

  it('keeps the Yueyang Tower fixture from turning text into witnessed presence', () => {
    const fixtures = readJson(fixturesPath);
    const fixture = (fixtures.fixtures as JsonRecord[]).find(item =>
      item.card_id === 'documentary-golden-yueyang-tower-text-site'
    );

    expect(fixture).toBeTruthy();
    const documentary = fixture!.documentary;
    const audienceText = [
      documentary.full_text,
      ...(documentary.scene_breakdown as JsonRecord[]).map(sceneAudienceText),
      ...(documentary.gears_segments as JsonRecord[]).map(segment => [
        segment.script_text,
        segment.segment_prompt_hint,
      ].join('\n')),
    ].join('\n');

    expect(audienceText).not.toMatch(YUEYANG_FALSE_PRESENCE_PATTERN);
    expect(audienceText).toContain('文本');
    expect(audienceText).toContain('传说');
  });

  it('keeps the Nanjing fixture restrained and evidence-led', () => {
    const fixtures = readJson(fixturesPath);
    const fixture = (fixtures.fixtures as JsonRecord[]).find(item =>
      item.card_id === 'documentary-golden-nanjing-massacre-memory-site'
    );

    expect(fixture).toBeTruthy();
    expect(fixture!.documentary.quality_report.sensitive_history_review_required).toBe(true);

    const documentary = fixture!.documentary;
    const audienceText = [
      documentary.full_text,
      ...(documentary.scene_breakdown as JsonRecord[]).map(sceneAudienceText),
      ...(documentary.gears_segments as JsonRecord[]).map(segment => [
        segment.script_text,
        segment.segment_prompt_hint,
      ].join('\n')),
    ].join('\n');

    expect(audienceText).not.toMatch(TRAUMA_UNSAFE_PATTERN);
    expect(audienceText).toContain('白花');
    expect(audienceText).toContain('审判档案');
  });

  it('keeps the Wuchang fixture from flattening contested first-shot details', () => {
    const fixtures = readJson(fixturesPath);
    const fixture = (fixtures.fixtures as JsonRecord[]).find(item =>
      item.card_id === 'documentary-golden-wuchang-uprising-red-building'
    );

    expect(fixture).toBeTruthy();
    expect(fixture!.documentary.quality_report.revolutionary_history_review_required).toBe(true);

    const documentary = fixture!.documentary;
    const audienceText = [
      documentary.full_text,
      ...(documentary.scene_breakdown as JsonRecord[]).map(sceneAudienceText),
      ...(documentary.gears_segments as JsonRecord[]).map(segment => [
        segment.script_text,
        segment.segment_prompt_hint,
      ].join('\n')),
    ].join('\n');

    expect(audienceText).not.toMatch(WUCHANG_FLATTENED_FIRST_SHOT_PATTERN);
    expect(audienceText).toContain('多说法');
    expect(audienceText).toContain('10 月 9 日');
    expect(audienceText).toContain('10 月 10 日');
  });
});
