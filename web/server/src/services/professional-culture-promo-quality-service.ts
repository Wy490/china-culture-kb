import type { ProfessionalCoverageReport, ProfessionalQualityDimensionId, ProfessionalTextPackage, ProfessionalTextQualityReport } from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';

export interface CulturePromoSymbol { symbol_id: string; label: string; meaning: string; scene_ids: number[]; }
export interface CulturePromoProofPoint { proof_id: string; claim: string; evidence_ids: string[]; visible_expression: string; }
export interface CulturePromoInformationBeat { scene_id: number; new_information: string; audience_effect: string; }
export interface CulturePromoProfessionalEvidence {
  communication_proposition: string; audience_takeaway: string; visual_symbols: CulturePromoSymbol[];
  proof_points: CulturePromoProofPoint[]; information_curve: CulturePromoInformationBeat[];
  voiceover_visual_division: string[]; modern_connection: string; call_to_action: string;
  slogan_or_key_sentence: string; scene_turns: Record<string, string>;
}
export interface CulturePromoEvaluationResult { quality_report: ProfessionalTextQualityReport; coverage_report: ProfessionalCoverageReport; }
interface DimensionResult { score: number; evidence: string[]; issues: string[]; }
const REPAIRS: Record<string, string> = {
  brief_missing: '补齐受众、平台、时长、传播目标和观众承诺。', full_text_not_final: '把宣传提纲或资料摘要改成完整观众文案。',
  proposition_missing: '用一句可验证的传播命题回答“为什么值得看”。', visual_symbol_missing: '建立至少两个具体视觉符号，并登记其场景和意义变化。',
  proof_point_missing: '用至少三个可核验文化细节和可拍表达支撑主张。', information_curve_missing: '逐场增加新信息，避免百科平铺或重复赞美。',
  voiceover_visual_overlap: '明确旁白与画面的分工，不重复描述已经可见的内容。', modern_connection_missing: '补足传统在当代人物、空间或使用场景中的真实连接。',
  call_to_action_missing: '让行动召唤承接前文观众承诺，避免空泛口号。', slogan_missing: '形成具体、可复述且由前文证据支撑的关键句。',
  scene_action_or_turn_missing: '每场补齐可见动作、新信息和传播推进。', truth_boundary_missing: '区分文化事实、诗化表达、合理补足和未知项。',
};
const nonEmpty = (value: string | undefined) => Boolean(value?.trim());
const ratio = (done: number, total: number) => Math.round(done / Math.max(1, total) * 100);
const dim = (score: number, evidence: string[], issues: string[]): DimensionResult => ({ score: Math.max(0, Math.min(100, Math.round(score))), evidence, issues });
const finalText = (text: string) => text.trim().length >= 120 && !/^(?:大纲|摘要|资料|分析|创作思路|宣传要点[:：])/u.test(text.trim()) && !/(?:TODO|待补|内部分析)/u.test(text);

