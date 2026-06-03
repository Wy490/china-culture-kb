import { getVideoInfo } from '../lib/bilibili.js';
import { VideoSource } from '../types.js';

export function extractBvId(input: string): string | null {
  const match = input.match(/BV[\w]+/);
  return match ? match[0] : null;
}

interface FetchVideoInput {
  bvId?: string;
  url?: string;
}

export async function fetchVideo(input: FetchVideoInput): Promise<VideoSource | null> {
  const bvid = input.bvId ?? extractBvId(input.url ?? '');
  if (!bvid) return null;

  const info = await getVideoInfo(bvid);
  if (!info) return null;

  return {
    bvId: info.bvid,
    url: `https://www.bilibili.com/video/${info.bvid}`,
    title: info.title,
    upOwner: info.ownerName,
    publishDate: info.publishDate,
    topic: '中华传统文化及故事',
    status: '待整理',
  };
}