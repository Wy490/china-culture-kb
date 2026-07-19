import type { Request } from 'express';

export interface MultipartAssetUploadFile {
  field_name: string;
  filename: string;
  mime_type: string;
  buffer: Buffer;
}

export interface MultipartAssetUpload {
  fields: Record<string, string>;
  file?: MultipartAssetUploadFile;
}

export async function parseMultipartAssetUpload(
  req: Request,
  options: { max_bytes: number; default_filename: string },
): Promise<MultipartAssetUpload> {
  const boundary = multipartBoundary(req.headers['content-type']);
  if (!boundary) throw new Error('multipart/form-data boundary is required');
  const body = await readRequestBody(req, options.max_bytes);
  const raw = body.toString('latin1');
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields: Record<string, string> = {};
  let file: MultipartAssetUploadFile | undefined;

  for (const part of parts) {
    const normalized = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const headerEnd = normalized.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headerText = normalized.slice(0, headerEnd);
    const content = normalized.slice(headerEnd + 4);
    const headers = Object.fromEntries(headerText.split('\r\n').map((line) => {
      const [name, ...rest] = line.split(':');
      return [name.trim().toLowerCase(), rest.join(':').trim()];
    }));
    const disposition = headers['content-disposition'] ?? '';
    const fieldName = multipartDispositionValue(disposition, 'name');
    if (!fieldName) continue;
    const filename = multipartDispositionValue(disposition, 'filename');
    const contentBuffer = Buffer.from(content, 'latin1');
    if (filename !== undefined) {
      file = {
        field_name: fieldName,
        filename: filename.split(/[\\/]/).pop() || options.default_filename,
        mime_type: headers['content-type'] || 'application/octet-stream',
        buffer: contentBuffer,
      };
    } else {
      fields[fieldName] = contentBuffer.toString('utf8').trim();
    }
  }
  return { fields, file };
}

async function readRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
  return await new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function multipartBoundary(contentType: string | undefined): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  return (match?.[1] ?? match?.[2])?.trim();
}

function multipartDispositionValue(disposition: string, key: string): string | undefined {
  const match = new RegExp(`${key}="([^"]*)"`).exec(disposition);
  return match?.[1];
}
