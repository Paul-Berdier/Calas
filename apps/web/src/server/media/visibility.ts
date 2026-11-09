import { sql } from 'drizzle-orm';
import { mediaReferences } from '../db/schema';
import { media } from './schema';

/** Library listings, totals and audit records use the same current media access. */
export function visibleMediaFilter(actor: { id: string; role: 'administrator' | 'editor' }) {
  return actor.role === 'administrator' ? undefined : sql`(
    ${media.createdBy} = ${actor.id} or exists (
      select 1 from ${mediaReferences}
      where ${mediaReferences.mediaId} = ${media.id} and ${mediaReferences.isPublished} = true
    )
  )`;
}
