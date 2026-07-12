import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const cardsPath = path.join(repoRoot, 'data', 'production-cards', 'heritage-promo-golden-cards.json');
const fixturesPath = path.join(repoRoot, 'data', 'production-cards', 'heritage-promo-golden-regression-fixtures.json');

const MEDICAL_INSTRUCTION_PATTERN =
  /(疗效承诺|正骨操作|徒手复位|药方比例|剂量|每日\d+次|每天\d+次|\d+\s*(克|毫升)|内服|外敷|操作教程|患者姓名|身份证|病历号)/;

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function filled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.every(item => typeof item === 'string' ? item.trim().length > 0 : Boolean(item));
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function audienceSceneText(scene: JsonRecord): string {
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

describe('heritage promo golden production cards', () => {
  it('fills required heritage promo fields with process, consent, and risk detail', () => {
    const data = readJson(cardsPath);

    expect(data.video_type).toBe('heritage_promo');
    expect(data.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(data.cards).toHaveLength(10);

    for (const card of data.cards as JsonRecord[]) {
      expect(card.field_completion.filled_required_field_count).toBe(data.required_fields.length);
      expect(card.field_completion.missing_required_fields).toEqual([]);

      for (const field of data.required_fields as string[]) {
        expect(filled(card.material_fields[field]), `${card.card_id} missing ${field}`).toBe(true);
      }

      expect(card.material_fields.process_steps.length).toBeGreaterThanOrEqual(5);
      expect(card.material_fields.hand_actions.length).toBeGreaterThanOrEqual(5);
      expect(card.material_fields.community_or_practitioner_consent.length).toBeGreaterThanOrEqual(3);
      expect(card.material_fields.production_risks.length).toBeGreaterThanOrEqual(4);
      expect(card.evidence_boundaries.forbidden_claims.length).toBeGreaterThan(0);
    }
  });

  it('keeps sampled promo fixtures aligned with card ids and GEARS segments', () => {
    const cards = readJson(cardsPath);
    const fixtures = readJson(fixturesPath);
    const cardIds = new Set(cards.cards.map((card: JsonRecord) => card.card_id));

    expect(fixtures.fixtures).toHaveLength(3);

    for (const fixture of fixtures.fixtures as JsonRecord[]) {
      const promo = fixture.promo;
      const scenes = promo.scene_breakdown;
      const segments = promo.gears_segments;
      const sceneIds = new Set(scenes.map((scene: JsonRecord) => scene.scene_id));

      expect(cardIds.has(fixture.card_id)).toBe(true);
      expect(promo.video_type).toBe('heritage_promo');
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes.length).toBeLessThanOrEqual(5);
      expect(segments).toHaveLength(scenes.length);
      expect(promo.quality_report.known_gaps.length).toBeGreaterThan(0);
      expect(promo.quality_report.human_review_required).toBe(true);

      for (const scene of scenes as JsonRecord[]) {
        expect(scene.location).toBeTruthy();
        expect(scene.plot).toBeTruthy();
        expect(scene.key_action).toBeTruthy();
        expect(scene.visual_prompt).toBeTruthy();
        expect(scene.camera_suggestion).toBeTruthy();
      }

      for (const segment of segments as JsonRecord[]) {
        expect(sceneIds.has(segment.source_scene_id)).toBe(true);
        expect(segment.script_text).toBeTruthy();
        expect(segment.segment_prompt_hint).toBeTruthy();
      }
    }
  });

  it('keeps the Miao medicine fixture as cultural documentation, not medical instruction', () => {
    const fixtures = readJson(fixturesPath);
    const fixture = (fixtures.fixtures as JsonRecord[]).find(item =>
      item.card_id === 'heritage-promo-golden-xiangxi-miao-medicine-boundary'
    );

    expect(fixture).toBeTruthy();
    expect(fixture!.promo.quality_report.medical_review_required).toBe(true);

    const sceneAndSegmentText = [
      fixture!.promo.full_text,
      ...(fixture!.promo.scene_breakdown as JsonRecord[]).map(audienceSceneText),
      ...(fixture!.promo.gears_segments as JsonRecord[]).map(segment => [
        segment.script_text,
        segment.segment_prompt_hint,
      ].join('\n')),
    ].join('\n');

    expect(sceneAndSegmentText).not.toMatch(MEDICAL_INSTRUCTION_PATTERN);
    expect(sceneAndSegmentText).toContain('不公开配方');
    expect(sceneAndSegmentText).toContain('镜头停在诊室门外');
  });

  it('keeps the Tujia hand-waving fixture consent-led and publicly bounded', () => {
    const fixtures = readJson(fixturesPath);
    const fixture = (fixtures.fixtures as JsonRecord[]).find(item =>
      item.card_id === 'heritage-promo-golden-tujia-hand-waving-ritual'
    );

    expect(fixture).toBeTruthy();
    expect(fixture!.promo.quality_report.community_consent_review_required).toBe(true);

    const sceneAndSegmentText = [
      fixture!.promo.full_text,
      ...(fixture!.promo.scene_breakdown as JsonRecord[]).map(audienceSceneText),
      ...(fixture!.promo.gears_segments as JsonRecord[]).map(segment => [
        segment.script_text,
        segment.segment_prompt_hint,
      ].join('\n')),
    ].join('\n');

    expect(sceneAndSegmentText).toContain('授权单');
    expect(sceneAndSegmentText).toContain('公开');
    expect(sceneAndSegmentText).toContain('未授权');
  });
});
