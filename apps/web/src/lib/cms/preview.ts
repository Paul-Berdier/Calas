import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { serverEnv } from './env';

export const PREVIEW_COOKIE = 'calas_preview';
export const PREVIEW_TTL = 60 * 60;
export type PreviewPerspective = 'drafts' | 'published';

function secret(): string {
  const value = serverEnv('PREVIEW_SESSION_SECRET');
  if (value.length < 32) throw new Error('A preview signing secret of at least 32 characters is required.');
  return value;
}
function signature(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
export function createPreviewSession(now = Date.now(), perspective: PreviewPerspective = 'drafts'): string {
  if (perspective !== 'drafts' && perspective !== 'published') throw new Error('Unsupported preview perspective.');
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(now / 1000) + PREVIEW_TTL,
    project: serverEnv('PUBLIC_SANITY_PROJECT_ID'),
    dataset: serverEnv('PUBLIC_SANITY_DATASET'),
    perspective,
    nonce: randomUUID(),
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
function readPreviewPerspective(value: string | undefined, now = Date.now()): PreviewPerspective | null {
  if (!value || value.length > 2048 || !serverEnv('SANITY_API_READ_TOKEN')) return null;
  try {
    const parts = value.split('.');
    if (parts.length !== 2) return null;
    const [payload, supplied] = parts as [string, string];
    const expected = Buffer.from(signature(payload), 'base64url');
    const actual = Buffer.from(supplied, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object') return null;
    const p = claims as Record<string, unknown>;
    const valid = typeof p.exp === 'number' && p.exp > Math.floor(now / 1000)
      && p.exp <= Math.floor(now / 1000) + PREVIEW_TTL
      && p.project === serverEnv('PUBLIC_SANITY_PROJECT_ID')
      && p.dataset === serverEnv('PUBLIC_SANITY_DATASET')
      && (p.perspective === 'drafts' || p.perspective === 'published');
    return valid ? p.perspective as PreviewPerspective : null;
  } catch { return null; }
}
export function verifyPreviewSession(value: string | undefined, now = Date.now()): boolean {
  return readPreviewPerspective(value, now) !== null;
}
export function getPreviewPerspective(cookies: AstroCookies): PreviewPerspective | null {
  return readPreviewPerspective(cookies.get(PREVIEW_COOKIE)?.value);
}
export function isPreview(cookies: AstroCookies): boolean {
  return getPreviewPerspective(cookies) !== null;
}
export const previewEnabled = isPreview;

export function safePreviewRedirect(value: string, origin: string): string {
  try {
    if (!value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
    const target = new URL(value, origin);
    if (target.origin !== origin || target.pathname.startsWith('/api/')) return '/';
    target.searchParams.delete('sanity-preview-secret');
    target.searchParams.delete('sanity-preview-perspective');
    target.searchParams.delete('sanity-preview-pathname');
    return target.pathname + target.search + target.hash;
  } catch { return '/'; }
}

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie',
};
