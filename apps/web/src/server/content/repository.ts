import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type DatabaseExecutor, type Transaction } from '../db';
import { articleRevisions, articles, auditLogs, categories, documents, mediaReferences, pageRevisions, pages, people, revisionReferences, revisions, siteSettings, statistics } from '../db/schema';
import { media } from '../media/schema';
import type { SiteContent } from '../../lib/cms/types';
import { assertPublishable, ContentError, contentTitle, parseContent, type ArticleDraft, type ContentDetail, type ContentKind, type ContentRevision, type EditorialActor } from './models';

type DocumentRow = typeof documents.$inferSelect;
type RevisionRow = typeof revisions.$inferSelect;
export type ContentWriter = Omit<EditorialActor, 'id'> & { id: string | null };
type RevisionAction = typeof revisions.$inferInsert.action;
const collectionKinds = { pages: ['home', 'page'], articles: ['article'], people: ['person'], statistics: ['statistic'], categories: ['category'], settings: ['settings'] } as const;
export type ContentCollection = keyof typeof collectionKinds;
export function isCollection(value: string): value is ContentCollection { return Object.hasOwn(collectionKinds, value); }
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
  return value;
}
const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function assertWritePermission(kind: ContentKind, actor: ContentWriter): void {
  if (!['administrator', 'editor'].includes(actor.role)) throw new ContentError(403, 'FORBIDDEN', 'Cette action n’est pas autorisée.');
  if (kind === 'settings' && actor.role !== 'administrator') throw new ContentError(403, 'ADMINISTRATOR_REQUIRED', 'Seul un administrateur peut modifier les paramètres du site.');
}

function normalizeContent(kind: ContentKind, input: unknown, id: string): Record<string, unknown> {
  const content = parseContent(kind, input);
  if (['page', 'person', 'statistic', 'category'].includes(kind)) content.id = id;
  if (kind === 'home') {
    const stats = content.statistics as Array<{ id?: string }>;
    content.statisticIds = content.statisticIds || stats.map(item => item.id).filter(Boolean);
    // Statistics have their own publication cycle, not duplicate copies inside the home snapshot.
    content.statistics = [];
  }
  return clean(content);
}

async function lockedDocument(tx: Transaction, id: string): Promise<DocumentRow> {
  const [document] = await tx.select().from(documents).where(eq(documents.id, id)).for('update');
  if (!document) throw new ContentError(404, 'NOT_FOUND', 'Ce contenu est introuvable.');
  return document;
}
function assertVersion(document: DocumentRow, expectedVersion: number): void {
  if (document.version !== expectedVersion) throw new ContentError(409, 'VERSION_CONFLICT', 'Ce contenu a été modifié depuis son ouverture. Votre saisie est conservée ; rechargez la dernière version avant de poursuivre.');
}
async function currentRevision(db: DatabaseExecutor, document: DocumentRow): Promise<RevisionRow> {
  if (!document.draftRevisionId) throw new ContentError(409, 'CONTENT_INCOMPLETE', 'Le contenu n’a pas encore de révision de travail.');
  const [revision] = await db.select().from(revisions).where(and(eq(revisions.id, document.draftRevisionId), eq(revisions.documentId, document.id)));
  if (!revision) throw new ContentError(409, 'CONTENT_INCOMPLETE', 'La révision de travail est introuvable.');
  return revision;
}

function collectMedia(value: unknown, result = new Map<string, boolean>(), downloadable = true): Map<string, boolean> {
  if (Array.isArray(value)) { for (const item of value) collectMedia(item, result, downloadable); return result; }
  if (!value || typeof value !== 'object') return result;
  const object = value as Record<string, unknown>;
  if (typeof object.mediaId === 'string') result.set(object.mediaId, (result.get(object.mediaId) || false) || downloadable);
  for (const [key, child] of Object.entries(object)) {
    collectMedia(child, result, key === 'sourcePdf' ? object.allowPdfDownload === true : downloadable);
  }
  return result;
}

