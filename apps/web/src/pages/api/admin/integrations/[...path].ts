import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSession, requireEditor } from '../../../../server/auth/permissions';
import { assertSameOrigin, HttpError, json, jsonError, readJson } from '../../../../server/http';
import { createAgentToken, createAgentTokenSchema, listAgentTokens, revokeAgentToken } from '../../../../server/agent/access';
import { decideOAuthRequest, decisionSchema, listOAuthConnections, readOAuthRequest, revokeOAuthConnection } from '../../../../server/agent/oauth';

export const ALL: APIRoute = async ({ request, params }) => {
  try {
    const actor = await requireEditor(request);
    const parts = (params.path || '').split('/').filter(Boolean);
    if (request.method === 'GET' && parts.length === 1 && parts[0] === 'tokens') return json({ items: await listAgentTokens(actor) });
    if (parts[0] === 'oauth') {
      const current = await getSession(request);
      if (!current) throw new HttpError(401, 'UNAUTHENTICATED', 'Reconnectez-vous.');
      if (request.method === 'GET' && parts.length === 2 && parts[1] === 'connections') return json({ items: await listOAuthConnections(actor) });
      if (request.method === 'GET' && parts.length === 3 && parts[1] === 'requests') return json(await readOAuthRequest(parts[2]!, actor, current.session.id));
      if (request.method === 'POST') {
        assertSameOrigin(request);
        if (parts.length === 4 && parts[1] === 'requests' && parts[3] === 'decision') return json(await decideOAuthRequest(parts[2]!, actor, current.session.id, await readJson(request, decisionSchema, 1024)));
        if (parts.length === 4 && parts[1] === 'connections' && parts[3] === 'revoke' && z.uuid().safeParse(parts[2]).success) {
          await readJson(request, z.object({}).strict(), 128); return json(await revokeOAuthConnection(actor, parts[2]!));
        }
      }
      throw new HttpError(404, 'NOT_FOUND', 'Cette demande est introuvable.');
    }
    if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Cette action est indisponible.');
    assertSameOrigin(request);
    if (parts.length === 1 && parts[0] === 'tokens') {
      const input = await readJson(request, createAgentTokenSchema, 1024);
      const current = await getSession(request);
      if (!current) throw new HttpError(401, 'UNAUTHENTICATED', 'Reconnectez-vous pour créer un accès.');
      return json(await createAgentToken(actor, current.session.id, input), 201);
    }
    if (parts.length === 3 && parts[0] === 'tokens' && parts[2] === 'revoke' && z.string().uuid().safeParse(parts[1]).success) {
      await readJson(request, z.object({}).strict(), 128);
      return json(await revokeAgentToken(actor, parts[1]!));
    }
    throw new HttpError(404, 'NOT_FOUND', 'Cet accès est introuvable.');
  } catch (error) { return jsonError(error); }
};
