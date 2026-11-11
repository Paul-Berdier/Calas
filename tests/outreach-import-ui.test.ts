import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import {
  parseContactsFile,
  parseContactsText,
  parseImportRows,
  validateXlsxArchive,
} from "../apps/web/src/admin/outreach-import";

const defaults = {
  company: "Entreprise vérifiée",
  source: "Salon professionnel",
  sourceDate: "2026-01-02",
  informationConfirmed: true,
};

// A small, real XLSX archive; stored ZIP entries keep the fixture independent of a spreadsheet writer.
function archive(files: Record<string, string>) {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [filename, content] of Object.entries(files)) {
    const name = Buffer.from(filename),
      body = Buffer.from(content),
      local = Buffer.alloc(30),
      directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(body), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc32(body), 16);
    directory.writeUInt32LE(body.length, 20);
    directory.writeUInt32LE(body.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    central.push(directory, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const workbook = () =>
  archive({
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml":
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>e-mail</t></is></c><c r="B1" t="inlineStr"><is><t>entreprise</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>contact@example.test</t></is></c><c r="B2" t="inlineStr"><is><t>Entreprise Excel</t></is></c></row></sheetData></worksheet>',
  });

test("import XLSX réel et colonnes françaises, sans écraser une entreprise connue", async () => {
  const result = await parseContactsFile(
    new File([workbook()], "contacts.xlsx"),
    defaults,
  );
  assert.equal(result.contacts[0].email, "contact@example.test");
  assert.equal(result.contacts[0].company, "Entreprise Excel");
  assert.equal(result.contacts[0].source, defaults.source);
});
test("TXT : dédoublonnage sans inventer de noms, validation des valeurs communes", () => {
  const parsed = parseContactsText(
    "contact@example.test\r\nCONTACT@example.test\n",
    defaults,
  );
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.contacts[0].name, "");
  assert.throws(() =>
    parseContactsText("contact@example.test", { ...defaults, source: "" }),
  );
  assert.throws(() =>
    parseContactsText("Voici contact@example.test", defaults),
  );
});
test("valeurs Excel de date et opposition explicite ne sont pas remplacées par les valeurs communes", () => {
  assert.equal(
    parseImportRows(
      [
        ["e-mail", "date de collecte"],
        ["contact@example.test", new Date("2026-01-03T00:00:00Z")],
      ],
      defaults,
    ).contacts[0].sourceDate,
    "2026-01-03",
  );
  assert.throws(() =>
    parseImportRows(
      [
        ["email", "informationConfirmée"],
        ["contact@example.test", false],
      ],
      defaults,
    ),
  );
});
test("fichiers XLS anciens, extension inconnue et archives démesurées sont refusés", async () => {
  await assert.rejects(
    parseContactsFile(new File([""], "contacts.xls"), defaults),
    /xlsx/,
  );
  await assert.rejects(
    parseContactsFile(new File([""], "contacts.html"), defaults),
    /Excel/,
  );
  assert.throws(() => validateXlsxArchive(new ArrayBuffer(2)), /XLSX/);
  const oversized = workbook();
  const central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  oversized.writeUInt32LE(30_000_000, central + 24);
  assert.throws(
    () =>
      validateXlsxArchive(
        oversized.buffer.slice(
          oversized.byteOffset,
          oversized.byteOffset + oversized.byteLength,
        ),
      ),
    /25 Mo/,
  );
});
