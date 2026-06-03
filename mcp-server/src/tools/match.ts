import { MatchResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';

interface MatchInput {
  storyText: string;
  provinceHints?: string[];
  typeHint?: string;
}

export async function matchEntries(input: MatchInput): Promise<MatchResult> {
  // When province hints are provided, only read those provinces (not all 34)
  const allFiles = await readAllProvinceFiles(input.provinceHints, !!input.provinceHints);
  const allEntries: MatchResult['entries'] = [];
  let totalEntriesRead = 0;

  for (const [province, content] of allFiles) {
    const entries = parseEntries(content, province);
    totalEntriesRead += entries.length;

    const filtered = input.typeHint
      ? entries.filter(e => e.type === input.typeHint)
      : entries;

    allEntries.push(...filtered);
  }

  return {
    entries: allEntries,
    provinceHints: input.provinceHints ?? [],
    totalEntriesRead,
  };
}