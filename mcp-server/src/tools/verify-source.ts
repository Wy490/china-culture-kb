import { VerifyResult, SourceType, CredibilityLevel } from '../types.js';

interface VerifyInput {
  sourceType: SourceType;
  sourceUrl?: string;
  sourceAuthor?: string;
  claims: string;
  externalVerificationResults?: string;
  internalEvidenceCount?: number;
}

const DEFAULT_CREDIBILITY: Record<SourceType, CredibilityLevel> = {
  bilibili: '待核实',
  article: '待核实',
  book: '基本可靠',
  oral: '待核实',
};

export async function verifySource(input: VerifyInput): Promise<VerifyResult> {
  let credibility = DEFAULT_CREDIBILITY[input.sourceType];
  let verificationMethod = `默认评级（${input.sourceType}类来源）`;
  const unverifiedPoints: string[] = [];

  if (input.externalVerificationResults && input.externalVerificationResults.trim()) {
    credibility = '基本可靠';
    verificationMethod = `外部核实：${input.externalVerificationResults}`;
  }

  if (credibility === '待核实' && input.internalEvidenceCount !== undefined) {
    if (input.internalEvidenceCount >= 3) {
      credibility = '基本可靠';
      verificationMethod = `内部互证：知识库内${input.internalEvidenceCount}条佐证`;
    } else if (input.internalEvidenceCount >= 1) {
      verificationMethod += `；内部部分佐证：${input.internalEvidenceCount}条`;
    }
  }

  // 存疑仅适用于：已明确核查外部和内部，两者都无佐证
  if (credibility === '待核实' && input.externalVerificationResults !== undefined && input.internalEvidenceCount !== undefined && (input.internalEvidenceCount ?? 0) === 0) {
    credibility = '存疑';
    unverifiedPoints.push(`来源类型${input.sourceType}无外部佐证`);
    unverifiedPoints.push('知识库内无相关条目佐证');
    unverifiedPoints.push('建议后续寻找权威来源印证');
  }

  switch (input.sourceType) {
    case 'bilibili':
      unverifiedPoints.push('UP主资质待查');
      unverifiedPoints.push('评论区考证信息待收集');
      break;
    case 'article':
      unverifiedPoints.push('平台权威性待评估');
      unverifiedPoints.push('作者背景待查');
      break;
    case 'oral':
      unverifiedPoints.push('讲述人背景是否可考');
      unverifiedPoints.push('故事与其他版本的一致性');
      unverifiedPoints.push('地域归属是否准确');
      break;
    case 'book':
      if (!input.sourceUrl && !input.sourceAuthor) {
        unverifiedPoints.push('ISBN/DOI信息缺失');
      }
      break;
  }

  return {
    credibility,
    verificationMethod,
    details: `来源类型：${input.sourceType}，主张：${input.claims}`,
    unverifiedPoints,
    internalEvidenceCount: input.internalEvidenceCount ?? 0,
  };
}