import type {APIContext} from 'astro';
import {getActor} from '../../server/auth/permissions';
export const PRIVATE_HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer',Vary:'Cookie'};
export async function isPreview(context:Pick<APIContext,'request'|'url'|'locals'>):Promise<boolean>{
  if(context.locals.cmsPreview!==undefined)return context.locals.cmsPreview;
  if(context.url.searchParams.get('preview')!=='1')return false;
  return Boolean(await getActor(context.request));
}
export function safePreviewRedirect(value:string,origin:string):string{
  try{
    if(value.length>4096||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return '/';
    const target=new URL(value,origin);
    let decodedPath=target.pathname;
    for(let count=0;count<4;count++){
      const next=decodeURIComponent(decodedPath);
      if(next===decodedPath)break;
      decodedPath=next;
    }
    if(target.origin!==origin||/[\\\u0000-\u001f\u007f]/.test(decodedPath)||decodedPath.startsWith('//')||/^\/(api|admin)(\/|$)/i.test(decodedPath))return '/';
    target.searchParams.delete('preview');
    return target.pathname+target.search+target.hash;
  }catch{return '/';}
}