async function validateReferences(tx: Transaction, kind: ContentKind, content: Record<string, unknown>, actor: ContentWriter, publishing: boolean) {
  const references: Array<{ id: string; relation: string; kind: ContentKind }> = [];
  if (kind === 'article') {
    if (content.authorId) references.push({ id: String(content.authorId), relation: 'author', kind: 'person' });
    if (content.categoryId) references.push({ id: String(content.categoryId), relation: 'category', kind: 'category' });
  }
  if (kind === 'home') for (const id of content.statisticIds as string[] || []) references.push({ id, relation: 'statistic', kind: 'statistic' });
  if (kind === 'settings') {
    const qualification = content.qualification as { personId?: string };
    if (qualification.personId) references.push({ id: qualification.personId, relation: 'qualification', kind: 'person' });
  }
  for (const reference of references) {
    const [target] = await tx.select().from(documents).where(eq(documents.id, reference.id)).for('share');
    if (!target || target.kind !== reference.kind) throw new ContentError(422, 'MISSING_REFERENCE', 'Une personne, une catégorie ou un chiffre référencé est introuvable.');
    if (publishing && ['author', 'category', 'qualification'].includes(reference.relation) && target.status !== 'published') throw new ContentError(422, 'UNPUBLISHED_REFERENCE', 'Publiez d’abord la personne ou la catégorie utilisée par ce contenu.');
  }
  const mediaIds = collectMedia(content);
  for (const [id] of mediaIds) {
    const [asset] = await tx.select().from(media).where(eq(media.id, id)).for('share');
    if (!asset) throw new ContentError(422, 'MISSING_MEDIA', 'Un média sélectionné est introuvable.');
    if (actor.role === 'editor' && asset.createdBy !== actor.id) {
      const [publicUse] = await tx.select({ id: mediaReferences.id }).from(mediaReferences).where(and(eq(mediaReferences.mediaId, id), eq(mediaReferences.isPublished, true))).limit(1);
      if (!publicUse) throw new ContentError(403, 'PRIVATE_MEDIA', 'Ce média privé n’appartient pas à votre espace autorisé.');
    }
    const pdfId = (content.sourcePdf as { mediaId?: string } | undefined)?.mediaId;
    if (id === pdfId && asset.mimeType !== 'application/pdf') throw new ContentError(422, 'INVALID_PDF', 'La pièce jointe doit être un PDF.');
    if (id !== pdfId && !asset.mimeType.startsWith('image/')) throw new ContentError(422, 'INVALID_IMAGE', 'Une illustration doit être une image.');
  }
  return { references, mediaIds };
}

async function audit(tx: Transaction, document: DocumentRow, actor: ContentWriter, action: string, version: number) {
  await tx.insert(auditLogs).values({ action, actorId: actor.id, actorName: actor.name, resourceType: document.kind, resourceId: document.id, title: document.internalTitle, metadata: { version } });
}

