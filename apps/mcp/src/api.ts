export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean; idempotentHint: boolean };
}

export function connectionSettings(env: Record<string, string | undefined>) {
  let url: URL;
  try { url = new URL(env.CALAS_MCP_URL || ''); } catch { throw new Error('Renseignez CALAS_MCP_URL avec l’adresse du site.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') throw new Error('CALAS_MCP_URL exige une origine HTTPS, sans chemin. HTTP est réservé à localhost.');
  const token = env.CALAS_MCP_TOKEN || '';
  if (!/^calas_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Créez un accès personnel dans Administration → Connexions IA puis renseignez CALAS_MCP_TOKEN.');
  return { endpoint: new URL('/api/agent/tools/', url), token };
}

const errors: Record<number, string> = {
  401: 'Accès expiré ou révoqué. Reconnectez-vous à l’administration et créez un nouvel accès personnel.',
  403: 'Le compte ou les droits de cet accès ne permettent pas cette opération.',
  404: 'La ressource ou l’outil demandé est introuvable.',
  409: 'La version a changé ou une protection métier empêche cette opération. Relisez la ressource avant une nouvelle demande.',
  413: 'La demande dépasse la taille autorisée.',
  422: 'Les paramètres sont invalides. Consultez le schéma et relisez le contenu.',
  429: 'Trop de demandes. Patientez une minute.',
};

export class CalasApi {
  readonly #endpoint: URL;
  readonly #token: string;
  constructor(settings: ReturnType<typeof connectionSettings>) { this.#endpoint = settings.endpoint; this.#token = settings.token; }

  async request(body?: unknown): Promise<Record<string, unknown>> {
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    if (serialized && Buffer.byteLength(serialized) > 1_100_000) throw new Error(errors[413]);
    try {
      const response = await fetch(this.#endpoint, { method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${this.#token}`, accept: 'application/json', ...(serialized ? { 'content-type': 'application/json' } : {}) },
        body: serialized, redirect: 'error', signal: AbortSignal.timeout(30_000), cache: 'no-store' });
      if (!response.ok) { await response.body?.cancel(); throw new Error(errors[response.status] || 'Le site n’a pas pu terminer cette opération. Vérifiez son état dans l’administration.'); }
      if (!response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('Réponse du site invalide.');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Réponse trop volumineuse. Affinez la demande.'); }
        chunks.push(part.value);
      }
      let result: unknown;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Réponse du site invalide.'); }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Réponse du site invalide.');
      return result as Record<string, unknown>;
    } catch (error) {
      // Never expose fetch errors: they may embed URLs, headers or private server responses.
      if (error instanceof Error && (Object.values(errors).includes(error.message) || [
        'Le site n’a pas pu terminer cette opération. Vérifiez son état dans l’administration.',
        'Réponse du site invalide.', 'Réponse trop volumineuse. Affinez la demande.',
      ].includes(error.message))) throw error;
      throw new Error('Connexion au site interrompue. Vérifiez son état avant de relancer une action : elle peut avoir été prise en compte.');
    }
  }

  async tools(): Promise<ToolDefinition[]> {
    const value = await this.request();
    if (!Array.isArray(value.tools) || value.tools.length > 50) throw new Error('Liste d’outils invalide.');
    const names = new Set<string>();
    return value.tools.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Liste d’outils invalide.');
      const tool = item as ToolDefinition;
      if (!/^calas_[a-z_]{1,70}$/.test(tool.name) || names.has(tool.name) || typeof tool.description !== 'string'
        || tool.description.length > 2000 || !tool.inputSchema || tool.inputSchema.type !== 'object'
        || !tool.annotations || ['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint'].some(key => typeof tool.annotations[key as keyof ToolDefinition['annotations']] !== 'boolean')) throw new Error('Liste d’outils invalide.');
      names.add(tool.name);
      return tool;
    });
  }
}
