import { CultureEntry, IngestVideoResult } from '../types.js';
import { fetchVideo } from './fetch-video.js';
import { addRegionEntry } from './add-region-entry.js';
import { writeVideoSourceFile } from '../lib/sources.js';

interface IngestVideoInput {
  video_url: string;
  name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  story: string;
  culturalSignificance: string;
  relatedLocations: string;
  keywords: string;
  credibility: string;
  unverifiedPoints: string;
  verificationMethod?: string;
}

export async function ingestVideo(input: IngestVideoInput): Promise<IngestVideoResult> {
  // Step 1: Fetch video metadata
  const videoResult = await fetchVideo({ url: input.video_url });
  if (!videoResult) {
    throw new Error('无法获取视频信息，请检查链接或BV号');
  }

  // Step 2: Build CultureEntry with video source reference
  const entry: CultureEntry = {
    name: input.name,
    province: input.province,
    region: input.region,
    type: input.type as CultureEntry['type'],
    summary: input.summary,
    story: input.story,
    culturalSignificance: input.culturalSignificance,
    relatedLocations: JSON.parse(input.relatedLocations),
    keywords: input.keywords.split(/[，,、]/),
    sources: [`B站视频：${videoResult.bvId} ${videoResult.title}`],
    credibility: input.credibility as CultureEntry['credibility'],
    verificationMethod: input.verificationMethod,
    unverifiedPoints: JSON.parse(input.unverifiedPoints),
  };

  // Step 3: Write entry to province file (with region grouping)
  const entryResult = await addRegionEntry(entry);

  // Step 4: Write video source record
  let sourceFile: string;
  try {
    sourceFile = await writeVideoSourceFile(videoResult, input.summary, input.name);
  } catch (e) {
    // Source record failure doesn't block entry write
    sourceFile = `来源记录写入失败：${(e as Error).message}`;
  }

  return {
    sourceFile,
    entryFile: entryResult.filePath,
    videoInfo: videoResult,
    entryInfo: {
      name: entryResult.entryName,
      province: entryResult.province,
      regionPrefix: entryResult.regionPrefix,
      grouped: entryResult.grouped,
    },
  };
}