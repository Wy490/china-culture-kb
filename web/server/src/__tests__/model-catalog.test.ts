import { describe, expect, it } from 'vitest';
import {
  getModelProfileById,
  getRecommendedModelProfile,
  listModelProfiles,
  resolveModelProfile,
} from '../services/model-catalog.js';

describe('model-catalog', () => {
  it('returns curated model profiles with a recommended default', () => {
    const profiles = listModelProfiles();

    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.some(profile => profile.recommended)).toBe(true);
    expect(profiles.every(profile => profile.capabilities.length > 0)).toBe(true);
  });

  it('looks up a model profile by id', () => {
    const profile = getModelProfileById('claude_sonnet');

    expect(profile).toBeTruthy();
    expect(profile?.runtime).toBe('claude');
    expect(profile?.model).toBe('sonnet');
  });

  it('returns the recommended profile when requested', () => {
    const profile = getRecommendedModelProfile();

    expect(profile.id).toBe('claude_sonnet');
    expect(profile.recommended).toBe(true);
  });

  it('falls back to the recommended profile for invalid ids', () => {
    const profile = resolveModelProfile('not-a-real-model');

    expect(profile.id).toBe('claude_sonnet');
    expect(profile.recommended).toBe(true);
  });
});
