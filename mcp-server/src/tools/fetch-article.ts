import { ArticleSource } from '../types.js';

const PLATFORM_MAP: Record<string, string> = {
  'mp.weixin.qq.com': '微信公众号',
  'zhuanlan.zhihu.com': '知乎',
  'www.zhihu.com': '知乎',
  'www.toutiao.com': '头条号',
  'www.sohu.com': '搜狐',
  'www.163.com': '网易',
  'www.people.com.cn': '人民网',
  'www.chinaculture.org': '中国文化网',
};

export function extractPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, platform] of Object.entries(PLATFORM_MAP)) {
      if (hostname.includes(domain)) return platform;
    }
    return '其他';
  } catch {
    return '其他';
  }
}

interface FetchArticleInput {
  url: string;
}

export async function fetchArticle(input: FetchArticleInput): Promise<ArticleSource | null> {
  try {
    const response = await fetch(input.url, {
      headers: { 'User-Agent': 'ChinaCultureKB/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';

    const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["'](.*?)["']/i);
    const author = authorMatch?.[1] || '未知';

    const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["'](.*?)["']/i);
    const publishDate = dateMatch?.[1]?.split('T')[0] || '';

    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    return {
      url: input.url,
      title,
      author,
      platform: extractPlatform(input.url),
      publishDate,
      content,
    };
  } catch {
    return null;
  }
}