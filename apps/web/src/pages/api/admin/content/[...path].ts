import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireEditor, requireAdministrator } from '../../../../server/auth/permissions';
import { assertSameOrigin, json, jsonError, readJson } from '../../../../server/http';
import { ContentError, type ContentKind } from '../../../../server/content/models';
import { changePublication, createContent, dashboard, getContent, getSettingsContent, isCollection, listContent, listHistory, listRevisions, publishContent, restoreContent, saveContent } from '../../../../server/content/repository';

const createSchema = z.object({ id: z.string().uuid().optional(), idempotencyKey: z.string().uuid().optional(), content: z.unknown() }).strict();
const saveSchema = z.object({ content: z.unknown(), expectedVersion: z.number().int().nonnegative() }).strict();
const actionSchema = z.object({ expectedVersion: z.number().int().nonnegative(), revisionId: z.string().uuid().optional() }).strict();
const kindByCollection: Record<string, ContentKind[]> = { pages: ['home', 'page'], articles: ['article'], people: ['person'], statistics: ['statistic'], categories: ['category'], settings: ['settings'] };

export const ALL: APIRoute = async ({ request, params }) => {
  try {
    const actor = await requireEditor(request);
    const segments = (params.path || '').split('/').filter(Boolean);
    const [collection, resourceId, action] = segments;
    if (segments.length > 3) throw new ContentError(404, 'NOT_FOUND', 'Cette action est introuvable.');
    if (request.method !== 'GET') assertSameOrigin(request);
    if (request.method === 'GET' && collection === 'dashboard' && segments.length === 1) return json(await dashboard());
    if (request.method === 'GET' && collection === 'history' && segments.length === 1) return json({ items: await listHistory() });
    if (!collection || !isCollection(collection)) throw new ContentError(404, 'NOT_FOUND', 'Cette rubrique est introuvable.');
    if (collection === 'settings') await requireAdministrator(request);

    if (!resourceId) {
      if (request.method === 'GET') return json({ items: await listContent(collection) });
      if (request.method === 'POST') {
        if (['pages', 'settings'].includes(collection)) throw new ContentError(403, 'STRUCTURAL_CONTENT', 'Les pages structurelles sont protégées.');
        const input = await readJson(request, createSchema, 1_100_000);
        const result = await createContent(kindByCollection[collection]![0]!, input.content, actor, { id: input.id || input.idempotencyKey });
        return json(result, 201);
      }
    } else {
      if (!(collection === 'settings' && resourceId === 'site') && !z.string().uuid().safeParse(resourceId).success) throw new ContentError(404, 'NOT_FOUND', 'Ce contenu est introuvable.');
      const detail = collection === 'settings' && resourceId === 'site' ? await getSettingsContent() : await getContent(resourceId);
      if (!kindByCollection[collection]?.includes(detail.kind)) throw new ContentError(404, 'NOT_FOUND', 'Ce contenu n’appartient pas à cette rubrique.');
      if (request.method === 'GET' && !action) return json(detail);
      if (request.method === 'GET' && action === 'revisions') return json({ items: await listRevisions(detail.id) });
      if (request.method === 'PUT' && !action) {
        const input = await readJson(request, saveSchema, 1_100_000);
        return json(await saveContent(detail.id, input.content, input.expectedVersion, actor));
      }
      if (request.method === 'POST' && action) {
        const input = await readJson(request, actionSchema);
        if (action === 'publish') return json(await publishContent(detail.id, input.expectedVersion, actor));
        if (action === 'unpublish' || action === 'archive') return json(await changePublication(detail.id, input.expectedVersion, actor, action));
        if (action === 'restore' || action === 'discard') return json(await restoreContent(detail.id, input.revisionId, input.expectedVersion, actor, action === 'discard'));
      }
    }
    return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Cette opération n’est pas disponible.' } }), { status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Allow: 'GET, POST, PUT' } });
  } catch (error) {
    if (error instanceof ContentError) return json({ error: { code: error.code, message: error.message, fields: error.fields } }, error.status);
    return jsonError(error);
  }
};
