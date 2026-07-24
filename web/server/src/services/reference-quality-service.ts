// web/server/src/services/reference-quality-service.ts — Reference-aware quality validation
// Checks generated stories against creative reference safety rules:
//   - No long-sentence copying from reference samples
//   - No unknown-rights references used with strong strength
//   - No "adapted from" claims without authorization
//   - Reference trace records only abstract rules, not original passages

import type {
  ReferenceGenerationSafetyFinding,
  ReferenceGenerationSafetyReport,
  ReferenceSimilarityEvidenceRecord,
  StoryGenerateResult,
  StoryQualityReport,
  ReferenceTrace,
  StoryStructureType,
} from '@shared/types.js';
import { buildStoryReferenceBaselineComparison } from './reference-baseline-comparison-service.js';

// ---------------------------------------------------------------------------
// Reference safety report structure
// ---------------------------------------------------------------------------

export interface ReferenceSafetyReport {
  safe: boolean;
  issues: string[];
  warnings: string[];
  blocked_references: string[];
}

// ---------------------------------------------------------------------------
// Validate reference safety — MVP rules
// ---------------------------------------------------------------------------

export interface ReferenceSafetyInput {
  generated_text: string;
  reference_rights?: string[];        // rights status of each referenced work
  reference_strength?: 'light' | 'medium' | 'strong';
  reference_trace?: ReferenceTrace[];
  style_pack_ids?: string[];
  expected_style_pack_ids?: string[];
  claimed_authorization?: boolean;    // user claims they have rights to "adapt from" a work
  reference_original_sentences?: string[]; // sentences from reference samples (for similarity check)
  generated_story?: Pick<
    StoryGenerateResult,
    | 'full_text'
    | 'logline'
    | 'theme'
    | 'scene_breakdown'
  > & Partial<Pick<StoryGenerateResult, 'storyId' | 'quality_report'>>;
  baseline_story?: Pick<
    StoryGenerateResult,
    'storyId' | 'quality_report'
  >;
  similarity_evidence?: ReferenceSimilarityEvidenceRecord[];
}

