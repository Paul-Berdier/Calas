import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  LayoutDashboard,
  Files,
  Feather,
  Images,
  Users,
  ChartNoAxesColumn,
  Settings,
  History,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Menu,
  ChevronRight,
  FileText,
  Upload,
  BookOpen,
  Clock,
  CheckCheck,
  LogOut,
  Tag,
  PenLine,
} from "lucide-react";
import {
  request,
  contentApi,
  formatDate,
  actionLabels,
  type AdminUser,
  type AuditEvent,
  type Collection,
  type ContentSummary,
  type DashboardData,
} from "./api";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Loading,
  Modal,
  SectionHeading,
  TextLink,
} from "./ui";
import "./admin.css";

const DocumentEditor = lazy(() =>
  import("./DocumentEditor").then((module) => ({
    default: module.DocumentEditor,
  })),
);

const MediaLibrary = lazy(() =>
  import("./components/MediaLibrary").then((module) => ({
    default: module.MediaLibrary,
  })),
);
const PdfImport = lazy(() =>
  import("./components/PdfImport").then((module) => ({
    default: module.PdfImport,
  })),
);
const navigation = [
  { slug: "", label: "Tableau de bord", Icon: LayoutDashboard },
  { slug: "pages", label: "Pages du site", Icon: Files },
  { slug: "articles", label: "Réflexions", Icon: Feather },
  { slug: "media", label: "Médiathèque", Icon: Images },
  { slug: "people", label: "Équipe", Icon: Users },
  { slug: "statistics", label: "Chiffres et sources", Icon: ChartNoAxesColumn },
  {
    slug: "settings",
    label: "Paramètres du site",
    Icon: Settings,
    admin: true,
  },
  { slug: "history", label: "Historique", Icon: History },
  { slug: "security", label: "Compte et sécurité", Icon: ShieldCheck },
  { slug: "users", label: "Utilisateurs", Icon: Users, admin: true },
];
const listMeta: Record<
  Collection,
  {
    title: string;
    description: string;
    newLabel?: string;
    empty: string;
    emptyText: string;
  }
> = {
  pages: {
    title: "Les pages du site",
    description: "Vos textes, dans une composition qui garde son équilibre.",
    empty: "Aucune page disponible",
    emptyText:
      "L’initialisation des contenus doit être effectuée avant l’édition des pages.",
  },
  articles: {
    title: "Le carnet Réflexions",
    description:
      "Des idées à partager, à votre rythme. Un brouillon reste privé jusqu’à sa publication.",
    newLabel: "Écrire un article",
    empty: "La prochaine réflexion commence ici.",
    emptyText:
      "Écrivez votre premier article ou partez d’un PDF. Vous pourrez le relire et le prévisualiser avant de le publier.",
  },
  people: {
    title: "L’équipe du cabinet",
    description: "Des présentations fidèles aux personnes et à leurs parcours.",
    newLabel: "Ajouter une personne",
    empty: "Aucune personne enregistrée",
    emptyText:
      "Ajoutez uniquement des personnes réelles avec leurs informations approuvées.",
  },
  statistics: {
    title: "Chiffres et sources",
    description:
      "Chaque indicateur garde son périmètre, sa période et sa source.",
    newLabel: "Ajouter un chiffre",
    empty: "Aucun chiffre enregistré",
    emptyText:
      "Un chiffre apparaîtra sur le site après vérification de sa source et publication.",
  },
  categories: {
    title: "Les thèmes du carnet",
    description:
      "Des repères pour organiser les articles et accompagner la lecture.",
    newLabel: "Créer une catégorie",
    empty: "Choisir les premiers thèmes",
    emptyText:
      "Créez des catégories simples, liées aux sujets que vous souhaitez réellement aborder.",
  },
  settings: {
    title: "Paramètres du site",
    description: "Les informations communes au cabinet.",
    empty: "Paramètres indisponibles",
    emptyText: "Le contenu initial doit être chargé.",
  },
};

