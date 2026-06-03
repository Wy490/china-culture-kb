import { describe, it, expect } from 'vitest';
import { extractPlatform } from '../src/tools/fetch-article.js';

describe('kb_fetch_article', () => {
  it('should extract platform from URL', () => {
    expect(extractPlatform('https://mp.weixin.qq.com/s/abc')).toBe('微信公众号');
    expect(extractPlatform('https://zhuanlan.zhihu.com/p/123')).toBe('知乎');
    expect(extractPlatform('https://www.toutiao.com/article/456')).toBe('头条号');
    expect(extractPlatform('https://www.chinaculture.org/festival')).toBe('中国文化网');
    expect(extractPlatform('https://example.com/some-article')).toBe('其他');
  });

  it('should return 其他 for invalid URL', () => {
    expect(extractPlatform('not-a-url')).toBe('其他');
  });
});