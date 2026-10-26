import type {APIRoute} from 'astro';
import {requireEditor} from '../../../server/auth/permissions';
import {safePreviewRedirect,PRIVATE_HEADERS} from '../../../lib/cms/preview';
import {jsonError} from '../../../server/http';
export const GET:APIRoute=async({request,url})=>{try{await requireEditor(request);const path=safePreviewRedirect(url.searchParams.get('path')||'/',url.origin);const target=new URL(path,url.origin);target.searchParams.set('preview','1');return new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:target.pathname+target.search+target.hash}});}catch(error){return jsonError(error);}};