async function appendRevision(tx: Transaction, document: DocumentRow, content: Record<string, unknown>, actor: ContentWriter, action: RevisionAction, publishing = false): Promise<DocumentRow> {
  const { references, mediaIds } = await validateReferences(tx, document.kind, content, actor, publishing);
  const id = randomUUID();
  const version = document.version + 1;
  await tx.insert(revisions).values({ id, documentId: document.id, version, content, action, createdBy: actor.id, createdByName: actor.name });
  if (document.kind === 'home' || document.kind === 'page') {
    await tx.insert(pageRevisions).values({ id, pageId: document.id, seo: (content.seo || {}) as { title?: string; description?: string } });
  }
  if (document.kind === 'article') {
    const article = content as ArticleDraft;
    await tx.insert(articleRevisions).values({ id, articleId: document.id, authorId: article.authorId, categoryId: article.categoryId, coverMediaId: article.image?.mediaId, sourcePdfMediaId: article.sourcePdf?.mediaId, publishedAt: article.date ? new Date(article.date) : null });
  }
  if (references.length) await tx.insert(revisionReferences).values(references.map(reference => ({ revisionId: id, targetDocumentId: reference.id, relation: reference.relation })));
  if (mediaIds.size) await tx.insert(mediaReferences).values([...mediaIds].map(([mediaId, downloadAllowed]) => ({ mediaId, resourceKind: document.kind, resourceId: document.id, revisionId: id, isPublished: false, downloadAllowed })));
  if (publishing) {
    await tx.update(mediaReferences).set({ isPublished: false }).where(eq(mediaReferences.resourceId, document.id));
    await tx.update(mediaReferences).set({ isPublished: true }).where(and(eq(mediaReferences.revisionId, id), eq(mediaReferences.downloadAllowed, true)));
  }
  const [updated] = await tx.update(documents).set({
    internalTitle: contentTitle(document.kind, content), draftRevisionId: id,
    ...(publishing ? { publishedRevisionId: id, status: 'published' as const } : document.status === 'archived' ? { status: document.publishedRevisionId ? 'published' as const : 'draft' as const } : {}),
    version, updatedAt: new Date(),
  }).where(eq(documents.id, document.id)).returning();
  await audit(tx, updated!, actor, action, version);
  return updated!;
}

async function setDomainIdentity(tx: Transaction, kind: ContentKind, id: string, content: Record<string, unknown>, create: boolean) {
  if (kind === 'home' || kind === 'page') {
    if (create) await tx.insert(pages).values({ id, slug: kind === 'home' ? '' : String(content.slug), pageType: kind });
  } else if (kind === 'person') {
    if (create) await tx.insert(people).values({ id, displayOrder: Number(content.order || 0) });
    else await tx.update(people).set({ displayOrder: Number(content.order || 0) }).where(eq(people.id, id));
  } else if (kind === 'statistic') {
    if (create) await tx.insert(statistics).values({ id, displayOrder: Number(content.order || 0) });
  } else if (kind === 'category') {
    if (create) await tx.insert(categories).values({ id, slug: String(content.slug) });
    else await tx.update(categories).set({ slug: String(content.slug) }).where(eq(categories.id, id));
  } else if (kind === 'settings') {
    if (create) await tx.insert(siteSettings).values({ id });
  } else if (kind === 'article') {
    if (create) await tx.insert(articles).values({ id, slug: String(content.slug), creationKey: id, creationHash: checksum(content) });
    else await tx.update(articles).set({ slug: String(content.slug) }).where(eq(articles.id, id));
  }
}

function wrapDatabaseError(error: unknown): never {
  if (error instanceof ContentError) throw error;
  const cause = error as { code?: string; cause?: { code?: string } };
  if (cause.code === '23505' || cause.cause?.code === '23505') throw new ContentError(409, 'DUPLICATE_SLUG', 'Cette adresse est déjà utilisée. Choisissez une autre adresse.');
  if (cause.code === '23503' || cause.cause?.code === '23503') throw new ContentError(409, 'REFERENCE_CONFLICT', 'Ce contenu est utilisé par une autre ressource. Rechargez avant de réessayer.');
  throw error;
}

export async function createContent(kind: ContentKind, input: unknown, actor: EditorialActor, options: { id?: string } = {}): Promise<ContentDetail> {
  assertWritePermission(kind, actor);
  if (!['article', 'person', 'category', 'statistic'].includes(kind)) throw new ContentError(403, 'STRUCTURAL_CONTENT', 'Les pages et paramètres structurels sont créés par la migration.');
  const id = options.id || randomUUID();
  const content = normalizeContent(kind, input, id);
  try {
    await getDb().transaction(async tx => {
      // Concurrent retries of a PDF import serialize on the same client-generated UUID.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const [existing] = await tx.select().from(documents).where(eq(documents.id, id));
      if (existing) {
        const [creation] = await tx.select().from(revisions).where(and(eq(revisions.documentId, id), eq(revisions.version, 1)));
        if (existing.kind !== kind || existing.createdBy !== actor.id || !creation || checksum(creation.content) !== checksum(content)) throw new ContentError(409, 'IDEMPOTENCY_CONFLICT', 'Cet import a déjà été utilisé avec un autre contenu.');
        return;
      }
      const [document] = await tx.insert(documents).values({ id, kind, internalTitle: contentTitle(kind, content), createdBy: actor.id }).returning();
      await setDomainIdentity(tx, kind, id, content, true);
      await appendRevision(tx, document!, content, actor, 'created');
    });
    return await getContent(id);
  } catch (error) { return wrapDatabaseError(error); }
}

