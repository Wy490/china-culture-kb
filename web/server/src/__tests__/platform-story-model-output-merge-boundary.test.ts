import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('story model-output merge platform boundary', () => {
  it('keeps production calls on the platform module and the legacy service as a re-export facade', () => {
    const serviceSource = readFileSync(
      resolve(import.meta.dirname, '..', 'services', 'story-service.ts'),
      'utf8',
    );
    const platformSource = readFileSync(
      resolve(import.meta.dirname, '..', 'platform', 'story-model-output-merge.ts'),
      'utf8',
    );
    const executionSource = readFileSync(
      resolve(import.meta.dirname, '..', 'domains', 'china-culture', 'story-generation-execution-service.ts'),
      'utf8',
    );
    const generationSource = readFileSync(
      resolve(import.meta.dirname, '..', 'domains', 'china-culture', 'story-generation-service.ts'),
      'utf8',
    );

    expect(serviceSource).toContain("from '../domains/china-culture/story-generation-service.js'");
    expect(serviceSource).toContain("} from '../platform/story-model-output-merge.js'");
    expect(serviceSource).not.toMatch(/export function isModelSceneBreakdownCompatible/);
    expect(serviceSource).not.toMatch(/export function mergeModelOutputOntoLocalSkeleton/);
    expect(serviceSource).not.toMatch(/export function mergeCharacterHintsIntoStoryResult/);
    expect(serviceSource).not.toContain('resolveStoryGenerationResult({');
    expect(serviceSource).not.toContain('fallback:scene_breakdown_incompatible_with_local_skeleton');
    expect(generationSource).toContain("from './story-generation-execution-service.js'");
    expect(platformSource).toMatch(/export function isModelSceneBreakdownCompatible/);
    expect(platformSource).toMatch(/export function mergeModelOutputOntoLocalSkeleton/);
    expect(platformSource).toMatch(/export function mergeCharacterHintsIntoStoryResult/);
    expect(platformSource).toMatch(/export function resolveStoryGenerationResult/);
    expect(platformSource).toContain('...local.cultural_constraints');
    expect(executionSource).toContain("from '../../platform/story-model-output-merge.js'");
    expect(executionSource).toContain('resolveStoryGenerationResult({');
    expect(executionSource).toContain('mergeCharacterHintsIntoStoryResult(');
  });
});
