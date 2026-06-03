import { CultureEntry, AddRegionEntryResult } from '../types.js';
import { writeEntryToRegionGroup } from '../lib/markdown.js';
import { findProvinceByName } from '../lib/provinces.js';

const REQUIRED_FIELDS: (keyof CultureEntry)[] = [
  'name', 'province', 'region', 'type', 'summary',
  'story', 'culturalSignificance', 'relatedLocations',
  'keywords', 'sources', 'credibility', 'unverifiedPoints',
];

export async function addRegionEntry(entry: CultureEntry): Promise<AddRegionEntryResult> {
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`缺少必填字段：${field}`);
    }
  }

  const provinceName = findProvinceByName(entry.province);
  if (!provinceName) {
    throw new Error(`无效省份：${entry.province}`);
  }

  const result = await writeEntryToRegionGroup(entry, provinceName);
  return {
    province: provinceName,
    regionPrefix: result.regionPrefix,
    entryName: entry.name,
    grouped: result.grouped,
    filePath: result.filePath,
  };
}