export async function saveContent(id: string, input: unknown, expectedVersion: number, actor: EditorialActor): Promise<ContentDetail> {
  try {
    await getDb().transaction(async tx => {
      const document = await lockedDocument(tx, id);
      assertWritePermission(document.kind, actor);
      assertVersion(document, expectedVersion);
      const previous = await currentRevision(tx, document);
      const content = normalizeContent(document.kind, input, id);
      if (document.kind === 'page' && content.slug !== previous.content.slug) throw new ContentError(422, 'FIXED_ROUTE', 'L’adresse des pages du site est protégée.');
      if (document.kind === 'article' && document.publishedRevisionId) {
        const [published] = await tx.select().from(revisions).where(eq(revisions.id, document.publishedRevisionId));
        if (published && content.slug !== published.content.slug) throw new ContentError(422, 'PUBLISHED_ROUTE', 'L’adresse d’un article déjà publié est protégée pour préserver les liens.');
      }
      if (checksum(content) === checksum(previous.content)) return;
      await setDomainIdentity(tx, document.kind, id, content, false);
      await appendRevision(tx, document, content, actor, 'saved');
    });
    return await getContent(id);
  } catch (error) { return wrapDatabaseError(error); }
}

export async function publishContent(id: string, expectedVersion: number, actor: EditorialActor): Promise<ContentDetail> {
  await getDb().transaction(async tx => {
    const document = await lockedDocument(tx, id);
    assertWritePermission(document.kind, actor);
    assertVersion(document, expectedVersion);
    const current = await currentRevision(tx, document);
    assertPublishable(document.kind, current.content);
    await appendRevision(tx, document, current.content, actor, 'published', true);
  });
  return getContent(id);
}

export async function changePublication(id: string, expectedVersion: number, actor: EditorialActor, action: 'unpublish' | 'archive'): Promise<ContentDetail> {
  await getDb().transaction(async tx => {
    const document = await lockedDocument(tx, id);
    assertWritePermission(document.kind, actor);
    assertVersion(document, expectedVersion);
    if (document.protected) throw new ContentError(422, 'PROTECTED_CONTENT', 'Cette page structurelle doit rester disponible. Modifiez et publiez son contenu.');
    const [referenced] = await tx.select({ id: revisionReferences.id }).from(revisionReferences).innerJoin(documents, eq(documents.publishedRevisionId, revisionReferences.revisionId)).where(and(eq(revisionReferences.targetDocumentId, id), eq(documents.status, 'published'))).limit(1);
    if (referenced) throw new ContentError(409, 'CONTENT_IN_USE', 'Ce contenu est utilisé par une publication. Modifiez d’abord cette publication.');
    await tx.update(documents).set({ status: action === 'archive' ? 'archived' : 'draft', publishedRevisionId: null, version: document.version + 1, updatedAt: new Date() }).where(eq(documents.id, id));
    await tx.update(mediaReferences).set({ isPublished: false }).where(eq(mediaReferences.resourceId, id));
    await audit(tx, document, actor, action === 'archive' ? 'archived' : 'unpublished', document.version + 1);
  });
  return getContent(id);
}

