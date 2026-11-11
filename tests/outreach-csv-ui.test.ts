import { test } from "node:test";
import assert from "node:assert/strict";
import { parseContactsCsv } from "../apps/web/src/admin/outreach-csv";

const header =
  "email;name;company;jobTitle;source;sourceDate;informationConfirmed";
const row =
  'contact@example.test;Camille;"Entreprise; conseil";RH;Rencontre professionnelle;2026-01-02;true';

test("CSV avec BOM, cellules protégées et doublons d’adresse", () => {
  const result = parseContactsCsv(
    `\uFEFF${header}\r\n${row}\r\n${row.replace("contact@", "CONTACT@")}\r\n`,
  );
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].company, "Entreprise; conseil");
  assert.equal(result.contacts[0].informationConfirmed, true);
  assert.equal(result.duplicates, 1);
});

test("CSV standard virgule et guillemets échappés", () => {
  const result = parseContactsCsv(
    `${header.replaceAll(";", ",")}\ncontact@example.test,"Camille ""C""",Entreprise,RH,Salon,2026-01-02,oui`,
  );
  assert.equal(result.contacts[0].name, 'Camille "C"');
});

test("CSV refuse les dates impossibles, la provenance manquante et l’information non confirmée", () => {
  for (const invalid of [
    row.replace("2026-01-02", "2026-02-30"),
    row.replace("2026-01-02", "2999-01-02"),
    row.replace("Rencontre professionnelle", ""),
    row.replace("true", "false"),
  ]) {
    assert.throws(() => parseContactsCsv(`${header}\n${invalid}`));
  }
});

test("CSV refuse un champ obligatoire absent ou une structure ambiguë avant tout import", () => {
  assert.throws(() =>
    parseContactsCsv(`${header.replace("company", "societe")}\n${row}`),
  );
  assert.throws(() =>
    parseContactsCsv(
      `${header}\n${row.replace('"Entreprise; conseil"', '"Entreprise"inattendu')}`,
    ),
  );
  assert.throws(() =>
    parseContactsCsv(
      `${header}\n${row.replace('"Entreprise; conseil"', '"Entreprise\nconseil"')}`,
    ),
  );
  assert.throws(() => parseContactsCsv(`${header}\n${row};colonne en trop`));
});

test("CSV limite le volume avant import", () => {
  assert.throws(() =>
    parseContactsCsv(
      `${header}\n${Array.from({ length: 5001 }, (_, index) => row.replace("contact@", `contact${index}@`)).join("\n")}`,
    ),
  );
});
