import test from "node:test";
import assert from "node:assert/strict";
import { dashboardCsv } from "../apps/web/src/admin/dashboard-export";
import { metricDifference, previousDashboardRange } from "../apps/web/src/lib/dashboard-comparison";
import type { DashboardMetrics } from "../apps/web/src/lib/dashboard-metrics";
import { dashboardFixture, emptyDashboardFixture, campaignDashboardFixture, dashboardCampaignId, secondDashboardCampaignId, inactiveDashboardCampaignId } from "./fixtures/dashboard-metrics.mjs";

const fixture = () => dashboardFixture() as DashboardMetrics;

test("previous interval has exactly the same UTC day count across DST and leap days", () => {
  assert.deepEqual(previousDashboardRange({days:3,from:'2024-03-01',to:'2024-03-03',timeZone:'UTC'}),{from:'2024-02-27',to:'2024-02-29'});
  assert.deepEqual(previousDashboardRange({days:3,from:'2026-03-30',to:'2026-04-01',timeZone:'UTC'}),{from:'2026-03-27',to:'2026-03-29'});
  assert.deepEqual(metricDifference(10,0),{difference:10,percentage:null});
  assert.deepEqual(metricDifference(0,0),{difference:0,percentage:null});
  assert.deepEqual(metricDifference(null,0),{difference:null,percentage:null});
  assert.deepEqual(metricDifference(3,6),{difference:-3,percentage:-50});
});

test("comparison export identifies both periods/campaigns and exports both complete aggregate sets", () => {
  const primary = campaignDashboardFixture(dashboardCampaignId) as DashboardMetrics;
  const reference = campaignDashboardFixture(secondDashboardCampaignId) as DashboardMetrics;
  reference.campaign!.title='=malicious()';
  reference.activity.arrivals=0;
  const csv=dashboardCsv(primary,{kind:'campaign',data:reference});
  assert(csv.includes('"Comparaison";"Autre campagne sur la même période"'));
  assert(csv.includes('"B — Référence";"\'=malicious()"'));
  assert(csv.includes('"Arrivées depuis les liens";"4";"0";"4";"Non calculable : référence nulle"'));
  assert(csv.includes('"Réponses signalées";"Non attribuable";"Non attribuable";"Non disponible";"Non disponible"'));
  assert(csv.includes('"Détail de la référence B"'));
  assert(csv.includes('"Lien propre à la campagne";"/r/c_first_fixture"'));
  assert(csv.includes('"Lien propre à la campagne";"/r/c_second_fixture"'));
  assert.equal([...csv].filter(c=>c==='\uFEFF').length,1);
  assert(!csv.includes('NaN')&&!csv.includes('Infinity'));
});

test("CSV preserves real, simulated and local totals as separate columns with their period", () => {
  const data = fixture();
  const csv = dashboardCsv(data);
  assert.ok(csv.startsWith("\uFEFF"), "French Excel receives a UTF-8 BOM");
  assert.ok(csv.includes('"Périmètre";"Toutes les campagnes"\r\n'));
  assert.ok(csv.includes('"Période UTC";"2026-10-14T00:00:00.000Z";"2026-11-12T12:00:00.000Z"\r\n'));
  assert.ok(csv.includes('"Messages acceptés par SMTP";"37"\r\n'));
  assert.ok(csv.includes('"Simulations";"11"\r\n'));
  assert.ok(csv.includes('"Acceptés par la messagerie de recette locale";"4"\r\n'));
  assert.ok(csv.includes('"2026-11-12";"37";"12";"21"\r\n'));
  assert.ok(csv.includes('"Diagnostic et qualité relationnelle";"active";"/diagnostic-rps/";"45";"37";"3";"2";"3";"11";"4";"12";"21"'));
  assert.ok(csv.includes('"Campagnes affichées";"1";"Campagnes avec activité";"1"'));
  assert.ok(csv.includes('"Diagnostic";"/diagnostic-rps/";"12";"13"'));
  assert.ok(csv.includes("Ni visiteurs uniques, ni ouvertures, ni classement en boîte de réception mesurés"));
});

test("campaign CSV identifies its unique link and only exports that campaign's counts", () => {
  const first = dashboardCsv(campaignDashboardFixture(dashboardCampaignId) as DashboardMetrics);
  const second = dashboardCsv(campaignDashboardFixture(secondDashboardCampaignId) as DashboardMetrics);
  assert.ok(first.includes('"Périmètre";"Campagne : Diagnostic et qualité relationnelle"'));
  assert.ok(first.includes(`"Identifiant de campagne";"${dashboardCampaignId}"`));
  assert.ok(first.includes('"Lien propre à la campagne";"/r/c_first_fixture"'));
  assert.ok(second.includes('"Lien propre à la campagne";"/r/c_second_fixture"'));
  for (const csv of [first, second]) assert.ok(csv.includes('"Page de destination";"/diagnostic-rps/"'));
  assert.ok(first.includes('"Messages acceptés par SMTP";"11"'));
  assert.ok(second.includes('"Messages acceptés par SMTP";"26"'));
  assert.ok(first.includes('"Destinataires inclus depuis la création (données conservées)";"14"'));
  assert.ok(second.includes('"Destinataires inclus depuis la création (données conservées)";"30"'));
  assert.ok(first.includes('"Arrivées depuis les liens";"4"'));
  assert.ok(second.includes('"Arrivées depuis les liens";"8"'));
  assert.ok(!first.includes("c_second_fixture") && !first.includes("Entreprises de Toulouse"));
  assert.ok(!second.includes("c_first_fixture") && !second.includes("Diagnostic et qualité relationnelle"));
});

