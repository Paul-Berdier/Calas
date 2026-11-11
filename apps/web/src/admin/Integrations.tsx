import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { formatDate, request, type AdminUser } from "./api";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Loading,
  Modal,
  SectionHeading,
} from "./ui";
import "./outreach.css";
import { permissions, type Scope } from "./integration-permissions";
interface AccessToken {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
interface RemoteConnection extends Omit<AccessToken, "name"> {
  clientName: string;
}

export function Integrations({ user }: { user: AdminUser }) {
  const [items, setItems] = useState<AccessToken[] | null>(null);
  const [connections, setConnections] = useState<RemoteConnection[] | null>(
    null,
  );
  const [revokingConnection, setRevokingConnection] =
    useState<RemoteConnection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const availablePermissions = permissions.filter(
    (item) => item.scope !== "users" || user.role === "administrator",
  );
  const [scopes, setScopes] = useState<Scope[]>(
    availablePermissions.map((item) => item.scope),
  );
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{
    token: string;
    item: AccessToken;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [revoking, setRevoking] = useState<AccessToken | null>(null);

  const reload = useCallback(async () => {
    const [local, remote] = await Promise.allSettled([
      request<{ items: AccessToken[] }>("/api/admin/integrations/tokens/"),
      request<{ items: RemoteConnection[] }>(
        "/api/admin/integrations/oauth/connections/",
      ),
    ]);
    if (local.status === "fulfilled") setItems(local.value.items);
    if (remote.status === "fulfilled") setConnections(remote.value.items);
    setError(
      [local, remote]
        .filter((item) => item.status === "rejected")
        .map((item) =>
          String(
            item.reason instanceof Error
              ? item.reason.message
              : "Impossible de charger une liste de connexions.",
          ),
        )
        .join(" "),
    );
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{ token: string; item: AccessToken }>(
        "/api/admin/integrations/tokens/",
        {
          method: "POST",
          body: JSON.stringify({ name, scopes }),
        },
      );
      setIssued(result);
      setVisible(false);
      setCreating(false);
      setName("");
      setScopes(availablePermissions.map((item) => item.scope));
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/integrations/tokens/${revoking.id}/revoke/`, {
        method: "POST",
        body: "{}",
      });
      if (issued?.item.id === revoking.id) setIssued(null);
      setRevoking(null);
      setNotice("Accès révoqué.");
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setNotice("Clé copiée. Conservez-la dans votre configuration privée.");
    } catch {
      setVisible(true);
      setNotice(
        "La copie automatique est indisponible. Sélectionnez la clé pour la copier.",
      );
    }
  }
  async function revokeConnection() {
    if (!revokingConnection) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/api/admin/integrations/oauth/connections/${revokingConnection.id}/revoke/`,
        { method: "POST", body: "{}" },
      );
      setRevokingConnection(null);
      setNotice("Connexion distante révoquée.");
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="outreach-space">
      <SectionHeading
        title="Connexions IA"
        description="Autorisez Claude ou Codex à travailler avec vos contenus et votre prospection."
        actions={
          <Button
            onClick={() => {
              setError("");
              setCreating(true);
            }}
          >
            <Plus size={16} aria-hidden />
            Créer une clé locale
          </Button>
        }
      />
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Connecter une application par Internet</h2>
            <p>Pour les clients compatibles avec MCP distant et OAuth.</p>
          </div>
        </div>
        <div className="admin-card-body outreach-stack">
          <Field label="Adresse du serveur MCP">
            {(id) => (
              <input
                id={id}
                className="admin-input"
                readOnly
                value={
                  typeof window === "undefined"
                    ? "https://www.calas-conseil.fr/mcp/"
                    : new URL("/mcp/", window.location.origin).href
                }
                onFocus={(event) => event.target.select()}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL("/mcp/", window.location.origin).href,
                );
                setNotice("Adresse MCP copiée.");
              } catch {
                setNotice("Sélectionnez l’adresse affichée pour la copier.");
              }
            }}
          >
            <Copy size={16} aria-hidden />
            Copier l’adresse MCP
          </Button>
          <ol className="outreach-instructions">
            <li>
              Dans votre application IA, ajoutez un serveur MCP distant ou un
              connecteur personnalisé avec cette adresse.
            </li>
            <li>
              Choisissez l’authentification OAuth et l’enregistrement
              automatique si ce choix est proposé.
            </li>
            <li>
              La page Calas s’ouvre : connectez-vous avec votre compte habituel,
              vérifiez le domaine de retour et autorisez les permissions
              souhaitées.
            </li>
          </ol>
          <p className="admin-hint">
            La disponibilité des connecteurs personnalisés dépend de votre
            application et de son offre. L’autorisation se fait sur le site
            Calas ; aucun mot de passe Calas n’est à copier dans une
            conversation IA.
          </p>
        </div>
      </section>
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Applications distantes autorisées</h2>
            <p>
              Ces autorisations sont personnelles et restent liées à votre
              session Calas.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Actualiser les applications distantes"
            onClick={() => void reload()}
          >
            <RefreshCw size={17} />
          </Button>
        </div>
        {connections === null ? (
          error ? (
            <p className="admin-card-body">La liste n’a pas pu être chargée.</p>
          ) : (
            <Loading />
          )
        ) : connections.length ? (
          <div className="outreach-list">
            {connections.map((connection) => {
              const expired =
                new Date(connection.expiresAt).getTime() <= Date.now();
              const inactive = Boolean(connection.revokedAt) || expired;
              return (
                <article className="outreach-list-row" key={connection.id}>
                  <div className="outreach-grow">
                    <h3>{connection.clientName}</h3>
                    <p>
                      {permissions
                        .filter((permission) =>
                          connection.scopes.includes(permission.scope),
                        )
                        .map((permission) => permission.label)
                        .join(" · ")}
                    </p>
                    <small>
                      Expiration {formatDate(connection.expiresAt)} · Dernière
                      utilisation{" "}
                      {connection.lastUsedAt
                        ? formatDate(connection.lastUsedAt)
                        : "Aucune"}
                    </small>
                  </div>
                  <Badge status={inactive ? "archived" : "published"}>
                    {connection.revokedAt
                      ? "Révoquée"
                      : expired
                        ? "Expirée"
                        : "Active"}
                  </Badge>
                  {!inactive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRevokingConnection(connection)}
                    >
                      Révoquer la connexion
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Aucune application distante autorisée"
            description="Démarrez la connexion depuis votre application IA avec l’adresse MCP ci-dessus."
          />
        )}
      </section>
      {issued && (
        <section
          className="admin-card outreach-token"
          aria-labelledby="token-title"
        >
          <div className="admin-card-header">
            <h2 id="token-title">Clé créée pour {issued.item.name}</h2>
            <KeyRound size={20} aria-hidden />
          </div>
          <div className="admin-card-body outreach-stack">
            <p>
              Cette clé est visible pendant cette visite. Elle expire le{" "}
              {formatDate(issued.item.expiresAt)} et à la fermeture de votre
              session.
            </p>
            <Field label="Clé personnelle">
              {(id) => (
                <input
                  id={id}
                  className="admin-input"
                  readOnly
                  type={visible ? "text" : "password"}
                  value={issued.token}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={(event) => event.target.select()}
                />
              )}
            </Field>
            <div className="admin-actions">
              <Button onClick={() => void copyToken()}>
                <Copy size={16} aria-hidden />
                Copier la clé
              </Button>
              <Button
                variant="secondary"
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? "Masquer" : "Afficher"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIssued(null);
                  setVisible(false);
                }}
              >
                Fermer l’affichage
              </Button>
            </div>
          </div>
        </section>
      )}
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Vos clés pour un connecteur local</h2>
            <p>
              Chaque connexion utilise vos droits actuels. La fermeture de votre
              session révoque son accès.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Actualiser les connexions"
            onClick={() => void reload()}
          >
            <RefreshCw size={17} />
          </Button>
        </div>
        {!items && !error ? (
          <Loading />
        ) : items?.length ? (
          <div className="outreach-list">
            {items.map((item) => {
              const expired = new Date(item.expiresAt).getTime() <= Date.now();
              const inactive = Boolean(item.revokedAt) || expired;
              return (
                <article className="outreach-list-row" key={item.id}>
                  <div className="outreach-grow">
                    <h3>{item.name}</h3>
                    <p>
                      {permissions
                        .filter((permission) =>
                          item.scopes.includes(permission.scope),
                        )
                        .map((permission) => permission.label)
                        .join(" · ")}
                    </p>
                    <small>
                      Expiration {formatDate(item.expiresAt)} · Dernière
                      utilisation{" "}
                      {item.lastUsedAt ? formatDate(item.lastUsedAt) : "Aucune"}
                    </small>
                  </div>
                  <Badge status={inactive ? "archived" : "published"}>
                    {item.revokedAt ? "Révoqué" : expired ? "Expiré" : "Actif"}
                  </Badge>
                  {!inactive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRevoking(item)}
                    >
                      Révoquer
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Aucune connexion créée"
            description="Créez une clé par outil pour pouvoir révoquer chaque connexion séparément."
          />
        )}
      </section>
      <section className="admin-card">
        <div className="admin-card-header">
          <h2>
            Autre possibilité : le connecteur installé sur votre ordinateur
          </h2>
        </div>
        <div className="admin-card-body outreach-stack">
          <p>
            Le connecteur MCP se lance sur votre ordinateur avec Node 24. Le
            dépôt Calas fournit son programme et les modèles de configuration
            dans <code>docs/MCP.md</code>.
          </p>
          <ol className="outreach-instructions">
            <li>
              Depuis le dépôt, construire le connecteur avec{" "}
              <code>pnpm --filter @calas/mcp build</code>.
            </li>
            <li>
              Définir l’adresse du site dans <code>CALAS_MCP_URL</code> et votre
              clé dans <code>CALAS_MCP_TOKEN</code>, dans la configuration
              privée de l’outil.
            </li>
            <li>
              Lancer <code>node</code> avec le chemin absolu vers{" "}
              <code>apps/mcp/dist/index.mjs</code> comme serveur MCP local.
            </li>
          </ol>
          <p className="admin-hint">
            Les actions demandées à l’IA utilisent les droits sélectionnés pour
            sa connexion, y compris la publication et l’envoi de campagnes.
            Renouvelez l’accès après expiration de votre session.
          </p>
        </div>
      </section>
      <Modal
        open={creating}
        onOpenChange={(open) => {
          if (!busy) setCreating(open);
        }}
        title="Créer une connexion personnelle"
        description="La clé reprend les droits de votre compte et expire avec votre session actuelle, au plus tard après huit heures."
      >
        <form
          onSubmit={(event) => void create(event)}
          className="outreach-stack"
        >
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <Field label="Nom de la connexion" required>
            {(id) => (
              <input
                id={id}
                className="admin-input"
                required
                maxLength={80}
                value={name}
                placeholder="Claude Desktop ou Codex"
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            )}
          </Field>
          <fieldset className="outreach-fieldset">
            <legend>Actions autorisées</legend>
            {availablePermissions.map((permission) => (
              <label className="outreach-check" key={permission.scope}>
                <input
                  type="checkbox"
                  checked={scopes.includes(permission.scope)}
                  disabled={permission.scope === "read"}
                  onChange={(event) =>
                    setScopes((values) =>
                      event.target.checked
                        ? [...values, permission.scope]
                        : values.filter((value) => value !== permission.scope),
                    )
                  }
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="admin-hint">
            Les textes et données lus pourront être transmis au service d’IA
            choisi. Gardez la clé dans sa configuration privée.
          </p>
          <div className="admin-actions">
            <Button type="submit" loading={busy}>
              Créer la clé
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(revokingConnection)}
        onOpenChange={(open) => {
          if (!open && !busy) setRevokingConnection(null);
        }}
        title="Révoquer cette application distante ?"
        description={`L’application « ${revokingConnection?.clientName ?? ""} » perdra l’accès à votre compte Calas. Vous pourrez l’autoriser à nouveau depuis son interface.`}
        confirmLabel="Révoquer l’application"
        onConfirm={() => void revokeConnection()}
        destructive
        busy={busy}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => {
          if (!open && !busy) setRevoking(null);
        }}
        title="Révoquer cette connexion ?"
        description={`L’accès « ${revoking?.name ?? ""} » cessera de fonctionner. Vous pourrez créer une nouvelle clé ensuite.`}
        confirmLabel="Révoquer l’accès"
        onConfirm={() => void revoke()}
        destructive
        busy={busy}
      />
    </div>
  );
}
