import { CultureEntry } from '../types.js';
import { writeEntryToProvince } from '../lib/markdown.js';
import { findProvinceByName } from '../lib/provinces.js';

const REQUIRED_FIELDS: (keyof CultureEntry)[] = [
  'name', 'province', 'region', 'type', 'summary',
  'story', 'culturalSignificance', 'relatedLocations',
  'keywords', 'sources', 'credibility', 'unverifiedPoints',
];

export async function addEntry(entry: CultureEntry): Promise<{ filePath: string; message: string }> {
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`缺少必填字段：${field}`);
    }
  }

  const provinceName = findProvinceByName(entry.province);
  if (!provinceName) {
    throw new Error(`无效省份：${entry.province}`);
  }

  const filePath = await writeEntryToProvince(entry, provinceName);
  return { filePath, message: `条目"${entry.name}"已写入${provinceName}` };
}