import { FullEntryDetail } from '../types.js';
import { getFullEntryDetail } from '../lib/markdown.js';

export async function getEntryDetail(entryName: string): Promise<FullEntryDetail | null> {
  return await getFullEntryDetail(entryName);
}