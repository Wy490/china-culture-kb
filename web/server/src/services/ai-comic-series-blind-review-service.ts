import { createHash } from 'node:crypto';
import type {
  AiComicHumanReviewDimension,
  AiComicSeriesBlindReviewEpisodeSample,
  AiComicSeriesBlindReviewPackage,
  AiComicSeriesBlindReviewReviewerPacket,
  AiComicSeriesPlan,
  StoryGenerateResult,
} from '@shared/types.js';

const SCORECARD_DIMENSIONS: Array<{
  dimension: AiComicHumanReviewDimension;
  label: string;
  reviewPrompt: string;
}> = [
  { dimension: 'hook', label: '钩子', reviewPrompt: '开篇是否在前三秒建立清楚、可视、值得继续看的问题？' },
  { dimension: 'character', label: '人物', reviewPrompt: '人物目标、压力、选择和后果是否具体且前后连续？' },
  { dimension: 'dialogue', label: '对白', reviewPrompt: '对白是否有角色差异、冲突信息和可表演性，而非说明书式复述？' },
  { dimension: 'progression', label: '推进', reviewPrompt: '三个代表样本是否持续改变局势、关系或认知，而非原地重复？' },
  { dimension: 'turn', label: '反转', reviewPrompt: '中段信息翻转是否改变行动方向，并由前文证据支撑？' },
  { dimension: 'ending', label: '结尾', reviewPrompt: '结尾是否留下具体问题、代价或选择，使下一集具有追看动力？' },
  { dimension: 'cultural_credibility', label: '文化可信度', reviewPrompt: '文化事实、口述传统、传说和原创机制是否边界清楚，文化细节是否真正参与剧情？' },
];

