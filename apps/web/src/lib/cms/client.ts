import { createClient, type SanityClient } from '@sanity/client';
import type { AstroGlobal } from 'astro';
import { contentMode, serverEnv } from './env';
import { getPreviewPerspective, PRIVATE_HEADERS } from './preview';
import { SITE_CONTENT_QUERY } from './queries';
import type { SiteContent } from './types';

export class ContentUnavailableError extends Error {
  constructor() { super('Le contenu est momentanément indisponible.'); this.name = 'ContentUnavailableError'; }
}

export function createServerClient(preview = false, perspective: 'drafts' | 'published' = 'drafts'): SanityClient {
  const projectId = serverEnv('PUBLIC_SANITY_PROJECT_ID');
  const dataset = serverEnv('PUBLIC_SANITY_DATASET');
  if (!/^[a-z0-9-]+$/.test(projectId) || !/^[a-z0-9_-]+$/.test(dataset)) throw new ContentUnavailableError();
  const token = preview ? serverEnv('SANITY_API_READ_TOKEN') : undefined;
  if (preview && !token) throw new ContentUnavailableError();
  return createClient({
    projectId, dataset, apiVersion: '2026-10-25',
    perspective: preview ? perspective : 'published',
    // Avoid a second cache whose lifetime cannot be controlled by this app.
    useCdn: false, token, timeout: 8000, maxRetries: 1,
    stega: preview ? {
      enabled: true, studioUrl: serverEnv('PUBLIC_SANITY_STUDIO_URL') || 'http://localhost:3333',
      filter: context => context.filterDefault(context) && (
        context.sourcePath.includes('editorial') || context.sourcePath.includes('journal') || context.sourcePath.includes('contact')
        || /(title|intro|text|label|bio|eyebrow|tagline|excerpt|instruction|description|transition|note)$/i.test(String(context.sourcePath.at(-1)))
      ),
    } : false,
  });
}

export async function getSiteContent(context: Pick<AstroGlobal, 'cookies'> & Partial<Pick<AstroGlobal, 'response'>>, options: { publishedOnly?: boolean } = {}): Promise<SiteContent> {
  const perspective = options.publishedOnly ? null : getPreviewPerspective(context.cookies);
  const preview = perspective !== null;
  const headers = context.response?.headers ?? new Headers();
  headers.set('Vary', 'Cookie');
  if (preview) Object.entries(PRIVATE_HEADERS).forEach(([key, value]) => headers.set(key, value));
  try {
    if (contentMode() === 'demo') {
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      const { demoContent } = await import('./demo');
      return demoContent;
    }
    if (!preview) headers.set('Cache-Control', 'public, max-age=0, s-maxage=30, must-revalidate');
    const data = await createServerClient(preview, perspective ?? 'published').fetch<SiteContent>(SITE_CONTENT_QUERY, { includeFuture: perspective === 'drafts' });
    if (!data?.settings?.brand || !data.settings.phone || !data.settings.email || !data.home?.title
      || !data.home.primaryCta?.href || !data.home.secondaryCta?.href || !data.home.diagnostic?.cta?.href
      || !data.home.conviction?.cta?.href || !Array.isArray(data.pages) || !Array.isArray(data.people)
      || !Array.isArray(data.articles)) throw new ContentUnavailableError();
    data.home.statistics = (data.home.statistics ?? []).filter((stat) => stat?.verified);
    data.home.reasons ??= [];
    for (const page of data.pages) page.sections ??= [];
    if (data.settings.qualification?.status !== 'verified' || !data.settings.qualification.personId || !data.settings.qualification.label) data.settings.qualification = { status: 'pending' };
    return data;
  } catch {
    headers.set('Cache-Control', 'private, no-store');
    throw new ContentUnavailableError();
  }
}