export function buildReferenceSafetyText(
  story: Pick<
    StoryGenerateResult,
    'full_text' | 'logline' | 'theme' | 'scene_breakdown'
  >,
): string {
  return [
    story.full_text,
    story.logline,
    story.theme,
    ...story.scene_breakdown.flatMap(scene => [
      scene.plot,
      scene.key_action,
      scene.conflict,
      scene.dialogue_or_narration,
      scene.visual_prompt,
      scene.camera_suggestion,
    ]),
  ].filter((value): value is string => Boolean(value)).join('\n');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function finding(
  issue_code: ReferenceGenerationSafetyFinding['issue_code'],
  severity: ReferenceGenerationSafetyFinding['severity'],
  message: string,
  reference_ids: string[] = [],
): ReferenceGenerationSafetyFinding {
  return { issue_code, severity, message, reference_ids };
}

/**
 * Canonical post-generation audit for approved reference-style influence.
 * The reference library intentionally stores no source body, so similarity
 * dimensions remain explicitly not-run unless lawful excerpts are supplied.
 */
export function evaluateReferenceGenerationSafety(input: ReferenceSafetyInput):
ReferenceGenerationSafetyReport {
  const trace = input.reference_trace ?? [];
  const referenceTraces = trace.filter(item => Boolean(item.style_pack_id));
  const tracedStylePackIds = unique(
    referenceTraces.map(item => item.style_pack_id).filter((id): id is string => Boolean(id)),
  );
  const expectedStylePackIds = unique(input.expected_style_pack_ids ?? []);
  const stylePackIds = expectedStylePackIds.length > 0
    ? expectedStylePackIds
    : tracedStylePackIds;
  const sourceReferences = uniqueSourceReferences(
    referenceTraces.flatMap(item => item.source_references ?? []),
  );
  const sourceReferenceIds = sourceReferences.map(source => source.reference_id);
  const evidenceRefs = uniqueEvidenceRefs(
    referenceTraces.flatMap(item => item.similarity_evidence_refs ?? []),
  );
  const similarityEvidence = input.similarity_evidence ?? [];
  const statuses = unique(
    referenceTraces
      .map(item => item.application_status)
      .filter((status): status is NonNullable<ReferenceTrace['application_status']> =>
        Boolean(status)),
  );
  const appliedToGeneration = statuses.includes('external_prompt_injected');
  const hasReferences = stylePackIds.length > 0;
  const expectedTraceSetComplete = expectedStylePackIds.length === 0
    || (
      expectedStylePackIds.length === tracedStylePackIds.length
      && expectedStylePackIds.every(stylePackId => tracedStylePackIds.includes(stylePackId))
    );
  const provenanceComplete = !hasReferences || (
    expectedTraceSetComplete
    && referenceTraces.every(item =>
      Boolean(item.style_pack_id)
      && (item.source_reference_ids?.length ?? 0) > 0
      && (item.source_analysis_ids?.length ?? 0) > 0
      && (item.source_benchmark_ids?.length ?? 0) > 0
      && (item.source_references?.length ?? 0) > 0
      && item.source_reference_ids?.every(referenceId =>
        item.source_references?.some(source => source.reference_id === referenceId))
    )
  );
  const evidenceProvenanceComplete = evidenceRefs.length === 0 || (
    evidenceRefs.length === similarityEvidence.length
    && evidenceRefs.every(reference => {
      const evidence = similarityEvidence.find(
        candidate => candidate.evidence_id === reference.evidence_id,
      );
      const source = sourceReferences.find(
        candidate => candidate.reference_id === reference.reference_id,
      );
      return evidence?.payload_sha256 === reference.payload_sha256
        && evidence.reference_id === reference.reference_id
        && evidence.source_content_fingerprint === source?.content_fingerprint
        && evidence.input_provenance === reference.input_provenance;
    })
  );
  const avoidCopyingConstraintsPresent = !appliedToGeneration || referenceTraces.every(item =>
    item.application_status !== 'external_prompt_injected'
    || (item.avoid_copying_rules?.length ?? 0) > 0
  );
  const issues: ReferenceGenerationSafetyFinding[] = [];
  const warnings: ReferenceGenerationSafetyFinding[] = [];

  if (!provenanceComplete) {
    issues.push(finding(
      'reference_provenance_incomplete',
      'blocker',
      'Reference trace is missing style-pack source, analysis, benchmark, or rights provenance.',
      sourceReferenceIds,
    ));
  }
  if (!avoidCopyingConstraintsPresent) {
    issues.push(finding(
      'avoid_copying_constraints_missing',
      'blocker',
      'An applied reference style pack has no recorded avoid-copying constraints.',
      sourceReferenceIds,
    ));
  }
  if (!evidenceProvenanceComplete) {
    issues.push(finding(
      'similarity_evidence_provenance_incomplete',
      'blocker',
      'Similarity evidence is missing or does not match its trace, source fingerprint, or immutable payload hash.',
      unique(evidenceRefs.map(reference => reference.reference_id)),
    ));
  }
  if (
    appliedToGeneration
    && input.reference_strength === 'strong'
    && sourceReferences.some(source => source.rights_status === 'unknown')
  ) {
    const unknownIds = sourceReferences
      .filter(source => source.rights_status === 'unknown')
      .map(source => source.reference_id);
    issues.push(finding(
      'unknown_rights_strong_reference',
      'blocker',
      'Strong reference influence cannot use unknown-rights sources.',
      unknownIds,
    ));
  }

  const adaptedFromPatterns = [
    /改编自[^，。\n]{2,30}/gu,
    /根据[^，。\n]{2,30}改编/gu,
  ];
  const adaptedClaim = adaptedFromPatterns
    .flatMap(pattern => input.generated_text.match(pattern) ?? [])[0];
  if (appliedToGeneration && adaptedClaim && !input.claimed_authorization) {
    issues.push(finding(
      'unauthorized_adaptation_claim',
      'blocker',
      `Generated story contains an unauthorized adaptation claim: ${adaptedClaim}`,
      sourceReferenceIds,
    ));
  }

  const forbiddenImitation = [
    '完全仿写',
    '仿写某作品',
    '写得像某位',
    '复刻某作品',
  ].find(value => input.generated_text.includes(value));
  if (appliedToGeneration && forbiddenImitation) {
    issues.push(finding(
      'forbidden_imitation_language',
      'blocker',
      `Generated story contains forbidden imitation language: ${forbiddenImitation}`,
      sourceReferenceIds,
    ));
  }

  let exactMatchCount: number | null = null;
  let nearMatchCount: number | null = null;
  let characterMatchCount: number | null = null;
  let plotMatchCount: number | null = null;
  let shotMatchCount: number | null = null;
  const authorizedExcerpts = similarityEvidence.flatMap(
    evidence => evidence.observations.excerpts.map(excerpt => excerpt.text),
  );
  const referenceSentences = [
    ...(input.reference_original_sentences ?? []),
    ...authorizedExcerpts,
  ];
  if (
    appliedToGeneration
    && referenceSentences.length > 0
  ) {
    exactMatchCount = 0;
    nearMatchCount = 0;
    for (const sentence of referenceSentences) {
      if (sentence.length >= 15 && input.generated_text.includes(sentence)) {
        exactMatchCount += 1;
      } else if (
        sentence.length >= 20
        && computeCharacterOverlap(sentence, input.generated_text) > 0.8
      ) {
        nearMatchCount += 1;
      }
    }
    if (exactMatchCount > 0) {
      issues.push(finding(
        'exact_long_sentence_match',
        'blocker',
        `Generated story contains ${exactMatchCount} exact long-sentence reference match(es).`,
        sourceReferenceIds,
      ));
    }
    if (nearMatchCount > 0) {
      issues.push(finding(
        'near_character_overlap',
        'blocker',
        `Generated story contains ${nearMatchCount} high-overlap reference sentence match(es).`,
        sourceReferenceIds,
      ));
    }
  }

  if (
    appliedToGeneration
    && similarityEvidence.some(
      evidence => evidence.observations.character_profiles.length > 0,
    )
  ) {
    characterMatchCount = similarityEvidence
      .flatMap(evidence => evidence.observations.character_profiles)
      .filter(profile =>
        markerCoverage(profile.distinctive_markers, input.generated_text) >= 0.75)
      .length;
    if (characterMatchCount > 0) {
      issues.push(finding(
        'character_design_similarity',
        'blocker',
        `Generated story matches ${characterMatchCount} distinctive reference character profile(s).`,
        sourceReferenceIds,
      ));
    }
  }

  if (
    appliedToGeneration
    && input.generated_story
    && similarityEvidence.some(evidence => evidence.observations.plot_beats.length > 0)
  ) {
    const sceneTexts = input.generated_story.scene_breakdown.map(scene => [
      scene.plot,
      scene.key_action,
      scene.conflict,
      scene.dialogue_or_narration,
    ].filter(Boolean).join(' '));
    plotMatchCount = similarityEvidence.filter(evidence =>
      sequenceMatches(evidence.observations.plot_beats, sceneTexts)).length;
    if (plotMatchCount > 0) {
      issues.push(finding(
        'plot_structure_similarity',
        'blocker',
        `Generated story matches ${plotMatchCount} distinctive reference plot sequence(s).`,
        sourceReferenceIds,
      ));
    }
  }

  if (
    appliedToGeneration
    && input.generated_story
    && similarityEvidence.some(evidence => evidence.observations.shot_sequence.length > 0)
  ) {
    const shotTexts = input.generated_story.scene_breakdown.map(scene => [
      scene.visual_prompt,
      scene.camera_suggestion,
      scene.key_action,
    ].filter(Boolean).join(' '));
    shotMatchCount = similarityEvidence.filter(evidence =>
      sequenceMatches(evidence.observations.shot_sequence, shotTexts)).length;
    if (shotMatchCount > 0) {
      issues.push(finding(
        'shot_sequence_similarity',
        'blocker',
        `Generated story matches ${shotMatchCount} distinctive reference shot sequence(s).`,
        sourceReferenceIds,
      ));
    }
  }

  const dimensionCounts = [
    exactMatchCount,
    characterMatchCount,
    plotMatchCount,
    shotMatchCount,
  ];
  const completedDimensionCount = dimensionCounts.filter(
    count => count !== null,
  ).length;
  const similarityStatus = !hasReferences
    ? 'not_run_no_reference' as const
    : !appliedToGeneration
      ? 'not_run_reference_not_applied' as const
      : completedDimensionCount === 0
        ? 'not_run_no_authorized_source_material' as const
        : completedDimensionCount === dimensionCounts.length
          ? 'completed' as const
          : 'partially_completed' as const;
  const sentenceStatus = exactMatchCount === null ? 'not_run' as const : 'completed' as const;
  const characterStatus =
    characterMatchCount === null ? 'not_run' as const : 'completed' as const;
  const plotStatus = plotMatchCount === null ? 'not_run' as const : 'completed' as const;
  const shotStatus = shotMatchCount === null ? 'not_run' as const : 'completed' as const;
  const blockedReferenceIds = unique(
    issues.flatMap(issue => issue.reference_ids),
  );
  const status = !hasReferences
    ? 'not_applicable' as const
    : issues.length > 0
      ? 'blocked' as const
      : appliedToGeneration
        ? 'passed_with_limits' as const
        : 'passed' as const;

  return {
    schema_version: 'story-reference-generation-safety/v1',
    status,
    passed: issues.length === 0,
    reference_strength: input.reference_strength ?? null,
    style_pack_ids: stylePackIds,
    source_references: sourceReferences,
    similarity_evidence_refs: evidenceRefs,
    application: {
      applied_to_generation: appliedToGeneration,
      statuses,
    },
    checks: {
      provenance_complete: provenanceComplete,
      avoid_copying_constraints_present: avoidCopyingConstraintsPresent,
      unauthorized_adaptation_claim_absent:
        !issues.some(issue => issue.issue_code === 'unauthorized_adaptation_claim'),
      forbidden_imitation_language_absent:
        !issues.some(issue => issue.issue_code === 'forbidden_imitation_language'),
    },
    similarity: {
      status: similarityStatus,
      exact_long_sentence: { status: sentenceStatus, match_count: exactMatchCount },
      near_character_overlap: { status: sentenceStatus, match_count: nearMatchCount },
      character_design: { status: characterStatus, match_count: characterMatchCount },
      plot_structure: { status: plotStatus, match_count: plotMatchCount },
      shot_sequence: { status: shotStatus, match_count: shotMatchCount },
      similarity_pass_credit_granted: false,
    },
    baseline_comparison: appliedToGeneration
      && input.baseline_story
      && input.generated_story?.storyId
      ? buildStoryReferenceBaselineComparison({
          baseline: input.baseline_story,
          referenceAssisted: {
            storyId: input.generated_story.storyId,
            quality_report: input.generated_story.quality_report,
          },
        })
      : {
          status: 'not_run_single_generation',
          baseline_story_id: null,
          reference_assisted_story_id: null,
          quality_delta: null,
          comparison_credit_granted: false,
        },
    issues,
    warnings,
    blocked_reference_ids: blockedReferenceIds,
    machine_validation_only: true,
    human_review_complete: false,
    real_similarity_check_completed:
      similarityStatus === 'completed'
      && similarityEvidence.length > 0
      && similarityEvidence.every(evidence =>
        evidence.input_provenance === 'operator_submitted'),
    real_credit_granted: false,
  };
}

function uniqueSourceReferences(
  sources: NonNullable<ReferenceTrace['source_references']>,
): NonNullable<ReferenceTrace['source_references']> {
  const byId = new Map(sources.map(source => [source.reference_id, source]));
  return [...byId.values()].map(source => ({ ...source }));
}

function uniqueEvidenceRefs(
  references: NonNullable<ReferenceTrace['similarity_evidence_refs']>,
): NonNullable<ReferenceTrace['similarity_evidence_refs']> {
  const byId = new Map(references.map(reference => [
    reference.evidence_id,
    reference,
  ]));
  return [...byId.values()].map(reference => ({
    ...reference,
    dimensions: [...reference.dimensions],
  }));
}

function normalizeSimilarityText(value: string): string {
  return value.toLocaleLowerCase().replace(
    /[\s，。！？；：、,.!?;:'"“”‘’（）()【】\[\]《》<>—-]+/gu,
    '',
  );
}

function markerCoverage(markers: string[], text: string): number {
  const normalizedText = normalizeSimilarityText(text);
  if (markers.length === 0 || normalizedText.length === 0) return 0;
  const matches = markers.filter(marker =>
    normalizedText.includes(normalizeSimilarityText(marker))).length;
  return matches / markers.length;
}

function sequenceMatches(
  observations: Array<{
    order: number;
    distinctive_markers: string[];
  }>,
  generatedUnits: string[],
): boolean {
  const ordered = [...observations].sort((left, right) => left.order - right.order);
  if (ordered.length < 3) return false;
  let generatedIndex = 0;
  let matched = 0;
  for (const observation of ordered) {
    while (generatedIndex < generatedUnits.length) {
      const candidate = generatedUnits[generatedIndex];
      generatedIndex += 1;
      if (markerCoverage(observation.distinctive_markers, candidate) >= 0.5) {
        matched += 1;
        break;
      }
    }
  }
  return matched / ordered.length >= 0.8;
}

export function validateReferenceSafety(input: ReferenceSafetyInput): ReferenceSafetyReport {
  const issues: string[] = [];
  const warnings: string[] = [];
  const blockedReferences: string[] = [];

  // Rule 1: No unknown-rights references used with strong strength
  if (input.reference_strength === 'strong' && input.reference_rights) {
    const unknownRights = input.reference_rights.filter(r => r === 'unknown');
    if (unknownRights.length > 0) {
      issues.push('reference_strength=strong 时不能使用 rights=unknown 的参考样本——版权状态不明');
      blockedReferences.push(...unknownRights);
    }
  }

  // Rule 2: No "adapted from" claims without authorization
  const adaptedFromPatterns = [
    /改编自[^，。]{2,30}/g,
    /根据[^，。]{2,30}改编/g,
    /改编自[^，。]{2,30}作品/g,
  ];
  for (const pattern of adaptedFromPatterns) {
    const matches = input.generated_text.match(pattern);
    if (matches && matches.length > 0 && !input.claimed_authorization) {
      issues.push(`生成文本中出现"${matches[0]}"——除非用户拥有授权，不允许声称改编自某作品`);
    }
  }

  // Rule 3: No long-sentence copying from reference samples
  if (input.reference_original_sentences && input.reference_original_sentences.length > 0) {
    for (const refSentence of input.reference_original_sentences) {
      // Check if a sentence of 15+ chars from reference appears in generated text
      if (refSentence.length >= 15 && input.generated_text.includes(refSentence)) {
        issues.push(`生成文本中出现参考样本原句"${refSentence.substring(0, 30)}……"——禁止复刻参考样本中的长句`);
        warnings.push(`疑似原文复刻：${refSentence.substring(0, 40)}`);
      }
      // Also check for near-matches (80%+ overlap of characters)
      if (refSentence.length >= 20) {
        const overlap = computeCharacterOverlap(refSentence, input.generated_text);
        if (overlap > 0.8) {
          warnings.push(`疑似近似复刻：与参考样本"${refSentence.substring(0, 30)}"重叠率${Math.round(overlap * 100)}%`);
        }
      }
    }
  }

  // Rule 4: Reference trace should only contain abstract rules, not original passages
  if (input.reference_trace) {
    for (const trace of input.reference_trace) {
      for (const rule of trace.applied_rules) {
        // Rules should be short (< 50 chars) and abstract, not quoting original text
        if (rule.length > 50 && !rule.startsWith('Using') && !rule.startsWith('采用')) {
          warnings.push(`reference_trace中的applied_rules可能包含原文段落而非抽象规则："${rule.substring(0, 50)}"`);
        }
      }
    }
  }

  // Rule 5: "完全仿写某作品" is forbidden
  const forbiddenRequests = ['完全仿写', '仿写某作品', '写得像某位', '复刻某作品'];
  for (const forbidden of forbiddenRequests) {
    if (input.generated_text.includes(forbidden)) {
      issues.push(`生成文本中出现"${forbidden}"——禁止要求完全仿写某作品`);
    }
  }

  const safe = issues.length === 0;

  return {
    safe,
    issues,
    warnings,
    blocked_references: blockedReferences,
  };
}

// ---------------------------------------------------------------------------
// Character overlap computation (simple heuristic for near-match detection)
// ---------------------------------------------------------------------------

function computeCharacterOverlap(reference: string, generated: string): number {
  // For short references, check character-level overlap in any 20-char window of generated text
  if (reference.length < 20) return 0;

  const refChars = [...reference];
  let maxOverlap = 0;

  // Slide a window of reference.length over generated text
  const windowSize = Math.min(reference.length, 60);
  for (let i = 0; i < generated.length - windowSize; i += 10) {
    const window = generated.substring(i, i + windowSize);
    const windowChars = [...window];
    const overlap = refChars.filter(c => windowChars.includes(c)).length / refChars.length;
    if (overlap > maxOverlap) maxOverlap = overlap;
  }

  return maxOverlap;
}

// ---------------------------------------------------------------------------
// Combine dramatic quality + reference safety into unified quality report
// ---------------------------------------------------------------------------

export function combineQualityReports(
  dramaticQuality: StoryQualityReport,
  referenceSafety: ReferenceSafetyReport,
): StoryQualityReport {
  const combinedIssues = [
    ...dramaticQuality.issues,
    ...referenceSafety.issues.map(i => `参考安全：${i}`),
  ];

  // Add warnings as lower-priority issues (won't block but will surface)
  for (const warning of referenceSafety.warnings) {
    combinedIssues.push(`参考安全警告：${warning}`);
  }

  // Pass only if both dramatic quality and reference safety pass
  const passed = dramaticQuality.passed && referenceSafety.safe;

  return {
    ...dramaticQuality,
    passed,
    issues: combinedIssues,
  };
}
