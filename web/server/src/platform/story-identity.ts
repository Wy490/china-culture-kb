import { randomUUID } from 'node:crypto';

export function generateStoryId(
  entryName: string,
  sources: {
    now?: () => Date;
    timestamp?: () => number;
    uuid?: () => string;
    random?: () => number;
  } = {},
): string {
  const now = (sources.now ?? (() => new Date()))();
  const timestamp = (sources.timestamp ?? Date.now)();
  const uuid = sources.uuid ?? randomUUID;
  const random = sources.random ?? Math.random;
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const hashInput = `${entryName}-${timestamp}-${uuid()}`;
  let sum = 0;
  for (const character of hashInput) sum += character.charCodeAt(0);
  const uuidSuffix = uuid().replace(/-/g, '').slice(0, 8);
  const hash36 = `${(sum + Math.floor(random() * 100)).toString(36)}${uuidSuffix}`;
  return `${datePart}-story-${hash36}`;
}
