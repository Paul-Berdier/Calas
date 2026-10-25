import type { APIRoute } from 'astro';
import { validatePreviewUrl } from '@sanity/preview-url-secret';
import { createServerClient } from '../../../lib/cms/client';
import { contentMode } from '../../../lib/cms/env';
import { createPreviewSession, PREVIEW_COOKIE, PREVIEW_TTL, PRIVATE_HEADERS, safePreviewRedirect } from '../../../lib/cms/preview';

export const prerender = false;
export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    if (contentMode() !== 'sanity') return new Response('La prévisualisation nécessite une connexion Sanity.', { status: 503, headers: PRIVATE_HEADERS });
    const { isValid, redirectTo = '/', studioPreviewPerspective = 'drafts' } = await validatePreviewUrl(createServerClient(true).withConfig({ stega: false }), request.url);
    if (!isValid) return new Response('Accès à la prévisualisation non autorisé.', { status: 401, headers: PRIVATE_HEADERS });
    if (studioPreviewPerspective !== 'drafts' && studioPreviewPerspective !== 'published') {
      return new Response('Cette prévisualisation accepte uniquement les brouillons ou les contenus publiés.', { status: 400, headers: PRIVATE_HEADERS });
    }
    const secure = url.protocol === 'https:' || url.hostname === 'localhost';
    const partitioned = secure && request.headers.get('sec-fetch-dest') === 'iframe' && request.headers.get('sec-fetch-site') === 'cross-site';
    cookies.set(PREVIEW_COOKIE, createPreviewSession(Date.now(), studioPreviewPerspective), {
      path: '/', httpOnly: true, secure,
      sameSite: secure ? 'none' : 'lax', partitioned, maxAge: PREVIEW_TTL,
    });
    return new Response(null, { status: 303, headers: { ...PRIVATE_HEADERS, Location: safePreviewRedirect(redirectTo, url.origin) } });
  } catch {
    return new Response('La prévisualisation est momentanément indisponible.', { status: 503, headers: PRIVATE_HEADERS });
  }
};