export default function AdminApp({
  user,
  initialPath = "/admin/",
}: {
  user: AdminUser;
  initialPath?: string;
}) {
  const [path, setPath] = useState(initialPath),
    [mobileNav, setMobileNav] = useState(false),
    [pendingPath, setPendingPath] = useState<string | null>(null),
    [signoutError, setSignoutError] = useState("");
  const dirty = useRef(false),
    pathRef = useRef(path);
  pathRef.current = path;
  const parts = path
      .replace(/^\/admin\/?/, "")
      .split("/")
      .filter(Boolean),
    section = parts[0] ?? "",
    id = parts[1];
  const navigate = useCallback((next: string, force = false) => {
    if (!force && dirty.current) {
      setPendingPath(next);
      return;
    }
    dirty.current = false;
    setMobileNav(false);
    if (/^\/admin\/(security|users|login)\//.test(next)) {
      window.location.assign(next);
      return;
    }
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".admin-main h1")?.focus(),
    );
  }, []);
  const changeDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  useEffect(() => {
    const pop = () => {
      const next = window.location.pathname;
      if (dirty.current) {
        window.history.pushState({}, "", pathRef.current);
        setPendingPath(next);
      } else {
        setPath(next);
        setMobileNav(false);
      }
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const link = (event: MouseEvent<HTMLAnchorElement>, next: string) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      navigate(next);
    }
  };
  async function signOut() {
    if (dirty.current) {
      setPendingPath("/admin/sign-out/");
      return;
    }
    try {
      await request("/api/auth/sign-out", { method: "POST", body: "{}" });
      window.location.assign("/admin/login/");
    } catch (cause) {
      setSignoutError((cause as Error).message);
    }
  }
  const title =
    navigation.find((item) => item.slug === section)?.label ??
    (section === "categories" ? "Catégories" : "Administration");
  const navItems = navigation.filter(
    (item) => !item.admin || user.role === "administrator",
  );
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "admin-mobile-nav" : "admin-nav"}
      aria-label="Administration"
    >
      {navItems.map(({ slug, label, Icon }) => (
        <a
          key={slug}
          href={`/admin/${slug ? `${slug}/` : ""}`}
          onClick={(event) => link(event, `/admin/${slug ? `${slug}/` : ""}`)}
          aria-current={section === slug ? "page" : undefined}
        >
          <Icon aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );
  let panel;
  if (section === "media")
    panel = (
      <>
        <SectionHeading
          eyebrow="Vos ressources"
          title="La médiathèque"
          description="Des images et documents conservés, organisés et protégés."
        />
        <Suspense fallback={<Loading label="Ouverture de la médiathèque…" />}>
          <MediaLibrary />
        </Suspense>
      </>
    );
  else if (section === "articles" && id === "import")
    panel = (
      <>
        <button
          className="admin-back"
          onClick={() => navigate("/admin/articles/")}
          style={{ marginBottom: 20 }}
        >
          ← Réflexions
        </button>
        <SectionHeading
          eyebrow="À partir de vos documents"
          title="Un PDF, une nouvelle réflexion"
          description="Le texte est analysé dans votre navigateur. Vous gardez la main sur sa relecture et sa publication."
        />
        <Suspense fallback={<Loading label="Préparation de l’import PDF…" />}>
          <PdfImport
            onCreated={(articleId) =>
              navigate(`/admin/articles/${articleId}/`, true)
            }
            onCancel={() => navigate("/admin/articles/")}
          />
        </Suspense>
      </>
    );
  else if (section === "history") panel = <HistoryView onNavigate={navigate} />;
  else if (section === "settings")
    panel =
      user.role === "administrator" ? (
        <DocumentEditor
          key="settings-site"
          collection="settings"
          id="site"
          onNavigate={navigate}
          onDirtyChange={changeDirty}
        />
      ) : (
        <EmptyState
          title="Accès réservé"
          description="Les paramètres du site sont réservés aux administrateurs."
        />
      );
  else if (
    ["pages", "articles", "people", "statistics", "categories"].includes(
      section,
    )
  ) {
    const collection = section as Collection;
    panel = id ? (
      <DocumentEditor
        key={`${collection}-${id}`}
        collection={collection}
        id={id}
        onNavigate={navigate}
        onDirtyChange={changeDirty}
      />
    ) : (
      <CollectionView collection={collection} onNavigate={navigate} />
    );
  } else if (!section) panel = <Dashboard user={user} onNavigate={navigate} />;
  else
    panel = (
      <EmptyState
        title="Cette rubrique n’existe pas."
        description="Retrouvez vos contenus depuis le tableau de bord."
        action={
          <Button onClick={() => navigate("/admin/")}>
            Revenir à l’accueil
          </Button>
        }
      />
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a
          href="/admin/"
          className="admin-brand"
          onClick={(event) => link(event, "/admin/")}
        >
          <img src="/brand/symbol.png" alt="" />
          <div>
            <strong>Calas Conseil</strong>
            <span>Atelier éditorial</span>
          </div>
        </a>
        <p className="admin-nav-label">Votre espace de travail</p>
        {nav()}
        <div className="admin-sidebar-footer">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={16} />
            Voir le site public
          </a>
          <p>
            La voie de la qualité
            <br />
            relationnelle.
          </p>
          <button
            className="admin-sidebar-signout"
            onClick={() => void signOut()}
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <Button
            variant="ghost"
            size="icon"
            className="admin-mobile-menu"
            aria-label="Ouvrir le menu d’administration"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={21} />
          </Button>
          <div className="admin-breadcrumb">
            <span>Espace éditorial</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <a
            className="admin-user"
            href="/admin/security/"
            onClick={(event) => link(event, "/admin/security/")}
          >
            <span className="admin-user-avatar">
              {user.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "administrator" ? "Administrateur" : "Éditeur"}
              </small>
            </div>
          </a>
        </header>
        <main className="admin-main" id="admin-main">
          {signoutError && (
            <p className="admin-error" role="alert">
              {signoutError}
            </p>
          )}
          <Suspense fallback={<Loading label="Ouverture de votre espace…" />}>
            {panel}
          </Suspense>
        </main>
      </div>
      <Modal
        open={mobileNav}
        onOpenChange={setMobileNav}
        title="Calas Conseil"
        description="Votre atelier éditorial."
      >
        {nav(true)}
        <div className="admin-actions">
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut size={15} />
            Se déconnecter
          </Button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button admin-button-secondary"
          >
            Voir le site public
          </a>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingPath)}
        onOpenChange={(open) => {
          if (!open) setPendingPath(null);
        }}
        title="Quitter sans enregistrer ?"
        description="Des modifications n’ont pas encore été confirmées par le serveur. Restez sur cette page pour les enregistrer, ou quittez en les abandonnant."
        confirmLabel="Quitter cette page"
        destructive
        onConfirm={() => {
          const next = pendingPath;
          setPendingPath(null);
          dirty.current = false;
          if (next === "/admin/sign-out/") void signOut();
          else if (next) navigate(next, true);
        }}
      />
    </div>
  );
}

