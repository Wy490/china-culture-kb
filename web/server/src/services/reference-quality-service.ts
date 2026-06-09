// web/server/src/services/reference-quality-service.ts — Reference-aware quality validation
// Checks generated stories against creative reference safety rules:
//   - No long-sentence copying from reference samples
//   - No unknown-rights references used with strong strength
//   - No "adapted from" claims without authorization
//   - Reference trace records only abstract rules, not original passages

import type {
  StoryQualityReport,
  ReferenceTrace,
  StoryStructureType,
} from '@shared/types.js';

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
  claimed_authorization?: boolean;    // user claims they have rights to "adapt from" a work
  reference_original_sentences?: string[]; // sentences from reference samples (for similarity check)
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
    hasCentralEvent: dramaticQuality.hasCentralEvent,
    hasConflict: dramaticQuality.hasConflict,
    hasProtagonistChoice: dramaticQuality.hasProtagonistChoice,
    hasSceneAction: dramaticQuality.hasSceneAction,
    hasClimax: dramaticQuality.hasClimax,
    hasEndingTheme: dramaticQuality.hasEndingTheme,
    isNotBiographySummary: dramaticQuality.isNotBiographySummary,
    passed,
    issues: combinedIssues,
  };
}