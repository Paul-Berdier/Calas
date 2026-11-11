import { parseContactsCsv, readRows, type ImportContact } from "./outreach-csv";

export type ImportDefaults = Pick<
  ImportContact,
  "company" | "source" | "sourceDate" | "informationConfirmed"
>;
const fields = [
  "email",
  "name",
  "company",
  "jobTitle",
  "source",
  "sourceDate",
  "informationConfirmed",
] as const;
const aliases: Record<string, string> = {
  email: "email",
  mail: "email",
  courriel: "email",
  adresseemail: "email",
  adresse: "email",
  name: "name",
  nom: "name",
  nomducontact: "name",
  contact: "name",
  company: "company",
  entreprise: "company",
  societe: "company",
  organisation: "company",
  jobtitle: "jobTitle",
  fonction: "jobTitle",
  poste: "jobTitle",
  source: "source",
  provenance: "source",
  sourcedate: "sourceDate",
  datedecollecte: "sourceDate",
  date: "sourceDate",
  informationconfirmed: "informationConfirmed",
  informationconfirmee: "informationConfirmed",
};
function cellText(value: unknown): string {
  if (value instanceof Date)
    return Number.isFinite(value.getTime())
      ? value.toISOString().slice(0, 10)
      : "";
  return value == null ? "" : String(value).trim();
}
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Convert only known columns; defaults fill empty cells and never replace supplied data. */
export function parseImportRows(rows: unknown[][], defaults: ImportDefaults) {
  if (rows.length > 5001) throw new Error("Le fichier dépasse 5 000 contacts.");
  const [head, ...body] = rows;
  if (!head) throw new Error("Le fichier est vide.");
  const headers = head.map(
    (value) =>
      aliases[
        cellText(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z]/g, "")
      ] ?? "",
  );
  const known = headers.filter(Boolean);
  if (!headers.includes("email") || new Set(known).size !== known.length)
    throw new Error(
      "Ajoutez une colonne email (ou e-mail), sans colonnes reconnues en double.",
    );
  const converted = body
    .filter((row) => row.some((value) => cellText(value)))
    .map((row, index) => {
      if (row.slice(headers.length).some((value) => cellText(value)))
        throw new Error(
          `Ligne ${index + 2} — des cellules n’ont pas d’en-tête.`,
        );
      const values = Object.fromEntries(
        headers.map((header, column) => [header, cellText(row[column])]),
      );
      return fields
        .map((field) => {
          const supplied = values[field];
          if (supplied) return csvCell(supplied);
          const fallback =
            field in defaults ? defaults[field as keyof ImportDefaults] : "";
          return csvCell(String(fallback));
        })
        .join(";");
    });
  return parseContactsCsv([fields.join(";"), ...converted].join("\n"));
}

export function parseContactsText(raw: string, defaults: ImportDefaults) {
  if (raw.length > 5_000_000)
    throw new Error("Choisissez un fichier de 5 Mo maximum.");
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return parseImportRows([["email"], ...lines.map((line) => [line])], defaults);
}

/** Bound the declared inflated archive before the XLSX parser reads XML. */
export function validateXlsxArchive(buffer: ArrayBuffer) {
  const data = new DataView(buffer);
  let end = buffer.byteLength - 22;
  const minimum = Math.max(0, end - 65_535);
  while (end >= minimum && data.getUint32(end, true) !== 0x06054b50) end--;
  if (end < minimum)
    throw new Error("Ce fichier n’est pas un classeur XLSX valide.");
  const count = data.getUint16(end + 10, true);
  const directoryOffset = data.getUint32(end + 16, true);
  if (count > 500 || count === 0 || directoryOffset >= end)
    throw new Error(
      "Le classeur est trop complexe. Exportez sa feuille de contacts en CSV.",
    );
  let offset = directoryOffset;
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || data.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Archive XLSX invalide.");
    expanded += data.getUint32(offset + 24, true);
    if (expanded > 25_000_000)
      throw new Error(
        "Le classeur décompressé dépasse 25 Mo. Exportez la feuille de contacts en CSV.",
      );
    offset +=
      46 +
      data.getUint16(offset + 28, true) +
      data.getUint16(offset + 30, true) +
      data.getUint16(offset + 32, true);
  }
  if (offset > end) throw new Error("Archive XLSX invalide.");
}

export async function parseContactsFile(file: File, defaults: ImportDefaults) {
  if (file.size > 5_000_000)
    throw new Error("Choisissez un fichier de 5 Mo maximum.");
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xls")
    throw new Error(
      "Enregistrez l’ancien fichier .xls au format .xlsx ou CSV depuis Excel.",
    );
  if (extension === "txt")
    return parseContactsText(await file.text(), defaults);
  if (extension === "csv") {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    return parseImportRows(
      readRows(text, text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ","),
      defaults,
    );
  }
  if (extension === "xlsx") {
    const buffer = await file.arrayBuffer();
    validateXlsxArchive(buffer);
    const { readSheet } = await import("read-excel-file/universal");
    return parseImportRows(await readSheet(buffer, 1), defaults);
  }
  throw new Error("Choisissez un fichier Excel .xlsx, CSV ou TXT.");
}
