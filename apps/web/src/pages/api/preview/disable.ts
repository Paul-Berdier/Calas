import type { APIRoute } from 'astro';
import { PREVIEW_COOKIE, PRIVATE_HEADERS } from '../../../lib/cms/preview';

export const prerender = false;
export const GET: APIRoute = ({ url }) => {
  const secure = url.protocol === 'https:' || url.hostname === 'localhost';
  const expired = `${PREVIEW_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=${secure ? 'None; Secure' : 'Lax'}`;
  const headers = new Headers({ ...PRIVATE_HEADERS, Location: '/' });
  headers.append('Set-Cookie', expired);
  if (secure) headers.append('Set-Cookie', `${expired}; Partitioned`);
  return new Response(null, { status: 303, headers });
};
