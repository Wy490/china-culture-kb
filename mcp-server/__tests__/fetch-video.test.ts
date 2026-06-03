import { describe, it, expect } from 'vitest';
import { extractBvId } from '../src/tools/fetch-video.js';

describe('kb_fetch_video', () => {
  it('should extract BV id from URL', () => {
    const bvId = extractBvId('https://www.bilibili.com/video/BV19dGb66ERy');
    expect(bvId).toBe('BV19dGb66ERy');
  });

  it('should accept BV id directly', () => {
    const bvId = extractBvId('BV19dGb66ERy');
    expect(bvId).toBe('BV19dGb66ERy');
  });

  it('should return null for invalid input', () => {
    const bvId = extractBvId('not-a-bv-id');
    expect(bvId).toBeNull();
  });
});