// Shared with Better Auth's server configuration. Activity does not renew this
// window: freshSessionMiddleware compares the session's creation time.
export const SESSION_FRESH_AGE_SECONDS = 15 * 60;

export function sessionFreshUntil(createdAt: string | number | Date): number {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created)
    ? created + SESSION_FRESH_AGE_SECONDS * 1000
    : 0;
}
