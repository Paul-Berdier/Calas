import type { ContentFile } from './types';
import {isMediaId} from './images';

export function formatFileSize(bytes: number | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) return null;
  const unit = bytes >= 1_000_000 ? 'Mo' : bytes >= 1_000 ? 'ko' : 'o';
  const value = bytes / (unit === 'Mo' ? 1_000_000 : unit === 'ko' ? 1_000 : 1);
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

export function pdfDownload(file: ContentFile | undefined): { url: string; filename: string; size: string | null } | null {
  if(!file||!isMediaId(file.mediaId)||file.mimeType!=='application/pdf')return null;
  const name=file.originalFilename?.replace(/[\\/\u0000-\u001f\u007f]/g,'-').trim().slice(0,180)||'article-original.pdf';
  return {url:`/media/${file.mediaId}/?download=1`,filename:/\.pdf$/i.test(name)?name:`${name}.pdf`,size:formatFileSize(file.size)};
}
