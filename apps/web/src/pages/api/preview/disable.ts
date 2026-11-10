import type {APIRoute} from 'astro';
import {safePreviewRedirect,PRIVATE_HEADERS} from '../../../lib/cms/preview';
export const GET:APIRoute=({url})=>new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:safePreviewRedirect(url.searchParams.get('path')||'/',url.origin)}});
