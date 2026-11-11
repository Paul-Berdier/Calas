// Isolated UI acceptance checks. All administration APIs are intercepted; no SMTP or database is used.
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import assert from "node:assert/strict";

const output = resolve("artifacts/outreach-ui");
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Outreach}from'./Outreach';import{Integrations}from'./Integrations';import{OAuthConsent}from'./OAuthConsent';import AuthScreens from'../auth/AuthScreens';import './admin.css';const params=new URLSearchParams(location.search);const user={id:'fixture',name:'Compte de recette',email:'fixture@example.test',role:params.get('role')||'administrator'};const panel=params.get('panel');createRoot(document.getElementById('root')).render(panel==='integrations'?<Integrations user={user}/>:panel==='oauth'?<OAuthConsent user={user} requestId={params.get('request')}/>:panel==='login'?<AuthScreens mode="login"/>:<Outreach onDirtyChange={()=>{}}/>);`,
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
const assets = Object.fromEntries(
  bundle.outputFiles.map((file) => ["/" + basename(file.path), file.text]),
);
const wordmark = await readFile(resolve("apps/web/public/brand/wordmark.svg"));
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/brand/wordmark.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(wordmark);
    return;
  }
  const content = assets[pathname];
  if (content) {
    res.setHeader(
      "Content-Type",
      pathname.endsWith("css") ? "text/css" : "text/javascript",
    );
    res.end(content);
    return;
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recette administration Calas</title><link rel="stylesheet" href="/ui.css"></head><body style="margin:0"><div class="admin-shell" style="display:block;min-height:100vh;padding:24px"><div id="root"></div></div><script type="module" src="/ui.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const contact = {
  id: "contact-1",
  version: 0,
  email: "contact@example.test",
  name: "Camille",
  company: "Entreprise de recette",
  jobTitle: "RH",
  source: "Rencontre professionnelle",
  sourceDate: "2026-01-02",
  informationConfirmed: true,
  status: "active",
  lastResponseAt: null,
  createdAt: "2026-11-10T12:00:00Z",
};
const campaign = {
  id: "campaign-1",
  version: 0,
  title: "Campagne de recette",
  subject: "Découvrir notre accompagnement",
  body: "Bonjour, voici une présentation de notre accompagnement professionnel.",
  targetPath: "/diagnostic-rps/",
  linkPath: "/r/c_fixture",
  status: "draft",
  createdAt: "2026-11-10T12:00:00Z",
};
const contacts = [contact];
let queued = 0,
  tokens = [],
  creationScopes = [],
  imported = 0;
const consentId = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN012";
const consentDecisions = [];
const remoteConnections = [
  {
    id: "remote-1",
    clientName: "Application distante de recette",
    scopes: ["read"],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  },
];
await page.route("**/api/admin/**", async (route) => {
  const request = route.request(),
    path = new URL(request.url()).pathname;
  const body = request.method() === "GET" ? {} : request.postDataJSON();
  let result = {};
  if (path === "/api/admin/outreach/overview/")
    result = {
      stats: {
        contacts: contacts.length,
        campaigns: 1,
        queued,
        accepted: 0,
        simulated: 0,
        arrivals: 2,
        visits: 3,
        responded: 0,
        suppressed: 0,
        uncertain: 0,
        failed: 0,
      },
      contacts,
      campaigns: [campaign],
      deliveries: [],
      transport: "simulation",
      maxBatch: 1000,
      targets: [{ path: "/diagnostic-rps/", title: "Diagnostic" }],
      visits: [],
    };
  else if (path.endsWith("/campaigns/campaign-1/overview/"))
    result = {
      campaign,
      stats: {
        total: queued,
        queued,
        accepted: 0,
        simulated: 0,
        failed: 0,
        uncertain: 0,
        suppressed: 0,
      },
      includedContactIds: queued ? contacts.map((item) => item.id) : [],
      visits: [
        { path: "/diagnostic-rps/", day: "2026-11-10", arrivals: 2, visits: 3 },
      ],
    };
  else if (path.endsWith("/send/")) {
    assert.equal(body.confirmation, true);
    queued += body.contactIds.length;
    campaign.status = "active";
    campaign.version++;
    result = { queued: body.contactIds.length, skipped: 0, simulation: true };
  } else if (path.endsWith("/pause/")) {
    campaign.status = body.paused ? "paused" : "active";
    campaign.version++;
    result = { ...campaign };
  } else if (path.endsWith("/contacts/") && request.method() === "POST") {
    contacts.push({ ...contact, ...body, id: "contact-2" });
    result = contacts.at(-1);
  } else if (path.endsWith("/contacts/import/")) {
    imported += body.contacts.length;
    result = { created: body.contacts.length, updated: 0, skipped: 0 };
  } else if (
    path.endsWith("/integrations/tokens/") &&
    request.method() === "GET"
  )
    result = { items: tokens };
  else if (
    path.endsWith("/integrations/tokens/") &&
    request.method() === "POST"
  ) {
    creationScopes = body.scopes;
    const item = {
      id: "token-1",
      name: body.name,
      scopes: body.scopes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
    tokens = [item];
    result = { item, token: "calas_fixture_never_a_real_secret" };
  } else if (path.endsWith("/oauth/connections/")) {
    result = { items: remoteConnections };
  } else if (path.endsWith("/oauth/connections/remote-1/revoke/")) {
    remoteConnections[0].revokedAt = new Date().toISOString();
    result = { revoked: true };
  } else if (path.endsWith(`/oauth/requests/${consentId}/`)) {
    result = {
      clientName: "Application de recette",
      redirectHost: "client.example.test",
      requestedScopes: ["read", "draft", "users"],
      allowedScopes: ["read", "draft"],
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  } else if (path.endsWith(`/oauth/requests/${consentId}/decision/`)) {
    consentDecisions.push(body);
    result = {
      redirectUrl: `${base}/callback/?${body.approve ? "code=fixture" : "error=access_denied"}&state=fixture`,
    };
  } else if (path.endsWith("/revoke/")) {
    tokens[0].revokedAt = new Date().toISOString();
    result = { revoked: true };
  } else
    throw new Error(`Unexpected fixture request: ${request.method()} ${path}`);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(result),
  });
});
await page.route("**/api/auth/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const result = path.endsWith("/sign-in/email")
    ? { twoFactorRedirect: true }
    : { status: true };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(result),
  });
});

async function inspect(name) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: resolve(output, `${name}-${width}.png`),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `${name} overflows ${width}`,
    );
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations;
    assert.deepEqual(
      violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      [],
      `${name} accessibility`,
    );
    checks.push({ name, width });
  }
}
try {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Campagne de recette" }),
  ).toBeVisible();
  await inspect("outreach-overview");
  await page.getByRole("button", { name: "Contacts", exact: true }).click();
  await page
    .getByRole("button", { name: "Ajouter un contact", exact: true })
    .click();
  await page.getByLabel("E-mail professionnel").fill("new@example.test");
  await page.getByLabel("Nom du contact").fill("Nouveau contact");
  await page
    .getByLabel("Entreprise", { exact: false })
    .fill("Entreprise nouvelle");
  await page
    .getByLabel("Provenance des coordonnées")
    .fill("Salon professionnel");
  await page.getByLabel("Date de collecte").fill("2026-01-02");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(
    page.getByRole("heading", { name: "Nouveau contact" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Campagnes", exact: true }).click();
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await page
    .getByRole("button", { name: "Sélectionner les contacts trouvés" })
    .click();
  await page.getByRole("button", { name: "Vérifier la simulation" }).click();
  assert.equal(queued, 0, "No queue before the explicit confirmation");
  await page
    .getByRole("button", { name: "Mettre en file de simulation", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "2 message(s) mis en file" }),
  ).toBeVisible();
  assert.equal(queued, 2);
  await page
    .getByRole("button", { name: "Mettre en pause", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reprendre les envois", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reprendre les envois", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mettre en pause", exact: true }),
  ).toBeVisible();
  await inspect("outreach-campaign");
  await page
    .getByRole("button", { name: "Importer des contacts", exact: true })
    .click();
  await page.getByLabel("Fichier de contacts").setInputFiles({
    name: "contacts.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("import@example.test"),
  });
  await page.getByLabel("Entreprise commune").fill("Entreprise importée");
  await page
    .getByLabel("Provenance de la liste")
    .fill("Annuaire professionnel vérifié");
  await page.getByLabel("Date de collecte commune").fill("2026-01-02");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyser le fichier" }).click();
  await expect(
    page.getByText("1 contact(s) à vérifier", { exact: false }),
  ).toBeVisible();
  await inspect("outreach-import");
  await page
    .getByRole("button", { name: "Confirmer l’import", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.equal(imported, 1);
  await page.goto(`${base}?panel=integrations`);
  await page
    .getByRole("button", { name: "Révoquer la connexion", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Révoquer l’application", exact: true })
    .click();
  await expect(page.getByText("Révoquée", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Créer une clé locale" }).click();
  await page.getByLabel("Nom de la connexion").fill("Claude de recette");
  await page.getByRole("button", { name: "Créer la clé", exact: true }).click();
  await expect(page.getByLabel("Clé personnelle")).toHaveAttribute(
    "type",
    "password",
  );
  assert.deepEqual([...creationScopes].sort(), [
    "draft",
    "outreach",
    "publish",
    "read",
    "send",
    "users",
  ]);
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await inspect("integrations-token");
  await page.getByRole("button", { name: "Fermer l’affichage" }).click();
  await expect(page.getByLabel("Clé personnelle")).toHaveCount(0);
  await page.getByRole("button", { name: "Révoquer", exact: true }).click();
  await page
    .getByRole("button", { name: "Révoquer l’accès", exact: true })
    .click();
  await expect(page.getByText("Révoqué", { exact: true })).toBeVisible();
  await page.goto(`${base}?panel=integrations&role=editor`);
  await page.getByRole("button", { name: "Créer une clé locale" }).click();
  await expect(
    page.getByText("Gérer les utilisateurs", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`${base}?panel=oauth&role=editor&request=${consentId}`);
  await expect(
    page.getByText("client.example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Gérer les utilisateurs", { exact: true }),
  ).toHaveCount(0);
  assert.equal(
    consentDecisions.length,
    0,
    "Loading a consent page cannot grant access",
  );
  await inspect("oauth-consent");
  await page.getByLabel("Créer et modifier les brouillons").uncheck();
  await page
    .getByRole("button", { name: "Autoriser la connexion", exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/callback/?code=fixture&state=fixture`);
  assert.deepEqual(consentDecisions[0], { approve: true, scopes: ["read"] });
  await page.goto(`${base}?panel=oauth&role=editor&request=${consentId}`);
  await page.getByRole("button", { name: "Refuser", exact: true }).click();
  await expect(page).toHaveURL(
    `${base}/callback/?error=access_denied&state=fixture`,
  );
  assert.deepEqual(consentDecisions[1], { approve: false, scopes: [] });
  const destination = `/admin/connexion-ia/?request=${consentId}`;
  await page.goto(
    `${base}?panel=login&returnTo=${encodeURIComponent(destination)}`,
  );
  await page.getByLabel("Adresse email").fill("fixture@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("fixture-never-a-real-password");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Code à six chiffres").fill("123456");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page).toHaveURL(base + destination);
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { at: new Date().toISOString(), checks, queued, imported, errors },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${checks.length} layout/accessibility checks; contact, explicit queue, TXT import, scoped token and revocation paths.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
