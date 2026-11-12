// Isolated browser acceptance checks. All API responses are synthetic: no SMTP,
// database, backup job or production endpoint is contacted by this script.
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import assert from "node:assert/strict";

const output = resolve("artifacts/operations-ui");
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{OperationsStatus}from'./OperationsStatus';import './admin.css';createRoot(document.getElementById('root')).render(<OperationsStatus/>);`,
    resolveDir: resolve("apps/web/src/admin"),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  outfile: "ui.js",
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const assets = Object.fromEntries(bundle.outputFiles.map((file) => ["/" + basename(file.path), file.text]));
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (assets[pathname]) {
    res.setHeader("Content-Type", pathname.endsWith("css") ? "text/css" : "text/javascript");
    res.end(assets[pathname]);
    return;
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recette état technique Calas</title><link rel="stylesheet" href="/ui.css"></head><body style="margin:0"><main class="admin-shell" style="display:block;min-height:100vh;padding:24px"><h1>Administration de recette</h1><div id="root"></div></main><script type="module" src="/ui.js"></script></body></html>');
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ timezoneId: "America/New_York" });
const page = await context.newPage();
const errors = [], unexpectedRequests = [], requests = [], checks = [];
page.on("pageerror", (error) => errors.push(error.message));

const healthy = {
  checkedAt: "2026-11-12T09:15:00Z",
  site: { status: "ok", checkedAt: "2026-11-12T09:14:59Z" },
  backup: {
    status: "ok", capturedAt: "2026-11-12T03:00:00Z",
    verifiedAt: "2026-11-12T03:02:00Z", failedAt: null, expectedDay: "2026-11-12",
  },
  mail: {
    mode: "smtp", configured: true, workerEnabled: true,
    lastAcceptedAt: "2026-11-11T12:24:00Z", lastFailedAt: null,
    failed24h: 0, uncertain: 0, waiting: 3,
  },
};
let response = { status: 200, body: healthy };
let pending = null;
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== base) {
    unexpectedRequests.push(url.origin + url.pathname);
    await route.abort();
    return;
  }
  if (!url.pathname.startsWith("/api/")) {
    await route.continue();
    return;
  }
  requests.push({ method: route.request().method(), path: url.pathname });
  if (url.pathname !== "/api/admin/operations/" || route.request().method() !== "GET") {
    unexpectedRequests.push(route.request().method() + " " + url.pathname);
    await route.fulfill({ status: 404, json: { error: "API de recette inconnue" } });
    return;
  }
  const result = pending ? await pending : response;
  await route.fulfill({ status: result.status, json: result.body });
});

const panel = page.locator(".operations-panel");
const refresh = page.getByRole("button", { name: "Vérifier maintenant" });
const backup = page.locator(".operations-grid article").filter({ has: page.getByRole("heading", { name: "Sauvegarde quotidienne" }) });
const mail = page.locator(".operations-grid article").filter({ has: page.getByRole("heading", { name: "Envois de campagnes" }) });
const site = page.locator(".operations-grid article").filter({ has: page.getByRole("heading", { name: "Site public" }) });
const snapshot = (patch = {}) => ({
  ...structuredClone(healthy), ...patch,
  site: { ...healthy.site, ...patch.site },
  backup: { ...healthy.backup, ...patch.backup },
  mail: { ...healthy.mail, ...patch.mail },
});

async function open(body, status = 200) {
  response = { status, body };
  await page.goto(base);
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(refresh).toBeEnabled();
}

async function verify(name, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name} overflows at ${width}px`);
  const clipped = await page.locator(".operations-panel button,.operations-panel a").evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
  }).map((element) => element.textContent));
  assert.deepEqual(clipped, [], `${name} has clipped actions at ${width}px`);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) })), [], `${name} accessibility at ${width}px`);
  await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
  checks.push({ name, width, accessibilityViolations: 0, overflow: false });
}