export function buildAiComicSeriesBlindReviewPackage(input: {
  exportedAt: string;
  seriesProjectId: string;
  plan: AiComicSeriesPlan;
  reviewContentFingerprint: string;
  reviewedEpisodeStoryIds: Record<string, string>;
  episodeStories: Array<{ episode_no: number; story: StoryGenerateResult }>;
}): AiComicSeriesBlindReviewPackage {
  const candidateLabel = buildCandidateLabel(input.reviewContentFingerprint);
  const forbiddenVisibleValues = [
    input.seriesProjectId,
    input.plan.series_title,
    ...Object.values(input.reviewedEpisodeStoryIds),
  ].filter(Boolean);
  const redact = (value: string | undefined): string => redactReviewerVisibleText(
    value ?? '',
    forbiddenVisibleValues,
  );
  const orderedStories = [...input.episodeStories].sort((left, right) => left.episode_no - right.episode_no);
  const episodeSamples: AiComicSeriesBlindReviewEpisodeSample[] = orderedStories.map((item, index) => ({
    sample_label: `样本 ${String.fromCharCode(65 + index)}`,
    position_label: reviewPositionLabel(index, orderedStories.length),
    title: redact(item.story.title),
    full_text: redact(item.story.full_text),
    scenes: item.story.scene_breakdown.map((scene, sceneIndex) => ({
      scene_order: sceneIndex + 1,
      title: redact(scene.title),
      location: redact(scene.location),
      time_of_day: redact(scene.time_of_day),
      dramatic_function: redact(scene.dramatic_function),
      plot: redact(scene.plot),
      key_action: redact(scene.key_action),
      ...(scene.dialogue_or_narration ? { dialogue_or_narration: redact(scene.dialogue_or_narration) } : {}),
      ...(scene.cultural_note ? { cultural_note: redact(scene.cultural_note) } : {}),
    })),
  }));
  const reviewerPacket: AiComicSeriesBlindReviewReviewerPacket = {
    schema_version: 'ai-comic-series-blind-review-reviewer-packet/v1',
    candidate_label: candidateLabel,
    origin_hidden: true,
    machine_scores_included: false,
    source_engine_included: false,
    episode_order_preserved: true,
    instructions: [
      '请按开篇、中段、终局顺序阅读三个样本，独立完成七维评分。',
      '请勿搜索候选来源，也不要向其他 reviewer 询问分数或意见。',
      '每项必须填写 1–5 的整数分；低于 4 分时请给出可定位的修改意见。',
      '评分只评价当前匿名文本，不评价生成工具、模型、团队或机器分。',
      '完成阅读后请填写随包提供的评审回执 JSON；不要修改候选编号和评审包 SHA256。',
    ],
    cultural_review_boundary: buildCulturalReviewBoundary(input.plan, redact),
    episode_samples: episodeSamples,
    scorecard: SCORECARD_DIMENSIONS.map(item => ({
      dimension: item.dimension,
      label: item.label,
      review_prompt: item.reviewPrompt,
      score: null,
      note: '',
    })),
    required_attestations: [
      '我是实际完成人工阅读与评分的 reviewer。',
      '评分时我不知道候选来源、生成引擎和机器评分。',
      '评分时我没有查看其他 reviewer 的分数或意见。',
    ],
  };
  const reviewerPacketSha256 = sha256Json(reviewerPacket);
  const reviewerResponseTemplate: AiComicSeriesBlindReviewPackage['reviewer_response_template'] = {
    schema_version: 'ai-comic-series-blind-review-response/v1',
    candidate_label: candidateLabel,
    reviewer_packet_sha256: reviewerPacketSha256,
    reviewer_id: '',
    blind: true,
    instructions: [
      '请填写 reviewer_id、七项整数评分和必要意见，不要修改候选编号或评审包 SHA256。',
      '低于 4 分的维度必须填写可定位的修改意见。',
      '只有三项声明均为 true 时，操作者才可导入此回执。',
    ],
    scores: SCORECARD_DIMENSIONS.map(item => ({
      dimension: item.dimension,
      label: item.label,
      score: null,
      note: '',
    })),
    attestations: {
      human_reviewer: false,
      origin_and_machine_scores_hidden: false,
      independent_review: false,
    },
  };
  const operatorManifest = {
    schema_version: 'ai-comic-series-blind-review-operator-manifest/v1' as const,
    exported_at: input.exportedAt,
    series_project_id: input.seriesProjectId,
    series_title: input.plan.series_title,
    candidate_label: candidateLabel,
    review_content_fingerprint: input.reviewContentFingerprint,
    reviewer_packet_sha256: reviewerPacketSha256,
    reviewed_episode_story_ids: { ...input.reviewedEpisodeStoryIds },
    share_with_reviewer: false as const,
    instructions: [
      '此内部映射包含项目身份和故事 ID，禁止发送给 reviewer。',
      '只把 reviewer_markdown 与 reviewer_response_template_json 交给 reviewer，内部映射不得外发。',
      '要求 reviewer 完整填写回执 JSON，并保持 candidate_label 与 reviewer_packet_sha256 不变。',
      '导入评分前确认 reviewer 身份、独立性和盲评声明真实有效。',
    ],
  };
  return {
    schema_version: 'ai-comic-series-blind-review-package/v1',
    candidate_label: candidateLabel,
    reviewer_packet_sha256: reviewerPacketSha256,
    reviewer_packet: reviewerPacket,
    reviewer_markdown: buildReviewerMarkdown(reviewerPacket, reviewerPacketSha256),
    reviewer_response_template: reviewerResponseTemplate,
    reviewer_response_template_json: `${JSON.stringify(reviewerResponseTemplate, null, 2)}\n`,
    operator_manifest: operatorManifest,
    operator_markdown: buildOperatorMarkdown(operatorManifest),
  };
}

