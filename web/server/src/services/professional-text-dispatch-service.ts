import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type {
  KnowledgeSupplementTask,
  ProfessionalTextPackage,
  StoryGenerateResult,
  SupportedDuration,
} from '@shared/types.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';
import { buildAiComicDramaProfessionalTextPackage } from './professional-ai-comic-drama-pipeline-service.js';
import { buildChildrenStoryProfessionalTextPackage } from './professional-children-story-pipeline-service.js';
import { buildCityBrandPromoProfessionalTextPackage } from './professional-city-brand-promo-pipeline-service.js';
import { buildCulturePromoProfessionalTextPackage } from './professional-culture-promo-pipeline-service.js';
import { buildDocumentaryShortProfessionalTextPackage } from './professional-documentary-short-pipeline-service.js';
import { buildEducationTrainingProfessionalTextPackage } from './professional-education-training-pipeline-service.js';
import {
  type ProfessionalEvidenceResolution,
  resolveProfessionalEvidenceForStory,
} from './professional-evidence-resolver-service.js';
import { buildExplainerVideoProfessionalTextPackage } from './professional-explainer-video-pipeline-service.js';
import { buildHeritagePromoProfessionalTextPackage } from './professional-heritage-promo-pipeline-service.js';
import { buildHistoricalDramaProfessionalTextPackage } from './professional-historical-drama-pipeline-service.js';
import { buildLandscapeMoodProfessionalTextPackage } from './professional-landscape-mood-pipeline-service.js';
import { buildLectureVideoProfessionalTextPackage } from './professional-lecture-video-pipeline-service.js';
import { buildLegendStoryProfessionalTextPackage } from './professional-legend-story-pipeline-service.js';
import { buildSceneShortProfessionalTextPackage } from './professional-scene-short-pipeline-service.js';
import { buildSocialShortProfessionalTextPackage } from './professional-social-short-pipeline-service.js';
import { buildCharacterStoryProfessionalTextPackage } from './professional-text-pipeline-service.js';

export interface ProfessionalTextDispatchResult {
  schema_version: 'professional-text-dispatch/v1';
  package: ProfessionalTextPackage;
  supplement_tasks: KnowledgeSupplementTask[];
  evidence_resolution: ProfessionalEvidenceResolution;
}

export function buildProfessionalTextPackageForStory(
  story: StoryGenerateResult,
  resolvedEvidence = resolveProfessionalEvidenceForStory(story),
): ProfessionalTextPackage {
  return dispatchProfessionalTextPackageForStory(story, resolvedEvidence).package;
}

export function dispatchProfessionalTextPackageForStory(
  story: StoryGenerateResult,
  resolvedEvidence = resolveProfessionalEvidenceForStory(story),
): ProfessionalTextDispatchResult {
  if (resolvedEvidence.video_type !== story.video_type || resolvedEvidence.payload.video_type !== story.video_type) {
    throw new Error(`Professional evidence type ${resolvedEvidence.video_type} does not match story type ${story.video_type}`);
  }
  const profile = getGenreStoryProfile(story.video_type);
  const professionalStory = withProfessionalSceneBoundaries(story);
  const common = {
    story: professionalStory,
    target_audience: story.target_audience || '中国文化数字内容观众',
    platform: 'Story Agent → Seedance 前置制作',
    target_duration: story.story_blueprint?.target_duration || '3分钟' as SupportedDuration,
    communication_goal: story.communication_goal || story.theme,
    production_goal: '生成可校验、可分场、可交给 GEARS/Seedance 的专业文本包。',
    audience_promise: profile.narrative_promise,
    truth_mode: story.truth_mode,
    research: resolvedEvidence.research,
  };
  const payload = resolvedEvidence.payload;
  let professionalPackage: ProfessionalTextPackage;

  switch (payload.video_type) {
    case 'character_story':
      professionalPackage = buildCharacterStoryProfessionalTextPackage({
        ...common,
        character_evidence: payload.evidence,
      });
      break;
    case 'historical_drama':
      professionalPackage = buildHistoricalDramaProfessionalTextPackage({
        ...common,
        historical_evidence: payload.evidence,
      });
      break;
    case 'legend_story':
      professionalPackage = buildLegendStoryProfessionalTextPackage({
        ...common,
        legend_evidence: payload.evidence,
      });
      break;
    case 'children_story':
      professionalPackage = buildChildrenStoryProfessionalTextPackage({
        ...common,
        children_evidence: payload.evidence,
      });
      break;
    case 'ai_comic_drama':
      professionalPackage = buildAiComicDramaProfessionalTextPackage({
        ...common,
        comic_evidence: payload.evidence,
      });
      break;
    case 'culture_promo':
      professionalPackage = buildCulturePromoProfessionalTextPackage({
        ...common,
        promo_evidence: payload.evidence,
      });
      break;
    case 'heritage_promo':
      professionalPackage = buildHeritagePromoProfessionalTextPackage({
        ...common,
        heritage_evidence: payload.evidence,
      });
      break;
    case 'city_brand_promo':
      professionalPackage = buildCityBrandPromoProfessionalTextPackage({
        ...common,
        city_evidence: payload.evidence,
      });
      break;
    case 'social_short':
      professionalPackage = buildSocialShortProfessionalTextPackage({
        ...common,
        social_evidence: payload.evidence,
      });
      break;
    case 'documentary_short':
      professionalPackage = buildDocumentaryShortProfessionalTextPackage({
        ...common,
        documentary_evidence: payload.evidence,
      });
      break;
    case 'explainer_video':
      professionalPackage = buildExplainerVideoProfessionalTextPackage({
        ...common,
        explainer_evidence: payload.evidence,
      });
      break;
    case 'lecture_video':
      professionalPackage = buildLectureVideoProfessionalTextPackage({
        ...common,
        lecture_evidence: payload.evidence,
      });
      break;
    case 'education_training':
      professionalPackage = buildEducationTrainingProfessionalTextPackage({
        ...common,
        training_evidence: payload.evidence,
      });
      break;
    case 'scene_short':
      professionalPackage = buildSceneShortProfessionalTextPackage({
        ...common,
        scene_evidence: payload.evidence,
      });
      break;
    case 'landscape_mood':
      professionalPackage = buildLandscapeMoodProfessionalTextPackage({
        ...common,
        landscape_evidence: payload.evidence,
      });
      break;
  }

  const now = story.professional_text_package?.updated_at
    ?? resolvedEvidence.resolved_at;
  professionalPackage = {
    ...professionalPackage,
    story_id: story.storyId,
    project_id: story.project_id,
    created_at: story.professional_text_package?.created_at ?? now,
    updated_at: now,
  };
  ProfessionalTextPackageSchema.parse(professionalPackage);

  return {
    schema_version: 'professional-text-dispatch/v1',
    package: professionalPackage,
    supplement_tasks: resolvedEvidence.supplement_tasks,
    evidence_resolution: resolvedEvidence,
  };
}

function withProfessionalSceneBoundaries(story: StoryGenerateResult): StoryGenerateResult {
  return {
    ...story,
    scene_breakdown: story.scene_breakdown.map(scene => ({
      ...scene,
      source_entries: scene.source_entries?.length ? scene.source_entries : [story.source_entry],
      factual_basis: scene.factual_basis?.trim()
        || `本场只沿用「${story.source_entry}」可支持的文化背景；具体人物动作、对白与镜头次序不视为确证事实。`,
      fictionalized_elements: scene.fictionalized_elements?.length
        ? scene.fictionalized_elements
        : ['人物行动、对白、转场和镜头次序为当前项目的可追踪创作组织。'],
    })),
  };
}
