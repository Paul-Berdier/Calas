export type ContentKind =
  | "home"
  | "page"
  | "article"
  | "person"
  | "statistic"
  | "category"
  | "settings";
export type Collection =
  "pages" | "articles" | "people" | "statistics" | "categories" | "settings";
export type EditorialContent = Record<string, any>;
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "administrator" | "editor";
}
export interface ContentSummary {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  version: number;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
}
export interface ContentDetail extends ContentSummary {
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  content: EditorialContent;
}
export interface Revision {
  id: string;
  version: number;
  content: EditorialContent;
  createdAt: string;
  createdBy: string | null;
  createdByName?: string | null;
  action: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  title?: string;
  actorName?: string | null;
  createdAt: string;
}
export interface DashboardData {
  counts: {
    pages: number;
    articlesPublished: number;
    articlesDraft: number;
    media: number;
    needsReview: number;
  };
  recent: AuditEvent[];
  recentPublications: AuditEvent[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "La connexion a été interrompue. Votre saisie est conservée. Réessayez.",
      0,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : (payload?.error?.message ?? payload?.message);
    throw new ApiError(
      message ||
        (response.status === 401
          ? "Votre session a expiré. Reconnectez-vous dans un autre onglet, puis réessayez ici."
          : "Cette opération n’a pas pu être confirmée. Réessayez."),
      response.status,
      payload?.code ?? payload?.error?.code,
      payload?.details ?? payload?.error?.fields ?? payload?.fields,
    );
  }
  return payload as T;
}

export const contentApi = {
  list: (collection: Collection, signal?: AbortSignal) =>
    request<{ items: ContentSummary[] }>(`/api/admin/content/${collection}/`, {
      signal,
    }),
  get: (collection: Collection, id: string, signal?: AbortSignal) =>
    request<ContentDetail>(
      `/api/admin/content/${collection}/${encodeURIComponent(id)}/`,
      { signal },
    ),
  create: (collection: Collection, content: EditorialContent, id: string) =>
    request<ContentDetail>(`/api/admin/content/${collection}/`, {
      method: "POST",
      body: JSON.stringify({ content, id, idempotencyKey: id }),
    }),
  save: (
    collection: Collection,
    id: string,
    content: EditorialContent,
    expectedVersion: number,
  ) =>
    request<ContentDetail>(
      `/api/admin/content/${collection}/${encodeURIComponent(id)}/`,
      { method: "PUT", body: JSON.stringify({ content, expectedVersion }) },
    ),
  action: (
    collection: Collection,
    id: string,
    action: string,
    expectedVersion: number,
    revisionId?: string,
  ) =>
    request<ContentDetail>(
      `/api/admin/content/${collection}/${encodeURIComponent(id)}/${action}/`,
      { method: "POST", body: JSON.stringify({ expectedVersion, revisionId }) },
    ),
  revisions: (collection: Collection, id: string, signal?: AbortSignal) =>
    request<{ items: Revision[] }>(
      `/api/admin/content/${collection}/${encodeURIComponent(id)}/revisions/`,
      { signal },
    ),
};

export function formatDate(value?: string) {
  if (!value) return "Date non renseignée";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date non renseignée"
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
export const collectionForKind: Record<ContentKind, Collection> = {
  home: "pages",
  page: "pages",
  article: "articles",
  person: "people",
  statistic: "statistics",
  category: "categories",
  settings: "settings",
};
export const actionLabels: Record<string, string> = {
  created: "Création",
  saved: "Brouillon enregistré",
  published: "Publication",
  unpublished: "Retrait du site",
  archived: "Archivage",
  restored: "Version restaurée",
  discarded: "Brouillon annulé",
  imported: "Import initial",
  create: "Création",
  save: "Brouillon enregistré",
  update: "Modification",
  publish: "Publication",
  unpublish: "Retrait du site",
  archive: "Archivage",
  restore: "Version restaurée",
  discard: "Brouillon annulé",
  upload: "Média ajouté",
  replace: "Média remplacé",
  delete: "Suppression",
};