export function evaluateCulturePromoProfessionalText(input: { package: ProfessionalTextPackage; promo_evidence: CulturePromoProfessionalEvidence }): CulturePromoEvaluationResult {
  const pkg = input.package; if (pkg.video_type !== 'culture_promo') throw new Error('evaluateCulturePromoProfessionalText only accepts culture_promo packages');
  const e = input.promo_evidence; const contract = getProfessionalTextTypeContract('culture_promo'); const sceneIds = pkg.scene_breakdown.map(scene => Number(scene.scene_id)); const evidenceIds = new Set(pkg.research_and_evidence_dossier.evidence_items.map(item => item.evidence_id));
  const brief = [pkg.creative_brief.target_audience, pkg.creative_brief.platform, pkg.creative_brief.target_duration, pkg.creative_brief.communication_goal].filter(nonEmpty).length;
  const symbolsReady = e.visual_symbols.length >= 2 && e.visual_symbols.every(symbol => nonEmpty(symbol.symbol_id) && nonEmpty(symbol.label) && nonEmpty(symbol.meaning) && symbol.scene_ids.length >= 2 && symbol.scene_ids.every(id => sceneIds.includes(id)));
  const proofsReady = e.proof_points.length >= 3 && e.proof_points.every(point => nonEmpty(point.claim) && nonEmpty(point.visible_expression) && point.evidence_ids.length > 0 && point.evidence_ids.every(id => evidenceIds.has(id)));
  const infoReady = e.information_curve.length === sceneIds.length && new Set(e.information_curve.map(beat => beat.scene_id)).size === sceneIds.length && e.information_curve.every(beat => sceneIds.includes(beat.scene_id) && nonEmpty(beat.new_information) && nonEmpty(beat.audience_effect));
  const divisionReady = e.voiceover_visual_division.filter(nonEmpty).length >= 2;
  const sceneReady = pkg.scene_breakdown.every(scene => nonEmpty(scene.key_action) && nonEmpty(e.scene_turns[String(scene.scene_id)]));
  const verified = pkg.research_and_evidence_dossier.evidence_items.filter(item => item.status === 'verified_fact').length;
  const adapted = pkg.research_and_evidence_dossier.evidence_items.filter(item => item.status !== 'verified_fact').length;
  const truthReady = verified > 0 && adapted > 0 && pkg.truth_and_adaptation_contract.unknown_or_forbidden_claims.length > 0 && pkg.truth_and_adaptation_contract.required_disclaimers.length > 0;
  const gates = [brief === 4 && nonEmpty(pkg.audience_promise) ? '' : 'brief_missing', finalText(pkg.full_text) ? '' : 'full_text_not_final', nonEmpty(e.communication_proposition) && nonEmpty(e.audience_takeaway) ? '' : 'proposition_missing', symbolsReady ? '' : 'visual_symbol_missing', proofsReady ? '' : 'proof_point_missing', infoReady ? '' : 'information_curve_missing', divisionReady ? '' : 'voiceover_visual_overlap', nonEmpty(e.modern_connection) ? '' : 'modern_connection_missing', nonEmpty(e.call_to_action) ? '' : 'call_to_action_missing', nonEmpty(e.slogan_or_key_sentence) ? '' : 'slogan_missing', sceneReady ? '' : 'scene_action_or_turn_missing', truthReady ? '' : 'truth_boundary_missing'].filter(Boolean);
  const dimensions: Record<ProfessionalQualityDimensionId, DimensionResult> = {
    creative_brief_and_audience_promise: dim(ratio(brief + Number(nonEmpty(pkg.audience_promise)), 5), [`brief=${brief}/4`], brief === 4 ? [] : ['传播简报不完整。']),
    premise_and_theme_unity: dim(ratio(Number(nonEmpty(e.communication_proposition)) + Number(nonEmpty(e.audience_takeaway)) + Number(nonEmpty(pkg.theme_statement)), 3), [`proposition=${nonEmpty(e.communication_proposition)}`], nonEmpty(e.communication_proposition) ? [] : ['传播命题不清楚。']),
    structure_causality_and_pacing: dim(ratio(Number(infoReady) + Number(symbolsReady) + Number(nonEmpty(e.modern_connection)) + Number(nonEmpty(e.call_to_action)), 4), [`info_curve=${infoReady}`], infoReady ? [] : ['信息曲线重复或平铺。']),
    character_agency_and_relationship_change: dim(nonEmpty(e.modern_connection) ? 85 : 40, [`modern_connection=${nonEmpty(e.modern_connection)}`], nonEmpty(e.modern_connection) ? [] : ['缺少当代人物或使用场景。']),
    scene_function_visible_action_and_blocking: dim(ratio(pkg.scene_breakdown.filter(scene => nonEmpty(scene.key_action)).length, Math.max(1, sceneIds.length)), [`visible_scenes=${pkg.scene_breakdown.filter(scene => nonEmpty(scene.key_action)).length}/${sceneIds.length}`], sceneReady ? [] : ['存在没有可见动作的场景。']),
    dialogue_narration_and_subtext: dim(ratio(Number(divisionReady) + Number(nonEmpty(pkg.dialogue_or_narration_pass.polished_text)) + Number(nonEmpty(e.slogan_or_key_sentence)), 3), [`division=${divisionReady}`], divisionReady ? [] : ['旁白与画面重复。']),
    emotional_curve_and_aftertaste: dim(ratio(Object.values(e.scene_turns).filter(nonEmpty).length + Number(nonEmpty(e.slogan_or_key_sentence)), sceneIds.length + 1), [`turns=${Object.values(e.scene_turns).filter(nonEmpty).length}`], nonEmpty(e.slogan_or_key_sentence) ? [] : ['结尾缺传播记忆点。']),
    cultural_fact_and_adaptation_boundary: dim(ratio(Number(proofsReady) + Number(truthReady), 2), [`proofs=${e.proof_points.length}`, `verified=${verified}`], proofsReady && truthReady ? [] : ['文化证据或边界不足。']),
    production_executability: dim(ratio(Number(symbolsReady) + Number(sceneReady) + Number(pkg.delivery_text_package.scene_units.length === sceneIds.length), 3), [`symbols=${e.visual_symbols.length}`], symbolsReady ? [] : ['视觉符号和交付单元不足。']),
    originality_and_distinctiveness: dim(50, ['machine_originality_verdict=not_allowed'], ['传播辨识度必须由固定基准与真人盲评确认。']),
  };
  const score = Math.round(Object.entries(contract.quality_dimension_weights).reduce((sum, [id, weight]) => sum + dimensions[id as ProfessionalQualityDimensionId].score * weight / 100, 0));
  const status = gates.length ? 'failed' : score >= 90 ? 'high_quality_candidate' : score >= 85 ? 'professional_candidate' : score >= 80 ? 'production_candidate' : 'failed';
  return { quality_report: { status, total_score: score, dimensions: Object.entries(contract.quality_dimension_weights).map(([id, weight]) => ({ dimension_id: id as ProfessionalQualityDimensionId, weight, score: dimensions[id as ProfessionalQualityDimensionId].score, evidence: dimensions[id as ProfessionalQualityDimensionId].evidence, issues: dimensions[id as ProfessionalQualityDimensionId].issues })), hard_gate_failures: gates.map(id => `${id}: ${REPAIRS[id]}`), professional_passed: false, evaluator_notes: ['机器评分只用于 Coverage 和修订路由。', '缺少真实模型传播文本、品牌/导演/事实人审，professional_passed 固定为 false。'] }, coverage_report: { verdict: gates.some(id => ['full_text_not_final', 'proposition_missing', 'proof_point_missing', 'information_curve_missing'].includes(id)) ? 'rebuild' : gates.length || score < 80 ? 'revise' : 'pass', strengths: Object.entries(dimensions).filter(([, v]) => v.score >= 85).map(([id]) => id), structure_notes: dimensions.structure_causality_and_pacing.issues, character_or_information_notes: dimensions.character_agency_and_relationship_change.issues, scene_notes: dimensions.scene_function_visible_action_and_blocking.issues, dialogue_or_narration_notes: dimensions.dialogue_narration_and_subtext.issues, pacing_notes: dimensions.emotional_curve_and_aftertaste.issues, fact_and_culture_notes: dimensions.cultural_fact_and_adaptation_boundary.issues, production_notes: dimensions.production_executability.issues, action_items: gates.map(id => `${id}: ${REPAIRS[id]}`) } };
}
export const culturePromoHardGateRepair = (gateId: string) => REPAIRS[gateId];
