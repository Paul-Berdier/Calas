import type {RichDocument,RichNode} from './types';
import {safeHref} from '../links';
import {imageUrl,isMediaId} from './images';

const markTags = new Map([['bold','strong'],['italic','em'],['strike','s'],['code','code'],['underline','u']]);
const nodeTags = new Map([['paragraph','p'],['bulletList','ul'],['orderedList','ol'],['listItem','li'],['blockquote','blockquote']]);

export const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Whitelist serializer. No HTML from the database is ever inserted verbatim. */
export function renderRichText(document:RichDocument|undefined):string{
  let count=0;
  const render=(node:RichNode,depth=0):string=>{
    if(++count>50_000||depth>24||!node||typeof node!=='object')return '';
    const children=()=>Array.isArray(node.content)?node.content.map(child=>render(child,depth+1)).join(''):'';
    if(node.type==='text'){
      let text=escapeHtml(typeof node.text==='string'?node.text:'');
      for(const mark of Array.isArray(node.marks)?node.marks:[]){
        if(!mark||typeof mark!=='object')continue;
        const tag=markTags.get(mark.type);
        if(tag)text=`<${tag}>${text}</${tag}>`;
        else if(mark.type==='link'&&typeof mark.attrs?.href==='string'){
          const href=safeHref(mark.attrs.href);if(href)text=`<a href="${escapeHtml(href)}"${href.startsWith('https:')?' rel="noopener noreferrer"':''}>${text}</a>`;
        }
      }return text;
    }
    if(node.type==='doc')return children();
    if(node.type==='hardBreak')return '<br>';
    if(node.type==='horizontalRule')return '<hr>';
    if(node.type==='image'){
      if(!isMediaId(node.attrs?.mediaId))return '';
      const alt=typeof node.attrs?.alt==='string'?node.attrs.alt:'';
      const src=imageUrl({mediaId:node.attrs.mediaId,alt},960)!;
      return `<figure><img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"></figure>`;
    }
    if(node.type==='heading'){const tag=node.attrs?.level===3?'h3':'h2';return `<${tag}>${children()}</${tag}>`;}
    if(node.type==='codeBlock')return `<pre><code>${children()}</code></pre>`;
    const tag=nodeTags.get(node.type);
    if(!tag)return '';
    const start=tag==='ol'&&Number.isInteger(node.attrs?.start)&&Number(node.attrs?.start)>1?` start="${Math.min(10000,Number(node.attrs?.start))}"`:'';
    return `<${tag}${start}>${children()}</${tag}>`;
  };
  return document?.type==='doc'?render(document):'';
}
