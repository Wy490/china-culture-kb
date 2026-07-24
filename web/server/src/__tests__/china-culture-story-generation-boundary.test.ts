import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chinaCultureDomainPack } from '../domains/china-culture/domain-pack.js';
import {
  applyProjectQualityRepairJson,
  generateProjectQualityRepairPrompt,
  getProject,
  repairProjectProductionBoard,
} from '../services/project-service.js';
import { revalidateStoryDomainRevision } from '../platform/story-domain-revision-safety.js';

describe('china_culture story generation boundary', () => {
  it('keeps the legacy import path as a facade and binds Domain Pack generation directly to the domain', async () => {
    const [legacySource, domainPackSource, generationSource, seriesSource, routeSource] = await Promise.all([
      readFile(new URL('../services/story-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../services/ai-comic-series-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../routes/outline.ts', import.meta.url), 'utf8'),
    ]);

    expect(legacySource).toContain('Compatibility facade');
    expect(legacySource).toContain('generateAndStoreChinaCultureStory as generateAndStoreStory');
    expect(legacySource).not.toContain('function ');
    expect(legacySource).not.toContain('prepareChinaCultureStoryGeneration(');
    expect(domainPackSource).toContain("from './story-generation-service.js'");
    expect(domainPackSource).not.toContain("from '../../services/story-service.js'");
    expect(domainPackSource).toContain('generateAndStoreChinaCultureStory(request');
    expect(generationSource).toContain('prepareChinaCultureStoryGeneration(request)');
    expect(generationSource).toContain('executeChinaCultureStoryGeneration({ request, preparation })');
    expect(generationSource).toContain('buildChinaCultureGeneratedStoryDocument({');
    expect(generationSource).toContain('orchestrateStoryPostGeneration({');
    expect(generationSource).toContain('evaluateReferenceGenerationSafety({');
    expect(generationSource).toContain('reference_trace: storyData.reference_trace');
    expect(generationSource).toContain(
      'similarity_evidence: preparation.referenceSimilarityEvidence',
    );
    expect(generationSource).toContain(
      'baseline_story: preparation.referenceBaselineStory',
    );
    expect(generationSource).toContain('validateChinaCultureStoryContent({');
    expect(generationSource).toContain('persistGeneratedStoryAndNotifyGears({');
    expect(generationSource.indexOf('options.transform_story_before_validation_and_persistence('))
      .toBeLessThan(generationSource.indexOf('evaluateReferenceGenerationSafety({'));
    expect(generationSource.indexOf('evaluateReferenceGenerationSafety({'))
      .toBeLessThan(generationSource.indexOf('validateChinaCultureStoryContent({'));
    expect(generationSource.indexOf('validateChinaCultureStoryContent({'))
      .toBeLessThan(generationSource.indexOf('persistGeneratedStoryAndNotifyGears({'));
    expect(seriesSource).toContain("from '../domains/china-culture/story-generation-service.js'");
    expect(seriesSource).toContain('generateAndStoreChinaCultureStory({');
    expect(seriesSource).toContain('transform_story_before_validation_and_persistence: story =>');
    expect(seriesSource).not.toContain('generateAndStoreStory({');
    expect(seriesSource).not.toContain('persistAiComicEpisodeStoryFile(');
    expect(routeSource).toContain('generateAiComicEpisodeFromPlan(req.body, { access_control: accessControl })');
    expect(routeSource).toContain('ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED');
  });

  it('rejects an unsafe consumer-finalized Story before creating Story or Project storage', async () => {
    const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
    const previousKbRoot = process.env.KB_ROOT;
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-pre-persist-safety-'));
    process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
    try {
      const result = await chinaCultureDomainPack.generateStory({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        outline: '少年在整理地方传说时发现版本冲突，决定逐条核对来源后再完成漫剧分集。',
        original_user_query: '创作一集强调来源核对和人物选择的原创文化漫剧。',
        output_gears_segments: false,
      }, {
        transform_story_before_validation_and_persistence: story => ({
          ...story,
          credibility_note: '最终化阶段错误移除了来源条目和可信度等级。',
          scene_breakdown: story.scene_breakdown.map(scene => ({
            ...scene,
            source_entries: [],
          })),
        }),
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DOMAIN_SAFETY_VALIDATION_FAILED');
      expect(result.error?.details).toMatchObject({
        passed: false,
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      });
      await expect(readdir(resolve(generatedRoot, 'stories'))).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readdir(resolve(generatedRoot, 'projects'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
      else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
      if (previousKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = previousKbRoot;
      await rm(generatedRoot, { recursive: true, force: true });
    }
  });

  it('uses china_culture revision guidance and revalidates source safety before a new version', async () => {
    const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
    const previousKbRoot = process.env.KB_ROOT;
    const previousProvider = process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-domain-revision-safety-'));
    process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'file';
    try {
      const generated = await chinaCultureDomainPack.generateStory({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'character_story',
        presentation_style: 'cinematic',
        outline: '周敦颐面对上级要求签署疑案判词，坚持核对案卷和证词，在辞官与守住判断之间作出选择，最终承担后果。',
        original_user_query: '写一个强调来源边界、具体行动和人物选择的文化人物短片。',
        output_gears_segments: true,
      });

      expect(generated.ok).toBe(true);
      const story = generated.data!;
      expect(story).toMatchObject({
        sourceDomain: 'china_culture',
        domain_safety: { domain: 'china_culture', passed: true },
      });

      const prompt = await generateProjectQualityRepairPrompt(story.project_id!, {
        include_story_json: false,
        include_markdown: false,
      });
      expect(prompt.ok).toBe(true);
      expect(prompt.data?.prompt).toContain('你是中国传统文化故事修复写手');
      expect(prompt.data?.prompt).toContain('scene_breakdown.source_entries');
      expect(prompt.data?.prompt).toContain('机器复验不能替代真人来源核验');
      expect(prompt.data?.prompt).toContain('story-domain-edit-persistence/v1');
      expect(prompt.data?.prompt).toContain('domain_source_write_allowed=false');
      expect(prompt.data?.prompt).toContain('knowledge_writeback_performed=false');
      expect(prompt.data?.prompt).not.toContain('data/provinces');
      expect(prompt.data?.prompt).not.toContain('用户原创故事修复写手');

      const missingSource = await revalidateStoryDomainRevision({
        ...story,
        source_entry: '不存在的领域来源条目',
      });
      expect(missingSource).toMatchObject({
        domain: 'china_culture',
        passed: false,
        blockers: [expect.objectContaining({ rule_id: 'DOMAIN-REVISION-SOURCE-ENTRY' })],
        real_credit_granted: false,
      });

      const unsafeRepair = await applyProjectQualityRepairJson(story.project_id!, {
        repaired_story_json: JSON.stringify({
          ...story,
          cultural_constraints: [],
          scene_breakdown: story.scene_breakdown.map(scene => ({
            ...scene,
            source_entries: [],
          })),
        }),
        apply: false,
        allow_no_improvement: true,
      });

      expect(unsafeRepair).toMatchObject({
        ok: false,
        error: {
          code: 'DOMAIN_SAFETY_VALIDATION_FAILED',
          details: {
            domain: 'china_culture',
            passed: false,
            blockers: expect.arrayContaining([
              expect.objectContaining({ rule_id: 'CC-S004-SOURCE-TRACE' }),
            ]),
          },
        },
      });
      expect((await getProject(story.project_id!)).data?.project.version_count).toBe(1);
    } finally {
      if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
      else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
      if (previousKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = previousKbRoot;
      if (previousProvider === undefined) delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
      else process.env.STORY_PROJECT_REPOSITORY_PROVIDER = previousProvider;
      await rm(generatedRoot, { recursive: true, force: true });
    }
  });

  it('revalidates persisted user-material sources without weakening missing-source protection', async () => {
    const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
    const previousKbRoot = process.env.KB_ROOT;
    const previousProvider = process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'story-agent-user-material-revision-'));
    process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'file';
    try {
      const generated = await chinaCultureDomainPack.generateStory({
        video_type: 'ai_comic_drama',
        presentation_style: 'ai_comic',
        creation_use_case: 'original_ai_comic',
        truth_mode: 'fictional_original',
        outline: '一个少年在长沙老街修复废弃戏台，在拆迁期限前完成一次皮影公开演出。',
        original_user_query: '生成一个用于完整前端流程验证的原创文化漫剧。',
        output_gears_segments: true,
      });

      expect(generated.ok).toBe(true);
      const story = generated.data!;
      expect(story).toMatchObject({
        sourceDomain: 'china_culture',
        truth_mode: 'fictional_original',
        domain_safety: { domain: 'china_culture', passed: true },
      });
      expect(story.source_entry).toContain('用户原创故事种子');

      const revalidated = await revalidateStoryDomainRevision(story);
      expect(revalidated).toMatchObject({
        domain: 'china_culture',
        passed: true,
        blockers: [],
        real_credit_granted: false,
      });

      const missingSource = await revalidateStoryDomainRevision({
        ...story,
        source_entry: '不存在的用户素材来源',
      });
      expect(missingSource).toMatchObject({
        domain: 'china_culture',
        passed: false,
        blockers: [expect.objectContaining({ rule_id: 'DOMAIN-REVISION-SOURCE-ENTRY' })],
      });

      const repaired = await repairProjectProductionBoard(story.project_id!, { apply_all: true });
      expect(repaired.ok).toBe(true);
      expect(repaired.data?.project.version_count).toBe(2);
    } finally {
      if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
      else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
      if (previousKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = previousKbRoot;
      if (previousProvider === undefined) delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
      else process.env.STORY_PROJECT_REPOSITORY_PROVIDER = previousProvider;
      await rm(generatedRoot, { recursive: true, force: true });
    }
  });
});
