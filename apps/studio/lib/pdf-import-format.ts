import type {PortableTextBlock} from 'sanity';
import {PDF_IMPORT_LIMITS,PdfImportError,type ExtractedParagraph,type PdfTextItem} from './pdf-import.types';

export function validatePdfFile(file:Pick<File,'size'|'name'|'type'>):void {
  if(!file.size)throw new PdfImportError('Le fichier est vide. Choisissez un PDF contenant du texte ou des pages scannées.');
  if(file.size>PDF_IMPORT_LIMITS.bytes)throw new PdfImportError('Ce PDF dépasse 20 Mo. Réduisez sa taille ou divisez-le en plusieurs fichiers ; aucun contenu n’a été importé.');
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')throw new PdfImportError('Choisissez un fichier au format PDF.');
}
export function validatePageCount(count:number):void {
  if(!Number.isInteger(count)||count<1)throw new PdfImportError('Ce PDF ne contient aucune page exploitable.');
  if(count>PDF_IMPORT_LIMITS.pages)throw new PdfImportError(`Ce PDF contient ${count} pages. La limite est de 40 pages ; divisez le document. Aucune page n’a été importée.`);
}
export function validateCharacterCount(count:number):void {
  if(count>PDF_IMPORT_LIMITS.characters)throw new PdfImportError('Le texte extrait dépasse 200 000 caractères. Divisez le PDF ; aucun article tronqué n’a été créé.');
}
export function cleanText(value:string):string {
  return value.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/\u00ad/g,'').replace(/[\t \u00a0]+/g,' ').trim();
}
export function titleFromFilename(filename:string):string {
  return filename.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').trim()||'Article issu du PDF';
}
export function excerptFromText(text:string):string {
  const value=cleanText(text).replace(/\s+/g,' ');
  if(value.length<=500)return value;
  const prefix=value.slice(0,500);
  const end=prefix.lastIndexOf(' ');
  return end>350?prefix.slice(0,end):prefix;
}
export function ocrTextToParagraphs(text:string):ExtractedParagraph[] {
  return cleanText(text).split(/\n\s*\n/).map(part=>({text:part.replace(/\s*\n\s*/g,' ').trim(),style:'normal' as const})).filter(part=>part.text.length>0);
}
export function shouldRecognizePage(text:string,hasBitmap:boolean,forceOcr=false):boolean {
  if(forceOcr)return true;
  const meaningful=(text.match(/[\p{L}\p{N}]/gu)??[]).length;
  const replacementCount=(text.match(/\uFFFD/g)??[]).length;
  return hasBitmap&&(meaningful<120||replacementCount>5);
}

/** Keep the PDF text stream's reading order. Coordinates reconnect fragments
 * on one line and identify paragraph gaps. Complex column order still needs
 * review because the PDF stream itself can interleave columns. */
export function textItemsToParagraphs(items:readonly PdfTextItem[]):ExtractedParagraph[] {
  interface Line {text:string;y:number;x:number;right:number;height:number}
  const lines:Line[]=[];
  let current:Line|undefined;
  const flush=()=>{if(current){current.text=cleanText(current.text);if(current.text)lines.push(current);current=undefined;}};
  for(const item of items){
    const x=Number(item.transform[4])||0,y=Number(item.transform[5])||0;
    const height=Math.abs(item.height)||Math.hypot(Number(item.transform[2])||0,Number(item.transform[3])||0)||12;
    const text=item.str.replace(/[\r\n]+/g,' ');
    if(current&&Math.abs(y-current.y)>Math.max(2,Math.min(height,current.height)*.4))flush();
    if(text){
      if(!current)current={text,y,x,right:x+item.width,height};
      else {
        const gap=x-current.right;
        const space=!/\s$/.test(current.text)&&!/^\s/.test(text)&&gap>Math.max(.5,height*.12)?' ':'';
        current.text+=space+text;current.right=x+item.width;current.height=Math.max(current.height,height);
      }
    }
    if(item.hasEOL)flush();
  }
  flush();
  if(!lines.length)return [];
  const heights=lines.map(line=>line.height).sort((a,b)=>a-b);
  const bodyHeight=heights[Math.floor((heights.length-1)/2)]??12;
  const paragraphs:ExtractedParagraph[]=[];
  let previous:Line|undefined;
  for(const line of lines){
    const heading=line.height>=bodyHeight*1.3&&line.text.length<=180;
    const last=paragraphs.at(-1);
    const gap=previous?previous.y-line.y:0;
    const paragraphBreak=!previous||gap>Math.max(bodyHeight,previous.height)*1.65||gap< -bodyHeight*.5;
    if(!last||heading||last.style==='h2'||paragraphBreak)paragraphs.push({text:line.text,style:heading?'h2':'normal'});
    else last.text+=(/-$/.test(last.text)&&/^\p{L}/u.test(line.text)?'':' ')+line.text;
    previous=line;
  }
  return paragraphs;
}
export function paragraphsToBlocks(paragraphs:readonly ExtractedParagraph[]):PortableTextBlock[] {
  return paragraphs.filter(paragraph=>paragraph.text.trim()).map((paragraph,index)=>({
    _type:'block',_key:`pdf-${index.toString(36)}`,style:paragraph.style,markDefs:[],
    children:[{_type:'span',_key:`text-${index.toString(36)}`,text:paragraph.text,marks:[]}],
  }));
}
