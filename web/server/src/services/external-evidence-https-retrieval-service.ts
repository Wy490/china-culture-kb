import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { ErrorCodes } from '@shared/types.js';

export const EXTERNAL_EVIDENCE_HTTPS_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2_048;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface ExternalEvidenceHttpsResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface ExternalEvidenceHttpsResolutionTrace extends ExternalEvidenceHttpsResolvedAddress {
  hostname: string;
}

export interface ExternalEvidenceHttpsTransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel: (reason?: Error) => void;
}

export interface ExternalEvidenceHttpsTransportInput {
  url: URL;
  pinnedAddress: ExternalEvidenceHttpsResolvedAddress;
  timeoutMs: number;
}

export type ExternalEvidenceHttpsResolver = (
  hostname: string,
) => Promise<ExternalEvidenceHttpsResolvedAddress[]>;

export type ExternalEvidenceHttpsTransport = (
  input: ExternalEvidenceHttpsTransportInput,
) => Promise<ExternalEvidenceHttpsTransportResponse>;

export interface ExternalEvidenceHttpsRetrievalResult {
  bytes: Buffer;
  final_url: string;
  redirect_count: number;
  content_type: string;
  resolution_trace: ExternalEvidenceHttpsResolutionTrace[];
}

export interface ExternalEvidenceHttpsRetrievalOptions {
  resolver?: ExternalEvidenceHttpsResolver;
  transport?: ExternalEvidenceHttpsTransport;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}

export class ExternalEvidenceHttpsRetrievalError extends Error {
  readonly code = ErrorCodes.VALIDATION_ERROR;

  constructor(message: string) {
    super(message);
    this.name = 'ExternalEvidenceHttpsRetrievalError';
  }
}

function retrievalError(message: string): never {
  throw new ExternalEvidenceHttpsRetrievalError(message);
}

function normalizedHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function parseIpv4(value: string): number[] | undefined {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return undefined;
  const numbers = parts.map(part => Number(part));
  return numbers.every(part => part >= 0 && part <= 255) ? numbers : undefined;
}

