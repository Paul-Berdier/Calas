import {
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";
import { Button, Field, Modal } from "./ui";
import { RichEditor } from "./RichEditor";
import { MediaPicker } from "./components/MediaPicker";
import { MediaLibrary } from "./components/MediaLibrary";
import { fileFromMedia } from "./components/media-client";
import type {
  Collection,
  ContentKind,
  ContentSummary,
  EditorialContent,
} from "./api";
import type { ContentImage } from "../lib/cms/types";
import type { JSONContent } from "@tiptap/react";

export type ContentPath = Array<string | number>;
export function readPath(value: EditorialContent, path: ContentPath): any {
  return path.reduce((current, key) => current?.[key], value);
}
export function writePath(
  value: EditorialContent,
  path: ContentPath,
  next: unknown,
): EditorialContent {
  if (!path.length) return next as EditorialContent;
  const [head, ...tail] = path;
  const copy = Array.isArray(value) ? [...value] : { ...value };
  (copy as any)[head] = tail.length
    ? writePath(
        (value?.[head] ??
          (typeof tail[0] === "number" ? [] : {})) as EditorialContent,
        tail,
        next,
      )
    : next;
  return copy as EditorialContent;
}

interface FormProps {
  kind: ContentKind;
  value: EditorialContent;
  onChange: (value: EditorialContent) => void;
  people: ContentSummary[];
  categories: ContentSummary[];
  statistics: ContentSummary[];
  disabled?: boolean;
  autoSlug?: boolean;
  onNavigate: (collection: Collection) => void;
}
interface TextDefinition {
  name: string;
  label: string;
  rows?: number;
  hint?: string;
  type?: string;
  max?: number;
  readonly?: boolean;
  required?: boolean;
}
const pageEditorial: TextDefinition[] = [
  { name: "artTop", label: "Repère supérieur de l’illustration" },
  { name: "artBottom", label: "Repère inférieur de l’illustration" },
  { name: "methodLinkLabel", label: "Lien vers la méthode" },
  { name: "invitationEyebrow", label: "Surtitre de l’invitation finale" },
  { name: "invitationTitle", label: "Titre de l’invitation finale", rows: 2 },
];
const homeEditorial: TextDefinition[] = [
  { name: "heroAudience", label: "Public accompagné", rows: 3 },
  { name: "heroArtTop", label: "Repère supérieur du coquillage" },
  { name: "heroArtBottom", label: "Repère inférieur du coquillage" },
  { name: "heroArtCaption", label: "Signature autour du coquillage", rows: 2 },
  { name: "exploreLabel", label: "Invitation à explorer la page" },
  { name: "statisticsEyebrow", label: "Surtitre des chiffres" },
  {
    name: "statisticsDescription",
    label: "Introduction aux chiffres",
    rows: 3,
  },
  { name: "statisticsNote", label: "Précision sur les indicateurs", rows: 3 },
  { name: "diagnosticEyebrow", label: "Surtitre du diagnostic" },
  { name: "diagnosticArtEyebrow", label: "Repère du visuel diagnostic" },
  { name: "diagnosticArtTitle", label: "Titre du visuel diagnostic", rows: 2 },
  { name: "diagnosticNote", label: "Précision sous le diagnostic", rows: 3 },
  { name: "reasonsEyebrow", label: "Surtitre des raisons" },
  { name: "reasonsMotifLabel", label: "Légende du motif des relations" },
  { name: "domainsEyebrow", label: "Surtitre des accompagnements" },
  { name: "convictionEyebrow", label: "Surtitre de la conviction" },
];
const journalEditorial: TextDefinition[] = [
  { name: "baseline", label: "Signature du carnet", rows: 2 },
  { name: "topics", label: "Thèmes du carnet", rows: 2 },
  { name: "seriesEyebrow", label: "Surtitre du lancement" },
  { name: "seriesStatus", label: "État de lancement" },
  { name: "seriesTitle", label: "Titre de l’état sans article", rows: 2 },
  { name: "seriesText", label: "Texte de l’état sans article", rows: 5 },
  { name: "exploreEyebrow", label: "Surtitre des accompagnements" },
  { name: "exploreTitle", label: "Titre des accompagnements", rows: 2 },
];
const contactEditorial: TextDefinition[] = [
  { name: "formEyebrow", label: "Surtitre du formulaire" },
  { name: "formTitle", label: "Titre du formulaire", rows: 2 },
  { name: "directHeading", label: "Titre des coordonnées directes" },
  { name: "context", label: "Précision avant prise de contact", rows: 4 },
  { name: "linkedinLabel", label: "Libellé du lien LinkedIn" },
];

function Group({
  title,
  description,
  children,
  open = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="admin-editor-section" open={open}>
      <summary>
        <span>
          {title}
          {description && <small>{description}</small>}
        </span>
        <ChevronDown aria-hidden />
      </summary>
      <div className="admin-card-body">
        <div className="admin-fields">{children}</div>
      </div>
    </details>
  );
}

export function ContentForm({
  kind,
  value,
  onChange,
  people,
  categories,
  statistics,
  disabled = false,
  autoSlug = false,
  onNavigate,
}: FormProps) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const update = (path: ContentPath, next: unknown) => {
    const updated = writePath(value, path, next);
    if (
      autoSlug &&
      path.length === 1 &&
      path[0] === "title" &&
      ["article", "category"].includes(kind) &&
      (!value.slug || value.slug === slugFromTitle(String(value.title ?? "")))
    )
      updated.slug = slugFromTitle(String(next));
    onChange(updated);
  };
  function text(definition: TextDefinition, path: ContentPath = []) {
    const keys = [...path, definition.name],
      current = readPath(value, keys) ?? "";
    return (
      <Field
        key={keys.join(".")}
        label={definition.label}
        hint={definition.hint}
        required={definition.required}
      >
        {(id) =>
          definition.rows ? (
            <textarea
              id={id}
              className="admin-textarea"
              rows={definition.rows}
              value={String(current)}
              maxLength={definition.max}
              disabled={disabled}
              onChange={(event) => update(keys, event.target.value)}
            />
          ) : (
            <input
              id={id}
              className="admin-input"
              type={definition.type ?? "text"}
              value={String(current)}
              maxLength={definition.max}
              readOnly={definition.readonly}
              disabled={disabled}
              min={definition.type === "number" ? 0 : undefined}
              onChange={(event) =>
                update(
                  keys,
                  definition.type === "number"
                    ? event.target.value === ""
                      ? undefined
                      : Number(event.target.value)
                    : definition.type === "date" && !event.target.value
                      ? undefined
                      : event.target.value,
                )
              }
            />
          )
        }
      </Field>
    );
  }
  function texts(definitions: TextDefinition[], path: ContentPath = []) {
    return definitions.map((definition) => text(definition, path));
  }
  function cta(
    path: ContentPath,
    label = "Appel à l’action",
    optional = false,
  ) {
    return (
      <div>
        <div className="admin-form-grid">
          {text({ name: "label", label: `${label} — libellé` }, path)}
          {text(
            {
              name: "href",
              label: `${label} — destination`,
              hint: "Adresse du site /contact/ ou lien https://.",
            },
            path,
          )}
        </div>
        {optional && readPath(value, path) && (
          <Button
            className="admin-repeat-add"
            variant="ghost"
            size="sm"
            onClick={() => update(path, undefined)}
          >
            Retirer ce lien facultatif
          </Button>
        )}
      </div>
    );
  }
  function image(path: ContentPath, label: string) {
    return (
      <MediaPicker
        key={path.join(".")}
        label={label}
        value={readPath(value, path) as ContentImage | undefined}
        onChange={(next) => update(path, next)}
      />
    );
  }
  function check(path: ContentPath, label: string, hint?: string) {
    return (
      <label className="admin-check">
        <input
          type="checkbox"
          checked={Boolean(readPath(value, path))}
          disabled={disabled}
          onChange={(event) => update(path, event.target.checked)}
        />
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
      </label>
    );
  }
  function rich(path: ContentPath, label: string) {
    return (
      <Field label={label}>
        {() => (
          <RichEditor
            label={label}
            value={readPath(value, path) as JSONContent | undefined}
            onChange={(next) => update(path, next)}
            disabled={disabled}
          />
        )}
      </Field>
    );
  }
  function strings(path: ContentPath, label: string) {
    const list: string[] = readPath(value, path) ?? [];
    return (
      <div>
        <span className="admin-hint">{label}</span>
        {list.map((item, index) => (
          <div className="admin-actions" key={index} style={{ marginTop: 8 }}>
            <Field label={`${label} ${index + 1}`} className="flex-1">
              {(id) => (
                <input
                  id={id}
                  className="admin-input"
                  value={item}
                  disabled={disabled}
                  onChange={(event) =>
                    update([...path, index], event.target.value)
                  }
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Retirer ${label.toLowerCase()} ${index + 1}`}
              onClick={() =>
                update(
                  path,
                  list.filter((_, at) => at !== index),
                )
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {list.length < 6 && (
          <Button
            className="admin-repeat-add"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => update(path, [...list, ""])}
          >
            <Plus size={14} />
            Ajouter un repère
          </Button>
        )}
      </div>
    );
  }
  function items(path: ContentPath, label: string, fixedCount?: number) {
    const list: EditorialContent[] = readPath(value, path) ?? [];
    return (
      <div>
        {list.map((item, index) => (
          <div className="admin-repeat-item" key={String(item.key ?? index)}>
            <div className="admin-repeat-heading">
              <strong>
                {label} {index + 1}
              </strong>
              {!fixedCount && (
                <div className="admin-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === 0}
                    aria-label={`Monter ${label.toLowerCase()} ${index + 1}`}
                    onClick={() => {
                      const next = [...list];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      update(path, next);
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === list.length - 1}
                    aria-label={`Descendre ${label.toLowerCase()} ${index + 1}`}
                    onClick={() => {
                      const next = [...list];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      update(path, next);
                    }}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled || list.length <= 1}
                    aria-label={`Retirer ${label.toLowerCase()} ${index + 1}`}
                    onClick={() =>
                      update(
                        path,
                        list.filter((_, at) => at !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
            <div className="admin-fields">
              {texts(
                [
                  { name: "title", label: "Titre", rows: 2 },
                  { name: "text", label: "Texte", rows: 4 },
                ],
                [...path, index],
              )}
              {item.number !== undefined &&
                text({ name: "number", label: "Repère affiché" }, [
                  ...path,
                  index,
                ])}
            </div>
          </div>
        ))}
        {!fixedCount && list.length < 8 && (
          <Button
            className="admin-repeat-add"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() =>
              update(path, [
                ...list,
                { key: crypto.randomUUID(), title: "", text: "" },
              ])
            }
          >
            <Plus size={14} />
            Ajouter un élément
          </Button>
        )}
      </div>
    );
  }
  const seo = (
    <Group
      title="Référencement"
      description="Titre et description visibles dans les moteurs de recherche."
    >
      {texts(
        [
          {
            name: "title",
            label: "Titre de référencement",
            max: 100,
            hint: "Le titre éditorial est utilisé si ce champ est vide.",
          },
          {
            name: "description",
            label: "Description de référencement",
            rows: 3,
            max: 300,
          },
        ],
        ["seo"],
      )}
    </Group>
  );
  const selection = (
    name: string,
    label: string,
    options: ContentSummary[],
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      {(id) => (
        <select
          id={id}
          className="admin-select"
          value={String(value[name] ?? "")}
          disabled={disabled}
          onChange={(event) => update([name], event.target.value || undefined)}
        >
          <option value="">Choisir…</option>
          {options.map((option) => (
            <option value={option.id} key={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  if (kind === "home")
    return (
      <>
        <Group
          title="01 · Premier écran"
          description="La promesse du cabinet et les deux liens principaux."
          open
        >
          {texts([
            { name: "eyebrow", label: "Surtitre", max: 140 },
            {
              name: "title",
              label: "Titre principal",
              rows: 4,
              max: 250,
              required: true,
            },
            {
              name: "intro",
              label: "Introduction",
              rows: 6,
              max: 1200,
              required: true,
            },
          ])}
          {cta(["primaryCta"], "Lien prioritaire")}
          {cta(["secondaryCta"], "Second lien")}
        </Group>
        <Group
          title="02 · Chiffres et sources"
          description="Le contexte qui donne du sens à la prévention."
        >
          {texts([
            { name: "statisticsTitle", label: "Titre", rows: 2 },
            {
              name: "statisticsTransition",
              label: "Transition après les chiffres",
              rows: 3,
            },
          ])}
          <p className="admin-hint">
            Les valeurs, les sources et leur vérification se règlent dans la
            rubrique dédiée.
          </p>
          {[0, 1, 2, 3].map((index) => {
            const ids: string[] =
              value.statisticIds ??
              (value.statistics ?? []).map((item: EditorialContent) => item.id);
            return (
              <Field
                key={index}
                label={`Chiffre affiché en position ${index + 1}`}
              >
                {(fieldId) => (
                  <select
                    id={fieldId}
                    className="admin-select"
                    value={ids[index] ?? ""}
                    onChange={(event) => {
                      const next = [...ids];
                      next[index] = event.target.value;
                      update(["statisticIds"], next.filter(Boolean));
                    }}
                  >
                    <option value="">Aucun chiffre</option>
                    {statistics.map((statistic) => (
                      <option
                        key={statistic.id}
                        value={statistic.id}
                        disabled={
                          ids.includes(statistic.id) &&
                          ids[index] !== statistic.id
                        }
                      >
                        {statistic.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            );
          })}
          <Button variant="secondary" onClick={() => onNavigate("statistics")}>
            Modifier les chiffres et leurs sources
          </Button>
        </Group>
        <Group
          title="03 · Diagnostic prioritaire"
          description="L’accompagnement central de Calas Conseil."
        >
          {texts(
            [
              { name: "title", label: "Titre", rows: 2 },
              { name: "text", label: "Présentation du diagnostic", rows: 6 },
            ],
            ["diagnostic"],
          )}
          {cta(["diagnostic", "cta"])}
          {image(["diagnostic", "image"], "Image du diagnostic")}
        </Group>
        <Group
          title="04 · Pourquoi travailler ensemble"
          description="Les trois raisons restent présentes dans la composition."
        >
          {text({
            name: "reasonsTitle",
            label: "Titre de la section",
            rows: 2,
          })}
          {items(["reasons"], "Raison", 3)}
        </Group>
        <Group
          title="05 · Accompagnements"
          description="Les offres renvoient à leurs pages dédiées."
        >
          {texts([
            { name: "domainsTitle", label: "Titre", rows: 2 },
            { name: "domainsIntro", label: "Introduction", rows: 3 },
          ])}
          <p className="admin-hint">
            Le résumé de chaque offre se modifie dans sa propre page.
          </p>
        </Group>
        <Group
          title="06 · Conviction et invitation"
          description="La dernière impression laissée au visiteur."
        >
          {texts(
            [
              { name: "title", label: "Notre conviction — titre", rows: 2 },
              { name: "text", label: "Notre conviction — texte", rows: 5 },
            ],
            ["conviction"],
          )}
          {cta(["conviction", "cta"])}
          {text({ name: "closingTitle", label: "Invitation finale", rows: 2 })}
          {cta(["closingCta"], "Lien final", true)}
        </Group>
        <Group
          title="Repères et textes secondaires"
          description="Légendes, surtitres et petits textes autour des illustrations."
        >
          {texts(homeEditorial, ["editorial"])}
          {strings(["editorial", "heroDisciplines"], "Discipline")}
          {strings(["editorial", "diagnosticArtLegend"], "Légende diagnostic")}
          {cta(["editorial", "reasonsLink"], "Rencontre avec l’équipe", true)}
        </Group>
        {seo}
      </>
    );
  if (kind === "page")
    return (
      <>
        <Group
          title="Premier écran"
          description={`Page /${value.slug ?? ""}/ — adresse protégée.`}
          open
        >
          {texts([
            { name: "eyebrow", label: "Surtitre", max: 130 },
            {
              name: "title",
              label: "Titre principal",
              rows: 3,
              max: 220,
              required: true,
            },
            {
              name: "intro",
              label: "Introduction",
              rows: 6,
              max: 1800,
              required: true,
            },
          ])}
          {image(["image"], "Image éditoriale")}
        </Group>
        {((value.sections as EditorialContent[]) ?? []).map(
          (section, index) => (
            <Group
              key={String(section.key ?? index)}
              title={`${String(index + 1).padStart(2, "0")} · ${section.title?.replace(/\n/g, " ") || "Section"}`}
              description={
                section.presentation === "method"
                  ? "Méthode · cinq étapes conservées"
                  : section.presentation === "faq"
                    ? "Questions fréquentes"
                    : section.presentation === "deliverables"
                      ? "Livrables"
                      : ({
                          text: "Texte éditorial",
                          steps: "Étapes",
                          list: "Points clés",
                          split: "Deux idées complémentaires",
                          notice: "Précision importante",
                        }[section.kind as string] ?? "Contenu éditorial")
              }
            >
              {texts(
                [
                  { name: "eyebrow", label: "Surtitre" },
                  { name: "title", label: "Titre de la section", rows: 2 },
                  { name: "text", label: "Présentation", rows: 5 },
                  {
                    name: "navigationLabel",
                    label: "Libellé dans le sommaire",
                  },
                ],
                ["sections", index],
              )}
              {section.presentation === "method" &&
                text(
                  {
                    name: "instruction",
                    label: "Invitation à explorer les étapes",
                  },
                  ["sections", index],
                )}
              {(["steps", "list", "split"].includes(section.kind) ||
                section.items?.length > 0) &&
                items(
                  ["sections", index, "items"],
                  section.presentation === "faq"
                    ? "Question"
                    : section.kind === "steps"
                      ? "Étape"
                      : "Point",
                  section.presentation === "method" ? 5 : undefined,
                )}
              {(section.kind === "text" || section.body) &&
                rich(
                  ["sections", index, "body"],
                  "Texte complémentaire mis en forme",
                )}
              {image(["sections", index, "image"], "Image de la section")}
            </Group>
          ),
        )}
        {["diagnostic-rps", "equipes", "managers"].includes(value.slug) && (
          <Group
            title="Présentation de l’offre"
            description="Résumé sur l’accueil et modalités confirmées."
          >
            {text({
              name: "offerExcerpt",
              label: "Résumé dans les accompagnements",
              rows: 4,
              max: 320,
            })}
            {texts(
              [
                { name: "duration", label: "Durée confirmée" },
                { name: "rhythm", label: "Rythme confirmé" },
                { name: "delivery", label: "Modalités confirmées", rows: 3 },
              ],
              ["format"],
            )}
          </Group>
        )}
        <Group title="Invitation à poursuivre">
          {cta(["cta"], "Appel à l’action", true)}
        </Group>
        {!["contact", "reflexions"].includes(value.slug) && (
          <Group title="Repères et invitation finale">
            {texts(pageEditorial, ["editorial"])}
          </Group>
        )}
        {value.slug === "reflexions" && (
          <Group
            title="Carnet Réflexions"
            description="Les textes de lancement restent visibles tant qu’aucun article n’est publié."
          >
            {texts(journalEditorial, ["journal"])}
            {cta(["journal", "seriesCta"], "Lien de lancement", true)}
          </Group>
        )}
        {value.slug === "contact" && (
          <Group
            title="Formulaire et coordonnées"
            description="Les coordonnées elles-mêmes se modifient dans les paramètres du site."
          >
            {texts(contactEditorial, ["contact"])}
          </Group>
        )}
        {seo}
      </>
    );
  if (kind === "article")
    return (
      <>
        <Group
          title="L’essentiel"
          description="Une accroche claire, une auteure identifiée, une date choisie."
          open
        >
          {texts([
            {
              name: "title",
              label: "Titre de l’article",
              max: 220,
              required: true,
            },
            {
              name: "slug",
              label: "Adresse de l’article",
              hint: "Minuscules, chiffres et tirets. Exemple : comprendre-la-qualite-du-lien",
              max: 96,
            },
            { name: "excerpt", label: "Résumé", rows: 4, max: 500 },
          ])}
          <div className="admin-form-grid">
            {selection("authorId", "Auteure", people)}
            {selection("categoryId", "Catégorie", categories)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("categories")}
          >
            Gérer les catégories
          </Button>
          <Field
            label="Date de publication"
            hint="La date est requise pour publier. Elle n’est jamais déduite du PDF."
          >
            {(id) => (
              <input
                id={id}
                className="admin-input"
                type="datetime-local"
                disabled={disabled}
                value={toLocalDate(value.date)}
                onChange={(event) =>
                  update(
                    ["date"],
                    event.target.value
                      ? new Date(event.target.value).toISOString()
                      : undefined,
                  )
                }
              />
            )}
          </Field>
        </Group>
        <Group
          title="Rédaction"
          description="Le contenu est mis en forme avec la typographie du site dans l’aperçu."
          open
        >
          {rich(["body"], "Texte de l’article")}
        </Group>
        <Group title="Image de couverture">
          {image(["image"], "Image de couverture")}
        </Group>
        <Group
          title="PDF original et relecture"
          description="Le fichier reste privé jusqu’à sa publication explicitement autorisée."
        >
          {value.sourcePdf?.mediaId ? (
            <>
              <p className="admin-hint">
                Document joint :{" "}
                {value.sourcePdf.originalFilename || "PDF original"}
              </p>
              <a
                className="admin-text-link"
                href={`/media/${encodeURIComponent(value.sourcePdf.mediaId)}/?download=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir le PDF original
              </a>
              {check(
                ["allowPdfDownload"],
                "Autoriser le téléchargement du PDF avec cet article publié",
                "Le PDF deviendra accessible aux visiteurs à la publication de cet article.",
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    sourcePdf: undefined,
                    allowPdfDownload: false,
                  })
                }
              >
                Retirer la pièce jointe de l’article
              </Button>
            </>
          ) : (
            <p className="admin-hint">
              Aucun PDF n’est joint à cet article. Vous pouvez sélectionner un
              document original dans votre médiathèque.
            </p>
          )}
          <Button variant="secondary" onClick={() => setPdfOpen(true)}>
            {value.sourcePdf
              ? "Choisir un autre PDF"
              : "Joindre un PDF original"}
          </Button>
          {value.pdfImport && (
            <div className="admin-notice">
              <p>
                {value.pdfImport.pageCount} pages analysées, dont{" "}
                {value.pdfImport.ocrPages} avec reconnaissance de caractères.
              </p>
              {check(
                ["pdfImport", "reviewed"],
                "J’ai relu et corrigé cet article à partir du PDF",
                "Cette relecture est indispensable avant publication.",
              )}
            </div>
          )}
          <Modal
            open={pdfOpen}
            onOpenChange={setPdfOpen}
            title="Choisir le PDF original"
            description="Le fichier restera privé tant que le téléchargement n’est pas autorisé dans une version publiée."
            wide
          >
            <MediaLibrary
              pdfOnly
              onSelect={(media) => {
                if (media.mimeType !== "application/pdf") return;
                onChange({
                  ...value,
                  sourcePdf: fileFromMedia(media),
                  allowPdfDownload: false,
                  pdfImport: {
                    pageCount: media.pageCount ?? 1,
                    ocrPages: 0,
                    reviewed: false,
                  },
                });
                setPdfOpen(false);
              }}
            />
          </Modal>
        </Group>
        {seo}
      </>
    );
  if (kind === "person")
    return (
      <Group
        title="Présentation de la personne"
        description="Une biographie approuvée et un portrait authentique uniquement."
        open
      >
        {texts([
          { name: "name", label: "Nom complet", required: true, max: 100 },
          {
            name: "role",
            label: "Fonction et qualifications vérifiées",
            rows: 3,
            max: 400,
          },
          { name: "bio", label: "Biographie approuvée", rows: 10, max: 4000 },
          { name: "order", label: "Ordre de présentation", type: "number" },
        ])}
        {image(["portrait"], "Portrait authentique")}
      </Group>
    );
  if (kind === "statistic")
    return (
      <Group
        title="Chiffre et source"
        description="Un indicateur non vérifié reste masqué sur le site public."
        open
      >
        {texts([
          { name: "value", label: "Valeur affichée", required: true, max: 60 },
          {
            name: "label",
            label: "Ce que le chiffre mesure",
            rows: 3,
            max: 500,
          },
          { name: "source", label: "Organisme et publication", max: 250 },
          {
            name: "sourceUrl",
            label: "Adresse de la source primaire",
            type: "url",
          },
          { name: "year", label: "Millésime affiché", max: 120 },
          {
            name: "observationPeriod",
            label: "Période d’observation",
            hint: "Distinguer la période observée de l’année de publication.",
          },
          {
            name: "publicationYear",
            label: "Année de publication",
            type: "number",
          },
          { name: "note", label: "Périmètre et méthode", rows: 6, max: 1200 },
        ])}
        {check(
          ["verified"],
          "La source et son interprétation ont été vérifiées",
          "La publication ne rend visible le chiffre que si cette vérification est cochée.",
        )}
      </Group>
    );
  if (kind === "category")
    return (
      <Group title="Catégorie du carnet" open>
        {texts([
          {
            name: "title",
            label: "Nom de la catégorie",
            required: true,
            max: 80,
          },
          {
            name: "slug",
            label: "Adresse lisible",
            hint: "Minuscules et tirets, sans espace.",
          },
          { name: "description", label: "Description", rows: 4 },
        ])}
      </Group>
    );
  return (
    <>
      <Group
        title="Identité du cabinet"
        description="Ces éléments restent liés à la géométrie et aux exports du logo."
        open
      >
        {texts([
          { name: "brand", label: "Nom de marque", readonly: true },
          { name: "tagline", label: "Signature", readonly: true },
        ])}
        <p className="admin-hint">
          <LockKeyhole size={12} style={{ display: "inline" }} /> Identité
          protégée contre les modifications accidentelles.
        </p>
      </Group>
      <Group title="Coordonnées publiques" open>
        {texts([
          { name: "phone", label: "Téléphone", type: "tel", required: true },
          {
            name: "email",
            label: "Courriel public",
            type: "email",
            required: true,
          },
          {
            name: "linkedin",
            label: "Adresse LinkedIn confirmée",
            type: "url",
            hint: "Laissez vide tant que le lien exact n’est pas confirmé.",
          },
          {
            name: "footerText",
            label: "Texte du pied de page",
            rows: 3,
            max: 400,
          },
          { name: "contactText", label: "Introduction du contact", rows: 4 },
        ])}
      </Group>
      <Group
        title="Qualification IPRP"
        description="Contrôle réservé aux administrateurs. Ne pas joindre de justificatif confidentiel."
      >
        <Field label="État de vérification">
          {(id) => (
            <select
              id={id}
              className="admin-select"
              value={value.qualification?.status ?? "pending"}
              disabled={disabled}
              onChange={(event) =>
                update(["qualification", "status"], event.target.value)
              }
            >
              <option value="pending">Non vérifiée — ne pas afficher</option>
              <option value="verified">Justificatif contrôlé</option>
            </select>
          )}
        </Field>
        <Field label="Personne concernée">
          {(id) => (
            <select
              id={id}
              className="admin-select"
              value={value.qualification?.personId ?? ""}
              onChange={(event) =>
                update(
                  ["qualification", "personId"],
                  event.target.value || undefined,
                )
              }
            >
              <option value="">Choisir…</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        {texts(
          [
            { name: "label", label: "Libellé public vérifié", max: 180 },
            {
              name: "registration",
              label: "Référence, région et validité confirmées",
              max: 220,
            },
            {
              name: "validUntil",
              label: "Date de validité confirmée",
              type: "date",
            },
          ],
          ["qualification"],
        )}
      </Group>
    </>
  );
}

function toLocalDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function slugFromTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
    .replace(/-$/, "");
}
