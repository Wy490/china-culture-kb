import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { GearsDeliveryPackage } from '@shared/types.js';
import type { GearsPostproductionReceipt, GearsSpeechContract } from '@shared/gears-postproduction.js';
import { FileJobRepository } from '../repositories/job-repository.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const dimension = z.number().int().positive();
const resolution = z.tuple([dimension, dimension]);
const artifact = z.object({ media_url: z.string().regex(/^\/media\/[a-zA-Z0-9_-]+\.(?:mp4|srt)$/), sha256: sha }).strict();
const receiptSchema = z.object({
  schema_version: z.literal('gears-postproduction-receipt/v1'), id: z.string().uuid(), project_id: z.string().uuid(),
  source: z.object({ project_id: z.string().min(1), story_id: z.string().min(1), version_id: z.string().min(1) }).strict().nullable(),
  timeline_id: z.string().uuid(), timeline_sha256: sha, video: artifact, subtitles: artifact,
  fps: z.literal(24), total_frames: z.number().int().positive().safe(), duration_sec: z.number().finite().positive(),
  source_resolutions: z.array(resolution).min(1), output_resolution: resolution,
  audio_id: z.string().uuid(), audio_sha256: sha, voice_audio_time_stretched: z.literal(false),
  human_review_complete: z.literal(false), real_credit_granted: z.literal(false), provider_call_count: z.literal(0),
  technical_decode_passed: z.literal(true),
}).strict().refine(value => Math.abs(value.total_frames / 24 - value.duration_sec) < 1e-8, '总帧数与时长不同')
  .refine(value => value.video.media_url.endsWith('.mp4') && value.subtitles.media_url.endsWith('.srt'), '产物类型不符');

export function parseGearsPostproductionReceipt(value: unknown): GearsPostproductionReceipt {
  return receiptSchema.parse(value);
}

export function buildGearsSpeechContract(delivery: GearsDeliveryPackage): GearsSpeechContract {
  if (delivery.units.some(unit => !unit.production_contract)) throw new Error('缺少独立旁白/对白合同，请先补齐镜头计划');
  const script_units = delivery.units.filter(unit => unit.production_contract!.speech_text.trim()).map(unit => ({
    unit_id: unit.unit_id, speech_text: unit.production_contract!.speech_text,
  }));
  if (!script_units.length || new Set(script_units.map(unit => unit.unit_id)).size !== script_units.length) {
    throw new Error('独立语音单元为空或重复');
  }
  return { schema_version: 'gears-speech-contract/v1', story_id: delivery.storyId, script_units, provider_call_count: 0 };
}

const eventSchema = z.object({ receipt: receiptSchema, recorded_at: z.string(),
  media_verified_locally: z.literal(false), real_credit_granted: z.literal(false) }).strict();
type ReceiptEvent = z.infer<typeof eventSchema>;
function repository(projectId: string): FileJobRepository<ReceiptEvent> {
  const key = createHash('sha256').update(projectId).digest('hex').slice(0, 24);
  return new FileJobRepository(resolve(storyGeneratedRoot(), 'gears-postproduction-receipts'), `project-${key}.jsonl`, {
    normalize_item: value => { const result = eventSchema.safeParse(value); return result.success ? result.data : undefined; },
    item_id: value => `${value.receipt.project_id}:${value.receipt.id}`,
  });
}

export async function recordGearsPostproductionReceipt(projectId: string, value: unknown): Promise<ReceiptEvent> {
  const receipt = parseGearsPostproductionReceipt(value);
  if (receipt.source?.project_id !== projectId) throw new Error('后期回执没有此 KB 项目的来源身份');
  const repo = repository(projectId);
  const previous = (await repo.read()).items.find(item => item.receipt.id === receipt.id && item.receipt.project_id === receipt.project_id);
  if (previous) {
    if (JSON.stringify(previous.receipt) !== JSON.stringify(receipt)) throw new Error('后期回执不可覆盖');
    return previous;
  }
  return (await repo.append({ receipt, recorded_at: new Date().toISOString(), media_verified_locally: false,
    real_credit_granted: false })).item;
}

export async function readGearsPostproductionReceipts(projectId: string) {
  const snapshot = await repository(projectId).read();
  return { project_id: projectId, items: snapshot.items.slice().reverse(), real_credit_granted: false as const };
}
