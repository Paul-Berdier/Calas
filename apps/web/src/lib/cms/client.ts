import type {APIContext} from 'astro';
import {contentMode} from './env';
import {isPreview,PRIVATE_HEADERS} from './preview';
import {readSiteContent} from '../../server/content/repository';
import type {SiteContent} from './types';
export class ContentUnavailableError extends Error{constructor(){super('Le contenu est momentanément indisponible.');this.name='ContentUnavailableError';}}
export async function getSiteContent(context:Pick<APIContext,'request'|'url'|'locals'> & {response?:{headers:Headers}},options:{publishedOnly?:boolean}={}):Promise<SiteContent>{
  const preview=!options.publishedOnly&&await isPreview(context);
  const headers=context.response?.headers??new Headers();
  headers.set('Vary','Cookie');
  // No shared cache in v1: publication is visible on the next SSR request.
  headers.set('Cache-Control',preview?'private, no-store':'public, max-age=0, must-revalidate');
  if(preview)for(const [key,value]of Object.entries(PRIVATE_HEADERS))headers.set(key,value);
  try{
    if(contentMode()==='demo'){
      headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow');
      const {demoContent}=await import('./demo');return demoContent;
    }
    const content=await readSiteContent({preview});
    if(!content.settings?.brand||!content.home?.title)throw new ContentUnavailableError();
    return content;
  }catch{headers.set('Cache-Control','private, no-store');throw new ContentUnavailableError();}
}
