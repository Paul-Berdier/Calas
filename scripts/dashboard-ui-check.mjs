// Browser acceptance checks with synthetic API responses only: no database, SMTP or production access.
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import assert from "node:assert/strict";
import { dashboardFixture, emptyDashboardFixture, campaignDashboardFixture, dashboardCampaignOptionsFixture, dashboardCampaignId, secondDashboardCampaignId, inactiveDashboardCampaignId, missingCampaignId } from "../tests/fixtures/dashboard-metrics.mjs";

const output = resolve("artifacts/dashboard-ui");
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import AdminApp from './AdminApp';createRoot(document.getElementById('root')).render(<AdminApp user={{id:'fixture',name:'Paul de recette',email:'fixture@example.test',role:'administrator'}} initialPath={location.pathname}/>);`,
    resolveDir: resolve("apps/web/src/admin"), loader: "tsx",
  },
  bundle: true, write: false, outfile: "ui.js", format: "esm", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  // These unrelated lazy screens are never opened by this acceptance suite.
  plugins: [{ name: "unrelated-panels", setup(builder) {
    builder.onResolve({ filter: /^\.\/(?:DocumentEditor|components\/MediaLibrary|components\/PdfImport|Integrations)$/ }, args => {
      if (!args.importer.endsWith("AdminApp.tsx")) return;
      return { path: args.path.split("/").at(-1), namespace: "unrelated-panels" };
    });
    builder.onLoad({ filter: /.*/, namespace: "unrelated-panels" }, args => ({ contents: `export function ${args.path}(){throw new Error('Unrelated panel opened during dashboard acceptance check')}`, loader: "js" }));
  } }],
});
const assets = Object.fromEntries(bundle.outputFiles.map(file => ["/" + basename(file.path), file.text]));
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (assets[pathname]) {
    res.setHeader("Content-Type", pathname.endsWith("css") ? "text/css" : "text/javascript");
    res.end(assets[pathname]); return;
  }
  if (/^\/(brand|fonts)\/[a-zA-Z0-9/_-]+\.(png|svg|woff2?)$/.test(pathname)) {
    try {
      const file = await readFile(resolve("apps/web/public", "." + pathname));
      res.setHeader("Content-Type", pathname.endsWith("svg") ? "image/svg+xml" : pathname.endsWith("png") ? "image/png" : "font/woff2");
      res.end(file); return;
    } catch { res.statusCode = 404; res.end(); return; }
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recette tableau de bord Calas</title><link rel="stylesheet" href="/ui.css"></head><body style="margin:0"><div id="root"></div><script type="module" src="/ui.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, serviceWorkers: "block" });
const page = await context.newPage();
const checks = [], errors = [], externalRequests = [], requests = [], writes = [], measurementRequests = [];
await page.addInitScript(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copiedCampaignLink = text; } } });
});
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  const url = route.request().url();
  if (url.startsWith(base + "/r/")) { measurementRequests.push(url); return route.abort("blockedbyclient"); }
  if (url.startsWith(base + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
  externalRequests.push(url); return route.abort("blockedbyclient");
});

const editorial = {
  counts: { pages: 8, articlesPublished: 5, articlesDraft: 2, media: 17, needsReview: 1 },
  shortcuts: { home: "home-fixture", diagnostic: "diagnostic-fixture" },
  pending: [{ id: "article-fixture", kind: "article", title: "Une réflexion à relire", status: "draft", review: "pdf" }],
  recent: [], recentPublications: [],
};
const contact = {
  id: "33333333-3333-4333-8333-333333333333", version: 0,
  email: "contact@example.test", name: "Camille", company: "Entreprise de recette", jobTitle: "RH",
  source: "Rencontre professionnelle", sourceDate: "2026-11-01", informationConfirmed: true,
  status: "active", lastResponseAt: null, createdAt: "2026-11-10T12:00:00Z",
};
const campaign = {
  id: dashboardCampaignId, version: 0, title: "Diagnostic et qualité relationnelle",
  subject: "Découvrir notre accompagnement", body: "Bonjour, voici une présentation de notre accompagnement professionnel.",
  targetPath: "/diagnostic-rps/", linkPath: "/r/c_fixture", status: "active", createdAt: "2026-11-10T12:00:00Z",
};
const overview = {
  stats: { contacts: 1, campaigns: 1, queued: 0, accepted: 0, simulated: 0, visits: 0, arrivals: 0, responded: 0, suppressed: 0, uncertain: 0, failed: 0 },
  contacts: [contact], campaigns: [campaign], deliveries: [], visits: [], transport: "smtp", maxBatch: 1000,
  targets: [{ path: "/diagnostic-rps/", title: "Diagnostic" }],
};
let scenario = "normal", fresh = false, heldResponse, releaseResponse, heldCompleted = false;
let campaignFailureId = null, holdCampaignId = null, heldCampaignResponse, releaseCampaignResponse, heldCampaignCompleted = false;
await page.route("**/api/**", async route => {
  const request = route.request(), url = new URL(request.url());
  const path = url.pathname;
  requests.push({ path, query: url.search, method: request.method() });
  if (request.method() !== "GET") {
    writes.push({ path, method: request.method() });
    return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "No mutation permitted during dashboard acceptance checks" }) });
  }
  let data, status = 200, isHeld = false, isCampaignHeld = false;
  if (path === "/api/admin/content/dashboard/") {
    if (scenario === "editorial-error") { status = 503; data = { error: "Contenus momentanément indisponibles (recette)." }; }
    else data = editorial;
  }
  else if (path === "/api/admin/outreach/analytics-campaigns/") {
    const query = url.searchParams.get("q") || "";
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || 20);
    assert.equal(limit, 20, "Campaign choices paginate independently of top ten analytics");
    data = dashboardCampaignOptionsFixture(query, offset, limit);
  }
  else if (path === "/api/admin/outreach/analytics/") {
    const days = Number(url.searchParams.get("days"));
    const campaignId = url.searchParams.get("campaignId");
    assert.ok([7, 30, 90].includes(days), "Only supported analytics periods requested");
    if (campaignId && campaignId === campaignFailureId) { status = 404; data = { error: "Les chiffres de cette campagne sont indisponibles (recette)." }; }
    else if (scenario === "error") { status = 503; data = { error: "Statistiques momentanément indisponibles (recette)." }; }
    else if (scenario === "zero" || scenario === "simulation" || scenario === "local") {
      data = emptyDashboardFixture(days, scenario === "zero" ? "smtp" : scenario);
      if (scenario === "simulation") data.activity.simulated = 19;
      if (scenario === "local") { data.activity.localAccepted = 8; data.current.workerEnabled = false; }
    } else {
      data = campaignId ? campaignDashboardFixture(campaignId, days) : dashboardFixture(days);
      if (fresh) { data.activity.accepted = 88; data.generatedAt = "2026-11-12T13:00:00.000Z"; }
      if (scenario === "long") {
        data.campaigns[0].title = "Diagnostic; équipe \"Calas\" et accompagnement du management ".repeat(5);
        data.campaigns = Array.from({ length: 10 }, (_, index) => ({ ...data.campaigns[0], id: `fixture-${index}`, title: `${index + 1}. ${data.campaigns[0].title}` }));
        data.pages = Array.from({ length: 10 }, (_, index) => ({ ...data.pages[index % 2], path: `/page-de-recette-${index + 1}/` }));
        data.campaignRowsTotal = 23; data.pageRowsTotal = 15;
      }
      if (scenario === "hold30" && days === 30) {
        isHeld = true;
        heldResponse = data;
        await new Promise(resolve => { releaseResponse = resolve; });
      }
      if (campaignId && campaignId === holdCampaignId) {
        isCampaignHeld = true;
        heldCampaignResponse = data;
        await new Promise(resolve => { releaseCampaignResponse = resolve; });
      }
    }
  } else if (path === "/api/admin/outreach/overview/") data = overview;
  else if (path === `/api/admin/outreach/campaigns/${dashboardCampaignId}/overview/`) data = {
    campaign, stats: { total: 0, queued: 0, accepted: 0, simulated: 0, failed: 0, uncertain: 0, suppressed: 0 },
    includedContactIds: [], visits: [],
  };
  else if (path === `/api/admin/outreach/campaigns/${missingCampaignId}/overview/`) { status = 404; data = { error: "Campagne introuvable." }; }
  else {
    errors.push(`Unexpected API request: ${path}`); status = 404; data = { error: "Unexpected fixture request" };
  }
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  if (isHeld) heldCompleted = true;
  if (isCampaignHeld) heldCampaignCompleted = true;
});

const kpi = label => page.locator(".dashboard-kpi").filter({ has: page.getByText(label, { exact: true }) }).locator("strong");
const outcome = label => page.locator(".dashboard-outcomes > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd");
async function ready(accepted = "37") {
  await expect(page.getByRole("heading", { name: "Les chiffres de votre activité" })).toBeVisible();
  await expect(kpi("Acceptés par le serveur mail")).toHaveText(accepted);
  await expect(page.getByRole("heading", { name: "Contenus du site", exact: true })).toBeVisible();
}
async function inspect(name) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator("img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true, `${name}: images loaded at ${width}`);
    if (name === "dashboard-real") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(output, `${name}-viewport-${width}.png`) });
    }
    await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: page overflow at ${width}`);
    const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations;
    assert.deepEqual(violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], `${name}: accessibility at ${width}`);
    checks.push({ name, width, overflow: false, axeViolations: 0 });
  }
}

