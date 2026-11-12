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
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Outreach}from'./Outreach';import{Integrations}from'./Integrations';import{OAuthConsent}from'./OAuthConsent';import AuthScreens from'../auth/AuthScreens';import './admin.css';const params=new URLSearchParams(location.search);const user={id:'fixture',name:'Compte de recette',email:'fixture@example.test',role:params.get('role')||'administrator'};const panel=params.get('panel');createRoot(document.getElementById('root')).render(panel==='integrations'?<Integrations user={user}/>:panel==='oauth'?<OAuthConsent user={user} requestId={params.get('request')}/>:panel==='login'?<AuthScreens mode="login"/>:<Outreach onDirtyChange={(dirty)=>{window.__outreachDirty=dirty;}}/>);`,
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
  timezoneId: "America/New_York",
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
const campaigns = [campaign];
const campaignCreations = [];
const templates = [], deliveryItems = [], scheduledRequests = [], previewRequests = [], deliveryRequests = [];
let previewFailure = false;
let templateSaveGate = null;
let queued = 0,
  transport = "simulation",
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
  if (templateSaveGate && path.startsWith('/api/admin/outreach/templates/') && ['POST','PATCH'].includes(request.method())) await templateSaveGate;
  let result = {};
  const search=new URL(request.url()).searchParams;
  const pageItems=items=>{const offset=Number(search.get('offset')||0),limit=Number(search.get('limit')||25);return {items:items.slice(offset,offset+limit),total:items.length,offset,limit};};
  if (request.method()==='GET'&&path==='/api/admin/outreach/contacts/') {
    const q=(search.get('q')||'').toLowerCase();
    result=pageItems(contacts.filter(item=>(!search.get('eligibleOnly')||!(queued&&search.get('campaignId')===campaign.id))&&[item.name,item.company,item.email].join(' ').toLowerCase().includes(q)));
  }
  else if (request.method()==='GET'&&path==='/api/admin/outreach/campaigns/') result=pageItems(campaigns.filter(item=>[item.title,item.subject].join(' ').toLowerCase().includes((search.get('q')||'').toLowerCase())));
  else if (request.method()==='GET'&&path==='/api/admin/outreach/deliveries/') {
    deliveryRequests.push(Object.fromEntries(search));
    const q=(search.get('q')||'').toLowerCase();
    result=pageItems(deliveryItems.filter(item=>(!search.get('campaignId')||item.campaignId===search.get('campaignId'))&&(!search.get('status')||item.status===search.get('status'))&&[item.email,item.company,item.campaignTitle].join(' ').toLowerCase().includes(q)));
  }
  else if (path==='/api/admin/outreach/templates/'&&request.method()==='GET') result=pageItems(templates.filter(item=>item.title.toLowerCase().includes((search.get('q')||'').toLowerCase())));
  else if (path==='/api/admin/outreach/templates/'&&request.method()==='POST') {result={...body,id:'template-'+(templates.length+1),version:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};templates.push(result);}
  else if (path.startsWith('/api/admin/outreach/templates/')&&request.method()==='PATCH') {const item=templates.find(item=>path.includes('/'+item.id+'/'));assert.equal(body.version,item.version);Object.assign(item,body,{version:item.version+1});result=item;}
  else if (path.startsWith('/api/admin/outreach/templates/')&&request.method()==='DELETE') {const index=templates.findIndex(item=>path.includes('/'+item.id+'/'));assert.equal(body.version,templates[index].version);templates.splice(index,1);result={ok:true};}
  else if (path.endsWith('/preview/')) {
    previewRequests.push(body);
    if(previewFailure){previewFailure=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Aperçu momentanément indisponible (recette).'})});return;}
    const selectedCampaign=campaigns.find(item=>path.includes(`/${item.id}/`));
    result={subject:selectedCampaign.subject,text:selectedCampaign.body+'\n\nCalas Conseil — La voie de la qualité relationnelle\nContact : contact@calas-conseil.fr\nNe plus recevoir : lien exemple inactif',campaignLink:selectedCampaign.linkPath,recipient:body.contactId?contacts.find(item=>item.id===body.contactId):null,unsubscribeIsExample:true,sourceIsExample:!body.contactId};
  }
  else if (path === "/api/admin/outreach/overview/") {
    assert.equal(search.get('summary'),'true','The UI requests only aggregate metadata, never capped legacy lists');
    result = {
      stats: {
        contacts: contacts.length,
        campaigns: campaigns.length,
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
      transport,
      maxBatch: 1000,
      targets: [{ path: "/diagnostic-rps/", title: "Diagnostic" }],
    };
  }
  else if (/\/campaigns\/[^/]+\/overview\/$/.test(path)) {
    const selectedCampaign = campaigns.find((item) => path.includes(`/${item.id}/`));
    assert.ok(selectedCampaign, "Campaign detail must use a known campaign");
    const selectedQueued = selectedCampaign.id === campaign.id ? queued : 0;
    result = {
      campaign: selectedCampaign,
      stats: {
        total: selectedQueued,
        queued: selectedQueued,
        accepted: 0,
        simulated: 0,
        failed: 0,
        uncertain: 0,
        suppressed: 0,
      },
      includedContactIds: selectedQueued ? contacts.map((item) => item.id) : [],
      visits: selectedCampaign.id === campaign.id ? [
        { path: "/diagnostic-rps/", day: "2026-11-10", arrivals: 2, visits: 3 },
      ] : [],
    };
  } else if (path === "/api/admin/outreach/campaigns/" && request.method() === "POST") {
    campaignCreations.push(body);
    const created = {
      ...body,
      id: `campaign-${campaigns.length + 1}`,
      version: 0,
      status: "draft",
      linkPath: `/r/c_fixture_${campaigns.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    campaigns.push(created);
    result = created;
  } else if (path.endsWith("/send/")) {
    assert.equal(body.confirmation, true);
    queued += body.contactIds.length;
    const target=campaigns.find(item=>path.includes('/'+item.id+'/'));
    target.status = "active";
    target.version++;
    if(body.scheduledAt)scheduledRequests.push(body);
    result = { queued: body.contactIds.length, skipped: 0, simulation: true,scheduledAt:body.scheduledAt??null };
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
    assert.equal(await page.locator('.outreach-space .admin-card-header .admin-button').evaluateAll(buttons=>buttons.every(button=>{const r=button.getBoundingClientRect(),card=button.closest('.admin-card').getBoundingClientRect();return r.left>=card.left&&r.right<=card.right;})),true,`${name}: header actions are not clipped at ${width}`);
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
async function checkDelayedTemplateSave() {
  await page.goto(base+'/?tab=templates');
  await page.getByRole('button',{name:'Créer un modèle',exact:true}).click();
  await page.getByLabel('Nom du modèle').fill('Modèle enregistrement protégé');
  await page.getByLabel('Objet du message').fill('Objet conservé pendant la sauvegarde');
  await page.getByLabel('Texte du modèle').fill('Bonjour, ce message vérifie la conservation de la saisie pendant une sauvegarde lente.');
  for (const phase of ['creation','edition']) {
    if (phase === 'edition') {
      await page.getByRole('button',{name:'Modifier',exact:true}).click();
      await page.getByLabel('Nom du modèle').fill('Modèle modifié sans perte');
    }
    const submittedTitle = await page.getByLabel('Nom du modèle').inputValue();
    let release;
    templateSaveGate = new Promise(resolveGate => { release = resolveGate; });
    await page.getByRole('button',{name:'Enregistrer le modèle',exact:true}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('fieldset')).toHaveAttribute('disabled','');
    for (const name of ['Nom du modèle','Objet du message','Texte du modèle','Page proposée par le modèle']) await expect(page.getByLabel(name)).toBeDisabled();
    await expect(page.getByRole('button',{name:'Enregistrer le modèle',exact:true})).toBeDisabled();
    await expect(dialog.getByRole('button',{name:'Annuler',exact:true})).toBeDisabled();
    await page.getByLabel('Nom du modèle').evaluate(input => input.focus());
    await page.keyboard.type('texte parasite pendant la requête');
    await expect(page.getByLabel('Nom du modèle')).toHaveValue(submittedTitle);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await inspect(`template-${phase}-saving`);
    release();
    templateSaveGate = null;
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading',{name:submittedTitle,exact:true})).toBeVisible();
    assert.equal(templates[0].title,submittedTitle);
  }
  assert.equal(templates.length,1);
  assert.equal(templates[0].version,1);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'template-save-report.json'),JSON.stringify({checks:checks.filter(item=>item.name.startsWith('template-')),blockedInputDuringCreate:true,blockedInputDuringUpdate:true,preservedSubmittedData:true,realEmails:0,errors},null,2));
  templates.length = 0;
  console.log('PASS: delayed template creation/update block further input and preserve submitted data; 4 layout/accessibility checks. No real API or SMTP.');
}
try {
  await checkDelayedTemplateSave();
  if (!process.argv.includes('--template-save-only')) {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Campagne de recette" }),
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Aucun e-mail n’est envoyé." })).toBeVisible();
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
    .getByRole("button", { name: "Sélectionner cette page" })
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
  transport = "smtp";
  await page.getByRole("button", { name: "Actualiser la prospection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Les anciens essais simulés ne sont pas renvoyés" })).toBeVisible();
  const sourceCampaign = { ...campaign };
  await page.getByRole("button", { name: "Dupliquer la campagne", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nom interne")).toHaveValue(`${campaign.title} — copie`);
  await expect(page.getByLabel("Objet de l’e-mail")).toHaveValue(campaign.subject);
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(campaign.body);
  await expect(page.getByLabel("Page du site proposée")).toHaveValue(campaign.targetPath);
  assert.equal(campaignCreations.length, 0, "Opening a duplicate does not create a campaign");
  assert.equal(await page.evaluate(() => window.__outreachDirty), true, "The unsaved copy is guarded");
  await inspect("outreach-duplicate");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.equal(campaignCreations.length, 0, "Cancelling a duplicate does not write");
  assert.equal(await page.evaluate(() => window.__outreachDirty), false);
  await page.getByRole("button", { name: "Dupliquer la campagne", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${campaign.title} — copie`, exact: true })).toBeVisible();
  assert.deepEqual(campaignCreations, [{
    title: `${campaign.title} — copie`,
    subject: campaign.subject,
    body: campaign.body,
    targetPath: campaign.targetPath,
  }], "Only editable message fields are sent to the create API");
  assert.deepEqual(campaign, sourceCampaign, "The original campaign is unchanged");
  assert.equal(queued, 2, "Duplicating cannot queue or resend a message");
  assert.equal(campaigns[1].status, "draft");
  assert.notEqual(campaigns[1].linkPath, campaign.linkPath);
  assert.equal(await page.evaluate(() => window.__outreachDirty), false);
  await expect(page.getByRole("checkbox")).toHaveCount(contacts.length);
  await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Relire et mettre en file", exact: true })).toBeDisabled();
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
  // The visible history is served independently from the legacy overview's capped arrays.
  deliveryItems.push(...Array.from({length:1002},(_,index)=>({
    id:'delivery-'+index,campaignId:campaign.id,campaignTitle:campaign.title,contactId:contact.id,
    email:index===1001?'ancien@example.test':`recette${index}@example.test`,company:index===1001?'Ancienne entreprise':'Entreprise '+index,
    status:index===1001?'failed':'accepted',transport:'smtp',attempts:1,createdAt:'2026-11-10T12:00:00Z',finishedAt:'2026-11-10T12:01:00Z',scheduledAt:null,
  })));
  await page.goto(base+'/?tab=history&view=fixture');
  await expect(page.getByRole('button',{name:'Historique des envois',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page).toHaveURL(base+'/?tab=history&view=fixture');
  await expect(page.getByText('1–25 sur 1002',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Suivants',exact:true}).click();
  await expect(page.getByText('26–50 sur 1002',{exact:true})).toBeVisible();
  await page.getByLabel('Rechercher un envoi',{exact:true}).fill('Ancienne');
  await expect(page.getByRole('heading',{name:'Ancienne entreprise',exact:true})).toBeVisible();
  assert.equal(deliveryRequests.at(-1).offset,'0');
  await page.getByLabel('État de l’envoi',{exact:true}).selectOption('accepted');
  await expect(page.getByRole('heading',{name:'Aucun envoi trouvé'})).toBeVisible();
  await page.getByLabel('État de l’envoi',{exact:true}).selectOption('failed');
  await expect(page.getByRole('heading',{name:'Ancienne entreprise',exact:true})).toBeVisible();
  await inspect('outreach-history-complete');
  await page.getByRole('button',{name:'Modèles de messages',exact:true}).click();
  await page.getByRole('button',{name:'Créer un modèle',exact:true}).click();
  await page.getByLabel('Nom du modèle').fill('Premier échange RH');
  await page.getByLabel('Objet du message').fill('Faire connaissance');
  await page.getByLabel('Texte du modèle').fill('Bonjour, échangeons sur la qualité relationnelle dans votre organisation.');
  await page.getByRole('button',{name:'Enregistrer le modèle',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Premier échange RH',exact:true})).toBeVisible();
  assert.equal(templates.length,1);assert.equal(queued,2);
  await page.getByRole('button',{name:'Modifier',exact:true}).click();
  await page.getByLabel('Nom du modèle').fill('Premier échange professionnel');
  await page.getByRole('button',{name:'Enregistrer le modèle',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Premier échange professionnel',exact:true})).toBeVisible();
  assert.equal(templates[0].version,1);
  await inspect('outreach-templates');
  contacts.push(...Array.from({length:101},(_,index)=>({...contact,id:`extra-${index}`,email:`extra${index}@example.test`,company:`Entreprise supplémentaire ${index}`})));
  await page.getByRole('button',{name:'Utiliser',exact:true}).click();
  await expect(page.getByLabel('Nom interne')).toHaveValue('Premier échange professionnel');
  assert.equal(campaignCreations.length,1,'Choosing a template does not create or queue a campaign');
  await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Premier échange professionnel',exact:true})).toBeVisible();
  assert.equal(campaignCreations.length,2);assert.equal(queued,2);
  await expect(page.getByText('1–100 sur 103',{exact:true})).toBeVisible();
  await page.locator('.outreach-selection input[type="checkbox"]').first().check();
  await page.locator('[aria-label="Pagination des destinataires"]').getByRole('button',{name:'Suivants'}).click();
  await expect(page.getByText('101–103 sur 103',{exact:true})).toBeVisible();
  await page.locator('.outreach-selection input[type="checkbox"]').first().check();
  await page.locator('[aria-label="Pagination des destinataires"]').getByRole('button',{name:'Précédents'}).click();
  await expect(page.locator('.outreach-selection input[type="checkbox"]').first()).toBeChecked();
  await expect(page.getByText('2 sélectionné(s), jusqu’à 1000 par mise en file.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Aperçu du mail final',exact:true}).click();
  await expect(page.getByLabel('Contenu final du courriel')).toContainText('Calas Conseil — La voie de la qualité relationnelle');
  await expect(page.getByText('La provenance affichée est un exemple',{exact:false})).toBeVisible();
  assert.equal(queued,2);
  await page.getByRole('button',{name:'Fermer la fenêtre'}).click();
  await page.getByLabel('À une date et une heure choisies',{exact:true}).check();
  await page.getByLabel('Début des envois — heure de Paris',{exact:true}).fill('2000-01-01T09:30');
  await expect(page.getByText('Choisissez une date et une heure futures.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Relire et mettre en file',exact:true})).toBeDisabled();
  const futureDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  const futureWall=futureDate+'T09:30';
  await page.getByLabel('Début des envois — heure de Paris',{exact:true}).fill(futureWall);
  previewFailure=true;
  await page.getByRole('button',{name:'Relire et mettre en file',exact:true}).click();
  await expect(page.getByText('Aperçu momentanément indisponible (recette).',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmer la programmation',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Réessayer l’aperçu',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirmer la programmation',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Contenu final du courriel')).toContainText('Ne plus recevoir');
  assert.equal(previewRequests.at(-1).contactId,contact.id);
  assert.equal(queued,2,'Preview and changing schedule cannot send or queue');
  await inspect('outreach-final-mail-scheduled');
  await page.getByRole('button',{name:'Confirmer la programmation',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Début prévu le'})).toHaveCount(2);
  assert.equal(scheduledRequests.length,1);assert.equal(scheduledRequests[0].contactIds.length,2);
  const scheduledWall=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(scheduledRequests[0].scheduledAt)).replace(' ','T');
  assert.equal(scheduledWall,futureWall);assert.equal(queued,4);
  await page.getByRole('button',{name:'Modèles de messages',exact:true}).click();
  await page.getByRole('button',{name:'Supprimer',exact:true}).click();
  assert.equal(templates.length,1,'Delete requires explicit confirmation');
  await page.getByRole('button',{name:'Supprimer le modèle',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Votre premier modèle',exact:true})).toBeVisible();
  assert.equal(templates.length,0);assert.equal(campaigns.length,3,'Deleting a template preserves its campaigns');
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
      { at: new Date().toISOString(), checks, queued, duplicated: campaignCreations.length, imported, management:{historyRows:deliveryItems.length,historySearchBeyond1000:true,templatesCrud:true,crossPageRecipients:true,previewRequests:previewRequests.length,scheduledConfirmations:scheduledRequests.length,timeZone:'Europe/Paris'}, errors },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${checks.length} layout/accessibility checks; complete history, templates, final preview, Paris schedule, cross-page recipients, contact/import/duplicate and scoped access. No real SMTP or database.`,
  );
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
