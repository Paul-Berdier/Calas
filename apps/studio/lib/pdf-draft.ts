import type { PdfImportResult } from './pdf-import.types';

export function validatePdfReview(value: unknown, document: unknown): true | string {
  const sourcePdf = (document as { sourcePdf?: { asset?: { _ref?: string } } } | undefined)?.sourcePdf;
  const reviewed = (value as { reviewed?: boolean } | undefined)?.reviewed;
  return !sourcePdf?.asset?._ref || reviewed === true ? true : 'Relisez l’article et cochez la confirmation avant de publier ce PDF.';
}

export interface PdfDraftInput {
  id: string; assetId: string; title: string; excerpt: string;
  analysis: Pick<PdfImportResult, 'blocks' | 'pageCount' | 'ocrPages'>;
}

/** Build only a new article draft. No author, publication date or publication action is inferred. */
export function buildPdfDraft({ id, assetId, title, excerpt, analysis }: PdfDraftInput) {
  const uuid = id.replace(/^drafts\./, '');
  if (!/^drafts\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error('L’import exige un identifiant de nouveau brouillon.');
  if (!/^file-[a-zA-Z0-9]+-pdf$/.test(assetId)) throw new Error('Le document joint doit être un fichier PDF.');
  const cleanTitle = title.trim();
  const cleanExcerpt = excerpt.trim();
  if (!cleanTitle || cleanTitle.length > 220 || cleanExcerpt.length > 500) throw new Error('Vérifiez le titre et le résumé avant de créer le brouillon.');
  if (!Number.isInteger(analysis.pageCount) || analysis.pageCount < 1 || analysis.pageCount > 40 || !Number.isInteger(analysis.ocrPages) || analysis.ocrPages < 0 || analysis.ocrPages > analysis.pageCount || !analysis.blocks.length) throw new Error('L’analyse du PDF est incomplète.');
  const slug = cleanTitle.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 59).replace(/-$/, '') || 'article';
  return {
    _id: id, _type: 'article' as const, title: cleanTitle,
    slug: { _type: 'slug' as const, current: `${slug}-${uuid}` },
    excerpt: cleanExcerpt, body: analysis.blocks,
    sourcePdf: { _type: 'file' as const, asset: { _type: 'reference' as const, _ref: assetId } },
    pdfImport: { pageCount: analysis.pageCount, ocrPages: analysis.ocrPages, reviewed: false },
  };
}