try {
  await page.goto(base + "/admin/");
  await ready();
  await expect(page.getByRole("button", { name: "30 jours", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(kpi("Arrivées depuis les liens")).toHaveText("12");
  await expect(kpi("Consultations attribuées")).toHaveText("21");
  await expect(kpi("Réponses signalées")).toHaveText("6");
  await expect(outcome("Simulations")).toHaveText("11");
  await expect(outcome("Acceptés en recette locale")).toHaveText("4");
  await expect(page.locator(".admin-metric").filter({ hasText: "Médias disponibles" }).locator("strong")).toHaveText("17");
  await expect(page.getByRole("img", { name: /Évolution quotidienne des envois acceptés/ })).toBeVisible();
  await expect(page.locator(".dashboard-period-caption")).toContainText("13:00");
  await expect(page.locator(".dashboard-period-caption")).toContainText("jours UTC");
  await inspect("dashboard-real");

  await page.getByText("Voir les valeurs jour par jour", { exact: true }).click();
  const daily = page.getByRole("region", { name: "Valeurs quotidiennes", exact: true });
  await expect(daily.getByRole("row")).toHaveCount(31);
  await expect(daily.locator("tbody tr").last().locator("td")).toHaveText(["37", "12", "21"]);
  await expect(daily.locator('time[datetime="2026-11-12"]')).toBeVisible();
  await inspect("dashboard-daily-table");
  await page.getByText("Comprendre ces chiffres et leurs limites", { exact: true }).click();
  await expect(page.getByText(/pas des personnes distinctes/)).toBeVisible();
  await expect(page.getByText(/Les réponses sont signalées manuellement/)).toBeVisible();
  checks.push({ name: "real-simulation-local-separation-and-accessible-daily-values", result: "passed" });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter les chiffres", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "calas-statistiques-30-jours.csv");
  await download.saveAs(resolve(output, "dashboard-export.csv"));
  const csv = await readFile(resolve(output, "dashboard-export.csv"), "utf8");
  assert.ok(csv.includes('"Messages acceptés par SMTP";"37"'));
  assert.ok(csv.includes('"Simulations";"11"'));
  assert.ok(!csv.includes("contact@example.test"));
  checks.push({ name: "csv-download-displayed-period-and-aggregates-only", result: "passed" });

  await page.getByRole("button", { name: "7 jours", exact: true }).click();
  await ready("7");
  await expect(page.getByRole("button", { name: "7 jours", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "90 jours", exact: true }).click();
  await ready("97");
  await expect(page.getByRole("button", { name: "90 jours", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Voir les valeurs jour par jour", { exact: true }).click();
  await expect(daily.getByRole("row")).toHaveCount(91);
  await page.getByRole("button", { name: "30 jours", exact: true }).click();
  await ready();
  fresh = true;
  await page.getByRole("button", { name: /Actualiser(?: les chiffres)?$/, exact: true }).click();
  await ready("88");
  await expect(page.locator(".dashboard-period-caption")).toContainText("14:00");
  checks.push({ name: "7-30-90-days-refresh-and-updated-time", result: "passed" });

  fresh = false; scenario = "hold30";
  await page.goto(base + "/admin/");
  await expect.poll(() => Boolean(releaseResponse)).toBe(true);
  await expect(page.getByText("Chargement des statistiques…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter les chiffres", exact: true })).toBeDisabled();
  await expect(page.locator(".dashboard-kpi")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Contenus du site", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "7 jours", exact: true }).click();
  await ready("7");
  assert.equal(heldResponse.period.days, 30);
  releaseResponse();
  await expect.poll(() => heldCompleted).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await ready("7");
  await expect(page.getByRole("button", { name: "7 jours", exact: true })).toHaveAttribute("aria-pressed", "true");
  checks.push({ name: "late-30-day-response-cannot-replace-selected-7-days", result: "passed" });

  scenario = "error";
  await page.goto(base + "/admin/");
  await expect(page.getByRole("alert")).toContainText("Statistiques momentanément indisponibles");
  await expect(page.getByRole("heading", { name: "Contenus du site", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Une réflexion à relire/ })).toBeVisible();
  await expect(page.locator(".dashboard-kpi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exporter les chiffres", exact: true })).toBeDisabled();
  await inspect("dashboard-error");
  scenario = "normal";
  await page.getByRole("button", { name: "Réessayer les statistiques", exact: true }).click();
  await ready();
  checks.push({ name: "analytics-error-isolated-from-editorial-and-retry", result: "passed" });

  scenario = "editorial-error";
  await page.goto(base + "/admin/");
  await expect(kpi("Acceptés par le serveur mail")).toHaveText("37");
  await expect(page.getByRole("alert")).toContainText("Contenus momentanément indisponibles");
  await expect(page.getByRole("button", { name: "Exporter les chiffres", exact: true })).toBeEnabled();
  scenario = "normal";
  await page.getByRole("button", { name: "Réessayer les contenus", exact: true }).click();
  await ready();
  checks.push({ name: "editorial-error-isolated-from-analytics-and-retry", result: "passed" });

  for (const mode of ["zero", "simulation", "local"]) {
    scenario = mode; await page.goto(base + "/admin/"); await ready("0");
    await expect(kpi("Arrivées depuis les liens")).toHaveText("0");
    await expect(kpi("Consultations attribuées")).toHaveText("0");
    await expect(page.getByText(/Aucune campagne avec une activité sur cette période/)).toBeVisible();
    if (mode === "simulation") {
      await expect(page.getByText("Mode simulation.", { exact: true })).toBeVisible();
      await expect(outcome("Simulations")).toHaveText("19");
    }
    if (mode === "local") {
      await expect(page.getByText("Mode de recette locale.", { exact: true })).toBeVisible();
      await expect(page.getByText("Traitement automatique désactivé.", { exact: true })).toBeVisible();
      await expect(outcome("Acceptés en recette locale")).toHaveText("8");
    }
    await inspect(`dashboard-${mode}`);
  }

  scenario = "long"; await page.goto(base + "/admin/"); await ready();
  await expect(page.getByText("10 campagnes affichées sur 23 avec une activité.", { exact: true })).toBeVisible();
  await expect(page.getByText("10 pages affichées sur 15.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Statistiques par campagne", exact: true }).locator("tbody tr")).toHaveCount(10);
  await expect(page.getByRole("region", { name: "Consultations par page", exact: true }).locator("tbody tr")).toHaveCount(10);
  await inspect("dashboard-long-titles");
  checks.push({ name: "displayed-versus-total-campaigns-pages-and-long-titles", result: "passed" });

  scenario = "normal"; await page.goto(base + "/admin/"); await ready();
  const campaignSelect = page.getByRole("combobox", { name: "Campagne analysée", exact: true });
  const campaignSearch = page.getByRole("searchbox", { name: "Rechercher une campagne", exact: true });
  const selectedCampaign = page.locator(".dashboard-selected-campaign");
  await expect(campaignSelect.locator("option")).toHaveCount(21);
  await page.getByRole("button", { name: `Analyser ${campaign.title}`, exact: true }).click();
  await ready("11");
  await expect(campaignSelect).toHaveValue(dashboardCampaignId);
  await expect(selectedCampaign).toContainText(campaign.title);
  await expect(kpi("Arrivées depuis les liens")).toHaveText("4");
  await expect(kpi("Consultations attribuées")).toHaveText("9");
  await expect(kpi("Destinataires inclus")).toHaveText("14");
  await expect(kpi("Réponses signalées")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Les contacts maintenant/ })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Lien unique de cette campagne", exact: true })).toHaveValue(`${base}/r/c_first_fixture`);
  await expect(page.getByRole("region", { name: "Consultations par page", exact: true }).locator("tbody tr").first().locator("td")).toHaveText(["4", "5"]);
  await inspect("dashboard-campaign-first");

  await campaignSelect.selectOption(secondDashboardCampaignId);
  await ready("26");
  await expect(selectedCampaign).toContainText("Entreprises de Toulouse");
  await expect(selectedCampaign).not.toContainText(campaign.title);
  await expect(kpi("Arrivées depuis les liens")).toHaveText("8");
  await expect(kpi("Consultations attribuées")).toHaveText("12");
  await expect(kpi("Destinataires inclus")).toHaveText("30");
  await expect(page.getByRole("textbox", { name: "Lien unique de cette campagne", exact: true })).toHaveValue(`${base}/r/c_second_fixture`);
  await expect(page.getByRole("region", { name: "Consultations par page", exact: true }).locator("tbody tr").first().locator("td")).toHaveText(["8", "8"]);
  const beforeCopyUrl = page.url();
  await page.getByRole("button", { name: "Copier le lien", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedCampaignLink)).toBe(`${base}/r/c_second_fixture`);
  assert.equal(page.url(), beforeCopyUrl);
  assert.deepEqual(measurementRequests, [], "Copying a unique link cannot count a visit");
  await page.getByText("Voir les valeurs jour par jour", { exact: true }).click();
  await expect(daily.locator("tbody tr").last().locator("td")).toHaveText(["26", "8", "12"]);
  await inspect("dashboard-campaign-second");
  checks.push({ name: "two-campaigns-same-destination-keep-links-counts-daily-series-and-pages-separate", result: "passed" });
  checks.push({ name: "copy-campaign-link-does-not-navigate-or-collect-an-arrival", result: "passed" });

  for (const [days, accepted] of [[7, "5"], [90, "66"], [30, "26"]]) {
    await page.getByRole("button", { name: `${days} jours`, exact: true }).click();
    await ready(accepted);
    await expect(campaignSelect).toHaveValue(secondDashboardCampaignId);
    assert.ok(requests.some(request => request.path.endsWith("/analytics/") && new URLSearchParams(request.query).get("campaignId") === secondDashboardCampaignId && new URLSearchParams(request.query).get("days") === String(days)));
  }
  const campaignDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter les chiffres", exact: true }).click();
  const campaignDownload = await campaignDownloadPromise;
  assert.equal(campaignDownload.suggestedFilename(), `calas-statistiques-30-jours-${secondDashboardCampaignId}.csv`);
  await campaignDownload.saveAs(resolve(output, "dashboard-campaign-export.csv"));
  const campaignCsv = await readFile(resolve(output, "dashboard-campaign-export.csv"), "utf8");
  assert.ok(campaignCsv.includes('"Messages acceptés par SMTP";"26"'));
  assert.ok(campaignCsv.includes('"Lien propre à la campagne";"/r/c_second_fixture"'));
  assert.ok(campaignCsv.includes('"Contacts avec une réponse signalée";"Non attribuable à une campagne"'));
  assert.ok(!campaignCsv.includes("c_first_fixture") && !campaignCsv.includes('"Contacts conservés"'));
  checks.push({ name: "period-changes-and-csv-preserve-selected-campaign-without-global-fake-zeros", result: "passed" });

  holdCampaignId = dashboardCampaignId;
  await campaignSelect.selectOption(dashboardCampaignId);
  await expect.poll(() => Boolean(releaseCampaignResponse)).toBe(true);
  await expect(page.locator(".dashboard-kpi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exporter les chiffres", exact: true })).toBeDisabled();
  await campaignSelect.selectOption(secondDashboardCampaignId);
  await ready("26");
  assert.equal(heldCampaignResponse.campaign.id, dashboardCampaignId);
  releaseCampaignResponse();
  await expect.poll(() => heldCampaignCompleted).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await ready("26");
  await expect(campaignSelect).toHaveValue(secondDashboardCampaignId);
  await expect(selectedCampaign).toContainText("Entreprises de Toulouse");
  holdCampaignId = null;
  checks.push({ name: "late-first-campaign-response-cannot-overwrite-second-campaign", result: "passed" });

  campaignFailureId = dashboardCampaignId;
  const globalRequestsBefore = requests.filter(request => request.path.endsWith("/analytics/") && !new URLSearchParams(request.query).has("campaignId")).length;
  await campaignSelect.selectOption(dashboardCampaignId);
  await expect(page.getByRole("alert")).toContainText("Les chiffres de cette campagne sont indisponibles");
  await expect(campaignSelect).toHaveValue(dashboardCampaignId);
  await expect(page.locator(".dashboard-kpi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exporter les chiffres", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Contenus du site", exact: true })).toBeVisible();
  assert.equal(requests.filter(request => request.path.endsWith("/analytics/") && !new URLSearchParams(request.query).has("campaignId")).length, globalRequestsBefore, "A scoped error cannot silently fall back to global totals");
  await inspect("dashboard-campaign-error");
  campaignFailureId = null;
  await page.getByRole("button", { name: "Réessayer les statistiques", exact: true }).click();
  await ready("11");
  checks.push({ name: "campaign-error-keeps-scope-no-global-fallback-and-retry", result: "passed" });

  await page.getByRole("button", { name: "Campagnes suivantes", exact: true }).click();
  await expect(campaignSelect.locator(`option[value="${inactiveDashboardCampaignId}"]`)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Campagnes précédentes", exact: true })).toBeEnabled();
  assert.ok(requests.some(request => request.path.endsWith("/analytics-campaigns/") && new URLSearchParams(request.query).get("offset") === "20"));
  await campaignSearch.fill("Ancienne");
  await expect.poll(() => requests.some(request => request.path.endsWith("/analytics-campaigns/") && new URLSearchParams(request.query).get("q") === "Ancienne" && new URLSearchParams(request.query).get("offset") === "0")).toBe(true);
  await expect(campaignSelect.locator(`option[value="${inactiveDashboardCampaignId}"]`)).toHaveCount(1);
  await ready("11");
  await campaignSelect.selectOption(inactiveDashboardCampaignId);
  await ready("0");
  await expect(selectedCampaign).toContainText("Ancienne campagne sans activité");
  await expect(kpi("Destinataires inclus")).toHaveText("0");
  await expect(kpi("Arrivées depuis les liens")).toHaveText("0");
  await expect(page.getByRole("textbox", { name: "Lien unique de cette campagne", exact: true })).toHaveValue(`${base}/r/c_inactive_fixture`);
  await expect(page.getByText("Aucune consultation attribuée sur cette période.", { exact: true })).toBeVisible();
  await inspect("dashboard-campaign-inactive");
  await page.getByRole("button", { name: "Toutes les campagnes", exact: true }).click();
  await ready("37");
  await expect(selectedCampaign).toHaveCount(0);
  await expect(kpi("Réponses signalées")).toHaveText("6");
  checks.push({ name: "campaign-selector-pagination-and-search-include-inactive-campaigns-outside-top-ten", result: "passed" });

  scenario = "normal"; await page.goto(base + "/admin/"); await ready();
  await page.getByRole("link", { name: campaign.title, exact: true }).click();
  await expect(page).toHaveURL(`${base}/admin/outreach/?campaign=${dashboardCampaignId}`);
  await expect(page.getByRole("heading", { name: campaign.title, exact: true })).toBeVisible();
  await expect(page.getByText("0 sélectionné(s), jusqu’à 1000 par mise en file.", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Relire et mettre en file", exact: true })).toBeDisabled();
  assert.ok(requests.some(request => request.path === `/api/admin/outreach/campaigns/${dashboardCampaignId}/overview/`));
  await inspect("campaign-deep-link");
  await page.getByRole("button", { name: "← Toutes les campagnes", exact: true }).click();
  await expect(page).toHaveURL(`${base}/admin/outreach/`);
  await expect(page.getByRole("button", { name: "Ouvrir", exact: true })).toBeVisible();
  checks.push({ name: "dashboard-campaign-link-loads-specific-campaign-with-empty-selection-and-no-send", result: "passed" });

  await page.goto(`${base}/admin/outreach/?campaign=${missingCampaignId}&view=fixture`);
  await expect(page.getByRole("alert")).toContainText("Campagne introuvable.");
  await inspect("campaign-missing");
  await page.getByRole("button", { name: "Revenir aux campagnes", exact: true }).click();
  await expect(page).toHaveURL(`${base}/admin/outreach/?view=fixture`);
  await expect(page.getByRole("button", { name: "Ouvrir", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  checks.push({ name: "missing-campaign-error-and-safe-return-preserving-other-query", result: "passed" });
  await page.goto(`${base}/admin/outreach/?campaign=not-a-uuid`);
  await expect(page.getByRole("button", { name: "Ouvrir", exact: true })).toBeVisible();
  assert.ok(!requests.some(request => request.path.includes("not-a-uuid")));
  assert.deepEqual(writes, [], "Browsing statistics and campaign detail cannot enqueue or mutate");
  assert.deepEqual(measurementRequests, [], "Viewing/copying analytics links does not measure visits");
  assert.deepEqual(externalRequests, [], "No external service used by this suite");
  assert.deepEqual(errors, []);
  checks.push({ name: "invalid-campaign-id-ignored-and-no-mutations-or-external-requests", result: "passed" });
  await writeFile(resolve(output, "report.json"), JSON.stringify({ at: new Date().toISOString(), scope: "Actual AdminApp, DashboardInsights and Outreach; unrelated lazy screens stubbed; synthetic HTTP APIs", checks, writes, measurementRequests, externalRequests, errors, requests }, null, 2));
  console.log(`PASS: ${checks.length} checks; real/simulated/local totals, periods, refresh, cancellation, isolated errors, CSV, accessible responsive UI and campaign deep links. No SMTP/database used.`);
} finally {
  releaseResponse?.();
  releaseCampaignResponse?.();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