function buildCandidateLabel(contentFingerprint: string): string {
  const code = createHash('sha256')
    .update(`story-agent-commercial-blind-review|${contentFingerprint}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `候选-${code}`;
}

function reviewPositionLabel(index: number, count: number): '开篇样本' | '中段样本' | '终局样本' {
  if (index === 0) return '开篇样本';
  if (index === count - 1) return '终局样本';
  return '中段样本';
}

function buildCulturalReviewBoundary(
  plan: AiComicSeriesPlan,
  redact: (value: string | undefined) => string,
): string[] {
  const boundaries = plan.premise_contract?.cultural_boundaries ?? [];
  if (boundaries.length === 0) {
    return ['请区分可核验文化事实、合理戏剧化、传说/口述传统与明确原创机制；不得把原创机制误判为历史事实。'];
  }
  return boundaries.map(boundary => `${truthModeLabel(boundary.truth_mode)}：${redact(boundary.statement)}`);
}

function truthModeLabel(mode: string): string {
  if (mode === 'verified_fact') return '可核验事实';
  if (mode === 'oral_tradition') return '口述传统';
  if (mode === 'legend') return '传说';
  return '原创机制';
}

function redactReviewerVisibleText(value: string, forbiddenValues: string[]): string {
  let output = value;
  for (const forbidden of forbiddenValues) {
    if (!forbidden) continue;
    output = output.split(forbidden).join('候选系列');
  }
  return output
    .replace(/\b(?:local_story_engine|external_model|local_fallback|claude_sonnet|claude_opus|codex_gpt55)\b/gi, '已隐藏来源')
    .replace(/\b\d{8}-(?:series|story)-[0-9a-z-]+\b/gi, '已隐藏标识')
    .replace(/用户原创(?:故事种子|悬疑故事依据)/g, '匿名创作设定');
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function buildReviewerMarkdown(
  packet: AiComicSeriesBlindReviewReviewerPacket,
  reviewerPacketSha256: string,
): string {
  const lines = [
    '# AI 漫剧匿名真人盲评包',
    '',
    `- 候选编号：${packet.candidate_label}`,
    `- 评审包 SHA256：${reviewerPacketSha256}`,
    '- 候选来源：已隐藏',
    '- 机器评分：未提供',
    '',
    '## 评审要求',
    ...packet.instructions.map(item => `- ${item}`),
    '',
    '## 文化可信度边界',
    ...packet.cultural_review_boundary.map(item => `- ${item}`),
    '',
  ];
  for (const sample of packet.episode_samples) {
    lines.push(
      `## ${sample.sample_label} · ${sample.position_label}`,
      '',
      `### ${sample.title}`,
      '',
      sample.full_text,
      '',
      '### 场景证据',
      '',
      '| 场次 | 地点/时间 | 功能 | 情节与动作 | 对白/旁白 | 文化备注 |',
      '| --- | --- | --- | --- | --- | --- |',
      ...sample.scenes.map(scene => `| ${scene.scene_order}. ${markdownCell(scene.title)} | ${markdownCell(`${scene.location} / ${scene.time_of_day}`)} | ${markdownCell(scene.dramatic_function)} | ${markdownCell(`${scene.plot}；${scene.key_action}`)} | ${markdownCell(scene.dialogue_or_narration ?? '')} | ${markdownCell(scene.cultural_note ?? '')} |`),
      '',
    );
  }
  lines.push(
    '## 七维评分表',
    '',
    '| 维度 | 评审问题 | 1–5 分 | 意见 |',
    '| --- | --- | ---: | --- |',
    ...packet.scorecard.map(item => `| ${item.label} | ${markdownCell(item.review_prompt)} |  |  |`),
    '',
    '## Reviewer 回传信息',
    '',
    '- Reviewer ID：',
    `- 候选编号：${packet.candidate_label}`,
    `- 评审包 SHA256：${reviewerPacketSha256}`,
    '- [ ] 我是实际完成人工阅读与评分的 reviewer。',
    '- [ ] 评分时我不知道候选来源、生成引擎和机器评分。',
    '- [ ] 评分时我没有查看其他 reviewer 的分数或意见。',
    '',
  );
  return lines.join('\n');
}

function buildOperatorMarkdown(manifest: AiComicSeriesBlindReviewPackage['operator_manifest']): string {
  return [
    '# AI 漫剧盲评内部映射（禁止发送给 Reviewer）',
    '',
    `- 导出时间：${manifest.exported_at}`,
    `- 系列项目：${manifest.series_project_id}`,
    `- 系列标题：${manifest.series_title}`,
    `- 候选编号：${manifest.candidate_label}`,
    `- 文本指纹：${manifest.review_content_fingerprint}`,
    `- 评审包 SHA256：${manifest.reviewer_packet_sha256}`,
    `- 代表集故事：${Object.entries(manifest.reviewed_episode_story_ids).map(([episodeNo, storyId]) => `E${episodeNo}=${storyId}`).join('；')}`,
    '',
    '## 操作要求',
    ...manifest.instructions.map(item => `- ${item}`),
    '',
  ].join('\n');
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '｜').replace(/\r?\n/g, '<br>').trim() || '—';
}
