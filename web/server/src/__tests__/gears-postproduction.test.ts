import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGearsDeliveryPackage } from '../services/gears-delivery-service.js';
import { fidelityStory } from './fixtures/shot-production-baselines.js';
import { buildGearsSpeechContract, parseGearsPostproductionReceipt,
  recordGearsPostproductionReceipt, readGearsPostproductionReceipts } from '../services/gears-postproduction-service.js';

const receipt = () => ({ schema_version: 'gears-postproduction-receipt/v1',
  id: '9a6aa5b7-d7c5-4b7f-96b6-b5e437c4e4db', project_id: '13b31a25-ad15-4f5a-a187-c752e3d01804',
  source: { project_id: 'kb-fixture', story_id: 'story-fixture', version_id: 'version-fixture' },
  timeline_id: 'd8428973-7a73-4b98-b281-f77b025f8853', timeline_sha256: 'a'.repeat(64),
  video: { media_url: '/media/postproduction-fixture.mp4', sha256: 'b'.repeat(64) },
  subtitles: { media_url: '/media/postproduction-fixture.srt', sha256: 'c'.repeat(64) },
  audio_id: '7051f721-f956-41a4-910e-0f9a5e5c6fda', audio_sha256: 'd'.repeat(64),
  fps: 24, total_frames: 48, duration_sec: 2, source_resolutions: [[160, 90]], output_resolution: [320, 180],
  voice_audio_time_stretched: false, human_review_complete: false, real_credit_granted: false,
  provider_call_count: 0, technical_decode_passed: true,
});

describe('S05 independent speech and local receipt contract', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'kb-s05-')); process.env.WEB_GENERATED_ROOT = root; });
  afterEach(async () => { delete process.env.WEB_GENERATED_ROOT; await rm(root, { recursive: true, force: true }); });
  it('exports only canonical speech, never action or full script text', () => {
    const delivery = buildGearsDeliveryPackage(fidelityStory());
    const contract = buildGearsSpeechContract(delivery);
    expect(contract.script_units.map(unit => unit.speech_text)).toEqual(delivery.units
      .filter(unit => unit.production_contract?.speech_text).map(unit => unit.production_contract!.speech_text));
    expect(JSON.stringify(contract)).not.toContain('袁了凡弯腰托住车轮');
    expect(() => buildGearsSpeechContract({ ...delivery, units: delivery.units.map(unit => ({ ...unit, production_contract: undefined })) }))
      .toThrow(/独立/);
  });
  it.each([
    { human_review_complete: true }, { provider_call_count: 1 }, { voice_audio_time_stretched: true },
    { total_frames: 47 }, { source_resolutions: [[0, 90]] },
    { video: { media_url: '/media/../sample.mp4', sha256: 'b'.repeat(64) } },
  ])('rejects an unproven or inconsistent receipt %j', changes => {
    expect(() => parseGearsPostproductionReceipt({ ...receipt(), ...changes })).toThrow();
  });
  it('stores immutable, replayable receipts separately from story versions and credit', async () => {
    const parsed = parseGearsPostproductionReceipt(receipt());
    expect(await recordGearsPostproductionReceipt('kb-fixture', parsed)).toMatchObject({ media_verified_locally: false, real_credit_granted: false });
    await recordGearsPostproductionReceipt('kb-fixture', parsed);
    expect((await readGearsPostproductionReceipts('kb-fixture')).items).toHaveLength(1);
    await expect(recordGearsPostproductionReceipt('other-project', parsed)).rejects.toThrow(/项目/);
    await expect(recordGearsPostproductionReceipt('kb-fixture', { ...parsed, total_frames: 72, duration_sec: 3 })).rejects.toThrow();
  });
  it.skipIf(!process.env.GEARS_S05_RECEIPT_FILE)('accepts the serialized receipt of the actual isolated GEARS local render', async () => {
    const parsed = parseGearsPostproductionReceipt(JSON.parse(await readFile(process.env.GEARS_S05_RECEIPT_FILE!, 'utf8')));
    expect(parsed.total_frames).toBe(48);
    expect(parsed.source_resolutions).toEqual([[160, 90]]);
    expect(parsed.output_resolution).toEqual([320, 180]);
    expect((await recordGearsPostproductionReceipt('kb-fixture', parsed)).media_verified_locally).toBe(false);
  });
});
