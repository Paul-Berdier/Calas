import test from "node:test";
import assert from "node:assert/strict";
import { dashboardCsv } from "../apps/web/src/admin/dashboard-export";
import type { DashboardMetrics } from "../apps/web/src/lib/dashboard-metrics";
import { dashboardFixture, emptyDashboardFixture } from "./fixtures/dashboard-metrics.mjs";

const fixture = () => dashboardFixture() as DashboardMetrics;

test("CSV preserves real, simulated and local totals as separate columns with their period", () => {
  const data = fixture();
  const csv = dashboardCsv(data);
  assert.ok(csv.startsWith("\uFEFF"), "French Excel receives a UTF-8 BOM");
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