test("campaign CSV labels non-attributable contact metrics instead of fabricating zeros", () => {
  const csv = dashboardCsv(campaignDashboardFixture(dashboardCampaignId) as DashboardMetrics);
  for (const label of ["Nouveaux contacts", "Contacts avec une réponse signalée", "Nouvelles adresses exclues"]) {
    assert.ok(csv.includes(`"${label}";"Non attribuable à une campagne"`));
    assert.ok(!csv.includes(`"${label}";"0"`));
  }
  for (const label of ["Contacts conservés", "Contacts disponibles", "Contacts avec réponse signalée", "Adresses exclues"]) assert.ok(!csv.includes(`"${label}";`));
  assert.ok(!csv.includes('"null"') && !csv.includes('"undefined"'));
});

test("inactive campaign CSV keeps its identity and genuine zero activity for the selected period", () => {
  const data = campaignDashboardFixture(inactiveDashboardCampaignId, 7) as DashboardMetrics;
  const csv = dashboardCsv(data);
  assert.ok(csv.includes('"Périmètre";"Campagne : Ancienne campagne sans activité"'));
  assert.ok(csv.includes('"Campagne créée le";"2025-02-01T12:00:00.000Z"'));
  assert.ok(csv.includes('"État de la campagne";"paused"'));
  assert.ok(csv.includes('"Messages acceptés par SMTP";"0"'));
  assert.ok(csv.includes('"Arrivées depuis les liens";"0"'));
  assert.ok(csv.includes('"Pages affichées";"0";"Pages avec activité";"0"'));
  assert.ok(csv.includes('"Contacts avec une réponse signalée";"Non attribuable à une campagne"'));
});

test("CSV retains zero real sends when the only activity consists of simulation", () => {
  const data = emptyDashboardFixture(7, "simulation") as DashboardMetrics;
  data.activity.simulated = 19;
  const csv = dashboardCsv(data);
  assert.ok(csv.includes('"Messages acceptés par SMTP";"0"\r\n'));
  assert.ok(csv.includes('"Simulations";"19"\r\n'));
  assert.ok(csv.includes('"Arrivées depuis les liens";"0"\r\n'));
  assert.ok(csv.includes('"Mode d’envoi";"simulation"\r\n'));
  assert.ok(csv.includes('"Campagnes affichées";"0";"Campagnes avec activité";"0"'));
  assert.ok(!csv.includes("NaN") && !csv.includes("undefined"));
});

test("CSV quotes delimiters, quotes and multiline text without changing ordinary titles", () => {
  const data = fixture();
  data.campaigns[0].title = 'Qualité; "équipe"\nDeuxième ligne';
  data.pages[0].title = 'Le lien d’Agnès et Sara';
  const csv = dashboardCsv(data);
  assert.ok(csv.includes('"Qualité; ""équipe""\nDeuxième ligne";"active"'));
  assert.ok(csv.includes('"Le lien d’Agnès et Sara";"/diagnostic-rps/"'));
});

test("CSV neutralizes formula-leading campaign and page titles, including whitespace prefixes", () => {
  for (const title of ['=HYPERLINK("https://example.test")', "+1+1", "-1+1", "@SUM(1)", "  =1+1", "\t=1+1", "\r=1+1", "\n=1+1", "\uFEFF=1+1"]) {
    const data = fixture();
    data.campaigns[0].title = title;
    data.pages[0].title = title;
    const csv = dashboardCsv(data);
    const escaped = '"\'' + title.replaceAll('"', '""') + '"';
    assert.ok(csv.includes(escaped + ';"active"'), `Campaign title protected: ${JSON.stringify(title)}`);
    assert.ok(csv.includes(escaped + ';"/diagnostic-rps/"'), `Page title protected: ${JSON.stringify(title)}`);
  }
});

test("CSV limits the export to displayed aggregates and does not leak incidental contact fields", () => {
  const data = fixture();
  Object.assign(data, { contacts: [{ email: "private@example.test", token: "private-fixture-token" }] });
  Object.assign(data.campaigns[0], { linkPath: "/r/private-fixture-token" });
  const before = JSON.stringify(data);
  const csv = dashboardCsv(data);
  assert.ok(!csv.includes("private@example.test"));
  assert.ok(!csv.includes("private-fixture-token"));
  assert.equal(JSON.stringify(data), before, "Export leaves the data unchanged");
});
