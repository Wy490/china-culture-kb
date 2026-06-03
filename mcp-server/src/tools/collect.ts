import { CultureEntry, CollectResult } from '../types.js';
import { addRegionEntry } from './add-region-entry.js';
import { writeArticleSourceFile, writeBookSourceFile, writeOralSourceFile } from '../lib/sources.js';
import { extractPlatform } from './fetch-article.js';

interface CollectInput {
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
  source_type: string;
  source_url?: string;
  source_title: string;
  source_author?: string;
  source_platform?: string;
  source_publishDate?: string;
  // Oral-specific fields
  source_narrator?: string;
  source_narratorInfo?: string;
  source_location?: string;
  source_date?: string;
  source_recorder?: string;
}

function buildSourceLabel(input: CollectInput): string {
  switch (input.source_type) {
    case 'article':
      return `文章：${input.source_title} (${input.source_url || '无链接'})`;
    case 'book':
      return `书籍：${input.source_title}，作者：${input.source_author || '未知'}`;
    case 'oral':
      return `口述：${input.source_narrator || '未知'}，地点：${input.source_location || '未知'}`;
    default:
      return `${input.source_type}：${input.source_title}`;
  }
}

export async function collect(input: CollectInput): Promise<CollectResult> {
  // Step 1: Build CultureEntry with source reference
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
    sources: [buildSourceLabel(input)],
    credibility: input.credibility as CultureEntry['credibility'],
    verificationMethod: input.verificationMethod,
    unverifiedPoints: JSON.parse(input.unverifiedPoints),
  };

  // Step 2: Write entry to province file (with region grouping)
  const entryResult = await addRegionEntry(entry);

  // Step 3: Write source record based on source_type
  let sourceFile: string;
  try {
    switch (input.source_type) {
      case 'article': {
        const platform = input.source_platform || extractPlatform(input.source_url || '');
        sourceFile = await writeArticleSourceFile(
          {
            url: input.source_url || '',
            title: input.source_title,
            author: input.source_author || '未知',
            platform,
            publishDate: input.source_publishDate || '未知',
          },
          input.summary,
          input.name
        );
        break;
      }
      case 'book': {
        sourceFile = await writeBookSourceFile(
          {
            title: input.source_title,
            author: input.source_author || '未知',
          },
          input.summary,
          input.name
        );
        break;
      }
      case 'oral': {
        sourceFile = await writeOralSourceFile(
          {
            narrator: input.source_narrator || '未知',
            narratorInfo: input.source_narratorInfo || '',
            location: input.source_location || '',
            date: input.source_date || '',
            recorder: input.source_recorder || '',
          },
          input.name,
          input.name
        );
        break;
      }
      default:
        throw new Error(`不支持的来源类型：${input.source_type}。支持：article, book, oral`);
    }
  } catch (e) {
    sourceFile = `来源记录写入失败：${(e as Error).message}`;
  }

  return {
    sourceFile,
    entryFile: entryResult.filePath,
    entryInfo: {
      name: entryResult.entryName,
      province: entryResult.province,
      regionPrefix: entryResult.regionPrefix,
      grouped: entryResult.grouped,
    },
  };
}