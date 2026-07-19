import type { GearsJobLedgerItem } from '@shared/types.js';

export const LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL = 'https://local.story-agent.invalid/gears-acceptance';

export function artifactIsLocalAcceptance(
  artifact: { role?: string; url?: string; metadata?: Record<string, unknown> },
): boolean {
  return artifact.role === 'local_acceptance'
    || artifact.metadata?.not_external_provider_output === true
    || artifact.url?.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL) === true;
}

export function gearsJobHasLocalAcceptanceArtifact(item: GearsJobLedgerItem): boolean {
  return (item.artifacts ?? []).some(artifact => artifactIsLocalAcceptance(artifact))
    || item.artifact_urls.some(url => url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL));
}

export function gearsJobHasExternalArtifact(item: GearsJobLedgerItem): boolean {
  const hasExternalStructuredArtifact = (item.artifacts ?? []).some(artifact =>
    !artifactIsLocalAcceptance(artifact)
  );
  const hasExternalUrl = item.artifact_urls.some(url =>
    !url.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL)
  );
  return hasExternalStructuredArtifact || hasExternalUrl;
}

function urlHostname(value: string): string | undefined {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function isPlaceholderExternalArtifactUrl(value: string): boolean {
  const host = urlHostname(value);
  return Boolean(
    host === 'example.com'
    || host === 'example.test'
    || host === 'gears.example'
    || host?.endsWith('.example')
    || host?.endsWith('.example.com')
    || host?.endsWith('.example.test')
    || /gears\.example/i.test(value),
  );
}

export function isLocalAcceptanceArtifactUrl(value: string): boolean {
  return value.startsWith(LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL);
}

export function isHttpArtifactUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPrivateOrLocalArtifactUrl(value: string): boolean {
  const host = urlHostname(value)?.replace(/^\[|\]$/g, '');
  if (!host) return false;
  const lowerHost = host.toLowerCase();
  const isIpv6Address = lowerHost.includes(':');
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host === 'host.docker.internal'
    || host === '0.0.0.0'
    || host === '::1'
    || (isIpv6Address && (
      lowerHost.startsWith('fe80:')
      || lowerHost.startsWith('fc')
      || lowerHost.startsWith('fd')
    ))
  ) {
    return true;
  }
  const ipv4Parts = host.split('.').map(part => Number.parseInt(part, 10));
  if (ipv4Parts.length !== 4 || ipv4Parts.some(part => Number.isNaN(part))) return false;
  const [first, second] = ipv4Parts;
  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

export function isExternalProductionArtifactUrl(value: string): boolean {
  return isHttpArtifactUrl(value)
    && !isPlaceholderExternalArtifactUrl(value)
    && !isLocalAcceptanceArtifactUrl(value)
    && !isPrivateOrLocalArtifactUrl(value);
}

export function artifactMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : undefined;
}

export function artifactUrlFilename(value: string): string | undefined {
  try {
    const filename = new URL(value).pathname.split('/').filter(Boolean).at(-1);
    return filename ? decodeURIComponent(filename).slice(0, 240) : undefined;
  } catch {
    return undefined;
  }
}
