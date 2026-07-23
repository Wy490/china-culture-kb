import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  saveAiComicSeriesProject,
} from '../services/ai-comic-series-service.js';
import { auditAiComicSeriesPremiseFidelity } from '../services/ai-comic-series-fidelity-service.js';
import {
  SHADOW_PUPPETRY_KEEPER_FORBIDDEN_TEMPLATE_ANCHORS,
  SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS,
  SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE,
} from './fixtures/shadow-puppetry-keeper-series-fixture.js';

const ORIGINAL_WEB_GENERATED_ROOT = process.env.WEB_GENERATED_ROOT;
let generatedRoot = '';

beforeAll(async () => {
  generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-premise-contract-'));
  process.env.WEB_GENERATED_ROOT = generatedRoot;
});

afterAll(async () => {
  if (ORIGINAL_WEB_GENERATED_ROOT === undefined) {
    delete process.env.WEB_GENERATED_ROOT;
  } else {
    process.env.WEB_GENERATED_ROOT = ORIGINAL_WEB_GENERATED_ROOT;
  }
  if (generatedRoot) await rm(generatedRoot, { recursive: true, force: true });
});

describe('AI comic series premise contract regression', () => {
  it('extracts named protagonists from common profession-role phrases', async () => {
    const cases = [
      {
        outline: '近未来海上城市停电后，记忆修理师顾弦发现失踪乘客的声音藏在废弃广播频段中。她与巡检员陆潮必须在三次潮汐前找出篡改航行记录的人。',
        title: '潮汐失忆局',
        expectedNames: ['顾弦', '陆潮'],
        expectedLead: '顾弦',
      },
      {
        outline: '长沙湘绣工作室面临修复期限，青年绣娘苏翎必须重新学习鬅毛针、掺针和劈丝。',
        title: '一线醒狮',
        expectedNames: ['苏翎'],
      },
      {
        outline: '少年药童小禾必须在日落前辨清草药并送回洗药池。',
        title: '白鹿送药记',
        expectedNames: ['小禾'],
      },
      {
        outline: '北宋南安军司理参军周敦颐面对一桩按律不该判死的案件，拒绝迎合上官王逵。',
        title: '告身不署',
        expectedNames: ['周敦颐'],
        expectedLead: '周敦颐',
      },
    ];

    for (const item of cases) {
      const result = await generateAiComicSeriesPlan({
        outline: item.outline,
        series_title: item.title,
        episode_count: 2,
        episode_duration_range_sec: { min: 60, max: 90 },
      });
      expect(result.ok).toBe(true);
      expect(result.data?.premise_contract?.locked_characters.map(character => character.name))
        .toEqual(expect.arrayContaining(item.expectedNames));
      if (item.expectedLead) expect(result.data?.main_characters[0]?.name).toBe(item.expectedLead);
      expect(auditAiComicSeriesPremiseFidelity(result.data!).hard_gate_passed).toBe(true);
    }
  });

  it('binds refusal-case foreshadowing to a planned long-running thread', async () => {
    const result = await generateAiComicSeriesPlan({
      outline: '北宋南安军司理参军周敦颐面对一桩按律不该判死的案件，拒绝迎合上官王逵，甚至取出告身准备辞官。',
      series_title: '告身不署',
      episode_count: 4,
      episode_duration_range_sec: { min: 75, max: 120 },
      pacing_profile: 'slow_burn',
    });

    expect(result.ok).toBe(true);
    const plan = result.data!;
    for (const episode of plan.episodes.filter(item => item.foreshadowing.length > 0)) {
      expect(episode.foreshadowing.every(text =>
        plan.plot_threads.some(thread => text.includes(thread.title))
      )).toBe(true);
    }
  });

  it('keeps the locked characters, rules, cost, and antagonistic forces in the 20-episode plan', async () => {
    const result = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);

    expect(result.ok).toBe(true);
    const plan = result.data!;
    const characterNames = plan.main_characters.map(character => character.name);
    const representativeEpisodes = [plan.episodes[0], plan.episodes[9], plan.episodes[19]];
    const representativeText = JSON.stringify(representativeEpisodes);

    expect(characterNames).toEqual(expect.arrayContaining([
      ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.characters,
    ]));
    for (const anchor of [
      ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.world_rules,
      ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.antagonistic_forces,
    ]) {
      expect(representativeText).toContain(anchor);
    }
    for (const pollutedAnchor of SHADOW_PUPPETRY_KEEPER_FORBIDDEN_TEMPLATE_ANCHORS) {
      expect(representativeText).not.toContain(pollutedAnchor);
    }
    expect(plan.premise_contract).toMatchObject({
      schema_version: 'series-premise-contract/v1',
      forbidden_substitutions: expect.arrayContaining(['少女', '阿湘', '拆迁']),
    });
    expect(plan.premise_contract?.locked_characters.map(character => character.name))
      .toEqual(expect.arrayContaining(['沈砚', '林灯']));
    expect(plan.premise_contract?.locked_characters.every(character => (
      character.required && character.evidence_span.includes(character.name)
    ))).toBe(true);
    expect(plan.premise_contract?.cultural_boundaries.map(boundary => boundary.truth_mode))
      .toEqual(expect.arrayContaining(['verified_fact', 'fictional_mechanism']));
    expect(representativeEpisodes.every(episode => episode.premise_anchor_ids?.length)).toBe(true);
  });

  it('hard-fails fidelity audit v2 when a required character, rule, or forbidden template is introduced', async () => {
    const result = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const plan = result.data!;
    const passingAudit = auditAiComicSeriesPremiseFidelity(plan);

    expect(passingAudit).toMatchObject({
      schema_version: 'ai-comic-series-premise-fidelity-audit/v2',
      hard_gate_passed: true,
      premise_coverage_score: 100,
      named_character_coverage: 100,
      world_rule_coverage: 100,
      antagonistic_force_coverage: 100,
      core_stakes_coverage: 100,
    });

    const withoutLinDeng = removePlanAnchor(plan, '林灯');
    const missingCharacterAudit = auditAiComicSeriesPremiseFidelity(withoutLinDeng);
    expect(missingCharacterAudit.hard_gate_passed).toBe(false);
    expect(missingCharacterAudit.missing_required_anchor_ids).toContain('character:林灯');

    const requiredRule = plan.premise_contract!.world_rules[0];
    const withoutWorldRule = removePlanAnchor(plan, requiredRule.statement);
    const missingRuleAudit = auditAiComicSeriesPremiseFidelity(withoutWorldRule);
    expect(missingRuleAudit.hard_gate_passed).toBe(false);
    expect(missingRuleAudit.missing_required_anchor_ids).toContain(`world_rule:${requiredRule.rule_id}`);

    const pollutedPlan = structuredClone(plan);
    pollutedPlan.episodes[0].main_conflict += '；阿湘接手拆迁守台任务。';
    const pollutedAudit = auditAiComicSeriesPremiseFidelity(pollutedPlan);
    expect(pollutedAudit.hard_gate_passed).toBe(false);
    expect(pollutedAudit.generic_substitution_issues.join('\n')).toMatch(/阿湘|拆迁/);
  });

  it('persists the premise contract and keeps structural and fidelity audits separate', async () => {
    const planResult = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const legacyCompatiblePlan = { ...planResult.data!, premise_contract: undefined };
    const saved = await saveAiComicSeriesProject({ plan: legacyCompatiblePlan });

    expect(saved.ok).toBe(true);
    expect(saved.data?.plan.premise_contract?.schema_version).toBe('series-premise-contract/v1');
    expect(saved.data?.series_quality_audit?.schema_version).toBe('ai-comic-series-quality-audit/v1');
    expect(saved.data?.premise_fidelity_audit).toMatchObject({
      schema_version: 'ai-comic-series-premise-fidelity-audit/v2',
      hard_gate_passed: true,
    });

    const loaded = await getAiComicSeriesProject(saved.data!.project.series_project_id);
    expect(loaded.data?.plan.premise_contract?.locked_characters.map(character => character.name))
      .toEqual(expect.arrayContaining(['沈砚', '林灯']));
    expect(loaded.data?.premise_fidelity_audit?.hard_gate_passed).toBe(true);
  });

  it('keeps E1, E10, and E20 audience stories on the locked rule-mystery premise', async () => {
    const planResult = await generateAiComicSeriesPlan(SHADOW_PUPPETRY_KEEPER_SERIES_FIXTURE);
    const saved = await saveAiComicSeriesProject({ plan: planResult.data! });
    const firstScenePlots: string[] = [];

    for (const episodeNo of [1, 10, 20]) {
      const episode = await generateAiComicEpisodeFromPlan({
        series_project_id: saved.data!.project.series_project_id,
        series_plan: planResult.data!,
        episode_no: episodeNo,
        output_gears_segments: true,
      });
      expect(episode.ok, JSON.stringify(episode.error)).toBe(true);
      const audienceText = JSON.stringify([
        episode.data?.full_text,
        episode.data?.scene_breakdown,
        episode.data?.gears_segments,
      ]);
      for (const anchor of [
        ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.characters,
        ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.world_rules,
        ...SHADOW_PUPPETRY_KEEPER_REQUIRED_ANCHORS.antagonistic_forces,
      ]) {
        expect(audienceText).toContain(anchor);
      }
      for (const pollutedAnchor of SHADOW_PUPPETRY_KEEPER_FORBIDDEN_TEMPLATE_ANCHORS) {
        expect(audienceText).not.toContain(pollutedAnchor);
      }
      firstScenePlots.push(episode.data!.scene_breakdown[0].plot);
    }

    expect(new Set(firstScenePlots).size).toBe(3);
  });
});

function removePlanAnchor<T extends { premise_contract?: unknown }>(plan: T, anchor: string): T {
  const contract = structuredClone(plan.premise_contract);
  const withoutContract = { ...structuredClone(plan), premise_contract: undefined };
  const stripped = JSON.parse(JSON.stringify(withoutContract).replaceAll(anchor, '[已删除设定锚点]')) as T;
  stripped.premise_contract = contract;
  return stripped;
}
