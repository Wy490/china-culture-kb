import type {
  ProfessionalCoverageReport,
  ProfessionalQualityDimensionId,
  ProfessionalTextPackage,
  ProfessionalTextQualityReport,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface SocialShortBeat {
  beat_id: string;
  order: number;
  start_sec: number;
  end_sec: number;
  new_information: string;
  vertical_visual: string;
  caption: string;
  voiceover_or_dialogue: string;
  evidence_ids: string[];
  contrast_or_turn: string;
}

export interface SocialShortEvidence {
  target_duration_sec: number;
  hook_0_3s: string;
  hook_fact_evidence_ids: string[];
  core_message: string;
  beat_plan: SocialShortBeat[];
  central_contrast: string;
  shareable_line: string;
  interaction_question: string;
  platform_safety_notes: string[];
  scene_turns: Record<string, string>;
}

export interface SocialShortEvaluation {
  quality_report: ProfessionalTextQualityReport;
  coverage_report: ProfessionalCoverageReport;
}

const repairs: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长和传播目标。',
  full_text_not_final: '把提纲或素材列表改为可直接发布的完整短视频文本。',
  duration_out_of_range: '把专业版本控制在60至90秒，并同步节拍时间码。',
  hook_missing: '前三秒给出具体反差、问题或动作观看理由。',
  hook_fact_boundary_missing: '钩子绑定已知证据，不得扭曲事实、身份、地域或机构口径。',
  beat_plan_missing: '建立至少五段、顺序连续且覆盖全片的时间码节拍。',
  new_information_missing: '每个节拍补一个不同的新信息，删除同义重复。',
  contrast_missing: '明确可验证的反差或认识转折。',
  caption_missing: '逐节拍补可读短字幕。',
  vertical_visual_missing: '逐节拍补单一视觉重点和竖屏可见动作。',
  channel_division_missing: '让字幕、画面和声音各承担不同信息。',
  interaction_missing: '用具体互动问题承接核心信息。',
  platform_safety_missing: '补事实、机构口径、肖像版权或平台安全边界。',
  scene_action_or_turn_missing: '逐场补可见动作和信息转折。',
  truth_boundary_missing: '区分已核事实、宣传组织和未知项。',
};

const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (value: number, total: number) => Math.round(value / Math.max(1, total) * 100);
const isFinalText = (text: string) => text.trim().length >= 90 && !/^(?:大纲|摘要|资料|节拍表)[:：]/u.test(text.trim());

