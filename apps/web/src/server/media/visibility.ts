import { sql } from 'drizzle-orm';
import { documents, mediaReferences, revisions } from '../db/schema';
import { media } from './schema';

/** Check the live revision itself so an obsolete reference cannot authorize a download. */
export function publishedMediaFilter(requireDownloadGrant = false) {
  return sql`exists (
    select 1 from ${mediaReferences}
    join ${documents} on ${documents.id} = ${mediaReferences.resourceId}
      and ${documents.publishedRevisionId} = ${mediaReferences.revisionId}
    join ${revisions} on ${revisions.id} = ${mediaReferences.revisionId}
    where ${mediaReferences.mediaId} = ${media.id} and ${mediaReferences.isPublished} = true
      and ${documents.status} = 'published'
      ${requireDownloadGrant ? sql`and ${mediaReferences.downloadAllowed} = true` : sql``}
      and (${media.mimeType} <> 'application/pdf' or (
        ${mediaReferences.downloadAllowed} = true and ${documents.kind} = 'article'
        and ${revisions.content}->'allowPdfDownload' = 'true'::jsonb
        and ${revisions.content}->'sourcePdf'->>'mediaId' = ${media.id}::text
      ))
  )`;
}

/** Library listings, totals and audit records use the same current media access. */
export function visibleMediaFilter(actor: { id: string; role: 'administrator' | 'editor' }) {
  return actor.role === 'administrator' ? undefined : sql`(${media.createdBy} = ${actor.id} or ${publishedMediaFilter()})`;
}
