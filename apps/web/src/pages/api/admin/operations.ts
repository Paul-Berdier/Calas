import type { APIRoute } from 'astro';
import { requireEditor } from '../../../server/auth/permissions';
import { consumeRateLimit } from '../../../server/auth/rate-limit';
import { HttpError, json, jsonError } from '../../../server/http';
import { getOperationsStatus } from '../../../server/operations/status';

export const GET: APIRoute = async ({ request }) => {
  try {
    const actor = await requireEditor(request);
    if (!await consumeRateLimit('admin:operations:' + actor.id, 12, 60)) throw new HttpError(429, 'RATE_LIMIT', 'Patientez une minute avant de vérifier à nouveau.');
    return json(await getOperationsStatus(actor));
  } catch (error) { return jsonError(error); }
};