export function evaluateSocialShortProfessionalText(input: {
  package: ProfessionalTextPackage;
  social_evidence: SocialShortEvidence;
}): SocialShortEvaluation {
  const professionalPackage = input.package;
  if (professionalPackage.video_type !== 'social_short') throw new Error('social_short only');
  const evidence = input.social_evidence;
  const contract = getProfessionalTextTypeContract('social_short');
  const evidenceIds = new Set(professionalPackage.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const briefCount = [
    professionalPackage.creative_brief.target_audience,
    professionalPackage.creative_brief.platform,
    professionalPackage.creative_brief.target_duration,
    professionalPackage.creative_brief.communication_goal,
  ].filter(nonEmpty).length;
  const durationReady = evidence.target_duration_sec >= 60 && evidence.target_duration_sec <= 90;
  const hookReady = nonEmpty(evidence.hook_0_3s) && evidence.beat_plan[0]?.start_sec === 0 && evidence.beat_plan[0]?.end_sec <= 3;
  const hookBoundaryReady = evidence.hook_fact_evidence_ids.length > 0
    && evidence.hook_fact_evidence_ids.every(id => evidenceIds.has(id));
  const beatsReady = evidence.beat_plan.length >= 5 && evidence.beat_plan.every((beat, index) =>
    beat.order === index + 1
    && beat.start_sec >= 0
    && beat.end_sec > beat.start_sec
    && (index === 0 || beat.start_sec === evidence.beat_plan[index - 1].end_sec)
    && beat.evidence_ids.every(id => evidenceIds.has(id))
  ) && evidence.beat_plan.at(-1)?.end_sec === evidence.target_duration_sec;
  const newInformationReady = evidence.beat_plan.every(beat => nonEmpty(beat.new_information))
    && new Set(evidence.beat_plan.map(beat => beat.new_information.trim())).size === evidence.beat_plan.length;
  const captionsReady = evidence.beat_plan.every(beat => nonEmpty(beat.caption) && beat.caption.trim().length <= 24);
  const verticalVisualsReady = evidence.beat_plan.every(beat => nonEmpty(beat.vertical_visual));
  const channelDivisionReady = evidence.beat_plan.every(beat => {
    const caption = beat.caption.trim();
    const voice = beat.voiceover_or_dialogue.trim();
    const visual = beat.vertical_visual.trim();
    return nonEmpty(voice) && caption !== voice && caption !== visual && voice !== visual;
  });
  const sceneReady = professionalPackage.scene_breakdown.every(scene =>
    nonEmpty(scene.key_action) && nonEmpty(evidence.scene_turns[String(scene.scene_id)])
  );
  const truthReady = professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status === 'verified_fact')
    && professionalPackage.research_and_evidence_dossier.evidence_items.some(item => item.status !== 'verified_fact')
    && professionalPackage.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0;
  const gateIds = [
    briefCount === 4 ? '' : 'brief_missing',
    isFinalText(professionalPackage.full_text) ? '' : 'full_text_not_final',
    durationReady ? '' : 'duration_out_of_range',
    hookReady ? '' : 'hook_missing',
    hookBoundaryReady ? '' : 'hook_fact_boundary_missing',
    beatsReady ? '' : 'beat_plan_missing',
    newInformationReady ? '' : 'new_information_missing',
    nonEmpty(evidence.central_contrast) ? '' : 'contrast_missing',
    captionsReady ? '' : 'caption_missing',
    verticalVisualsReady ? '' : 'vertical_visual_missing',
    channelDivisionReady ? '' : 'channel_division_missing',
    nonEmpty(evidence.shareable_line) && nonEmpty(evidence.interaction_question) ? '' : 'interaction_missing',
    evidence.platform_safety_notes.filter(nonEmpty).length >= 2 ? '' : 'platform_safety_missing',
    sceneReady ? '' : 'scene_action_or_turn_missing',
    truthReady ? '' : 'truth_boundary_missing',
  ].filter(Boolean);
  const dimension = (score: number, issues: string[] = []) => ({ score, evidence: [] as string[], issues });
  const dimensions: Record<ProfessionalQualityDimensionId, ReturnType<typeof dimension>> = {
    creative_brief_and_audience_promise: dimension(ratio(briefCount + Number(nonEmpty(professionalPackage.audience_promise)), 5)),
    premise_and_theme_unity: dimension(ratio(Number(nonEmpty(evidence.core_message)) + Number(nonEmpty(evidence.shareable_line)) + Number(nonEmpty(professionalPackage.theme_statement)), 3)),
    structure_causality_and_pacing: dimension(ratio(Number(durationReady) + Number(hookReady) + Number(beatsReady) + Number(newInformationReady), 4), beatsReady ? [] : ['节拍或时间码不完整。']),
    character_agency_and_relationship_change: dimension(ratio(Number(nonEmpty(evidence.central_contrast)) + Number(nonEmpty(evidence.interaction_question)), 2)),
    scene_function_visible_action_and_blocking: dimension(ratio(Number(verticalVisualsReady) + Number(sceneReady), 2)),
    dialogue_narration_and_subtext: dimension(ratio(Number(captionsReady) + Number(channelDivisionReady), 2)),
    emotional_curve_and_aftertaste: dimension(ratio(Number(nonEmpty(evidence.central_contrast)) + Number(nonEmpty(evidence.shareable_line)) + Number(nonEmpty(evidence.interaction_question)), 3)),
    cultural_fact_and_adaptation_boundary: dimension(ratio(Number(hookBoundaryReady) + Number(truthReady) + Number(evidence.platform_safety_notes.length >= 2), 3), truthReady ? [] : ['事实边界不足。']),
    production_executability: dimension(ratio(Number(beatsReady) + Number(verticalVisualsReady) + Number(channelDivisionReady), 3)),
    originality_and_distinctiveness: dimension(50, ['需真人平台编辑和导演盲评。']),
  };
  const totalScore = Math.round(Object.entries(contract.quality_dimension_weights).reduce(
    (sum, [dimensionId, weight]) => sum + dimensions[dimensionId as ProfessionalQualityDimensionId].score * weight / 100,
    0,
  ));
  const status = gateIds.length ? 'failed' : totalScore >= 85 ? 'professional_candidate' : totalScore >= 80 ? 'production_candidate' : 'failed';
  return {
    quality_report: {
      status,
      total_score: totalScore,
      dimensions: Object.entries(contract.quality_dimension_weights).map(([dimensionId, weight]) => ({
        dimension_id: dimensionId as ProfessionalQualityDimensionId,
        weight,
        score: dimensions[dimensionId as ProfessionalQualityDimensionId].score,
        evidence: [],
        issues: dimensions[dimensionId as ProfessionalQualityDimensionId].issues,
      })),
      hard_gate_failures: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
      professional_passed: false,
      evaluator_notes: ['机器评分不构成专业通过。', '缺真实模型、平台编辑、事实文化和导演人审。'],
    },
    coverage_report: {
      verdict: gateIds.length ? 'rebuild' : 'pass',
      strengths: Object.entries(dimensions).filter(([, value]) => value.score >= 85).map(([dimensionId]) => dimensionId),
      structure_notes: dimensions.structure_causality_and_pacing.issues,
      character_or_information_notes: [],
      scene_notes: [],
      dialogue_or_narration_notes: dimensions.dialogue_narration_and_subtext.issues,
      pacing_notes: beatsReady ? [] : ['60至90秒内必须持续产生新信息。'],
      fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues,
      production_notes: verticalVisualsReady ? [] : ['竖屏画面不可执行。'],
      action_items: gateIds.map(gateId => `${gateId}: ${repairs[gateId]}`),
    },
  };
}

export const socialShortHardGateRepair = (gateId: string) => repairs[gateId];
