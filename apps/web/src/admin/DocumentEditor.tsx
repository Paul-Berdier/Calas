import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  History,
  Save,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Archive,
  Undo2,
  Copy,
  AlertTriangle,
} from "lucide-react";
import {
  ApiError,
  contentApi,
  formatDate,
  actionLabels,
  type Collection,
  type ContentDetail,
  type ContentSummary,
  type EditorialContent,
  type Revision,
  type ContentKind,
} from "./api";
import { Badge, Button, ConfirmDialog, Loading, Modal } from "./ui";
import { ContentForm } from "./ContentForm";
import { emptyDocument } from "./RichEditor";

const names: Record<Collection, string> = {
  pages: "Pages",
  articles: "Réflexions",
  people: "Équipe",
  statistics: "Chiffres et sources",
  categories: "Catégories",
  settings: "Paramètres du site",
};
const newKinds: Partial<Record<Collection, ContentKind>> = {
  articles: "article",
  people: "person",
  statistics: "statistic",
  categories: "category",
};
function initialContent(collection: Collection): EditorialContent {
  if (collection === "articles")
    return {
      title: "",
      slug: "",
      excerpt: "",
      body: emptyDocument,
      allowPdfDownload: false,
    };
  if (collection === "people") return { name: "", role: "", bio: "", order: 0 };
  if (collection === "statistics")
    return {
      value: "",
      label: "",
      source: "",
      sourceUrl: "",
      year: "",
      note: "",
      verified: false,
    };
  return { title: "", slug: "", description: "" };
}
export function DocumentEditor({
  collection,
  id,
  onNavigate,
  onDirtyChange,
}: {
  collection: Collection;
  id: string;
  onNavigate: (path: string, force?: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const isNew = id === "new";
  const [detail, setDetail] = useState<ContentDetail | null>(null),
    [content, setContent] = useState<EditorialContent>(() =>
      initialContent(collection),
    ),
    [snapshot, setSnapshot] = useState("");
  const [people, setPeople] = useState<ContentSummary[]>([]),
    [categories, setCategories] = useState<ContentSummary[]>([]);
  const [statistics, setStatistics] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(!isNew),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false),
    [latest, setLatest] = useState<ContentDetail | null>(null),
    [compareOpen, setCompareOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [autosave, setAutosave] = useState(true),
    [autosavePaused, setAutosavePaused] = useState(false),
    [preview, setPreview] = useState(false),
    [previewWidth, setPreviewWidth] = useState(1280),
    [previewRefresh, setPreviewRefresh] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [selectedRevision, setSelectedRevision] = useState<Revision | null>(null),
    [historyLoading, setHistoryLoading] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null),
    [actionBusy, setActionBusy] = useState(false);
  const contentRef = useRef(content),
    detailRef = useRef(detail),
    snapshotRef = useRef(snapshot),
    savingRef = useRef(false),
    createId = useRef<string | null>(null),
    alive = useRef(true);
  contentRef.current = content;
  detailRef.current = detail;
  snapshotRef.current = snapshot;
  const kind = detail?.kind ?? newKinds[collection] ?? "page";
  const dirty = !loading && JSON.stringify(content) !== snapshot;
  useEffect(() => {
    onDirtyChange(dirty || saving);
    return () => onDirtyChange(false);
  }, [dirty, saving, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        JSON.stringify(contentRef.current) !== snapshotRef.current ||
        savingRef.current
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setError("");
    setMessage("");
    setConflict(false);
    setAutosavePaused(false);
    setPreview(false);
    if (isNew) {
      const start = initialContent(collection);
      setContent(start);
      setSnapshot(JSON.stringify(start));
      setLoading(false);
      createId.current = crypto.randomUUID();
    } else {
      setLoading(true);
      contentApi
        .get(collection, id, controller.signal)
        .then((result) => {
          setDetail(result);
          setContent(result.content);
          setSnapshot(JSON.stringify(result.content));
        })
        .catch((cause) => {
          if (cause.name !== "AbortError") setError(cause.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    Promise.all([
      contentApi.list("people", controller.signal),
      contentApi.list("categories", controller.signal),
      contentApi.list("statistics", controller.signal),
    ])
      .then(([persons, tags, figures]) => {
        setPeople(persons.items);
        setCategories(tags.items);
        setStatistics(figures.items);
      })
      .catch((cause) => {
        if (cause.name !== "AbortError")
          setError(
            "Les auteures ou catégories n’ont pas pu être chargées. Rechargez la page avant publication.",
          );
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [collection, id, isNew]);
  const save = useCallback(
    async (manual = true): Promise<ContentDetail | null> => {
      if (savingRef.current) return null;
      if (!isNew && JSON.stringify(contentRef.current) === snapshotRef.current)
        return detailRef.current;
      savingRef.current = true;
      setSaving(true);
      setError("");
      setValidationErrors({});
      setMessage("");
      const candidate = structuredClone(contentRef.current),
        candidateSnapshot = JSON.stringify(candidate);
      try {
        const result = isNew
          ? await contentApi.create(
              collection,
              candidate,
              createId.current ?? crypto.randomUUID(),
            )
          : await contentApi.save(
              collection,
              id,
              candidate,
              detailRef.current!.version,
            );
        if (!alive.current) return result;
        detailRef.current = result;
        setDetail(result);
        if (JSON.stringify(contentRef.current) === candidateSnapshot) {
          contentRef.current = result.content;
          setContent(result.content);
          setSnapshot(JSON.stringify(result.content));
          snapshotRef.current = JSON.stringify(result.content);
        } else {
          setSnapshot(candidateSnapshot);
          snapshotRef.current = candidateSnapshot;
        }
        setConflict(false);
        setAutosavePaused(false);
        if (manual)
          setMessage(
            "Le brouillon a été enregistré. La version publique reste inchangée.",
          );
        if (isNew) onNavigate(`/admin/${collection}/${result.id}/`, true);
        return result;
      } catch (cause) {
        if (!alive.current) return null;
        const problem = cause as ApiError;
        setError(problem.message);
        setValidationErrors(validationFields(problem.details));
        setConflict(problem.status === 409);
        setAutosavePaused(true);
        return null;
      } finally {
        savingRef.current = false;
        if (alive.current) setSaving(false);
      }
    },
    [collection, id, isNew, onNavigate],
  );
  useEffect(() => {
    if (
      !autosave ||
      autosavePaused ||
      isNew ||
      !dirty ||
      saving ||
      loading ||
      actionBusy ||
      historyOpen ||
      compareOpen ||
      confirm
    )
      return;
    const timer = setTimeout(() => {
      void save(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [
    content,
    autosave,
    autosavePaused,
    isNew,
    dirty,
    saving,
    loading,
    save,
    actionBusy,
    historyOpen,
    compareOpen,
    confirm,
  ]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save]);
  const change = (next: EditorialContent) => {
    contentRef.current = next;
    setContent(next);
    setMessage("");
  };
  async function showHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await contentApi.revisions(collection, id);
      setRevisions(result.items);
      setSelectedRevision(result.items[0] ?? null);
    } catch (cause) {
      setError((cause as Error).message);
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  }
  async function showPreview() {
    const saved = await save();
    if (saved) {
      setPreview(true);
      setPreviewRefresh((value) => value + 1);
    }
  }
  async function compare() {
    try {
      const fresh = await contentApi.get(collection, id);
      setLatest(fresh);
      setCompareOpen(true);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function perform(action: string) {
    setActionBusy(true);
    setError("");
    setValidationErrors({});
    setMessage("");
    try {
      let current = detailRef.current;
      if (
        action === "publish" &&
        JSON.stringify(contentRef.current) !== snapshotRef.current
      )
        current = await save();
      if (!current) return;
      const updated = await contentApi.action(
        collection,
        id,
        action,
        current.version,
        action === "restore" ? selectedRevision?.id : undefined,
      );
      setDetail(updated);
      detailRef.current = updated;
      setContent(updated.content);
      contentRef.current = updated.content;
      setSnapshot(JSON.stringify(updated.content));
      snapshotRef.current = JSON.stringify(updated.content);
      setConflict(false);
      setAutosavePaused(false);
      setPreviewRefresh((value) => value + 1);
      setMessage(
        (
          {
            publish:
              "La publication est confirmée. La nouvelle version est visible sur le site.",
            unpublish: "Le contenu a été retiré du site public.",
            archive: "Le contenu a été archivé. Son historique est conservé.",
            restore:
              "La version a été restaurée dans un nouveau brouillon. Publiez-la lorsque vous êtes prête.",
            discard:
              "Le brouillon reprend maintenant la dernière version publiée.",
          } as Record<string, string>
        )[action] ?? "Modification confirmée.",
      );
      setHistoryOpen(false);
    } catch (cause) {
      const problem = cause as ApiError;
      setError(problem.message);
      setValidationErrors(validationFields(problem.details));
      setConflict(problem.status === 409);
      setAutosavePaused(true);
    } finally {
      setActionBusy(false);
      setConfirm(null);
    }
  }
  const previewContent = detail?.content ?? content;
  const previewPath =
    kind === "home" || kind === "settings" || kind === "statistic"
      ? "/"
      : kind === "article"
        ? `/reflexions/${encodeURIComponent(previewContent.slug ?? "")}/`
        : kind === "person"
          ? "/qui-sommes-nous/"
          : `/${encodeURIComponent(previewContent.slug ?? "")}/`;
  const title = isNew
    ? ({
        articles: "Écrire une réflexion",
        people: "Ajouter une personne",
        statistics: "Ajouter un chiffre",
        categories: "Créer une catégorie",
      }[collection as string] ?? "Nouveau contenu")
    : kind === "home"
      ? "Accueil"
      : kind === "settings"
        ? "Paramètres du site"
        : detail?.title ||
          content.title ||
          content.name ||
          content.value ||
          "Éditer le contenu";
  const descriptions: Record<
    string,
    { title: string; text: string; label: string; danger?: boolean }
  > = {
    publish: {
      title: "Publier cette version ?",
      text: "Le brouillon enregistré remplacera la version visible par les visiteurs. Vérifiez les textes, les sources et les droits des images avant de confirmer.",
      label: "Confirmer la publication",
    },
    unpublish: {
      title: "Retirer cet article du site ?",
      text: "L’article ne sera plus accessible au public. Son contenu et son historique resteront disponibles dans l’administration.",
      label: "Retirer du site",
      danger: true,
    },
    archive: {
      title: "Archiver ce contenu ?",
      text: "Le contenu sera retiré du site et conservé dans les archives avec son historique. Vous pourrez restaurer une version plus tard.",
      label: "Archiver",
      danger: true,
    },
    discard: {
      title: "Annuler les modifications non publiées ?",
      text: "Le brouillon reprendra la dernière version publiée. Vos modifications non enregistrées seront abandonnées ; les versions déjà enregistrées restent dans l’historique.",
      label: "Reprendre la version publiée",
      danger: true,
    },
    restore: {
      title: `Restaurer la version ${selectedRevision?.version ?? ""} ?`,
      text: "Un nouveau brouillon sera créé à partir de cette version. L’historique et la version actuellement publique seront conservés. Les modifications non enregistrées seront abandonnées.",
      label: "Restaurer en brouillon",
    },
    reload: {
      title: "Charger la version du serveur ?",
      text: "Votre saisie actuelle sera remplacée par la dernière version enregistrée. Copiez d’abord les passages que vous souhaitez conserver.",
      label: "Charger la dernière version",
      danger: true,
    },
  };
  if (loading) return <Loading label="Ouverture du contenu…" />;
  if (!isNew && !detail)
    return (
      <>
        <p className="admin-error" role="alert">
          {error || "Ce contenu n’a pas pu être chargé."}
        </p>
        <Button
          variant="secondary"
          onClick={() => onNavigate(`/admin/${collection}/`)}
        >
          Revenir à la liste
        </Button>
      </>
    );
  return (
    <>
      <div className="admin-editor-top">
        <button
          className="admin-back"
          onClick={() =>
            onNavigate(
              collection === "settings" ? "/admin/" : `/admin/${collection}/`,
            )
          }
        >
          <ArrowLeft size={16} />
          {names[collection]}
        </button>
        {detail && <Badge status={detail.status} />}
      </div>
      <div className="admin-editor-heading">
        <div>
          <h1 tabIndex={-1}>{title}</h1>
          <p>
            {isNew
              ? "Commencez par un brouillon. Vous choisirez le moment de sa publication."
              : `Dernière modification : ${formatDate(detail?.updatedAt)} · Version ${detail?.version}`}
          </p>
        </div>
        <div className="admin-actions">
          {!isNew && (
            <Button variant="secondary" onClick={() => void showHistory()}>
              <History size={15} />
              Historique
            </Button>
          )}
          {!isNew && kind !== "category" && (
            <Button
              variant="secondary"
              onClick={() => void showPreview()}
              disabled={saving || actionBusy || conflict}
            >
              <Eye size={15} />
              Prévisualiser
            </Button>
          )}
          {!isNew && (
            <Button
              onClick={() => setConfirm("publish")}
              disabled={saving || actionBusy || conflict}
            >
              <Send size={14} />
              Publier
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="admin-error" role="alert">
          <p>{error}</p>
          {Object.keys(validationErrors).length > 0 && (
            <ul>
              {Object.entries(validationErrors).map(([path, text]) => (
                <li key={path}>
                  {labelForPath(path)} : {text}
                </li>
              ))}
            </ul>
          )}
          {conflict && (
            <>
              <p>
                Une autre version existe déjà. Votre saisie est conservée ici et
                aucun contenu n’a été écrasé.
              </p>
              <div className="admin-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void compare()}
                >
                  Comparer les versions
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm("reload")}
                >
                  Charger la version enregistrée
                </Button>
              </div>
            </>
          )}
          {!conflict && (
            <div className="admin-actions">
              <Button
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => void save()}
              >
                Réessayer l’enregistrement
              </Button>
            </div>
          )}
        </div>
      )}
      {message && (
        <div className="admin-success" role="status">
          {message}
        </div>
      )}
      <div className="admin-savebar">
        <div className="admin-save-status" data-saved={!dirty && !saving}>
          {saving ? (
            <>
              <Cloud size={15} />
              Enregistrement en cours…
            </>
          ) : dirty ? (
            <>
              <span aria-hidden>●</span>Modifications non enregistrées
            </>
          ) : (
            <>
              <Check size={15} />
              {isNew ? "Nouveau contenu" : "Brouillon enregistré"}
            </>
          )}
        </div>
        <div className="admin-actions">
          {!isNew && (
            <label className="admin-autosave">
              <input
                type="checkbox"
                checked={autosave}
                onChange={(event) => {
                  setAutosave(event.target.checked);
                  setAutosavePaused(false);
                }}
              />
              Sauvegarde automatique
            </label>
          )}
          <Button
            variant="secondary"
            loading={saving}
            disabled={actionBusy || conflict || (!isNew && !dirty)}
            onClick={() => void save()}
          >
            <Save size={14} />
            {isNew ? "Créer le brouillon" : "Enregistrer le brouillon"}
          </Button>
        </div>
      </div>
      <div className="admin-editor-layout" data-preview={preview}>
        <div className="admin-editor-content">
          <fieldset
            disabled={actionBusy}
            style={{ padding: 0, border: 0, margin: 0, minWidth: 0 }}
          >
            <ContentForm
              kind={kind}
              value={content}
              onChange={change}
              people={people}
              categories={categories}
              statistics={statistics}
              onNavigate={(next) => onNavigate(`/admin/${next}/`)}
              disabled={actionBusy}
              autoSlug={isNew}
            />
          </fieldset>
          {!isNew && (
            <div className="admin-actions" style={{ marginTop: 24 }}>
              {detail?.publishedRevisionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm("discard")}
                  disabled={saving || actionBusy}
                >
                  <Undo2 size={14} />
                  Annuler le brouillon
                </Button>
              )}
              {kind === "article" && detail?.status === "published" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm("unpublish")}
                  disabled={saving || actionBusy}
                >
                  Retirer du site
                </Button>
              )}
              {!["home", "page", "settings"].includes(kind) &&
                detail?.status !== "archived" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirm("archive")}
                    disabled={saving || actionBusy}
                  >
                    <Archive size={14} />
                    Archiver
                  </Button>
                )}
            </div>
          )}
        </div>
        {preview && (
          <aside className="admin-preview" aria-label="Aperçu privé">
            <div className="admin-preview-controls">
              <div className="admin-actions">
                {[
                  { width: 1280, label: "Ordinateur", Icon: Monitor },
                  { width: 768, label: "Tablette", Icon: Tablet },
                  { width: 390, label: "Mobile", Icon: Smartphone },
                ].map(({ width, label, Icon }) => (
                  <Button
                    key={width}
                    variant="ghost"
                    size="icon"
                    aria-label={`Aperçu ${label.toLowerCase()}`}
                    title={label}
                    aria-pressed={previewWidth === width}
                    onClick={() => setPreviewWidth(width)}
                  >
                    <Icon size={15} />
                  </Button>
                ))}
              </div>
              <span>{previewWidth} px</span>
              <div className="admin-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Actualiser l’aperçu"
                  aria-label="Actualiser l’aperçu"
                  onClick={() => void showPreview()}
                >
                  <RefreshCw size={15} />
                </Button>
                <a
                  className="admin-button admin-button-ghost admin-button-icon"
                  aria-label="Ouvrir l’aperçu dans un nouvel onglet"
                  href={`${previewPath}?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={15} />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreview(false)}
                >
                  Fermer
                </Button>
              </div>
            </div>
            <PreviewViewport
              width={previewWidth}
              src={`${previewPath}?preview=1&v=${previewRefresh}`}
            />
            <p className="admin-preview-caption">
              Aperçu privé du dernier brouillon enregistré. Le site public
              conserve sa dernière version publiée. Affichage ajusté à l’espace
              disponible.
            </p>
          </aside>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setConfirm(null);
        }}
        title={descriptions[confirm ?? ""]?.title ?? ""}
        description={descriptions[confirm ?? ""]?.text ?? ""}
        confirmLabel={descriptions[confirm ?? ""]?.label}
        destructive={descriptions[confirm ?? ""]?.danger}
        busy={actionBusy}
        onConfirm={() => {
          if (confirm === "reload") {
            void contentApi
              .get(collection, id)
              .then((fresh) => {
                setDetail(fresh);
                setContent(fresh.content);
                setSnapshot(JSON.stringify(fresh.content));
                setError("");
                setConflict(false);
                setAutosavePaused(false);
                setConfirm(null);
              })
              .catch((cause) => setError(cause.message));
          } else if (confirm) void perform(confirm);
        }}
      />
      <Modal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="L’histoire de ce contenu"
        description="Chaque enregistrement conserve une version. Restaurer crée un nouveau brouillon."
        wide
      >
        {historyLoading ? (
          <Loading />
        ) : (
          <div className="admin-history-layout">
            <div className="admin-history-list">
              {revisions.map((revision) => (
                <button
                  className="admin-revision"
                  key={revision.id}
                  aria-pressed={selectedRevision?.id === revision.id}
                  onClick={() => setSelectedRevision(revision)}
                >
                  <strong>
                    Version {revision.version} ·{" "}
                    {actionLabels[revision.action] ?? "Enregistrement"}
                  </strong>
                  <span>{formatDate(revision.createdAt)}</span>
                  <small>{revision.createdByName ?? "Équipe éditoriale"}</small>
                </button>
              ))}
            </div>
            <div>
              {selectedRevision && (
                <>
                  <p className="admin-hint">
                    Comparaison avec votre brouillon actuel.
                  </p>
                  <ContentDiff
                    before={selectedRevision.content}
                    after={content}
                    beforeLabel={`Version ${selectedRevision.version}`}
                    afterLabel="Votre brouillon"
                    references={[...people, ...categories]}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setHistoryOpen(false);
                      setConfirm("restore");
                    }}
                    disabled={actionBusy || saving}
                  >
                    <History size={14} />
                    Restaurer cette version
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={compareOpen}
        onOpenChange={setCompareOpen}
        title="Deux versions à rapprocher"
        description="Comparez les modifications avant de recharger. Votre saisie n’a pas été perdue."
        wide
      >
        {latest && (
          <ContentDiff
            before={latest.content}
            after={content}
            beforeLabel="Version du serveur"
            afterLabel="Votre saisie"
            references={[...people, ...categories]}
          />
        )}
        <div className="admin-actions">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard
                .writeText(humanText(content))
                .then(() =>
                  setMessage(
                    "Votre texte a été copié. Vous pouvez recharger la version du serveur.",
                  ),
                )
                .catch(() =>
                  setError(
                    "La copie n’est pas disponible. Sélectionnez et copiez les passages depuis la comparaison.",
                  ),
                );
            }}
          >
            <Copy size={14} />
            Copier mon texte
          </Button>
          <Button
            onClick={() => {
              setCompareOpen(false);
              setConfirm("reload");
            }}
          >
            Charger la version du serveur
          </Button>
        </div>
      </Modal>
      <p className="admin-bottom-note">
        <AlertTriangle />
        Les informations confidentielles, dossiers RH et justificatifs privés ne
        doivent pas être saisis ici.
      </p>
    </>
  );
}

function PreviewViewport({ width, src }: { width: number; src: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 690 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, size.width / width);
  return (
    <div ref={container} className="admin-preview-frame">
      <iframe
        key={`${width}-${src}`}
        title="Prévisualisation privée du brouillon"
        src={src}
        style={{
          width,
          height: Math.ceil(size.height / Math.max(scale, 0.1)),
          transform: `scale(${scale})`,
          left: Math.max(0, (size.width - width * scale) / 2),
        }}
      />
    </div>
  );
}

const fieldLabels: Record<string, string> = {
  title: "Titre",
  intro: "Introduction",
  eyebrow: "Surtitre",
  text: "Texte",
  label: "Libellé",
  href: "Destination du lien",
  body: "Corps de l’article",
  excerpt: "Résumé",
  name: "Nom",
  role: "Fonction",
  bio: "Biographie",
  value: "Chiffre",
  source: "Source",
  sourceUrl: "Adresse de la source",
  year: "Millésime",
  note: "Périmètre et méthode",
  verified: "Vérification",
  phone: "Téléphone",
  email: "Courriel",
  linkedin: "LinkedIn",
  footerText: "Pied de page",
  contactText: "Texte du contact",
  slug: "Adresse",
  date: "Date de publication",
  alt: "Description de l’image",
  allowPdfDownload: "Autorisation de téléchargement du PDF",
  reviewed: "Relecture du PDF",
  description: "Description",
  order: "Ordre de présentation",
  duration: "Durée",
  rhythm: "Rythme",
  delivery: "Modalités",
  statisticsTitle: "Titre des chiffres",
  statisticsTransition: "Transition des chiffres",
  reasonsTitle: "Titre des raisons",
  domainsTitle: "Titre des accompagnements",
  domainsIntro: "Introduction des accompagnements",
  closingTitle: "Invitation finale",
  offerExcerpt: "Résumé de l’offre",
  seo: "Référencement",
  editorial: "Repères éditoriaux",
  journal: "Carnet Réflexions",
  contact: "Contact",
  format: "Modalités",
  sections: "Sections",
  items: "Éléments",
  primaryCta: "Lien prioritaire",
  secondaryCta: "Second lien",
  cta: "Appel à l’action",
  closingCta: "Lien final",
  diagnostic: "Diagnostic",
  reasons: "Raisons",
  conviction: "Conviction",
  reasonsLink: "Lien vers l’équipe",
  seriesCta: "Lien de lancement",
  image: "Image",
  portrait: "Portrait",
  sourcePdf: "PDF original",
  qualification: "Qualification IPRP",
  pdfImport: "Relecture du PDF",
  statistics: "Chiffres",
  statisticIds: "Sélection de chiffres",
  heroAudience: "Public accompagné",
  heroDisciplines: "Disciplines",
  heroArtTop: "Repère supérieur du coquillage",
  heroArtBottom: "Repère inférieur du coquillage",
  heroArtCaption: "Signature du coquillage",
  exploreLabel: "Invitation à explorer",
  statisticsEyebrow: "Surtitre des chiffres",
  statisticsDescription: "Introduction aux chiffres",
  statisticsNote: "Précision sur les indicateurs",
  diagnosticEyebrow: "Surtitre du diagnostic",
  diagnosticArtEyebrow: "Repère du visuel diagnostic",
  diagnosticArtLegend: "Légende du diagnostic",
  diagnosticArtTitle: "Titre du visuel diagnostic",
  diagnosticNote: "Précision sur le diagnostic",
  reasonsEyebrow: "Surtitre des raisons",
  reasonsMotifLabel: "Légende des relations",
  domainsEyebrow: "Surtitre des accompagnements",
  convictionEyebrow: "Surtitre de la conviction",
  artTop: "Repère supérieur",
  artBottom: "Repère inférieur",
  methodLinkLabel: "Lien vers la méthode",
  invitationEyebrow: "Surtitre de l’invitation",
  invitationTitle: "Titre de l’invitation",
  baseline: "Signature du carnet",
  topics: "Thèmes",
  seriesEyebrow: "Surtitre du lancement",
  seriesStatus: "État du lancement",
  seriesTitle: "Titre de lancement",
  seriesText: "Texte de lancement",
  exploreEyebrow: "Surtitre des accompagnements",
  exploreTitle: "Titre des accompagnements",
  formEyebrow: "Surtitre du formulaire",
  formTitle: "Titre du formulaire",
  directHeading: "Coordonnées directes",
  context: "Précision avant prise de contact",
  linkedinLabel: "Libellé LinkedIn",
  navigationLabel: "Libellé du sommaire",
  instruction: "Invitation à explorer",
  number: "Repère affiché",
  brand: "Nom de marque",
  tagline: "Signature",
  status: "État",
  registration: "Référence vérifiée",
  validUntil: "Validité",
  observationPeriod: "Période d’observation",
  publicationYear: "Année de publication",
  authorId: "Auteure",
  categoryId: "Catégorie",
  personId: "Personne concernée",
  mediaId: "Média sélectionné",
  crop: "Recadrage",
  hotspot: "Point d’intérêt",
  pageCount: "Pages analysées",
  ocrPages: "Pages reconnues",
  originalFilename: "Nom du fichier",
  size: "Poids du fichier",
  mimeType: "Format du fichier",
};
function validationFields(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};
}
function labelForPath(path: string) {
  return path
    .split(".")
    .map((part) =>
      /^\d+$/.test(part)
        ? String(Number(part) + 1)
        : (fieldLabels[part] ?? "Contenu"),
    )
    .join(" · ");
}
function humanText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return value.map(humanText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const object = value as EditorialContent;
    if (object.type === "text") return object.text ?? "";
    if (object.type) return humanText(object.content);
    return Object.entries(object)
      .filter(
        ([key]) =>
          ![
            "id",
            "key",
            "mediaId",
            "authorId",
            "categoryId",
            "personId",
          ].includes(key),
      )
      .map(
        ([key, item]) =>
          `${fieldLabels[key] ?? ""}${fieldLabels[key] ? ": " : ""}${humanText(item)}`,
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
function comparable(
  content: EditorialContent,
  references: ContentSummary[],
  prefix = "",
): Record<string, { raw: string; display: string; label: string }> {
  const result: Record<
    string,
    { raw: string; display: string; label: string }
  > = {};
  for (const [key, value] of Object.entries(content)) {
    if (["id", "key"].includes(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const label = labelForPath(path);
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value as EditorialContent).type
    ) {
      Object.assign(
        result,
        comparable(value as EditorialContent, references, path),
      );
    } else {
      let display = humanText(value);
      if (["authorId", "categoryId", "personId"].includes(key))
        display =
          references.find((item) => item.id === value)?.title ??
          (value ? "Sélection enregistrée" : "Non renseigné");
      if (key === "mediaId")
        display = value ? "Un média est sélectionné" : "Aucun média";
      if (key === "statisticIds")
        display = Array.isArray(value)
          ? `${value.length} chiffres sélectionnés`
          : "Aucun chiffre";
      result[path] = { raw: JSON.stringify(value) ?? "", display, label };
    }
  }
  return result;
}
function ContentDiff({
  before,
  after,
  beforeLabel,
  afterLabel,
  references,
}: {
  before: EditorialContent;
  after: EditorialContent;
  beforeLabel: string;
  afterLabel: string;
  references: ContentSummary[];
}) {
  const left = comparable(before, references),
    right = comparable(after, references);
  const keys = [
    ...new Set([...Object.keys(left), ...Object.keys(right)]),
  ].filter((key) => left[key]?.raw !== right[key]?.raw);
  return (
    <div className="admin-diff-list">
      {keys.length ? (
        keys.map((key) => (
          <div className="admin-diff-item" key={key}>
            <strong>{left[key]?.label ?? right[key]?.label}</strong>
            <div className="admin-diff-values">
              <div>
                <small>{beforeLabel}</small>
                <p
                  tabIndex={0}
                  role="region"
                  aria-label={`${left[key]?.label ?? right[key]?.label} — ${beforeLabel}`}
                >
                  {left[key]?.display || "Non renseigné"}
                </p>
              </div>
              <div>
                <small>{afterLabel}</small>
                <p
                  tabIndex={0}
                  role="region"
                  aria-label={`${right[key]?.label ?? left[key]?.label} — ${afterLabel}`}
                >
                  {right[key]?.display || "Non renseigné"}
                </p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="admin-hint">
          Les textes de ces deux versions sont identiques.
        </p>
      )}
    </div>
  );
}
