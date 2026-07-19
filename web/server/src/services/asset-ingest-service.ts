import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { AssetIngestReport, SeedanceAssetModality } from '@shared/types.js';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 8_192;
const MAX_IMAGE_PIXELS = 40_000_000;

interface DetectedMedia {
  modality: SeedanceAssetModality;
  mime_type: string;
  extension: string;
  width?: number;
  height?: number;
  duration_sec?: number;
  warnings?: string[];
}

export class AssetIngestValidationError extends Error {
  readonly code = 'ASSET_INGEST_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'AssetIngestValidationError';
  }
}

export function inspectMediaAssetUpload(input: {
  original_filename: string;
  declared_mime_type: string;
  expected_modality?: SeedanceAssetModality;
  buffer: Buffer;
}): AssetIngestReport {
  if (input.buffer.length === 0) throw new AssetIngestValidationError('uploaded media is empty');
  if (input.buffer.length > MAX_BYTES) {
    throw new AssetIngestValidationError(`uploaded media exceeds ${MAX_BYTES} bytes`);
  }
  const detected = detectMedia(input.buffer);
  if (!detected) throw new AssetIngestValidationError('unsupported or unrecognized media signature');
  if (input.expected_modality && input.expected_modality !== detected.modality) {
    throw new AssetIngestValidationError(
      `expected ${input.expected_modality} but detected ${detected.modality}`,
    );
  }
  const declaredMime = input.declared_mime_type.trim().toLowerCase();
  if (declaredMime && declaredMime !== 'application/octet-stream' && !mimeEquivalent(declaredMime, detected.mime_type)) {
    throw new AssetIngestValidationError(
      `declared MIME ${declaredMime} does not match detected ${detected.mime_type}`,
    );
  }
  const originalExtension = extname(input.original_filename).toLowerCase();
  if (originalExtension && !extensionEquivalent(originalExtension, detected.extension)) {
    throw new AssetIngestValidationError(
      `filename extension ${originalExtension} does not match detected ${detected.mime_type}`,
    );
  }
  validateTechnicalLimits(detected);

  return {
    schema_version: 'asset-ingest/v1',
    modality: detected.modality,
    detected_mime_type: detected.mime_type,
    canonical_extension: detected.extension,
    byte_size: input.buffer.length,
    content_sha256: createHash('sha256').update(input.buffer).digest('hex'),
    integrity_status: 'verified',
    quarantined: false,
    technical_metadata: {
      width: detected.width,
      height: detected.height,
      duration_sec: detected.duration_sec,
    },
    warnings: detected.warnings ?? [],
  };
}

function detectMedia(buffer: Buffer): DetectedMedia | undefined {
  return detectPng(buffer)
    ?? detectJpeg(buffer)
    ?? detectWebp(buffer)
    ?? detectMp4(buffer)
    ?? detectWav(buffer)
    ?? detectMp3(buffer);
}

function detectPng(buffer: Buffer): DetectedMedia | undefined {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return undefined;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new AssetIngestValidationError('PNG is missing the IHDR header');
  }
  return {
    modality: 'image',
    mime_type: 'image/png',
    extension: '.png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function detectJpeg(buffer: Buffer): DetectedMedia | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) break;
      return {
        modality: 'image',
        mime_type: 'image/jpeg',
        extension: '.jpg',
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  throw new AssetIngestValidationError('JPEG dimensions could not be parsed');
}

function detectWebp(buffer: Buffer): DetectedMedia | undefined {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      modality: 'image', mime_type: 'image/webp', extension: '.webp',
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return {
      modality: 'image', mime_type: 'image/webp', extension: '.webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      modality: 'image', mime_type: 'image/webp', extension: '.webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  throw new AssetIngestValidationError('WebP dimensions could not be parsed');
}

function detectMp4(buffer: Buffer): DetectedMedia | undefined {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return undefined;
  const duration = parseMp4Duration(buffer);
  return {
    modality: 'video',
    mime_type: 'video/mp4',
    extension: '.mp4',
    duration_sec: duration,
    warnings: duration === undefined ? ['duration_not_parsed'] : [],
  };
}

function detectWav(buffer: Buffer): DetectedMedia | undefined {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined;
  }
  const byteRate = buffer.readUInt32LE(28);
  const dataIndex = buffer.indexOf(Buffer.from('data'), 12);
  const dataBytes = dataIndex >= 0 && dataIndex + 8 <= buffer.length ? buffer.readUInt32LE(dataIndex + 4) : 0;
  return {
    modality: 'audio',
    mime_type: 'audio/wav',
    extension: '.wav',
    duration_sec: byteRate > 0 && dataBytes > 0 ? round(dataBytes / byteRate) : undefined,
    warnings: byteRate > 0 && dataBytes > 0 ? [] : ['duration_not_parsed'],
  };
}

function detectMp3(buffer: Buffer): DetectedMedia | undefined {
  const hasId3 = buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';
  const hasFrameSync = buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  if (!hasId3 && !hasFrameSync) return undefined;
  return {
    modality: 'audio',
    mime_type: 'audio/mpeg',
    extension: '.mp3',
    warnings: ['duration_not_parsed'],
  };
}

function validateTechnicalLimits(media: DetectedMedia): void {
  if (media.modality === 'image') {
    if (!media.width || !media.height) throw new AssetIngestValidationError('image dimensions are required');
    if (media.width > MAX_IMAGE_EDGE || media.height > MAX_IMAGE_EDGE) {
      throw new AssetIngestValidationError(`image edge exceeds ${MAX_IMAGE_EDGE}px`);
    }
    if (media.width * media.height > MAX_IMAGE_PIXELS) {
      throw new AssetIngestValidationError(`image pixels exceed ${MAX_IMAGE_PIXELS}`);
    }
  }
}

function parseMp4Duration(buffer: Buffer): number | undefined {
  const index = buffer.indexOf(Buffer.from('mvhd'));
  if (index < 0 || index + 24 > buffer.length) return undefined;
  const version = buffer[index + 4];
  const timescaleOffset = version === 1 ? index + 24 : index + 16;
  const durationOffset = timescaleOffset + 4;
  if (durationOffset + (version === 1 ? 8 : 4) > buffer.length) return undefined;
  const timescale = buffer.readUInt32BE(timescaleOffset);
  if (!timescale) return undefined;
  const duration = version === 1
    ? Number(buffer.readBigUInt64BE(durationOffset))
    : buffer.readUInt32BE(durationOffset);
  return Number.isFinite(duration) ? round(duration / timescale) : undefined;
}

function mimeEquivalent(declared: string, detected: string): boolean {
  if (declared === detected) return true;
  return detected === 'audio/mpeg' && declared === 'audio/mp3';
}

function extensionEquivalent(declared: string, detected: string): boolean {
  if (declared === detected) return true;
  return detected === '.jpg' && declared === '.jpeg';
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