function ipv4Number(parts: number[]): number {
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function ipv4InCidr(value: number, base: number, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function publicIpv4(value: string): boolean {
  const parts = parseIpv4(value);
  if (!parts) return false;
  const address = ipv4Number(parts);
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  return !blocked.some(([base, prefix]) => ipv4InCidr(address, ipv4Number(parseIpv4(base)!), prefix));
}

function expandedIpv6(value: string): number[] | undefined {
  let normalized = value.toLowerCase();
  if (normalized.includes('%')) return undefined;
  const ipv4Match = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[2]);
    if (!ipv4) return undefined;
    normalized = `${ipv4Match[1]}${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  if ((normalized.match(/::/g) ?? []).length > 1) return undefined;
  const [leftRaw, rightRaw] = normalized.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const missing = normalized.includes('::') ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
  if (groups.length !== 8 || groups.some(group => !/^[a-f0-9]{1,4}$/.test(group))) return undefined;
  return groups.map(group => Number.parseInt(group, 16));
}

function publicIpv6(value: string): boolean {
  const groups = expandedIpv6(value);
  if (!groups) return false;
  if (groups.every(group => group === 0)) return false;
  if (groups.slice(0, 7).every(group => group === 0) && groups[7] === 1) return false;
  if ((groups[0] & 0xfe00) === 0xfc00) return false;
  if ((groups[0] & 0xffc0) === 0xfe80 || (groups[0] & 0xffc0) === 0xfec0) return false;
  if ((groups[0] & 0xff00) === 0xff00) return false;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
  if (groups[0] === 0x2002) return false;
  if (groups[0] === 0x2001 && (
    groups[1] === 0x0000
    || groups[1] === 0x0002
    || (groups[1] & 0xfff0) === 0x0010
    || (groups[1] & 0xfff0) === 0x0020
  )) return false;
  if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff) {
    return publicIpv4(`${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`);
  }
  return groups[0] >= 0x2000 && groups[0] <= 0x3fff;
}

export function isPublicExternalEvidenceAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? publicIpv4(address) : family === 6 ? publicIpv6(address) : false;
}

function assertSafeUrl(rawUrl: string): URL {
  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) retrievalError('External evidence HTTPS URL is empty or too long');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return retrievalError('External evidence HTTPS URL is invalid');
  }
  if (url.protocol !== 'https:') retrievalError('External evidence retrieval requires HTTPS');
  if (url.username || url.password) retrievalError('External evidence HTTPS URL must not include credentials');
  if (url.port && url.port !== '443') retrievalError('External evidence HTTPS URL must use the standard TLS port');
  const hostname = normalizedHostname(url);
  if (!hostname) retrievalError('External evidence HTTPS URL must include a hostname');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home.arpa')
    || hostname.endsWith('.test')
    || hostname.endsWith('.invalid')
    || hostname.endsWith('.example')
    || hostname.endsWith('.onion')
  ) {
    retrievalError('External evidence HTTPS hostname is local, reserved, or non-public');
  }
  if (isIP(hostname) && !isPublicExternalEvidenceAddress(hostname)) {
    retrievalError('External evidence HTTPS address is not globally routable');
  }
  return url;
}

const defaultResolver: ExternalEvidenceHttpsResolver = async hostname => {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers
    .filter(answer => answer.family === 4 || answer.family === 6)
    .map(answer => ({ address: answer.address, family: answer.family as 4 | 6 }));
};

const defaultTransport: ExternalEvidenceHttpsTransport = async input => await new Promise((resolvePromise, reject) => {
  const request = httpsRequest(input.url, {
    method: 'GET',
    headers: {
      accept: '*/*',
      'accept-encoding': 'identity',
      'user-agent': 'china-culture-story-agent/external-evidence-v1',
    },
    lookup: (_hostname, _options, callback) => {
      callback(null, input.pinnedAddress.address, input.pinnedAddress.family);
    },
    rejectUnauthorized: true,
    servername: normalizedHostname(input.url),
  }, response => {
    resolvePromise({
      status: response.statusCode ?? 0,
      headers: response.headers,
      body: response,
      cancel: reason => response.destroy(reason),
    });
  });
  request.setTimeout(input.timeoutMs, () => {
    request.destroy(new ExternalEvidenceHttpsRetrievalError('External evidence HTTPS request timed out'));
  });
  request.on('error', reject);
  request.end();
});

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function resolvePinnedAddress(
  url: URL,
  resolver: ExternalEvidenceHttpsResolver,
): Promise<{ pinned: ExternalEvidenceHttpsResolvedAddress; hostname: string }> {
  const hostname = normalizedHostname(url);
  if (isIP(hostname)) {
    const family = isIP(hostname) as 4 | 6;
    return { pinned: { address: hostname, family }, hostname };
  }
  let answers: ExternalEvidenceHttpsResolvedAddress[];
  try {
    answers = await resolver(hostname);
  } catch (error) {
    return retrievalError(
      `External evidence HTTPS DNS resolution failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (!answers.length) retrievalError('External evidence HTTPS hostname has no usable DNS answers');
  if (answers.some(answer => (
    isIP(answer.address) !== answer.family
    || !isPublicExternalEvidenceAddress(answer.address)
  ))) {
    retrievalError('External evidence HTTPS DNS answers include a non-public address');
  }
  return { pinned: answers[0], hostname };
}

export async function retrieveExternalEvidenceHttps(
  sourceUrl: string,
  options: ExternalEvidenceHttpsRetrievalOptions = {},
): Promise<ExternalEvidenceHttpsRetrievalResult> {
  const resolver = options.resolver ?? defaultResolver;
  const transport = options.transport ?? defaultTransport;
  const maxBytes = options.maxBytes ?? EXTERNAL_EVIDENCE_HTTPS_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > EXTERNAL_EVIDENCE_HTTPS_MAX_BYTES) {
    retrievalError('External evidence HTTPS maxBytes is invalid');
  }
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > DEFAULT_MAX_REDIRECTS) {
    retrievalError('External evidence HTTPS maxRedirects is invalid');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    retrievalError('External evidence HTTPS timeoutMs is invalid');
  }

  let currentUrl = assertSafeUrl(sourceUrl);
  let redirectCount = 0;
  const resolutionTrace: ExternalEvidenceHttpsResolutionTrace[] = [];
  while (true) {
    const { pinned, hostname } = await resolvePinnedAddress(currentUrl, resolver);
    resolutionTrace.push({ hostname, ...pinned });
    let response: ExternalEvidenceHttpsTransportResponse;
    try {
      response = await transport({ url: currentUrl, pinnedAddress: pinned, timeoutMs });
    } catch (error) {
      return retrievalError(
        `External evidence HTTPS transport failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      response.cancel();
      const location = firstHeader(response.headers, 'location');
      if (!location) retrievalError('External evidence HTTPS redirect is missing Location');
      if (redirectCount >= maxRedirects) retrievalError('External evidence HTTPS redirect limit exceeded');
      currentUrl = assertSafeUrl(new URL(location, currentUrl).toString());
      redirectCount += 1;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      response.cancel();
      retrievalError(`External evidence HTTPS request returned HTTP ${response.status}`);
    }
    const declaredLength = Number(firstHeader(response.headers, 'content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      response.cancel();
      retrievalError(`External evidence HTTPS response exceeds ${maxBytes} bytes`);
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    try {
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > maxBytes) {
          response.cancel();
          retrievalError(`External evidence HTTPS response exceeds ${maxBytes} bytes`);
        }
        chunks.push(buffer);
      }
    } catch (error) {
      if (error instanceof ExternalEvidenceHttpsRetrievalError) throw error;
      return retrievalError(
        `External evidence HTTPS response failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    if (totalBytes === 0) retrievalError('External evidence HTTPS response is empty');
    return {
      bytes: Buffer.concat(chunks),
      final_url: currentUrl.toString(),
      redirect_count: redirectCount,
      content_type: firstHeader(response.headers, 'content-type')?.split(';')[0]?.trim().toLowerCase()
        || 'application/octet-stream',
      resolution_trace: resolutionTrace,
    };
  }
}
