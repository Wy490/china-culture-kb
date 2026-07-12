import type { ProfessionalTextPackage, ResearchAndEvidenceDossier, StoryGenerateResult, SupportedDuration, TruthMode } from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from './professional-text-package-service.js';
import { evaluateAiComicDramaProfessionalText, type AiComicDramaProfessionalEvidence } from './professional-ai-comic-drama-quality-service.js';

export interface AiComicDramaProfessionalPipelineInput {
  story: StoryGenerateResult;
  target_audience: string;
  platform: string;
  target_duration?: SupportedDuration;
  communication_goal: string;
  production_goal: string;
  audience_promise: string;
  truth_mode?: TruthMode;
  research: ResearchAndEvidenceDossier;
  comic_evidence: AiComicDramaProfessionalEvidence;
  now?: string;
}

export function buildAiComicDramaProfessionalTextPackage(input: AiComicDramaProfessionalPipelineInput): ProfessionalTextPackage {
  if (input.story.video_type !== 'ai_comic_drama') throw new Error('ai_comic_drama professional pipeline requires an ai_comic_drama source');
  const { story, comic_evidence: comic } = input;
  const now = input.now ?? new Date().toISOString();
  const targetDuration = input.target_duration ?? story.story_blueprint?.target_duration ?? '5分钟';
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'ai_comic_drama', package_id: `${story.storyId}--professional-text`, story_id: story.storyId,
    project_id: story.project_id, target_duration: targetDuration, target_audience: input.target_audience,
    platform: input.platform, communication_goal: input.communication_goal, truth_mode: input.truth_mode ?? story.truth_mode, now,
  });
  const facts = input.research.evidence_items.filter(item => item.status === 'verified_fact').map(item => item.claim);
  const dramatizations = input.research.evidence_items.filter(item => item.status === 'plausible_dramatization').map(item => item.claim);
  const fictional = input.research.evidence_items.filter(item => item.status === 'fictional_addition').map(item => item.claim);
  pkg.creative_brief = { target_audience: input.target_audience, platform: input.platform, target_duration: targetDuration, communication_goal: input.communication_goal, production_goal: input.production_goal, budget_assumptions: [], delivery_constraints: ['每场 3-6 格', `气泡不超过 ${comic.max_bubble_characters} 字`, '资产 ID 必须来自 asset bible'] };
  pkg.research_and_evidence_dossier = input.research;
  pkg.audience_promise = input.audience_promise;
  pkg.premise_or_core_question = story.logline;
  pkg.theme_statement = story.theme;
  pkg.truth_and_adaptation_contract = {
    truth_mode: input.truth_mode ?? story.truth_mode ?? 'inspired_by_material',
    verified_facts: facts, plausible_dramatizations: dramatizations, fictional_additions: fictional,
    unknown_or_forbidden_claims: [...input.research.unknowns],
    required_disclaimers: story.creation_contract?.required_disclaimers ?? ['人物关系、对白、表情和分格为漫画化改编，不作为史料或真实人物原话。'],
  };
  pkg.relationship_or_information_architecture = {
    mode: 'character_relationships',
    nodes: comic.asset_bible.filter(asset => asset.asset_type === 'character').map(asset => ({ node_id: asset.asset_id, label: asset.label, role: asset.label === comic.protagonist ? 'protagonist' : 'relationship_collision_role' })),
    links: [{ from: comic.asset_bible.find(asset => asset.label === comic.protagonist)?.asset_id ?? 'protagonist', to: comic.asset_bible.find(asset => asset.asset_type === 'character' && asset.label !== comic.protagonist)?.asset_id ?? 'counterpart', relationship: comic.relationship_collision }],
  };
  pkg.structure_outline = { structure_name: story.story_structure ?? 'single_event_drama', opening: comic.episode_hook, development: story.scene_breakdown.slice(1, -2).map(scene => scene.plot), climax_or_key_turn: comic.reversal_or_choice, ending: `${comic.ending_visible_action}；${comic.ending_hook}` };
  pkg.sequence_beats = story.scene_breakdown.map((scene, index) => ({ beat_id: `comic-beat-${index + 1}`, order: index + 1, title: scene.title, purpose: scene.dramatic_function, visible_action: scene.key_action, conflict_discovery_or_instruction: scene.conflict ?? scene.plot, emotional_or_information_turn: comic.scene_turns[String(scene.scene_id)] ?? '', evidence_ids: [] }));
  pkg.scene_breakdown = story.scene_breakdown;
  pkg.full_text = story.full_text;
  pkg.dialogue_or_narration_pass = { mode: 'dialogue', voice_rules: [`气泡不超过 ${comic.max_bubble_characters} 字`, '对白来回后必须给表情或动作反应格'], polished_text: comic.panel_beats.map(panel => panel.dialogue_bubble).filter(Boolean).join('\n'), unresolved_issues: [] };
  pkg.director_text_plan = {
    visual_strategy: '每格只保留一个视觉重点；近景表情、动作格和反应格交替，资产 ID 全程稳定。',
    sound_strategy: '对白短促，动作音和停顿承担节拍，旁白不解释已经可见的画面。',
    rhythm_strategy: '强钩子 -> 关系碰撞 -> 反应格 -> 可画选择 -> 结尾动作钩子。',
    sequences: story.scene_breakdown.map(scene => ({ sequence_id: `comic-sequence-${scene.scene_id}`, scene_ids: [scene.scene_id], blocking_and_visible_action: scene.key_action, camera_and_transition_intent: scene.camera_suggestion, sound_intent: scene.dialogue_or_narration ?? '动作音与短气泡交替。', production_constraints: comic.panel_beats.filter(panel => panel.scene_id === Number(scene.scene_id)).map(panel => `${panel.panel_id}:${panel.asset_ids.join(',')}:${panel.expression}`) })),
  };
  pkg.continuity_ledger = {
    items: comic.asset_bible.map(asset => ({ continuity_id: `comic-${asset.asset_id}`, category: asset.asset_type === 'character' ? 'character' as const : asset.asset_type === 'prop' ? 'prop' as const : 'location' as const, rule: asset.continuity_rule, applies_to_scene_ids: [...new Set(comic.panel_beats.filter(panel => panel.asset_ids.includes(asset.asset_id)).map(panel => panel.scene_id))], evidence_ids: [] })),
    unresolved_conflicts: [],
  };
  pkg.delivery_text_package = {
    script_text: story.full_text,
    scene_units: story.scene_breakdown.map(scene => ({ scene_id: scene.scene_id, script_text: comic.panel_beats.filter(panel => panel.scene_id === Number(scene.scene_id)).map(panel => `[${panel.panel_id}] ${panel.visible_action}${panel.dialogue_bubble ? `｜${panel.dialogue_bubble}` : ''}`).join('\n'), visual_action: scene.key_action, camera_intent: scene.camera_suggestion, sound_intent: '短气泡、动作音和反应停顿。', continuity_notes: comic.panel_beats.filter(panel => panel.scene_id === Number(scene.scene_id)).flatMap(panel => panel.asset_ids), evidence_boundary_notes: [scene.factual_basis ?? '', ...(scene.fictionalized_elements ?? [])].filter(Boolean) })),
    gears_handoff_notes: ['格级动作、表情和资产 ID 必须完整传递；不可依赖隐藏上下文。'],
    seedance_handoff_notes: ['只有角色、服装、道具和场景连续性复核后才生成视频分段提示。'], validation_notes: [],
  };
  const evaluation = evaluateAiComicDramaProfessionalText({ package: pkg, comic_evidence: comic });
  pkg.quality_report = evaluation.quality_report;
  pkg.coverage_report = evaluation.coverage_report;
  pkg.status = pkg.quality_report.hard_gate_failures.length > 0 ? 'revision_required' : 'in_review';
  return pkg;
}
