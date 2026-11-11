import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ContentError } from '../../../server/content/models';
import { MediaError } from '../../../server/media/validation';
import { HttpError, json, jsonError, readJson } from '../../../server/http';
import { clientAddress } from '../../../server/client-address';
import { consumeRateLimit } from '../../../server/auth/rate-limit';
import { recordAgentCall, requireAgentAccess } from '../../../server/agent/access';
import { availableAgentTools, callAgentTool } from '../../../server/agent/tools';

export const ALL: APIRoute = async ({ request, clientAddress: adapterAddress }) => {
  try {
    if (!['GET', 'POST'].includes(request.method)) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Cette méthode est indisponible.');
    if (!await consumeRateLimit(`agent:ip:${clientAddress(request, adapterAddress)}`, 120, 60)) throw new HttpError(429, 'RATE_LIMIT', 'Patientez une minute avant de réessayer.');
    const access = await requireAgentAccess(request);
    if (!await consumeRateLimit(`agent:token:${access.tokenId}`, 60, 60)) throw new HttpError(429, 'RATE_LIMIT', 'Patientez une minute avant de réessayer.');
    if (request.method === 'GET') return json({ tools: availableAgentTools(access) });
    const input = await readJson(request, z.object({ name: z.string().max(80), arguments: z.unknown() }).strict(), 1_100_000);
    const result = await callAgentTool(access, input.name, input.arguments, () => recordAgentCall(access, input.name));
    return json({ result });
  } catch (error) {
    if (error instanceof ContentError) return json({ error: { code: error.code, message: error.message, fields: error.fields } }, error.status);
    if (error instanceof MediaError) return json({ error: { code: error.code, message: error.message } }, error.status);
    return jsonError(error);
  }
};
