import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatDate, request, type AdminUser } from "./api";
import { Button, Loading } from "./ui";
import { permissions, type Scope } from "./integration-permissions";
import { consentDestination } from "../auth/destination";
import "./admin.css";
import "./outreach.css";

interface ConsentRequest {
  clientName: string;
  redirectHost: string;
  requestedScopes: Scope[];
  allowedScopes: Scope[];
  expiresAt: string;
}

export function OAuthConsent({
  requestId,
  user,
}: {
  requestId: string;
  user: AdminUser;
}) {
  const [details, setDetails] = useState<ConsentRequest | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!consentDestination(requestId)) {
      setError(
        "Cette demande de connexion est invalide. Relancez la connexion depuis votre application IA.",
      );
      return;
    }
    let active = true;
    request<ConsentRequest>(
      `/api/admin/integrations/oauth/requests/${requestId}/`,
    )
      .then((result) => {
        if (!active) return;
        setDetails(result);
        setScopes(
          permissions
            .filter(
              (item) =>
                result.requestedScopes.includes(item.scope) &&
                result.allowedScopes.includes(item.scope) &&
                (item.scope !== "users" || user.role === "administrator"),
            )
            .map((item) => item.scope),
        );
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [requestId, user.role]);

  async function decide(approve: boolean) {
    if (!details || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ redirectUrl: string }>(
        `/api/admin/integrations/oauth/requests/${requestId}/decision/`,
        {
          method: "POST",
          body: JSON.stringify({ approve, scopes: approve ? scopes : [] }),
        },
      );
      // The destination is returned by the server from its registered client, never a query parameter.
      const destination = new URL(result.redirectUrl);
      if (
        destination.protocol !== "https:" &&
        !(
          destination.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(destination.hostname)
        )
      )
        throw new Error("La destination de l’application n’est pas valide.");
      window.location.assign(destination.href);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  const available = permissions.filter(
    (item) =>
      details?.requestedScopes.includes(item.scope) &&
      details.allowedScopes.includes(item.scope) &&
      (item.scope !== "users" || user.role === "administrator"),
  );
  return (
    <main className="admin-auth oauth-consent">
      <a href="/" className="oauth-brand">
        <img
          src="/brand/wordmark.svg?v=clean-curves-20261102"
          width="340"
          height="46"
          alt="Calas Conseil"
        />
      </a>
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h1>Connecter votre application IA</h1>
            <p>
              Compte connecté : {user.name} ({user.email})
            </p>
          </div>
          <ShieldCheck size={24} aria-hidden />
        </div>
        <div className="admin-card-body outreach-stack">
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          {!details && !error && (
            <Loading label="Vérification de la demande…" />
          )}
          {details && (
            <>
              <div className="outreach-warning">
                <p>
                  Nom déclaré par l’application :{" "}
                  <strong>{details.clientName}</strong>.
                </p>
                <p>
                  Domaine de retour enregistré :{" "}
                  <strong>{details.redirectHost}</strong>.
                </p>
              </div>
              <p>
                Le nom est fourni par l’application et ne constitue pas une
                identité vérifiée par Calas Conseil. Vérifiez le domaine et les
                permissions avant d’autoriser l’accès.
              </p>
              <fieldset className="outreach-fieldset" disabled={busy}>
                <legend>Actions autorisées pour cette application</legend>
                {available.map((permission) => (
                  <label className="outreach-check" key={permission.scope}>
                    <input
                      type="checkbox"
                      checked={scopes.includes(permission.scope)}
                      disabled={permission.scope === "read"}
                      onChange={(event) =>
                        setScopes((values) =>
                          event.target.checked
                            ? [...values, permission.scope]
                            : values.filter(
                                (value) => value !== permission.scope,
                              ),
                        )
                      }
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </fieldset>
              <p>
                Les contenus et données consultés pourront être transmis au
                service IA choisi. Les permissions de publication et d’envoi lui
                permettent d’agir sur le site et les campagnes. Autorisez
                uniquement l’application dont vous venez de lancer la connexion.
              </p>
              <p className="admin-hint">
                Cette demande expire le {formatDate(details.expiresAt)}. Vous
                pourrez révoquer l’accès dans « Connexions IA ». L’accès reste
                lié aux droits et à la durée de votre session.
              </p>
              <div className="admin-actions">
                <Button
                  loading={busy}
                  disabled={!scopes.includes("read")}
                  onClick={() => void decide(true)}
                >
                  Autoriser la connexion
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void decide(false)}
                >
                  Refuser
                </Button>
              </div>
            </>
          )}
          <a href="/admin/integrations/">Revenir aux connexions IA</a>
        </div>
      </section>
    </main>
  );
}
