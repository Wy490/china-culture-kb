import { describe, it, expect } from 'vitest';
import { verifySource } from '../src/tools/verify-source.js';

describe('kb_verify_source', () => {
  it('should assign default credibility for bilibili source', async () => {
    const result = await verifySource({
      sourceType: 'bilibili',
      sourceUrl: 'https://www.bilibili.com/video/BV19dGb66ERy',
      claims: '白蛇传的故事',
      externalVerificationResults: '',
    });
    expect(result.credibility).toBe('待核实');
    expect(result.verificationMethod).toContain('默认评级');
  });

  it('should assign 基本可靠 for book source', async () => {
    const result = await verifySource({
      sourceType: 'book',
      sourceUrl: '',
      sourceAuthor: '冯骥才',
      claims: '中国民间故事',
      externalVerificationResults: 'ISBN 978-7-xxx 可查',
    });
    expect(result.credibility).toBe('基本可靠');
  });

  it('should upgrade credibility with external verification', async () => {
    const result = await verifySource({
      sourceType: 'bilibili',
      sourceUrl: 'https://www.bilibili.com/video/BV19dGb66ERy',
      claims: '白蛇传',
      externalVerificationResults: '非遗名录有白蛇传条目，与中国文化网记载一致',
    });
    expect(result.credibility).toBe('基本可靠');
    expect(result.verificationMethod).toContain('外部核实');
  });

  it('should upgrade credibility with 3+ internal evidence', async () => {
    const result = await verifySource({
      sourceType: 'oral',
      sourceUrl: '',
      claims: '某地方故事',
      externalVerificationResults: '',
      internalEvidenceCount: 3,
    });
    expect(result.credibility).toBe('基本可靠');
    expect(result.verificationMethod).toContain('内部互证');
  });

  it('should mark 存疑 for no evidence', async () => {
    const result = await verifySource({
      sourceType: 'oral',
      sourceUrl: '',
      claims: '某地方故事',
      externalVerificationResults: '',
      internalEvidenceCount: 0,
    });
    expect(result.credibility).toBe('存疑');
  });
});