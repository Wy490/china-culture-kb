import fs from 'node:fs/promises';

export function parseProductionMaterialSourceObservationsJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('sourceObservations must contain valid JSON');
  }
}

export async function loadProductionMaterialSourceObservationsFile(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    throw new Error('observations file is unavailable');
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('observations file must contain valid JSON');
  }
}

export function formatProductionMaterialDraftCliError(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'production material pack draft failed';
}
