import type {RichDocument,ContentFile} from '../../lib/cms/types';
import type {PdfImportResult} from './pdf-import.types';
import {validateCharacterCount,validatePageCount} from './pdf-import-format';

export function buildPdfArticle(input:{id:string;title:string;excerpt:string;body:RichDocument;analysis:Pick<PdfImportResult,'pageCount'|'ocrPages'>;pdf:ContentFile}){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!uuid.test(input.id)||!uuid.test(input.pdf.mediaId)||input.pdf.mimeType&&input.pdf.mimeType!=='application/pdf')throw new Error('Le document PDF ou son identifiant est invalide.');
  validatePageCount(input.analysis.pageCount);
  if(!Number.isInteger(input.analysis.ocrPages)||input.analysis.ocrPages<0||input.analysis.ocrPages>input.analysis.pageCount)throw new Error('L’analyse du PDF est incomplète.');
  const readText=(node:RichDocument|RichDocument['content'][number]):string=>node.text??(node.content??[]).map(readText).join('\n');
  const text=readText(input.body);
  if(input.body.type!=='doc'||!text.trim()||!input.title.trim())throw new Error('Le titre et le texte extrait sont nécessaires.');
  validateCharacterCount(text.length);
  const slugBase=input.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,87).replace(/-$/,'')||'article';
  return {title:input.title.trim(),slug:`${slugBase}-${input.id.slice(0,8)}`,excerpt:input.excerpt.trim(),body:input.body,sourcePdf:input.pdf,allowPdfDownload:false,
    pdfImport:{pageCount:input.analysis.pageCount,ocrPages:input.analysis.ocrPages,reviewed:false}};
}
