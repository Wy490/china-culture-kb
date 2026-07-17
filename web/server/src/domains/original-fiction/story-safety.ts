import type {
  StoryDomainSafetyFinding,
  StoryDomainSafetyReport,
  StoryGenerateResult,
} from '@shared/types.js';

const DOMAIN_ID = 'original_fiction';
const ENTRY_NAME = '用户原创素材';

export function validateOriginalFictionStoryContent(
  story: StoryGenerateResult,
): StoryDomainSafetyReport {
  const blockers: StoryDomainSafetyFinding[] = [];
  if (story.sourceDomain !== DOMAIN_ID) {
    blockers.push({ rule_id: 'OF-S001-DOMAIN', severity: 'blocker', message: 'sourceDomain 必须固化为 original_fiction' });
  }
  if (story.truth_mode !== 'fictional_original') {
    blockers.push({ rule_id: 'OF-S002-TRUTH-MODE', severity: 'blocker', message: '原创领域必须使用 fictional_original 真实度模式' });
  }
  if (!story.original_user_query?.trim() || story.original_user_query.trim().length < 40) {
    blockers.push({ rule_id: 'OF-S003-USER-MATERIAL', severity: 'blocker', message: '必须保留足够的用户原创大纲' });
  }
  if (
    !story.credibility_note.includes('未核验')
    || !story.credibility_note.includes('不计')
    || story.scene_breakdown.some(scene => !scene.source_entries?.includes(ENTRY_NAME))
  ) {
    blockers.push({ rule_id: 'OF-S004-BOUNDARY', severity: 'blocker', message: '必须保留用户素材、未核验权利和零信用边界' });
  }
  return {
    schema_version: 'story-domain-safety/v1',
    domain: DOMAIN_ID,
    passed: blockers.length === 0,
    evaluated_rule_ids: ['OF-S001-DOMAIN', 'OF-S002-TRUTH-MODE', 'OF-S003-USER-MATERIAL', 'OF-S004-BOUNDARY'],
    blockers,
    warnings: [{
      rule_id: 'OF-S005-HUMAN-RIGHTS-REVIEW',
      severity: 'warning',
      message: '本地机器编排不替代真人编剧、权利、品牌、场地或发布审查。',
    }],
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
}
