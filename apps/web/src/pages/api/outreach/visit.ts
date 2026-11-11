import type { APIRoute } from 'astro';
import { z } from 'zod';
import { assertSameOrigin, HttpError, json, jsonError, readJson } from '../../../server/http';
import { consumeRateLimit } from '../../../server/auth/rate-limit';
import { clientAddress } from '../../../server/client-address';
import { recordCampaignVisit } from '../../../server/outreach/service';

const visitSchema = z.object({
  campaignToken: z.string().min(20).max(160).regex(/^c_[A-Za-z0-9_-]+$/),
  path: z.string().max(200).regex(/^\/(?:[a-z0-9-]+\/)*$/),
  arrival: z.boolean().default(false),
}).strict();

export const POST: APIRoute = async ({ request, clientAddress: address }) => {
  try {
    assertSameOrigin(request);
    const input = await readJson(request, visitSchema, 1024);
    if (!await consumeRateLimit('outreach-visit:' + clientAddress(request, address), 120, 600)) {
      throw new HttpError(429, 'RATE_LIMIT', 'Trop de demandes.');
    }
    await recordCampaignVisit(input.campaignToken, input.path, input.arrival);
    return json({ recorded: true });
  } catch (error) {
    return jsonError(error);
  }
};