try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await open(healthy);
    await expect(site).toContainText("Disponible");
    await expect(backup).toContainText("Sauvegarde à jour");
    await expect(backup).toContainText("12/11/2026 04:00 (Paris)");
    await expect(backup).toContainText("Archive vérifiée le 12/11/2026 04:02 (Paris)");
    await expect(mail).toContainText("0 échec(s) sur 24 h · 0 envoi(s) à vérifier.");
    await expect(panel).toContainText("3 envoi(s) en attente ou en cours.");
    await expect(page.getByRole("link", { name: "Consulter les envois" })).toHaveAttribute("href", "/admin/outreach/?tab=history");
    await expect(panel).toContainText("une panne complète du fournisseur peut aussi interrompre les alertes");
    await expect(panel).toContainText("Ce contrôle ne déclenche aucun envoi ni sauvegarde");
    await verify("healthy", width);

    const backupCases = [
      { name: "late", fields: { status: "late", capturedAt: "2026-11-11T03:00:00Z", verifiedAt: "2026-11-11T03:02:00Z" }, label: "Sauvegarde attendue manquante", detail: "Une capture du 12/11/2026 UTC est attendue." },
      { name: "failed", fields: { status: "error", failedAt: "2026-11-12T03:04:00Z" }, label: "Dernière tentative en échec", detail: "Échec signalé le 12/11/2026 04:04 (Paris)" },
      { name: "unknown", fields: { status: "unknown", capturedAt: null, verifiedAt: null }, label: "État indisponible", detail: "La lecture du suivi n’a pas confirmé l’état de la sauvegarde." },
      { name: "unconfigured", fields: { status: "unconfigured", capturedAt: null, verifiedAt: null }, label: "Suivi à raccorder", detail: "La lecture du suivi n’a pas confirmé l’état de la sauvegarde." },
    ];
    for (const item of backupCases) {
      await open(snapshot({ backup: item.fields }));
      await expect(backup).toHaveAttribute("data-status", item.fields.status);
      await expect(backup).toContainText(item.label);
      await expect(backup).toContainText(item.detail);
      await expect(backup).not.toContainText("Sauvegarde à jour");
      if (item.fields.capturedAt === null) {
        await expect(backup).toContainText("Aucune confirmation enregistrée");
        await expect(backup).not.toContainText("Archive vérifiée le");
      }
      await verify(`backup-${item.name}`, width);
    }

    await open(snapshot({ site: { status: "error" }, mail: { failed24h: 2, uncertain: 1, waiting: 4 } }));
    await expect(site).toContainText("Contrôle en échec");
    await expect(site).toHaveAttribute("data-status", "error");
    await expect(mail).toHaveAttribute("data-status", "error");
    await expect(mail).toContainText("2 échec(s) sur 24 h · 1 envoi(s) à vérifier.");
    await verify("site-and-delivery-failures", width);

    await open(snapshot({ mail: { mode: "unknown", configured: false, workerEnabled: false, failed24h: null, uncertain: null, waiting: null, lastAcceptedAt: null } }));
    await expect(mail).toContainText("Mode indisponible");
    await expect(mail).toContainText("Historique momentanément indisponible.");
    await expect(mail).not.toContainText("0 échec(s)");
    await expect(panel).not.toContainText("envoi(s) en attente ou en cours");
    await expect(panel).not.toContainText("null");
    await expect(panel).toContainText("Traitement des campagnes : désactivé");
    await verify("unavailable-counts", width);

    for (const [mode, configured, label] of [
      ["smtp", false, "Configuration incomplète"],
      ["simulation", false, "Simulation, aucun mail envoyé"],
      ["local", false, "Messagerie de recette locale"],
    ]) {
      await open(snapshot({ mail: { mode, configured } }));
      await expect(mail).toContainText(label);
      await verify(`mail-${mode}`, width);
    }

    await open({ error: "Le suivi est temporairement indisponible." }, 503);
    await expect(page.getByRole("alert")).toContainText("Le suivi est temporairement indisponible.");
    await expect(page.locator(".operations-grid")).toHaveCount(0);
    await expect(panel).not.toContainText("Disponible");
    await verify("initial-request-failure", width);
    response = { status: 200, body: healthy };
    await refresh.focus();
    await page.keyboard.press("Enter");
    await expect(backup).toContainText("Sauvegarde à jour");
    await expect(page.getByRole("alert")).toHaveCount(0);

    let release;
    pending = new Promise((resolvePending) => { release = resolvePending; });
    await refresh.click();
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(refresh).toBeDisabled();
    await expect(backup).toContainText("Sauvegarde à jour");
    release({ status: 503, body: { error: "Le suivi est temporairement indisponible." } });
    await expect(panel).toHaveAttribute("aria-busy", "false");
    pending = null;
    await expect(refresh).toBeEnabled();
    await expect(page.getByRole("alert")).toContainText("Les résultats ci-dessous datent du dernier contrôle réussi.");
    await expect(panel).toContainText("Dernière lecture : 12/11/2026 10:15 (Paris)");
    await expect(panel).toContainText("3 envoi(s) en attente ou en cours.");
    await verify("stale-results-after-failure", width);

    response = { status: 200, body: snapshot({ checkedAt: "2026-11-12T10:20:00Z", mail: { waiting: 7 } }) };
    await refresh.click();
    await expect(panel).toContainText("Dernière lecture : 12/11/2026 11:20 (Paris)");
    await expect(panel).toContainText("7 envoi(s) en attente ou en cours.");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await verify("successful-retry", width);
  }
  assert.deepEqual(errors, [], "Unexpected browser errors");
  assert.deepEqual(unexpectedRequests, [], "No external URL or mutation may be requested");
  assert.ok(requests.length > 0 && requests.every(({ method, path }) => method === "GET" && path === "/api/admin/operations/"));
  await writeFile(resolve(output, "report.json"), JSON.stringify({ checks, requests: requests.length, browserTimeZone: "America/New_York", displayTimeZone: "Europe/Paris", externalRequests: 0, mutationRequests: 0, browserErrors: errors }, null, 2));
  console.log(`PASS: ${checks.length} layout/accessibility checks; backup states, null counts, keyboard retry, stale result preservation and Paris dates. Synthetic read-only APIs only.`);
} finally {
  await browser.close();
  await new Promise((closed) => server.close(closed));
}
