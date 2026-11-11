import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authLoginPath,
  consentDestination,
  isConsentDestination,
  safeAuthDestination,
} from "../apps/web/src/auth/destination";

const id = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN012";
const target = `/admin/connexion-ia/?request=${id}`;
test("seule la route de consentement avec identifiant opaque est conservée", () => {
  assert.equal(id.length, 43);
  assert.equal(consentDestination(id), target);
  assert.equal(safeAuthDestination(target), target);
  assert.equal(isConsentDestination(target), true);
  assert.equal(
    new URL(authLoginPath(target), "https://example.test").searchParams.get(
      "returnTo",
    ),
    target,
  );
});
test("aucune URL absolue, chemin relatif, double encodage ni paramètre supplémentaire ne redirige", () => {
  for (const value of [
    "https://evil.example/",
    "//evil.example/",
    "javascript:alert(1)",
    "/admin/connexion-ia/?request=" + id + "&next=https://evil.example",
    target + "#fragment",
    "/admin/connexion-ia?request=" + id,
    encodeURIComponent(target),
    "/admin/connexion-ia/?request=%2f" + id,
    "/admin/connexion-ia/../login/",
    "\\evil.example",
    null,
    "",
  ]) {
    assert.equal(safeAuthDestination(value), "/admin/", String(value));
  }
  assert.equal(consentDestination(id.slice(1)), null);
  assert.equal(consentDestination("/".repeat(43)), null);
});
test("le parcours sécurité existant garde son retour dédié", () => {
  assert.equal(safeAuthDestination("security"), "/admin/security/");
  assert.equal(
    authLoginPath("/admin/security/"),
    "/admin/login/?returnTo=security",
  );
  assert.equal(authLoginPath("https://evil.example"), "/admin/login/");
});
