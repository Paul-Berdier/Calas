import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import { ShieldCheck, ArrowLeft, LogOut, KeyRound, Mail } from "lucide-react";
import { authClient } from "./client";
import "./auth.css";
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
};
type AuthResult = {
  error?: { message?: string; code?: string } | null;
  data?: unknown;
};
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-app">
      <header className="auth-header">
        <a href="/" className="auth-brand">
          Calas <span>Conseil</span>
        </a>
        <a href="/">Voir le site public ↗</a>
      </header>
      {children}
    </div>
  );
}
function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <div
      role={error ? "alert" : "status"}
      className={`auth-status ${error ? "error" : ""}`}
    >
      {message}
    </div>
  ) : null;
}
const genericError = (result: AuthResult) =>
  result.error?.code === "TOO_MANY_REQUESTS"
    ? "Trop de tentatives. Patientez quelques minutes."
    : "La connexion n’a pas pu être vérifiée. Vérifiez votre saisie ou utilisez la récupération d’accès.";
export default function AuthScreens({
  mode,
  user,
}: {
  mode: "login" | "security" | "reset" | "invitation" | "users";
  user?: User;
}) {
  if (mode === "security" && user) return <Security user={user} />;
  if (mode === "users" && user) return <Users />;
  return (
    <Login mode={mode === "reset" || mode === "invitation" ? mode : "login"} />
  );
}
function Login({ mode }: { mode: "login" | "reset" | "invitation" }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [step, setStep] = useState<"password" | "mfa" | "backup" | "forgot">(
      "password",
    );
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") || "",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const [complete, setComplete] = useState(false);
  const formHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    formHeading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      if (mode === "invitation") {
        const response = await fetch("/api/invitations/accept/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message || "Invitation non valide.");
        setPassword("");
        setComplete(true);
        setMessage(
          "Votre compte est créé. Ouvrez l’email de vérification, puis connectez-vous pour activer la double authentification.",
        );
        return;
      }
      if (mode === "reset") {
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error)
          throw new Error(
            "Ce lien est expiré ou ne peut pas être vérifié. Demandez un nouveau lien.",
          );
        setPassword("");
        setComplete(true);
        setMessage(
          "Votre mot de passe a été modifié. Vous pouvez vous reconnecter.",
        );
        return;
      }
      if (step === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: new URL("/admin/reset-password/", window.location.origin)
            .href,
        });
        if (result.error)
          throw new Error(
            "La demande n’a pas pu être confirmée. Patientez quelques minutes, puis réessayez.",
          );
        setMessage(
          "Si un compte correspond à cette adresse, un lien de récupération a été envoyé.",
        );
        return;
      }
      if (step === "mfa" || step === "backup") {
        const result =
          step === "mfa"
            ? await authClient.twoFactor.verifyTotp({
                code,
                trustDevice: false,
              })
            : await authClient.twoFactor.verifyBackupCode({ code });
        if (result.error)
          throw new Error(
            "Ce code n’a pas pu être vérifié. Réessayez avec un code valide.",
          );
        window.location.assign("/admin/");
        return;
      }
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: false,
      });
      if (result.error) throw new Error(genericError(result));
      setPassword("");
      if (
        result.data &&
        "twoFactorRedirect" in result.data &&
        result.data.twoFactorRedirect
      ) {
        setStep("mfa");
        return;
      }
      window.location.assign("/admin/security/");
    } catch (reason) {
      setError(true);
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Connexion interrompue. Votre saisie est conservée.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "invitation"
      ? "Bienvenue dans votre espace"
      : mode === "reset"
        ? "Choisir un nouveau mot de passe"
        : step === "forgot"
          ? "Retrouver votre accès"
          : step === "mfa"
            ? "Vérifier votre identité"
            : step === "backup"
              ? "Utiliser un code de secours"
              : "Se connecter";
  return (
    <Shell>
      <main className="auth-layout">
        <section className="auth-intro">
          <p className="auth-eyebrow">Votre espace éditorial</p>
          <h1>
            Vos idées.
            <br />
            Votre voix.
            <br />
            Votre site.
          </h1>
          <p>
            Un espace pour faire vivre les contenus de Calas Conseil, à votre
            rythme.
          </p>
          <p>
            <ShieldCheck size={20} aria-hidden /> Accès privé, protégé par
            double authentification.
          </p>
        </section>
        <section className="auth-card">
          <h2 ref={formHeading} tabIndex={-1}>
            {title}
          </h2>
          <p>
            {step === "mfa"
              ? "Saisissez les six chiffres affichés dans votre application d’authentification."
              : step === "backup"
                ? "Chaque code de secours ne peut être utilisé qu’une fois."
                : "Retrouvez vos pages, vos articles et vos images."}
          </p>
          <form className="auth-form" onSubmit={submit}>
            {mode === "login" && (step === "password" || step === "forgot") && (
              <label>
                Adresse email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {(mode !== "login" || step === "password") && (
              <label>
                Mot de passe
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode !== "login" && (
                  <small>
                    Au moins 12 caractères. Choisissez un mot de passe unique.
                  </small>
                )}
              </label>
            )}
            {(step === "mfa" || step === "backup") && (
              <label>
                {step === "mfa" ? "Code à six chiffres" : "Code de secours"}
                <input
                  autoComplete="one-time-code"
                  inputMode={step === "mfa" ? "numeric" : "text"}
                  pattern={step === "mfa" ? "[0-9]{6}" : undefined}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={step === "mfa" ? 6 : 64}
                />
              </label>
            )}
            <button
              className="auth-button"
              disabled={busy || complete || (mode !== "login" && !token)}
            >
              {busy
                ? "Vérification…"
                : mode === "invitation"
                  ? "Créer mon compte"
                  : mode === "reset"
                    ? "Enregistrer le mot de passe"
                    : step === "forgot"
                      ? "Recevoir un lien"
                      : "Continuer"}
            </button>
            {mode === "login" && step === "password" && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setStep("forgot");
                  setMessage("");
                }}
              >
                Mot de passe oublié ?
              </button>
            )}
            {(step === "mfa" || step === "backup") && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setStep(step === "mfa" ? "backup" : "mfa");
                  setCode("");
                  setMessage("");
                }}
              >
                {step === "mfa"
                  ? "Utiliser un code de secours"
                  : "Utiliser mon application"}
              </button>
            )}
            {(step === "forgot" || mode !== "login") && (
              <a className="auth-link" href="/admin/login/">
                Retour à la connexion
              </a>
            )}
          </form>
          <Notice message={message} error={error} />
          {mode !== "login" && !token && (
            <Notice
              error
              message="Ce lien ne contient pas de code d’accès. Ouvrez le lien reçu par email ou demandez-en un nouveau."
            />
          )}
          <p className="auth-fine">
            Accès sur invitation. Pour toute difficulté, contactez la personne
            qui administre votre site.
          </p>
        </section>
      </main>
    </Shell>
  );
}
function Security({ user }: { user: User }) {
  const [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [code, setCode] = useState(""),
    [qr, setQr] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [enabled, setEnabled] = useState(user.twoFactorEnabled),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      token: string;
      createdAt: Date;
      userAgent?: string | null;
    }>
  >([]);
  async function execute(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      await work();
    } catch (reason) {
      setError(true);
      setMessage(
        reason instanceof Error
          ? reason.message
          : "L’opération a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refreshSessions() {
    const result = await authClient.listSessions();
    if (result.data) setSessions(result.data);
  }
  useEffect(() => {
    if (enabled) void refreshSessions();
  }, [enabled]);
  async function setup(event: FormEvent) {
    event.preventDefault();
    await execute(async () => {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error || !result.data)
        throw new Error("Le mot de passe n’a pas pu être vérifié.");
      if ("totpURI" in result.data)
        setQr(
          await QRCode.toDataURL(String(result.data.totpURI), {
            width: 240,
            margin: 2,
          }),
        );
      if ("backupCodes" in result.data)
        setCodes(result.data.backupCodes as string[]);
      setPassword("");
    });
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    await execute(async () => {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });
      if (result.error)
        throw new Error(
          "Code invalide. Vérifiez l’heure de votre appareil et réessayez.",
        );
      setEnabled(true);
      setQr("");
      setCode("");
      setMessage(
        "La double authentification est activée. Conservez vos codes de secours dans un endroit privé.",
      );
    });
  }
  return (
    <Shell>
      <main className="auth-workspace">
        <a href="/admin/" className="auth-link">
          <ArrowLeft size={14} aria-hidden /> Administration
        </a>
        <p className="auth-eyebrow">Compte et sécurité</p>
        <h1>Bonjour, {user.name}.</h1>
        <p>Votre accès personnel à Calas Conseil.</p>
        <Notice message={message} error={error} />
        <div className="auth-security-grid">
          <section className="auth-card">
            <h2>
              <ShieldCheck size={25} aria-hidden /> Double authentification
            </h2>
            <p>
              {enabled
                ? "Votre compte est protégé par un mot de passe et un code temporaire."
                : "Activez votre application d’authentification pour accéder à l’administration."}
            </p>
            {!enabled && !qr && (
              <form className="auth-form" onSubmit={setup}>
                <label>
                  Confirmez votre mot de passe
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
                <button className="auth-button" disabled={busy}>
                  Configurer mon application
                </button>
              </form>
            )}
            {qr && (
              <>
                <p>
                  Scannez ce QR code dans votre application d’authentification.
                </p>
                <img
                  className="auth-qr"
                  src={qr}
                  alt="QR code personnel à scanner avec votre application d’authentification"
                />
                <form className="auth-form" onSubmit={verify}>
                  <label>
                    Code à six chiffres
                    <input
                      required
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={6}
                    />
                  </label>
                  <button className="auth-button" disabled={busy}>
                    Activer la protection
                  </button>
                </form>
              </>
            )}
            {codes.length > 0 && (
              <>
                <h3>Codes de secours</h3>
                <p>
                  Copiez-les dans votre gestionnaire de mots de passe. Chacun
                  remplace un code temporaire une seule fois.
                </p>
                <div className="auth-backup">
                  {codes.map((value) => (
                    <code key={value}>{value}</code>
                  ))}
                </div>
                <div className="auth-actions">
                  <button
                    className="auth-button secondary"
                    onClick={() => {
                      const blob = new Blob([codes.join("\n")], {
                        type: "text/plain",
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "calas-codes-secours.txt";
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Enregistrer mes codes
                  </button>
                  <button
                    className="auth-button secondary"
                    onClick={() => setCodes([])}
                  >
                    J’ai conservé mes codes
                  </button>
                </div>
              </>
            )}
            {enabled && (
              <a className="auth-button" href="/admin/">
                Accéder à mes contenus
              </a>
            )}
          </section>
          {enabled && (
            <section className="auth-card">
              <h2>
                <KeyRound size={25} aria-hidden /> Mot de passe
              </h2>
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void execute(async () => {
                    const result = await authClient.changePassword({
                      currentPassword: password,
                      newPassword,
                      revokeOtherSessions: true,
                    });
                    if (result.error)
                      throw new Error(
                        "Le mot de passe n’a pas pu être modifié.",
                      );
                    setPassword("");
                    setNewPassword("");
                    setMessage(
                      "Mot de passe modifié. Les autres sessions ont été déconnectées.",
                    );
                    await refreshSessions();
                  });
                }}
              >
                <label>
                  Mot de passe actuel
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Nouveau mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
                <button className="auth-button" disabled={busy}>
                  Modifier mon mot de passe
                </button>
                <button
                  type="button"
                  className="auth-button secondary"
                  disabled={busy || !password}
                  onClick={() =>
                    void execute(async () => {
                      const result =
                        await authClient.twoFactor.generateBackupCodes({
                          password,
                        });
                      if (result.error || !result.data)
                        throw new Error(
                          "Le mot de passe n’a pas pu être vérifié.",
                        );
                      setCodes(result.data.backupCodes);
                      setPassword("");
                      setMessage(
                        "Nouveaux codes créés : les anciens codes de secours sont invalides.",
                      );
                    })
                  }
                >
                  Renouveler les codes de secours
                </button>
              </form>
            </section>
          )}
        </div>
        {enabled && (
          <section className="auth-card" style={{ marginTop: 24 }}>
            <h2>Sessions ouvertes</h2>
            <p>Fermez une session sur un appareil que vous n’utilisez plus.</p>
            {sessions.map((item) => (
              <div className="auth-session" key={item.id}>
                <span>
                  {item.userAgent?.slice(0, 150) || "Navigateur"}
                  <br />
                  <small>
                    Ouverte le{" "}
                    {new Date(item.createdAt).toLocaleString("fr-FR")}
                  </small>
                </span>
                <button
                  className="auth-button secondary"
                  disabled={busy}
                  onClick={() =>
                    void execute(async () => {
                      const result = await authClient.revokeSession({
                        token: item.token,
                      });
                      if (result.error)
                        throw new Error("La session n’a pas pu être fermée.");
                      await refreshSessions();
                      setMessage("Session fermée.");
                    })
                  }
                >
                  Fermer cette session
                </button>
              </div>
            ))}
          </section>
        )}
        <div className="auth-actions">
          <button
            className="auth-button secondary"
            onClick={() =>
              void execute(async () => {
                await authClient.signOut();
                window.location.assign("/admin/login/");
              })
            }
          >
            <LogOut size={17} aria-hidden /> Se déconnecter
          </button>
        </div>
      </main>
    </Shell>
  );
}
type Member = User & { disabled: boolean; emailVerified: boolean };
function Users() {
  const [users, setUsers] = useState<Member[]>([]),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"editor" | "administrator">("editor"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  async function load() {
    const response = await fetch("/api/admin/users/");
    if (!response.ok) throw new Error("La liste des comptes est indisponible.");
    setUsers((await response.json()).users);
  }
  useEffect(() => {
    void load().catch((reason) => {
      setError(true);
      setMessage(reason.message);
    });
  }, []);
  async function action(path: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(`/api/admin/users/${path}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Opération non confirmée.");
      setMessage(
        path === "invite"
          ? "Invitation envoyée. Le lien est valable 24 heures."
          : "Compte mis à jour. Ses sessions ont été révoquées.",
      );
      await load();
    } catch (reason) {
      setError(true);
      setMessage(
        reason instanceof Error ? reason.message : "Opération interrompue.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <main className="auth-workspace">
        <a href="/admin/" className="auth-link">
          ← Administration
        </a>
        <p className="auth-eyebrow">Accès et responsabilités</p>
        <h1>Les personnes autorisées.</h1>
        <p>
          Chaque personne utilise son propre compte et sa double
          authentification.
        </p>
        <Notice message={message} error={error} />
        <div className="auth-users-top">
          <section aria-label="Comptes existants">
            {users.map((person) => (
              <article className="auth-user" key={person.id}>
                <h2>{person.name}</h2>
                <p>{person.email}</p>
                <p>
                  {person.role === "administrator"
                    ? "Administrateur"
                    : "Éditeur"}{" "}
                  ·{" "}
                  {person.disabled
                    ? "Accès suspendu"
                    : person.twoFactorEnabled
                      ? "Double authentification active"
                      : "Activation en attente"}
                </p>
                <div className="auth-actions">
                  <button
                    className="auth-button secondary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${person.disabled ? "Réactiver" : "Suspendre"} l’accès de ${person.name} ?`,
                        )
                      )
                        void action(
                          `${person.id}/${person.disabled ? "enable" : "disable"}`,
                          {},
                        );
                    }}
                  >
                    {person.disabled ? "Réactiver" : "Suspendre"}
                  </button>
                  <button
                    className="auth-button secondary"
                    disabled={busy}
                    onClick={() => void action(`${person.id}/revoke`, {})}
                  >
                    Fermer les sessions
                  </button>
                  <button
                    className="auth-button secondary"
                    disabled={busy}
                    onClick={() => {
                      const next =
                        person.role === "administrator"
                          ? "editor"
                          : "administrator";
                      if (
                        window.confirm(
                          `Passer ${person.name} au rôle ${next === "editor" ? "éditeur" : "administrateur"} ?`,
                        )
                      )
                        void action(`${person.id}/role`, { role: next });
                    }}
                  >
                    Changer le rôle
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="auth-card">
            <h2>
              <Mail size={24} aria-hidden /> Inviter une personne
            </h2>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void action("invite", { name, email, role });
              }}
            >
              <label>
                Nom
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Rôle
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                >
                  <option value="editor">
                    Éditeur — contenus et publication
                  </option>
                  <option value="administrator">
                    Administrateur — contenus, accès et réglages
                  </option>
                </select>
              </label>
              <button className="auth-button" disabled={busy}>
                {busy ? "Envoi…" : "Envoyer l’invitation"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </Shell>
  );
}