export async function restoreContent(id: string, revisionId: string | undefined, expectedVersion: number, actor: EditorialActor, discard = false): Promise<ContentDetail> {
  await getDb().transaction(async tx => {
    const document = await lockedDocument(tx, id);
    assertWritePermission(document.kind, actor);
    assertVersion(document, expectedVersion);
    const targetId = discard ? document.publishedRevisionId : revisionId;
    if (!targetId) throw new ContentError(422, 'NO_PUBLISHED_VERSION', 'Aucune version publiée n’est disponible à restaurer.');
    const [target] = await tx.select().from(revisions).where(and(eq(revisions.id, targetId), eq(revisions.documentId, id)));
    if (!target) throw new ContentError(404, 'REVISION_NOT_FOUND', 'Cette version n’appartient pas au contenu.');
    const content = normalizeContent(document.kind, target.content, id);
    await setDomainIdentity(tx, document.kind, id, content, false);
    await appendRevision(tx, document, content, actor, discard ? 'discarded' : 'restored');
  });
  return getContent(id);
}

async function detailFromRow(db: DatabaseExecutor, document: DocumentRow): Promise<ContentDetail> {
  const current = await currentRevision(db, document);
  let published: RevisionRow | undefined;
  if (document.publishedRevisionId) [published] = await db.select().from(revisions).where(eq(revisions.id, document.publishedRevisionId));
  const content = clean(current.content);
  if (document.kind === 'home') {
    const ids = content.statisticIds as string[] || [];
    if (ids.length) {
      const stats = await db.select({ id: documents.id, content: revisions.content }).from(documents).innerJoin(revisions, eq(documents.draftRevisionId, revisions.id)).where(inArray(documents.id, ids));
      content.statistics = ids.map(id => stats.find(item => item.id === id)?.content).filter(Boolean);
    }
  }
  return { id: document.id, kind: document.kind, slug: String(content.slug || ''), title: document.internalTitle, status: document.status, version: document.version, draftRevisionId: document.draftRevisionId, publishedRevisionId: document.publishedRevisionId, hasUnpublishedChanges: !published || checksum(published.content) !== checksum(current.content), content, updatedAt: document.updatedAt.toISOString() };
}

