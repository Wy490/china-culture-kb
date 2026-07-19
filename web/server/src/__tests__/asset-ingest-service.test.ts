import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AssetIngestValidationError,
  inspectMediaAssetUpload,
} from '../services/asset-ingest-service.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('AssetIngestService', () => {
  it('rejects declared PNG files whose magic bytes are plain text', () => {
    expect(() => inspectMediaAssetUpload({
      original_filename: 'fake.png',
      declared_mime_type: 'image/png',
      expected_modality: 'image',
      buffer: Buffer.from('not really a png'),
    })).toThrowError(AssetIngestValidationError);
  });

  it('sniffs PNG media, records dimensions and returns a content hash', () => {
    expect(inspectMediaAssetUpload({
      original_filename: 'reference.png',
      declared_mime_type: 'image/png',
      expected_modality: 'image',
      buffer: ONE_PIXEL_PNG,
    })).toMatchObject({
      schema_version: 'asset-ingest/v1',
      modality: 'image',
      detected_mime_type: 'image/png',
      canonical_extension: '.png',
      byte_size: ONE_PIXEL_PNG.length,
      content_sha256: createHash('sha256').update(ONE_PIXEL_PNG).digest('hex'),
      integrity_status: 'verified',
      quarantined: false,
      technical_metadata: { width: 1, height: 1 },
    });
  });

  it('rejects declared MIME and filename extensions that disagree with sniffed bytes', () => {
    expect(() => inspectMediaAssetUpload({
      original_filename: 'reference.jpg',
      declared_mime_type: 'image/jpeg',
      expected_modality: 'image',
      buffer: ONE_PIXEL_PNG,
    })).toThrow(/does not match detected image\/png/);
  });

  it('rejects SVG uploads from the production ingest boundary', () => {
    expect(() => inspectMediaAssetUpload({
      original_filename: 'reference.svg',
      declared_mime_type: 'image/svg+xml',
      expected_modality: 'image',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    })).toThrow(/unsupported or unrecognized media signature/);
  });
});

export { ONE_PIXEL_PNG };
