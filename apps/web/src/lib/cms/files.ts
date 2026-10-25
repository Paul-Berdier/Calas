import type { ContentFile } from './types';
import { serverEnv } from './env';

export function formatFileSize(bytes: number | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) return null;
  const unit = bytes >= 1_000_000 ? 'Mo' : bytes >= 1_000 ? 'ko' : 'o';
  const value = bytes / (unit === 'Mo' ? 1_000_000 : unit === 'ko' ? 1_000 : 1);
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

export function pdfDownload(file: ContentFile | undefined): { url: string; filename: string; size: string | null } | null {
  const asset = file?.asset;
  const project = serverEnv('PUBLIC_SANITY_PROJECT_ID');
  const dataset = serverEnv('PUBLIC_SANITY_DATASET');
  const id = asset?._id?.match(/^file-([a-zA-Z0-9_-]+)-pdf$/);
  if (!asset?.url || !id || asset.mimeType !== 'application/pdf' || !project || !dataset) return null;
  try {
    const url = new URL(asset.url);
    if (url.origin !== 'https://cdn.sanity.io' || url.username || url.password
      || url.pathname !== `/files/${project}/${dataset}/${id[1]}.pdf`) return null;
    const original = asset.originalFilename?.replace(/[\\/\u0000-\u001f\u007f]/g, '-').trim().slice(0, 180);
    const filename = original ? (/\.pdf$/i.test(original) ? original : `${original}.pdf`) : 'article-original.pdf';
    url.search = '';
    url.hash = '';
    // Sanity's dl parameter sets Content-Disposition for cross-origin downloads.
    url.searchParams.set('dl', filename);
    return { url: url.href, filename, size: formatFileSize(asset.size) };
  } catch { return null; }
}
