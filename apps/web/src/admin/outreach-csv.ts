export interface ImportContact {
  email: string;
  name: string;
  company: string;
  jobTitle: string;
  source: string;
  sourceDate: string;
  informationConfirmed: boolean;
}

/** Read quoted CSV cells, including escaped quotes and multiline values. */
export function readRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closed = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (quoted) {
        quoted = false;
        closed = true;
      } else if (!closed && value.length === 0) quoted = true;
      else throw new Error("Guillemet inattendu dans le CSV.");
    } else if (!quoted && character === separator) {
      row.push(value.trim());
      value = "";
      closed = false;
    } else if (!quoted && (character === "\n" || character === "\r")) {
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
      closed = false;
      if (character === "\r" && text[index + 1] === "\n") index++;
    } else if (closed && !/\s/.test(character)) {
      throw new Error(
        "Caractère inattendu après une cellule entre guillemets.",
      );
    } else if (!closed) value += character;
  }
  if (quoted)
    throw new Error("Une cellule entre guillemets n’est pas terminée.");
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export function parseContactsCsv(raw: string): {
  contacts: ImportContact[];
  duplicates: number;
} {
  const text = raw.replace(/^\uFEFF/, "");
  if (text.length > 5_000_000)
    throw new Error(
      "Le fichier dépasse 5 Mo. Divisez votre liste en plusieurs fichiers.",
    );
  const firstLine = text.split(/\r?\n/, 1)[0];
  const separator = firstLine.includes(";") ? ";" : ",";
  const [headers, ...rows] = readRows(text, separator);
  const fields = [
    "email",
    "name",
    "company",
    "jobTitle",
    "source",
    "sourceDate",
    "informationConfirmed",
  ];
  if (
    !headers ||
    fields.some((field) => !headers.includes(field)) ||
    new Set(headers).size !== headers.length
  ) {
    throw new Error(
      "Le CSV doit contenir les colonnes email, name, company, jobTitle, source, sourceDate et informationConfirmed.",
    );
  }
  if (rows.length > 5_000)
    throw new Error(
      "Le fichier dépasse 5 000 contacts. Divisez votre liste en plusieurs fichiers.",
    );
  const contacts: ImportContact[] = [];
  const emails = new Set<string>();
  let duplicates = 0;
  for (const [index, cells] of rows.entries()) {
    if (cells.length !== headers.length)
      throw new Error(
        `Ligne ${index + 2} — le nombre de colonnes diffère de l’en-tête.`,
      );
    const values = Object.fromEntries(
      headers.map((header, column) => [header, cells[column]]),
    );
    const email = values.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error(`Ligne ${index + 2} — adresse e-mail invalide.`);
    const parsedDate = new Date(values.sourceDate + "T00:00:00Z");
    if (
      values.source.length < 3 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(values.sourceDate) ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== values.sourceDate ||
      values.sourceDate > new Date().toISOString().slice(0, 10)
    ) {
      throw new Error(
        `Ligne ${index + 2} — indiquez la provenance et une date au format AAAA-MM-JJ.`,
      );
    }
    if (!values.company)
      throw new Error(`Ligne ${index + 2} — indiquez l’entreprise.`);
    for (const [field, max] of [
      ["name", 120],
      ["company", 160],
      ["jobTitle", 160],
      ["source", 500],
    ] as const) {
      if (values[field].length > max || /[\r\n\u0000]/.test(values[field])) {
        throw new Error(
          `Ligne ${index + 2} — la colonne ${field} doit tenir sur une ligne de ${max} caractères maximum.`,
        );
      }
    }
    if (
      !["true", "oui", "1"].includes(values.informationConfirmed.toLowerCase())
    ) {
      throw new Error(
        `Ligne ${index + 2} — l’information de la personne sur l’usage professionnel de ses coordonnées doit être confirmée.`,
      );
    }
    if (emails.has(email)) {
      duplicates++;
      continue;
    }
    emails.add(email);
    contacts.push({
      email,
      name: values.name,
      company: values.company,
      jobTitle: values.jobTitle,
      source: values.source,
      sourceDate: values.sourceDate,
      informationConfirmed: true,
    });
  }
  if (!contacts.length)
    throw new Error("Le fichier ne contient aucun contact.");
  return { contacts, duplicates };
}
