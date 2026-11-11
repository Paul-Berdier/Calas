const consentRequestPattern = /^[A-Za-z0-9_-]{43}$/;
const consentDestinationPattern =
  /^\/admin\/connexion-ia\/\?request=([A-Za-z0-9_-]{43})$/;

export function consentDestination(
  requestId: string | null | undefined,
): string | null {
  return requestId && consentRequestPattern.test(requestId)
    ? `/admin/connexion-ia/?request=${requestId}`
    : null;
}

/** A small allowlist, never a general URL redirect. Keep the existing security flow. */
export function safeAuthDestination(value: string | null | undefined): string {
  if (value === "security") return "/admin/security/";
  return value && consentDestinationPattern.test(value) ? value : "/admin/";
}

export function authLoginPath(destination: string): string {
  const returnTo =
    destination === "/admin/security/"
      ? "security"
      : safeAuthDestination(destination);
  return returnTo === "/admin/"
    ? "/admin/login/"
    : `/admin/login/?returnTo=${encodeURIComponent(returnTo)}`;
}

export function isConsentDestination(value: string): boolean {
  return consentDestinationPattern.test(value);
}
