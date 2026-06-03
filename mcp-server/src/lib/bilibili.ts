export interface BilibiliVideoInfo {
  bvid: string;
  title: string;
  ownerName: string;
  ownerMid: number;
  publishDate: string;
  description: string;
  duration: number;
}

export async function getVideoInfo(bvid: string): Promise<BilibiliVideoInfo | null> {
  try {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ChinaCultureKB/0.1' },
    });
    if (!response.ok) return null;

    const data = await response.json() as any;
    if (data.code !== 0) return null;

    return {
      bvid: data.data.bvid,
      title: data.data.title,
      ownerName: data.data.owner.name,
      ownerMid: data.data.owner.mid,
      publishDate: new Date(data.data.pubdate * 1000).toISOString().split('T')[0],
      description: data.data.desc,
      duration: data.data.duration,
    };
  } catch {
    return null;
  }
}