function Dashboard({
  user,
  onNavigate,
}: {
  user: AdminUser;
  onNavigate: (path: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null),
    [pages, setPages] = useState<ContentSummary[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<DashboardData>("/api/admin/content/dashboard/", {
        signal: controller.signal,
      }),
      contentApi.list("pages", controller.signal),
    ])
      .then(([dashboard, pageList]) => {
        setData(dashboard);
        setPages(pageList.items);
        setError("");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, [retry]);
  const openPage = (slug: string) => {
    const page = pages.find(
      (item) => item.slug === slug || (slug === "" && item.kind === "home"),
    );
    onNavigate(page ? `/admin/pages/${page.id}/` : "/admin/pages/");
  };
  if (error)
    return (
      <>
        <SectionHeading title="Votre atelier éditorial" />
        <p className="admin-error" role="alert">
          {error}
        </p>
        <Button onClick={() => setRetry((value) => value + 1)}>
          Réessayer
        </Button>
      </>
    );
  if (!data) return <Loading label="Chargement de votre espace…" />;
  return (
    <>
      <SectionHeading
        eyebrow="L’atelier Calas Conseil"
        title={`Bonjour ${user.name.split(" ")[0]}.`}
        description="Un espace pour faire vivre vos idées et prendre soin de chaque mot."
        actions={
          <Button onClick={() => onNavigate("/admin/articles/new/")}>
            <Plus size={16} />
            Nouvelle réflexion
          </Button>
        }
      />
      <div className="admin-metrics">
        {[
          {
            label: "Pages du site",
            value: data.counts.pages,
            note: "Votre socle éditorial",
            Icon: Files,
          },
          {
            label: "Articles publiés",
            value: data.counts.articlesPublished,
            note: "À découvrir dans Réflexions",
            Icon: BookOpen,
          },
          {
            label: "Articles en brouillon",
            value: data.counts.articlesDraft,
            note: "Des idées en préparation",
            Icon: PenLine,
          },
          {
            label: "Contenus à vérifier",
            value: data.counts.needsReview,
            note: "Une relecture reste nécessaire",
            Icon: CheckCheck,
          },
        ].map(({ label, value, note, Icon }) => (
          <div className="admin-metric" key={label}>
            <Icon aria-hidden />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <section className="admin-welcome">
        <div>
          <p className="admin-eyebrow" style={{ color: "#d0ad7c" }}>
            Écrire, relire, partager
          </p>
          <h2>
            Votre expertise mérite
            <br />
            des mots qui lui ressemblent.
          </h2>
          <p>
            Transformez un document en article, retrouvez un brouillon ou
            apportez une nouvelle nuance à votre site.
          </p>
          <Button
            variant="secondary"
            onClick={() => onNavigate("/admin/articles/import/")}
          >
            <Upload size={15} />
            Importer un PDF
            <ArrowRight size={15} />
          </Button>
        </div>
        <img className="admin-welcome-art" src="/brand/symbol.png" alt="" />
      </section>
      <div className="admin-dashboard-grid">
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Reprendre le fil</h2>
              <p>Les dernières modifications de votre équipe.</p>
            </div>
            <TextLink onClick={() => onNavigate("/admin/history/")}>
              Tout voir
            </TextLink>
          </div>
          <div className="admin-card-body">
            <Activity events={data.recent.slice(0, 5)} />
          </div>
        </section>
        <div>
          <section className="admin-card">
            <div className="admin-card-header">
              <h2>À portée de main</h2>
            </div>
            <div className="admin-card-body">
              <div className="admin-quick-grid">
                {[
                  {
                    title: "Accueil",
                    text: "Le premier regard",
                    Icon: LayoutDashboard,
                    action: () => openPage(""),
                  },
                  {
                    title: "Diagnostic RPS",
                    text: "Votre offre centrale",
                    Icon: Files,
                    action: () => openPage("diagnostic-rps"),
                  },
                  {
                    title: "Nouvel article",
                    text: "Une idée à partager",
                    Icon: Feather,
                    action: () => onNavigate("/admin/articles/new/"),
                  },
                  {
                    title: "Ajouter une image",
                    text: "Votre médiathèque",
                    Icon: Images,
                    action: () => onNavigate("/admin/media/"),
                  },
                ].map(({ title, text, Icon, action }) => (
                  <button
                    className="admin-quick-action"
                    key={title}
                    onClick={action}
                  >
                    <Icon />
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="admin-card" style={{ marginTop: 20 }}>
            <div className="admin-card-header">
              <h2>Dernières publications</h2>
            </div>
            <div className="admin-card-body">
              <Activity
                events={data.recentPublications.slice(0, 4)}
                empty="Les prochaines publications apparaîtront ici."
              />
            </div>
          </section>
        </div>
      </div>
      <p className="admin-bottom-note">
        <ShieldCheck size={14} />
        Les brouillons et leurs médias restent privés jusqu’à leur publication.
      </p>
    </>
  );
}
function CollectionView({
  collection,
  onNavigate,
}: {
  collection: Collection;
  onNavigate: (path: string) => void;
}) {
  const [items, setItems] = useState<ContentSummary[] | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [retry, setRetry] = useState(0);
  const meta = listMeta[collection];
  useEffect(() => {
    const controller = new AbortController();
    contentApi
      .list(collection, controller.signal)
      .then((result) => {
        setItems(result.items);
        setError("");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, [collection, retry]);
  const filtered = (items ?? []).filter(
    (item) =>
      (status === "all" || item.status === status) &&
      (item.title ?? "")
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
  );
  const create = meta.newLabel ? (
    <Button onClick={() => onNavigate(`/admin/${collection}/new/`)}>
      <Plus size={15} />
      {meta.newLabel}
    </Button>
  ) : undefined;
  return (
    <>
      <SectionHeading
        eyebrow={
          collection === "articles"
            ? "Votre voix, vos idées"
            : "Le contenu du cabinet"
        }
        title={meta.title}
        description={meta.description}
        actions={
          <>
            {collection === "articles" && (
              <Button
                variant="secondary"
                onClick={() => onNavigate("/admin/articles/import/")}
              >
                <Upload size={15} />
                Importer un PDF
              </Button>
            )}
            {create}
          </>
        }
      />
      {collection === "articles" && (
        <div className="admin-actions" style={{ marginBottom: 20 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("/admin/categories/")}
          >
            <Tag size={14} />
            Gérer les catégories
          </Button>
        </div>
      )}
      {error ? (
        <div className="admin-error" role="alert">
          {error}
          <div className="admin-actions">
            <Button
              variant="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Réessayer
            </Button>
          </div>
        </div>
      ) : !items ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          title={meta.empty}
          description={meta.emptyText}
          action={create}
        />
      ) : (
        <>
          <div className="admin-toolbar">
            <div className="admin-search">
              <Search aria-hidden />
              <input
                className="admin-input"
                type="search"
                aria-label="Rechercher un contenu"
                placeholder="Rechercher dans les contenus…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="admin-filters" aria-label="Filtrer les contenus">
              {[
                { value: "all", label: "Tous" },
                { value: "published", label: "Publiés" },
                { value: "draft", label: "Brouillons" },
                { value: "archived", label: "Archives" },
              ].map((filter) => (
                <button
                  className="admin-filter"
                  key={filter.value}
                  aria-pressed={status === filter.value}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className="admin-content-list">
              {filtered.map((item) => (
                <button
                  className="admin-card admin-document-card"
                  key={item.id}
                  onClick={() => onNavigate(`/admin/${collection}/${item.id}/`)}
                >
                  <div className="admin-document-top">
                    <span className="admin-document-icon">
                      {collection === "articles" ? (
                        <Feather />
                      ) : collection === "people" ? (
                        <Users />
                      ) : collection === "statistics" ? (
                        <ChartNoAxesColumn />
                      ) : (
                        <FileText />
                      )}
                    </span>
                    <Badge
                      status={
                        item.hasUnpublishedChanges &&
                        item.status === "published"
                          ? "modified"
                          : item.status
                      }
                    />
                  </div>
                  <div>
                    <h2>
                      {item.kind === "home"
                        ? "Accueil"
                        : item.title || "Sans titre"}
                    </h2>
                    {collection === "pages" && (
                      <p>{item.kind === "home" ? "/" : `/${item.slug}/`}</p>
                    )}
                  </div>
                  <div className="admin-document-footer">
                    <span>Modifié le {formatDate(item.updatedAt)}</span>
                    <ArrowUpRight aria-hidden />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Aucun contenu ne correspond."
              description="Essayez un autre mot ou affichez tous les états."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              }
            />
          )}
        </>
      )}
    </>
  );
}
function Activity({
  events,
  empty = "Les modifications apparaîtront ici au fil de votre travail.",
}: {
  events: AuditEvent[];
  empty?: string;
}) {
  return events.length ? (
    <ul className="admin-activity">
      {events.map((event) => (
        <li key={event.id}>
          <span className="admin-activity-icon">
            {event.action === "publish" ? <CheckCheck /> : <Clock />}
          </span>
          <div>
            <strong>{event.title ?? resourceLabel(event.resourceType)}</strong>
            <p>
              {actionLabels[event.action] ?? "Modification"}
              {event.actorName ? ` · ${event.actorName}` : ""}
            </p>
            <time dateTime={event.createdAt}>
              {formatDate(event.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="admin-hint">{empty}</p>
  );
}
function HistoryView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<{ items: AuditEvent[] }>("/api/admin/content/history/", {
      signal: controller.signal,
    })
      .then((result) => {
        setEvents(result.items);
        setError("");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, [retry]);
  const visible = (events ?? []).filter((event) =>
    `${event.title ?? ""} ${event.actorName ?? ""} ${actionLabels[event.action] ?? ""}`
      .toLocaleLowerCase("fr")
      .includes(query.toLocaleLowerCase("fr")),
  );
  return (
    <>
      <SectionHeading
        eyebrow="Garder le fil"
        title="L’histoire de votre site"
        description="Les actions confirmées, les personnes qui les ont réalisées et les moments de publication."
        actions={
          <Button
            variant="secondary"
            onClick={() => onNavigate("/admin/pages/")}
          >
            Retrouver une page
          </Button>
        }
      />
      {error ? (
        <p className="admin-error" role="alert">
          {error}
          <Button
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Réessayer
          </Button>
        </p>
      ) : !events ? (
        <Loading />
      ) : (
        <>
          <div className="admin-toolbar">
            <div className="admin-search">
              <Search />
              <input
                type="search"
                className="admin-input"
                aria-label="Rechercher dans l’historique"
                placeholder="Un contenu, une personne, une action…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p className="admin-hint">{visible.length} événements affichés</p>
          </div>
          <div className="admin-card">
            <div className="admin-card-body">
              <Activity
                events={visible}
                empty="Aucun événement ne correspond à cette recherche."
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
function resourceLabel(kind: string) {
  return (
    (
      {
        page: "Page du site",
        home: "Accueil",
        article: "Article du carnet",
        person: "Équipe",
        statistic: "Chiffre et source",
        category: "Catégorie",
        settings: "Paramètres du site",
        media: "Média",
        user: "Utilisateur",
      } as Record<string, string>
    )[kind] ?? "Contenu éditorial"
  );
}
