import { describe, expect, it, vi } from 'vitest';
import {
  ExternalEvidenceHttpsRetrievalError,
  retrieveExternalEvidenceHttps,
} from '../services/external-evidence-https-retrieval-service.js';

function body(...chunks: Array<string | Buffer>): AsyncIterable<Uint8Array> {
  return (async function* stream() {
    for (const chunk of chunks) yield typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
  })();
}

describe('external-evidence-https-retrieval-service', () => {
  it('pins a reviewed public DNS result and revalidates an HTTPS redirect', async () => {
    const resolver = vi.fn(async (hostname: string) => hostname === 'evidence.example.org'
      ? [{ address: '93.184.216.34', family: 4 as const }]
      : [{ address: '142.250.72.196', family: 4 as const }]);
    const transport = vi.fn(async (input: { url: URL; pinnedAddress: { address: string } }) => (
      input.url.hostname === 'evidence.example.org'
        ? {
            status: 302,
            headers: { location: 'https://cdn.example.org/evidence.bin' },
            body: body(),
            cancel: (): void => {},
          }
        : {
            status: 200,
            headers: { 'content-type': 'application/pdf', 'content-length': '8' },
            body: body('evidence'),
            cancel: (): void => {},
          }
    ));

    const result = await retrieveExternalEvidenceHttps('https://evidence.example.org/start', {
      resolver,
      transport,
      maxBytes: 32,
    });

    expect(result.bytes.toString('utf8')).toBe('evidence');
    expect(result.final_url).toBe('https://cdn.example.org/evidence.bin');
    expect(result.redirect_count).toBe(1);
    expect(result.content_type).toBe('application/pdf');
    expect(result.resolution_trace).toEqual([
      { hostname: 'evidence.example.org', address: '93.184.216.34', family: 4 },
      { hostname: 'cdn.example.org', address: '142.250.72.196', family: 4 },
    ]);
    expect(transport.mock.calls[0][0].pinnedAddress.address).toBe('93.184.216.34');
    expect(transport.mock.calls[1][0].pinnedAddress.address).toBe('142.250.72.196');
  });

  it.each([
    ['loopback literal', 'https://127.0.0.1/evidence', undefined],
    ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/evidence', undefined],
    ['6to4 transition address', 'https://[2002:7f00:0001::]/evidence', undefined],
    ['credential-bearing URL', 'https://user:secret@example.org/evidence', undefined],
    ['non-standard TLS port', 'https://example.org:8443/evidence', undefined],
    ['local hostname', 'https://metadata.internal/evidence', undefined],
    ['private DNS answer', 'https://example.org/evidence', [{ address: '10.0.0.2', family: 4 as const }]],
    ['mixed DNS answers', 'https://example.org/evidence', [
      { address: '93.184.216.34', family: 4 as const },
      { address: '192.168.1.4', family: 4 as const },
    ]],
  ])('rejects %s before transport', async (_label, url, addresses) => {
    const transport = vi.fn();
    const resolver = vi.fn(async () => addresses ?? [{ address: '93.184.216.34', family: 4 as const }]);
    await expect(retrieveExternalEvidenceHttps(url, { resolver, transport })).rejects.toBeInstanceOf(
      ExternalEvidenceHttpsRetrievalError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('blocks redirects whose DNS answers include a private address', async () => {
    const transport = vi.fn(async () => ({
      status: 302,
      headers: { location: 'https://redirect.example.org/private' },
      body: body(),
      cancel: () => undefined,
    }));
    const resolver = vi.fn(async (hostname: string) => hostname === 'redirect.example.org'
      ? [{ address: '169.254.169.254', family: 4 as const }]
      : [{ address: '93.184.216.34', family: 4 as const }]);

    await expect(retrieveExternalEvidenceHttps('https://evidence.example.org/start', {
      resolver,
      transport,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('cancels responses that exceed the declared or streamed byte limit', async () => {
    const resolver = vi.fn(async () => [{ address: '93.184.216.34', family: 4 as const }]);
    const cancelDeclared = vi.fn();
    await expect(retrieveExternalEvidenceHttps('https://evidence.example.org/declared', {
      resolver,
      maxBytes: 4,
      transport: async () => ({
        status: 200,
        headers: { 'content-length': '5' },
        body: body('small'),
        cancel: cancelDeclared,
      }),
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(cancelDeclared).toHaveBeenCalledOnce();

    const cancelStreamed = vi.fn();
    await expect(retrieveExternalEvidenceHttps('https://evidence.example.org/streamed', {
      resolver,
      maxBytes: 4,
      transport: async () => ({
        status: 200,
        headers: {},
        body: body('abc', 'de'),
        cancel: cancelStreamed,
      }),
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(cancelStreamed).toHaveBeenCalledOnce();
  });
});