export async function getContent(id: string): Promise<ContentDetail> {
  return getDb().transaction(async tx => {
    const [document] = await tx.select().from(documents).where(eq(documents.id, id));
    if (!document) throw new ContentError(404, 'NOT_FOUND', 'Ce contenu est introuvable.');
    return detailFromRow(tx, document);
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
export async function getSettingsContent(): Promise<ContentDetail> {
  const [settings] = await getDb().select().from(siteSettings).limit(1);
  if (!settings) throw new ContentError(404, 'NOT_INITIALIZED', 'Les paramètres doivent être initialisés par la migration.');
  return getContent(settings.id);
}
export async function listContent(collection: ContentCollection): Promise<ContentDetail[]> {
  return getDb().transaction(async tx => {
    const rows = await tx.select().from(documents).where(inArray(documents.kind, [...collectionKinds[collection]])).orderBy(asc(documents.createdAt), asc(documents.id));
    return Promise.all(rows.map(row => detailFromRow(tx, row)));
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
export async function listRevisions(id: string): Promise<ContentRevision[]> {
  await getContent(id);
  const rows = await getDb().select().from(revisions).where(eq(revisions.documentId, id)).orderBy(desc(revisions.version)).limit(100);
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
export async function listHistory(limit = 50) { return getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(Math.max(limit, 1), 100)); }
export async function dashboard() {
  const rows = await getDb().select({ kind: documents.kind, status: documents.status, draft: revisions.content }).from(documents).leftJoin(revisions, eq(documents.draftRevisionId, revisions.id));
  const [{ count: mediaCount }] = await getDb().select({ count: sql<number>`count(*)::int` }).from(media);
  const recent = await listHistory(12);
  const recentPublications = await getDb().select().from(auditLogs).where(eq(auditLogs.action, 'published')).orderBy(desc(auditLogs.createdAt)).limit(6);
  return { counts: { pages: rows.filter(row => ['home', 'page'].includes(row.kind)).length, articlesPublished: rows.filter(row => row.kind === 'article' && row.status === 'published').length, articlesDraft: rows.filter(row => row.kind === 'article' && row.status === 'draft').length, media: mediaCount, needsReview: rows.filter(row => row.kind === 'article' && Boolean((row.draft?.pdfImport as { reviewed?: boolean } | undefined) && !(row.draft?.pdfImport as { reviewed?: boolean }).reviewed) || row.kind === 'statistic' && row.draft?.verified !== true).length }, recent, recentPublications };
}

function hydrateMedia(value: unknown, assets: Map<string, typeof media.$inferSelect>): unknown {
  if (Array.isArray(value)) return value.map(item => hydrateMedia(item, assets));
  if (!value || typeof value !== 'object') return value;
  const object = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, hydrateMedia(child, assets)]));
  if (typeof object.mediaId === 'string') {
    const asset = assets.get(object.mediaId);
    if (asset) {
      if (asset.mimeType === 'application/pdf') Object.assign(object, { originalFilename: asset.originalFilename, size: asset.sizeBytes, mimeType: asset.mimeType });
      else Object.assign(object, { width: asset.width, height: asset.height });
    }
  }
  return object;
}

export async function readSiteContent(options: { preview?: boolean } = {}): Promise<SiteContent> {
  return getDb().transaction(async tx => {
    const pointer = options.preview ? documents.draftRevisionId : documents.publishedRevisionId;
    const rows = await tx.select({ document: documents, revision: revisions }).from(documents).innerJoin(revisions, eq(pointer, revisions.id)).where(options.preview ? undefined : eq(documents.status, 'published'));
    const assets = await tx.select().from(media);
    const byId = new Map(rows.map(row => [row.document.id, row]));
    const contentOf = (row: typeof rows[number]) => hydrateMedia(clean(row.revision.content), new Map(assets.map(asset => [asset.id, asset]))) as Record<string, unknown>;
    const homeRow = rows.find(row => row.document.kind === 'home');
    const settingsRow = rows.find(row => row.document.kind === 'settings');
    if (!homeRow || !settingsRow) throw new ContentError(503, 'CONTENT_NOT_PUBLISHED', 'L’accueil et les paramètres ne sont pas encore publiés.');
    const home = contentOf(homeRow);
    home.statistics = (home.statisticIds as string[] || []).map(id => byId.get(id)).filter(row => row?.document.kind === 'statistic' && (options.preview || row.revision.content.verified === true)).map(row => contentOf(row!));
    delete home.statisticIds;
    const settings = contentOf(settingsRow);
    const qualification = settings.qualification as { status: string; personId?: string; validUntil?: string };
    if (qualification.status !== 'verified' || !qualification.personId || !byId.has(qualification.personId) || (qualification.validUntil && qualification.validUntil < new Date().toISOString().slice(0, 10))) settings.qualification = { status: 'pending' };
    const publicArticles = rows.filter(row => row.document.kind === 'article').map(row => {
      const content = contentOf(row);
      const author = byId.get(String(content.authorId));
      const category = byId.get(String(content.categoryId));
      const result = { ...content, id: row.document.id, author: author ? contentOf(author) : undefined, category: category ? contentOf(category) : undefined };
      if (!content.allowPdfDownload && !options.preview) delete (result as Record<string, unknown>).sourcePdf;
      delete (result as Record<string, unknown>).authorId;
      delete (result as Record<string, unknown>).categoryId;
      delete (result as Record<string, unknown>).pdfImport;
      return result;
    }).filter(article => options.preview || Boolean(article.author && (article as Record<string, unknown>).date && new Date(String((article as Record<string, unknown>).date)).getTime() <= Date.now())).sort((left, right) => {
      const rightTime = new Date(String((right as Record<string, unknown>).date || '')).getTime() || 0;
      const leftTime = new Date(String((left as Record<string, unknown>).date || '')).getTime() || 0;
      return rightTime - leftTime || left.id.localeCompare(right.id);
    });
    return { settings, home, pages: rows.filter(row => row.document.kind === 'page').map(contentOf), people: rows.filter(row => row.document.kind === 'person').map(contentOf).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)), articles: publicArticles } as unknown as SiteContent;
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

export async function isMediaPublished(id: string, options: { download?: boolean } = {}): Promise<boolean> {
  const [reference] = await getDb().select({ id: mediaReferences.id }).from(mediaReferences).where(and(eq(mediaReferences.mediaId, id), eq(mediaReferences.isPublished, true), options.download ? eq(mediaReferences.downloadAllowed, true) : undefined)).limit(1);
  return Boolean(reference);
}
export async function mediaIsReferenced(id: string): Promise<boolean> { const [reference] = await getDb().select({ id: mediaReferences.id }).from(mediaReferences).where(eq(mediaReferences.mediaId, id)).limit(1); return Boolean(reference); }

export async function seedDocuments(entries: Array<{ id: string; kind: ContentKind; content: unknown }>, options: { publish: boolean }): Promise<Array<{ id: string; kind: ContentKind; result: 'created' | 'skipped' | 'conflict' }>> {
  if (process.env.SITE_ENV === 'production') throw new ContentError(403, 'SEED_PRODUCTION_REFUSED', 'L’initialisation automatique est réservée au développement et à la préproduction.');
  const actor: ContentWriter = { id: null, name: 'Migration initiale', role: 'administrator' };
  return getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('calas-initial-seed', 0))`);
    const result: Array<{ id: string; kind: ContentKind; result: 'created' | 'skipped' | 'conflict' }> = [];
    const created: Array<{ document: DocumentRow; content: Record<string, unknown> }> = [];
    for (const entry of entries) {
      const content = normalizeContent(entry.kind, entry.content, entry.id);
      const [existing] = await tx.select().from(documents).where(eq(documents.id, entry.id));
      if (existing) { result.push({ id: entry.id, kind: entry.kind, result: existing.kind === entry.kind ? 'skipped' : 'conflict' }); continue; }
      let collision = false;
      if (entry.kind === 'home' || entry.kind === 'page') collision = (await tx.select().from(pages).where(eq(pages.slug, entry.kind === 'home' ? '' : String(content.slug))).limit(1)).length > 0;
      if (entry.kind === 'article') collision = (await tx.select().from(articles).where(eq(articles.slug, String(content.slug))).limit(1)).length > 0;
      if (entry.kind === 'category') collision = (await tx.select().from(categories).where(eq(categories.slug, String(content.slug))).limit(1)).length > 0;
      if (entry.kind === 'settings') collision = (await tx.select().from(siteSettings).limit(1)).length > 0;
      if (collision) { result.push({ id: entry.id, kind: entry.kind, result: 'conflict' }); continue; }
      const [document] = await tx.insert(documents).values({ id: entry.id, kind: entry.kind, internalTitle: contentTitle(entry.kind, content), protected: ['home', 'page', 'settings'].includes(entry.kind) }).returning();
      await setDomainIdentity(tx, entry.kind, entry.id, content, true);
      created.push({ document: document!, content });
      result.push({ id: entry.id, kind: entry.kind, result: 'created' });
    }
    if (result.some(item => item.result === 'conflict')) throw new ContentError(409, 'SEED_CONFLICT', 'Une ressource existante utilise déjà une adresse ou un identifiant du contenu initial. Aucun contenu n’a été modifié.');
    const priority: Record<ContentKind, number> = { person: 0, category: 1, statistic: 2, settings: 3, home: 4, page: 5, article: 6 };
    for (const { document, content } of created.sort((a, b) => priority[a.document.kind] - priority[b.document.kind])) {
      if (options.publish) assertPublishable(document.kind, content);
      await appendRevision(tx, document, content, actor, 'imported', options.publish);
    }
    return result;
  });
}

