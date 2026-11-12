import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Copy,
  Download,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { formatDate, request } from "./api";
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
import { type ImportContact } from "./outreach-csv";
import { parseContactsFile, type ImportDefaults } from "./outreach-import";
import { CampaignMailPreview, DeliveryHistory, OutreachPagination, PreviewButton, ScheduleChooser, TemplateLibrary, useOutreachPage, type ScheduleChoice } from "./OutreachManagement";
import { formatParisSchedule, validateScheduledAt } from "./outreach-schedule";
import "./outreach.css";

interface Contact extends ImportContact {
  id: string;
  version: number;
  status: "active" | "responded" | "suppressed";
  lastResponseAt: string | null;
  createdAt: string;
}
interface Campaign {
  id: string;
  version: number;
  title: string;
  subject: string;
  body: string;
  targetPath: string;
  linkPath: string;
  status: "draft" | "active" | "paused";
  createdAt: string;
}
interface Overview {
  stats: {
    contacts: number;
    campaigns: number;
    queued: number;
    accepted: number;
    simulated: number;
    visits: number;
    arrivals: number;
    responded: number;
    suppressed: number;
    uncertain: number;
    failed: number;
  };
  transport: "simulation" | "local" | "smtp";
  maxBatch: number;
  targets: { path: string; title: string }[];
}
interface CampaignOverview {
  campaign: Campaign;
  stats: {
    queued: number;
    accepted: number;
    simulated: number;
    failed: number;
    uncertain: number;
    suppressed: number;
    total: number;
  };
  includedContactIds: string[];
  visits: { path: string; day: string; visits: number; arrivals: number }[];
}
type CampaignInput = Pick<
  Campaign,
  "title" | "subject" | "body" | "targetPath"
>;
const contactLabels: Record<Contact["status"], string> = {
  active: "À contacter",
  responded: "Réponse reçue",
  suppressed: "Opposition",
};
const emptyContact: ImportContact = {
  email: "",
  name: "",
  company: "",
  jobTitle: "",
  source: "",
  sourceDate: "",
  informationConfirmed: false,
};
const emptyCampaign: CampaignInput = {
  title: "",
  subject: "",
  body: "",
  targetPath: "/diagnostic-rps/",
};

export function Outreach({
  onDirtyChange,
}: {
  onDirtyChange: (value: boolean) => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"campaigns" | "contacts" | "history" | "templates">(() => {
    if (typeof window === "undefined") return "campaigns";
    const search = new URLSearchParams(window.location.search);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.get("campaign") ?? "")) return "campaigns";
    const requested = search.get("tab");
    return requested === "contacts" || requested === "history" || requested === "templates" ? requested : "campaigns";
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [contactPage, setContactPage] = useState(0);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientPage, setRecipientPage] = useState(0);
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("campaign");
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  });
  const [campaignError, setCampaignError] = useState("");
  const [campaignOverview, setCampaignOverview] =
    useState<CampaignOverview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | "new" | null>(
    null,
  );
  const [contactInput, setContactInput] = useState<ImportContact>(emptyContact);
  const [editingCampaign, setEditingCampaign] = useState<
    Campaign | "new" | null
  >(null);
  const [campaignInput, setCampaignInput] =
    useState<CampaignInput>(emptyCampaign);
  const [duplicatingCampaign, setDuplicatingCampaign] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleChoice>({enabled:false,scheduledAt:null,error:''});
  const [contactAction, setContactAction] = useState<{
    contact: Contact;
    action: "suppress" | "responded" | "delete";
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState<{
    contacts: ImportContact[];
    duplicates: number;
  } | null>(null);
  const [imported, setImported] = useState(0);
  const [fileError, setFileError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDefaults, setImportDefaults] = useState<ImportDefaults>({
    company: "",
    source: "",
    sourceDate: "",
    informationConfirmed: false,
  });

  const reload = useCallback(async () => {
    try {
      const result = await request<Overview>("/api/admin/outreach/overview/?summary=true");
      setData(result);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (
      !data?.stats.queued
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden) void reload();
    }, 12_000);
    return () => clearInterval(timer);
  }, [data, reload]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    setSchedule({enabled:false,scheduledAt:null,error:''});
    setPreviewOpen(false); setConfirmSend(false); setPreviewReady(false);
  }, [campaignId]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (campaignId && tab === "campaigns") url.searchParams.set("campaign", campaignId);
    else url.searchParams.delete("campaign");
    if (tab === "campaigns") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }, [campaignId, tab]);
  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setCampaignError("");
    request<CampaignOverview>(
      `/api/admin/outreach/campaigns/${campaignId}/overview/`,
    )
      .then((result) => {
        if (active) setCampaignOverview(result);
      })
      .catch((cause) => {
        if (active) setCampaignError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [campaignId, data]);

  const campaign =
    campaignOverview?.campaign.id === campaignId
      ? campaignOverview.campaign
      : undefined;
  const contactsList = useOutreachPage<Contact>(tab === "contacts" ? "/api/admin/outreach/contacts/?" + new URLSearchParams({q:query,offset:String(contactPage*100),limit:"100"}) : null, data);
  const recipientsList = useOutreachPage<Contact>(tab === "campaigns" && campaignId ? "/api/admin/outreach/contacts/?" + new URLSearchParams({q:recipientQuery,campaignId,eligibleOnly:"true",offset:String(recipientPage*100),limit:"100"}) : null, data);
  const campaignsList = useOutreachPage<Campaign>(tab === "campaigns" && !campaignId ? "/api/admin/outreach/campaigns/?" + new URLSearchParams({q:campaignQuery,offset:String(campaignPage*25),limit:"25"}) : null, data);
  const matchingContacts = contactsList.data?.items ?? [];
  // Selection spans pages. Eligibility is checked again transactionally by the server.
  const selectedEligible = selected;
  const selectedIds = new Set(selectedEligible);
  const matchingAvailable = recipientsList.data?.items ?? [];
  const campaignVisits = campaign ? (campaignOverview?.visits ?? []) : [];

  function closeContact() {
    setEditingContact(null);
    onDirtyChange(false);
  }
  function closeCampaign() {
    setEditingCampaign(null);
    setDuplicatingCampaign(false);
    onDirtyChange(false);
  }
  function startContact(contact: Contact | "new") {
    setError("");
    setEditingContact(contact);
    setContactInput(
      contact === "new"
        ? emptyContact
        : {
            email: contact.email,
            name: contact.name,
            company: contact.company,
            jobTitle: contact.jobTitle,
            source: contact.source,
            sourceDate: contact.sourceDate.slice(0, 10),
            informationConfirmed: contact.informationConfirmed,
          },
    );
  }
  function startCampaign(value: Campaign | "new", duplicate = false) {
    setError("");
    setDuplicatingCampaign(duplicate);
    setEditingCampaign(duplicate ? "new" : value);
    setCampaignInput(
      value === "new"
        ? {
            ...emptyCampaign,
            targetPath: data?.targets.some(
              (item) => item.path === emptyCampaign.targetPath,
            )
              ? emptyCampaign.targetPath
              : (data?.targets[0]?.path ?? ""),
          }
        : {
            title: duplicate ? `${value.title.slice(0, 112)} — copie` : value.title,
            subject: value.subject,
            body: value.body,
            targetPath: value.targetPath,
          },
    );
    if (duplicate) onDirtyChange(true);
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContact) return;
    setBusy(true);
    setError("");
    try {
      const existing = editingContact === "new" ? null : editingContact;
      await request(
        `/api/admin/outreach/contacts/${existing ? `${existing.id}/` : ""}`,
        {
          method: existing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...contactInput,
            ...(existing ? { version: existing.version } : {}),
          }),
        },
      );
      closeContact();
      setNotice("Contact enregistré.");
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCampaign) return;
    setBusy(true);
    setError("");
    try {
      const existing = editingCampaign === "new" ? null : editingCampaign;
      const saved = await request<Campaign>(
        `/api/admin/outreach/campaigns/${existing ? `${existing.id}/` : ""}`,
        {
          method: existing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...campaignInput,
            ...(existing ? { version: existing.version } : {}),
          }),
        },
      );
      if (!existing) {
        setCampaignId(saved.id);
        setCampaignOverview(null);
        setSelected([]);
        setRecipientQuery("");
        setRecipientPage(0);
      }
      closeCampaign();
      setNotice(
        duplicatingCampaign
          ? "Copie enregistrée en brouillon. Choisissez les destinataires puis confirmez l’envoi séparément."
          : "Campagne enregistrée.",
      );
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendCampaign() {
    if (!campaign || !selectedEligible.length || !previewReady) return;
    const scheduleError = schedule.enabled
      ? schedule.error || (schedule.scheduledAt ? validateScheduledAt(schedule.scheduledAt) : "Renseignez la date et l’heure de début.")
      : "";
    if (scheduleError) { setError(scheduleError); setConfirmSend(false); return; }
    setBusy(true);
    setError("");
    try {
      const result = await request<{
        queued: number;
        skipped: number;
        simulation: boolean;
        scheduledAt: string|null;
      }>(`/api/admin/outreach/campaigns/${campaign.id}/send/`, {
        method: "POST",
        body: JSON.stringify({
          version: campaign.version,
          contactIds: selectedEligible,
          confirmation: true,
          ...(schedule.scheduledAt ? { scheduledAt: schedule.scheduledAt } : {}),
        }),
      });
      setConfirmSend(false);
      setSelected([]);
      setNotice(
        `${result.queued} message(s) mis en file ${result.simulation ? "de simulation" : "d’envoi"}.${result.scheduledAt ? ` Début prévu le ${formatParisSchedule(result.scheduledAt)}.` : ""} ${result.skipped} contact(s) exclu(s) ou déjà présent(s).`,
      );
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
      setConfirmSend(false);
    } finally {
      setBusy(false);
    }
  }
  async function applyContactAction() {
    if (!contactAction) return;
    setBusy(true);
    setError("");
    try {
      const removing = contactAction.action === "delete";
      await request(
        `/api/admin/outreach/contacts/${contactAction.contact.id}/${removing ? "" : `${contactAction.action}/`}`,
        { method: removing ? "DELETE" : "POST", body: "{}" },
      );
      setContactAction(null);
      setNotice(
        removing
          ? "Coordonnées effacées. L’adresse restera exclue des prochains envois, même après un réimport."
          : "Le contact est exclu des prochains envois.",
      );
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function togglePause() {
    if (!campaign) return;
    setBusy(true);
    setError("");
    try {
      const paused = campaign.status !== "paused";
      await request(`/api/admin/outreach/campaigns/${campaign.id}/pause/`, {
        method: "POST",
        body: JSON.stringify({ version: campaign.version, paused }),
      });
      setNotice(
        paused
          ? "Campagne en pause. Un message déjà en cours peut encore être remis."
          : "Campagne reprise. La file reprendra au prochain passage du serveur.",
      );
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    if (!campaign?.linkPath) return;
    try {
      await navigator.clipboard.writeText(
        new URL(campaign.linkPath, window.location.origin).href,
      );
      setNotice("Lien de campagne copié.");
    } catch {
      setError(
        "La copie automatique est indisponible. Sélectionnez le lien affiché pour le copier.",
      );
    }
  }
  async function readImport() {
    setCsv(null);
    setImported(0);
    setFileError("");
    if (!importFile) return;
    setBusy(true);
    try {
      setCsv(await parseContactsFile(importFile, importDefaults));
      onDirtyChange(true);
    } catch (cause) {
      setFileError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importCsv() {
    if (!csv) return;
    setBusy(true);
    setFileError("");
    let completed = imported;
    try {
      while (completed < csv.contacts.length) {
        const batch = csv.contacts.slice(completed, completed + 200);
        await request("/api/admin/outreach/contacts/import/", {
          method: "POST",
          body: JSON.stringify({ contacts: batch }),
        });
        completed += batch.length;
        setImported(completed);
      }
      setNotice(
        `${completed} contact(s) traité(s). Les oppositions et les réponses déjà enregistrées sont conservées.`,
      );
      setImporting(false);
      setCsv(null);
      onDirtyChange(false);
      await reload();
    } catch (cause) {
      setFileError(
        `${completed} contact(s) traité(s). ${(cause as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  function downloadTemplate() {
    const blob = new Blob(
      [
        "\uFEFFemail;name;company;jobTitle;source;sourceDate;informationConfirmed\r\n",
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele-contacts-calas.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="outreach-space">
      <SectionHeading
        title="Prospection"
        description="Préparez vos messages et suivez les résultats de chaque campagne."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setImporting(true);
                setCsv(null);
                setFileError("");
                setImported(0);
                setImportFile(null);
                setImportDefaults({ company: "", source: "", sourceDate: "", informationConfirmed: false });
              }}
            >
              <Upload size={16} aria-hidden />
              Importer des contacts
            </Button>
            <Button
              onClick={() =>
                tab === "contacts" ? startContact("new") : startCampaign("new")
              }
            >
              <Plus size={16} aria-hidden />
              {tab === "contacts" ? "Ajouter un contact" : "Créer une campagne"}
            </Button>
          </>
        }
      />
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {campaignError && campaign && (
        <p className="admin-error" role="alert">
          {campaignError}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        error ? (
          <Button variant="secondary" onClick={() => void reload()}>
            Réessayer le chargement
          </Button>
        ) : (
          <Loading label="Chargement de la prospection…" />
        )
      ) : (
        <>
          <div className="outreach-metrics">
            {[
              [data.stats.contacts, "Contacts"],
              [data.stats.accepted, "Messages acceptés par le serveur mail"],
              [data.stats.arrivals, "Arrivées depuis le lien"],
              [data.stats.visits, "Consultations attribuées"],
              [data.stats.responded, "Réponses signalées"],
              [data.stats.suppressed, "Adresses exclues"],
            ].map(([value, label]) => (
              <div className="outreach-metric" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="admin-hint">
            Une même personne peut arriver plusieurs fois et consulter plusieurs
            pages. Ces chiffres ne représentent pas des personnes distinctes.
            Les consultations sans JavaScript ne sont pas comptées. Un e-mail
            accepté par le serveur n’est pas une confirmation de lecture.
          </p>
          <div className="outreach-warning" role="status">
            {data.transport === "smtp"
              ? "Envoi réel configuré. Les nouveaux envois confirmés seront traités progressivement par le serveur. Les anciens essais simulés ne sont pas renvoyés : dupliquez leur campagne pour préparer un nouvel envoi."
              : data.transport === "local"
                ? "Recette locale. Les messages sont remis à la boîte de test configurée."
                : "Mode simulation. Aucun e-mail n’est envoyé. L’activation ultérieure de l’envoi réel ne renverra pas ces essais : il faudra dupliquer la campagne et confirmer de nouveaux destinataires."}{" "}
            {data.stats.queued} message(s) en file · {data.stats.simulated}{" "}
            simulation(s).
          </div>
          {(data.stats.uncertain > 0 || data.stats.failed > 0) && (
            <p className="admin-error" role="alert">
              {data.stats.uncertain} envoi(s) à vérifier auprès de la messagerie
              et {data.stats.failed} échec(s). Consultez les destinataires des
              campagnes concernées avant une nouvelle action.
            </p>
          )}
          <div className="outreach-tabs" aria-label="Rubriques de prospection">
            <Button
              variant="secondary"
              aria-pressed={tab === "campaigns"}
              onClick={() => setTab("campaigns")}
            >
              Campagnes
            </Button>
            <Button
              variant="secondary"
              aria-pressed={tab === "contacts"}
              onClick={() => setTab("contacts")}
            >
              Contacts
            </Button>
            <Button variant="secondary" aria-pressed={tab === "history"} onClick={() => setTab("history")}>Historique des envois</Button>
            <Button variant="secondary" aria-pressed={tab === "templates"} onClick={() => setTab("templates")}>Modèles de messages</Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Actualiser la prospection"
              onClick={() => void reload()}
            >
              <RefreshCw size={17} />
            </Button>
          </div>
          {tab === "history" ? <DeliveryHistory refresh={data}/> : tab === "templates" ? <TemplateLibrary targets={data.targets} onDirtyChange={onDirtyChange} onUse={input => {
            setTab("campaigns"); setEditingCampaign("new"); setDuplicatingCampaign(false); setCampaignInput(input); setError(""); onDirtyChange(true);
            setNotice("Modèle repris dans un nouveau brouillon. Relisez le message et choisissez une page publiée avant d’enregistrer.");
          }}/> : tab === "contacts" ? (
            <>
              <Field label="Rechercher un contact" className="outreach-filter">
                {(id) => (
                  <div className="outreach-search">
                    <Search size={16} aria-hidden />
                    <input
                      id={id}
                      className="admin-input"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setContactPage(0);
                      }}
                      placeholder="Nom, entreprise ou e-mail"
                    />
                  </div>
                )}
              </Field>
              <section className="admin-card">
                {contactsList.error ? <div className="admin-card-body admin-error" role="alert"><p>{contactsList.error}</p><Button variant="secondary" onClick={contactsList.retry}>Réessayer les contacts</Button></div> : contactsList.loading ? <Loading label="Chargement des contacts…"/> : matchingContacts.length ? (
                  <div className="outreach-list">
                    {matchingContacts.map((contact) => (
                        <article key={contact.id} className="outreach-list-row">
                          <div className="outreach-grow">
                            <h3>{contact.name || contact.email}</h3>
                            <p>
                              {[contact.company, contact.jobTitle]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <small>{contact.email}</small>
                          </div>
                          <Badge
                            status={
                              contact.status === "active" ? "draft" : "archived"
                            }
                          >
                            {contactLabels[contact.status]}
                          </Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startContact(contact)}
                          >
                            Modifier
                          </Button>
                          {contact.status === "active" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setContactAction({
                                    contact,
                                    action: "responded",
                                  })
                                }
                              >
                                Réponse reçue
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setContactAction({
                                    contact,
                                    action: "suppress",
                                  })
                                }
                              >
                                Opposition
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setContactAction({ contact, action: "delete" })
                            }
                          >
                            Effacer
                          </Button>
                        </article>
                      ))}
                  </div>
                ) : (
                  <EmptyState
                    title={
                      query ? "Aucun contact trouvé" : "Vos premiers contacts"
                    }
                    description="Ajoutez les coordonnées professionnelles et leur provenance, ou importez votre liste CSV."
                  />
                )}
              </section>
              <OutreachPagination data={contactsList.data} offset={contactPage*100} onOffset={offset=>setContactPage(offset/100)} label="Pagination des contacts" disabled={contactsList.loading}/>
            </>
          ) : campaignId && !campaign ? (
            campaignError ? (
              <section className="admin-card admin-card-body">
                <p className="admin-error" role="alert">{campaignError}</p>
                <Button variant="secondary" onClick={() => {
                  setCampaignId(null);
                  setSelected([]);
                }}>Revenir aux campagnes</Button>
              </section>
            ) : <Loading label="Chargement de la campagne…" />
          ) : campaign ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setCampaignId(null);
                  setSelected([]);
                }}
              >
                ← Toutes les campagnes
              </Button>
              <div className="outreach-metrics">
                {[
                  [
                    campaignOverview?.stats.total ?? 0,
                    "Destinataires de cette campagne",
                  ],
                  [
                    campaignOverview?.stats.accepted ?? 0,
                    "Messages acceptés par le serveur mail",
                  ],
                  [
                    campaignOverview?.stats.queued ?? 0,
                    "Messages en file ou en cours",
                  ],
                  [campaignOverview?.stats.simulated ?? 0, "Messages simulés"],
                  [
                    campaignVisits.reduce(
                      (sum, item) => sum + item.arrivals,
                      0,
                    ),
                    "Arrivées depuis le lien",
                  ],
                  [
                    campaignVisits.reduce((sum, item) => sum + item.visits, 0),
                    "Consultations attribuées",
                  ],
                ].map(([value, label]) => (
                  <div className="outreach-metric" key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="admin-hint">
                Statistiques de cette campagne :{" "}
                {campaignOverview?.stats.failed ?? 0} échec(s),{" "}
                {campaignOverview?.stats.uncertain ?? 0} envoi(s) à vérifier et{" "}
                {campaignOverview?.stats.suppressed ?? 0} envoi(s) exclu(s).
              </p>
              {campaign.status === "paused" && (
                <p className="outreach-warning">
                  Campagne en pause : la file d’envoi est suspendue. Un message
                  déjà en cours peut encore être remis.
                </p>
              )}
              <section className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h2>{campaign.title}</h2>
                    <p>{campaign.subject}</p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => startCampaign(campaign, true)}
                  >
                    <Copy size={16} aria-hidden />
                    Dupliquer la campagne
                  </Button>
                  {campaign.status === "draft" && (
                    <Button
                      variant="secondary"
                      onClick={() => startCampaign(campaign)}
                    >
                      Modifier le message
                    </Button>
                  )}
                  {campaign.status !== "draft" && (
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() => void togglePause()}
                    >
                      {campaign.status === "paused"
                        ? "Reprendre les envois"
                        : "Mettre en pause"}
                    </Button>
                  )}
                </div>
                <div className="admin-card-body outreach-stack">
                  <div className="outreach-message">{campaign.body}</div>
                  <PreviewButton onClick={() => setPreviewOpen(true)}/>
                  <p className="admin-hint">
                    La page proposée est{" "}
                    <a
                      href={campaign.targetPath}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {campaign.targetPath}
                    </a>
                    . Le message comportera le lien de campagne et la
                    désinscription personnelle.
                  </p>
                  {campaign.linkPath && (
                    <>
                      <Field label="Lien de cette campagne">
                        {(id) => (
                          <input
                            id={id}
                            readOnly
                            className="admin-input"
                            value={
                              typeof window === "undefined"
                                ? campaign.linkPath
                                : new URL(
                                    campaign.linkPath,
                                    window.location.origin,
                                  ).href
                            }
                            onFocus={(event) => event.target.select()}
                          />
                        )}
                      </Field>
                      <Button
                        variant="secondary"
                        onClick={() => void copyLink()}
                      >
                        <Copy size={16} aria-hidden />
                        Copier le lien
                      </Button>
                    </>
                  )}
                </div>
              </section>
              <section className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h2>Choisir les destinataires</h2>
                    <p>
                      {selectedEligible.length} sélectionné(s), jusqu’à{" "}
                      {data.maxBatch} par mise en file.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={recipientsList.loading || !matchingAvailable.length || selectedEligible.length >= data.maxBatch}
                    onClick={() => setSelected(values => [...new Set([...values, ...matchingAvailable.map(contact => contact.id)])].slice(0,data.maxBatch))}
                  >
                    Sélectionner cette page
                  </Button>
                  {selectedEligible.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Tout désélectionner</Button>}
                </div>
                <div className="admin-card-body outreach-stack">
                  <Field label="Rechercher parmi les destinataires disponibles">
                    {(id) => (
                      <input
                        id={id}
                        className="admin-input"
                        value={recipientQuery}
                        onChange={(event) => {
                          setRecipientQuery(event.target.value);
                          setRecipientPage(0);
                        }}
                        placeholder="Entreprise, fonction, nom ou e-mail"
                      />
                    )}
                  </Field>
                  {recipientsList.error ? <div className="admin-error" role="alert"><p>{recipientsList.error}</p><Button variant="secondary" onClick={recipientsList.retry}>Réessayer les destinataires</Button></div> : recipientsList.loading ? <Loading label="Chargement des destinataires…"/> : matchingAvailable.length ? (
                    <div className="outreach-selection">
                      {matchingAvailable.map((contact) => (
                          <label className="outreach-check" key={contact.id}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(contact.id)}
                              disabled={
                                !selectedIds.has(contact.id) &&
                                selectedEligible.length >= data.maxBatch
                              }
                              onChange={(event) =>
                                setSelected((values) =>
                                  event.target.checked
                                    ? [...values, contact.id]
                                    : values.filter(
                                        (value) => value !== contact.id,
                                      ),
                                )
                              }
                            />
                            <span>
                              <strong>
                                {contact.company ||
                                  contact.name ||
                                  contact.email}
                              </strong>
                              <br />
                              {contact.email}
                            </span>
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="outreach-muted">
                      Tous les contacts disponibles ont déjà été sélectionnés
                      pour cette campagne, ou ont répondu ou demandé leur
                      retrait.
                    </p>
                  )}
                  <OutreachPagination data={recipientsList.data} offset={recipientPage*100} onOffset={offset=>setRecipientPage(offset/100)} label="Pagination des destinataires" disabled={recipientsList.loading}/>
                  <ScheduleChooser key={campaign.id} onChange={setSchedule}/>
                  <Button
                    disabled={
                      !selectedEligible.length ||
                      busy ||
                      campaign.status === "paused" || Boolean(schedule.error)
                    }
                    onClick={() => {setPreviewReady(false);setConfirmSend(true);}}
                  >
                    <Mail size={16} aria-hidden />
                    {data.transport === "simulation"
                      ? "Vérifier la simulation"
                      : "Relire et mettre en file"}
                  </Button>
                </div>
              </section>
              <DeliveryHistory campaignId={campaign.id} refresh={data}/>
              {campaignVisits.length > 0 && (
                <section className="admin-card">
                  <div className="admin-card-header">
                    <div>
                      <h2>Pages consultées</h2>
                      <p>
                        Comptage par page et par jour, sans identification des
                        visiteurs.
                      </p>
                    </div>
                  </div>
                  <div className="outreach-list">
                    {campaignVisits.slice(0, 100).map((visit) => (
                      <div
                        className="outreach-list-row"
                        key={`${visit.day}-${visit.path}`}
                      >
                        <div className="outreach-grow">
                          <h3>{visit.path}</h3>
                          <small>{formatDate(visit.day)}</small>
                        </div>
                        <span>
                          {visit.arrivals} arrivée(s) · {visit.visits}{" "}
                          consultation(s)
                        </span>
                      </div>
                    ))}
                  </div>
                  {campaignVisits.length > 100 && (
                    <p className="admin-card-body admin-hint">
                      Les 100 lignes les plus récentes sont affichées. Les
                      totaux comprennent tout l’historique.
                    </p>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
            <Field label="Rechercher une campagne">{id => <input id={id} className="admin-input" maxLength={100} value={campaignQuery} onChange={event => {setCampaignQuery(event.target.value);setCampaignPage(0);}} placeholder="Nom ou objet du message"/>}</Field>
            <section className="admin-card">
              {campaignsList.error ? <div className="admin-card-body admin-error" role="alert"><p>{campaignsList.error}</p><Button variant="secondary" onClick={campaignsList.retry}>Réessayer les campagnes</Button></div> : campaignsList.loading ? <Loading label="Chargement des campagnes…"/> : campaignsList.data?.items.length ? (
                <div className="outreach-list">
                  {campaignsList.data.items.map((item) => (
                    <article className="outreach-list-row" key={item.id}>
                      <div className="outreach-grow">
                        <h3>{item.title}</h3>
                        <p>{item.subject}</p>
                        <small>{formatDate(item.createdAt)}</small>
                      </div>
                      <Badge
                        status={item.status === "draft" ? "draft" : "published"}
                      >
                        {item.status === "draft"
                          ? "Brouillon"
                          : item.status === "paused"
                            ? "En pause"
                            : "En cours"}
                      </Badge>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCampaignId(item.id);
                          setSelected([]);
                        }}
                      >
                        Ouvrir
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={campaignQuery ? "Aucune campagne trouvée" : "Préparer votre première campagne"}
                  description="Rédigez un message, choisissez la page du site à présenter, puis sélectionnez les contacts professionnels concernés."
                  action={
                    <Button onClick={() => startCampaign("new")}>
                      Créer une campagne
                    </Button>
                  }
                />
              )}
            </section>
            <OutreachPagination data={campaignsList.data} offset={campaignPage*25} onOffset={offset=>setCampaignPage(offset/25)} label="Pagination des campagnes" disabled={campaignsList.loading}/>
            </>
          )}
        </>
      )}
      <Modal
        open={Boolean(editingContact)}
        onOpenChange={(open) => {
          if (!open && !busy) closeContact();
        }}
        title={
          editingContact === "new"
            ? "Ajouter un contact professionnel"
            : "Modifier le contact"
        }
        wide
      >
        <form
          className="outreach-stack"
          onSubmit={(event) => void saveContact(event)}
          onChange={() => onDirtyChange(true)}
        >
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="outreach-grid">
            {(
              [
                {
                  key: "email",
                  label: "E-mail professionnel",
                  required: true,
                  type: "email",
                },
                { key: "name", label: "Nom du contact" },
                { key: "company", label: "Entreprise", required: true },
                { key: "jobTitle", label: "Fonction" },
                {
                  key: "source",
                  label: "Provenance des coordonnées",
                  required: true,
                },
                {
                  key: "sourceDate",
                  label: "Date de collecte",
                  required: true,
                  type: "date",
                },
              ] as const
            ).map((field) => (
              <Field
                key={field.key}
                label={field.label}
                required={"required" in field && field.required}
              >
                {(id) => (
                  <input
                    id={id}
                    className="admin-input"
                    required={"required" in field && field.required}
                    type={"type" in field ? field.type : "text"}
                    maxLength={
                      field.key === "source"
                        ? 500
                        : field.key === "name"
                          ? 120
                          : field.key === "email"
                            ? 254
                            : 160
                    }
                    readOnly={field.key === "email" && editingContact !== "new"}
                    max={
                      field.key === "sourceDate"
                        ? new Date().toISOString().slice(0, 10)
                        : undefined
                    }
                    value={contactInput[field.key]}
                    onChange={(event) =>
                      setContactInput((values) => ({
                        ...values,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
          <label className="outreach-check">
            <input
              type="checkbox"
              required
              checked={contactInput.informationConfirmed}
              onChange={(event) =>
                setContactInput((values) => ({
                  ...values,
                  informationConfirmed: event.target.checked,
                }))
              }
            />
            <span>
              La personne est informée de l’utilisation de ses coordonnées pour
              une prospection en rapport avec sa fonction professionnelle et
              peut s’y opposer.
            </span>
          </label>
          <div className="admin-actions">
            <Button type="submit" loading={busy}>
              Enregistrer le contact
            </Button>
            <Button variant="secondary" disabled={busy} onClick={closeContact}>
              Annuler
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(editingCampaign)}
        onOpenChange={(open) => {
          if (!open && !busy) closeCampaign();
        }}
        title={
          editingCampaign === "new"
            ? "Créer une campagne"
            : "Modifier la campagne"
        }
        wide
      >
        <form
          className="outreach-stack"
          onSubmit={(event) => void saveCampaign(event)}
          onChange={() => onDirtyChange(true)}
        >
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          {duplicatingCampaign && (
            <p className="admin-hint">
              Seuls le nom, l’objet, le message et la page proposée sont copiés.
              Les destinataires, les envois et les statistiques restent dans
              l’ancienne campagne. Enregistrer crée un brouillon avec un nouveau
              lien, sans envoyer d’e-mail.
            </p>
          )}
          <Field label="Nom interne" required>
            {(id) => (
              <input
                id={id}
                required
                className="admin-input"
                minLength={3}
                maxLength={120}
                value={campaignInput.title}
                onChange={(event) =>
                  setCampaignInput((values) => ({
                    ...values,
                    title: event.target.value,
                  }))
                }
                placeholder="Ex. Diagnostic — entreprises de Charente"
              />
            )}
          </Field>
          <Field label="Objet de l’e-mail" required>
            {(id) => (
              <input
                id={id}
                required
                className="admin-input"
                minLength={3}
                maxLength={180}
                value={campaignInput.subject}
                onChange={(event) =>
                  setCampaignInput((values) => ({
                    ...values,
                    subject: event.target.value,
                  }))
                }
              />
            )}
          </Field>
          <Field
            label="Message"
            required
            hint="Le lien de campagne, l’identité du cabinet et la désinscription seront ajoutés par le serveur."
          >
            {(id) => (
              <textarea
                id={id}
                required
                className="admin-textarea"
                rows={9}
                minLength={10}
                maxLength={15000}
                value={campaignInput.body}
                onChange={(event) =>
                  setCampaignInput((values) => ({
                    ...values,
                    body: event.target.value,
                  }))
                }
              />
            )}
          </Field>
          <Field label="Page du site proposée" required>
            {(id) => (
              <select
                id={id}
                required
                className="admin-input"
                value={campaignInput.targetPath}
                onChange={(event) =>
                  setCampaignInput((values) => ({
                    ...values,
                    targetPath: event.target.value,
                  }))
                }
              >
                <option value="">Choisir une page publiée</option>
                {data?.targets.map((target) => (
                  <option value={target.path} key={target.path}>
                    {target.title} ({target.path})
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="admin-actions">
            <Button type="submit" loading={busy}>
              Enregistrer le brouillon
            </Button>
            <Button variant="secondary" disabled={busy} onClick={closeCampaign}>
              Annuler
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={importing}
        onOpenChange={(open) => {
          if (!busy) {
            setImporting(open);
            if (!open) onDirtyChange(false);
          }
        }}
        title="Importer des contacts professionnels"
        wide
      >
        <div className="outreach-stack">
          <p>
            Choisissez un fichier Excel (.xlsx, première feuille), CSV UTF-8 ou
            TXT avec une adresse e-mail par ligne. Les adresses en double sont
            regroupées et les oppositions existantes sont conservées.
          </p>
          <p className="admin-hint">
            Pour Excel et CSV : colonnes email, nom, entreprise, fonction,
            source, date de collecte et informationConfirmée (true après
            information du contact). Les titres anglais du modèle conviennent
            aussi. Une adresse déjà connue n’est pas modifiée.
          </p>
          <Button variant="secondary" onClick={downloadTemplate}>
            <Download size={16} aria-hidden />
            Télécharger le modèle CSV
          </Button>
          <Field
            label="Fichier de contacts"
            hint="5 000 contacts et 5 Mo au maximum par fichier."
          >
            {(id) => (
              <input
                id={id}
                type="file"
                accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
                disabled={busy}
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setCsv(null);
                  setImported(0);
                  setFileError("");
                }}
              />
            )}
          </Field>
          <fieldset
            className="outreach-fieldset"
            disabled={busy}
            onChange={() => {
              setCsv(null);
              setImported(0);
            }}
          >
            <legend>Compléter les informations absentes du fichier</legend>
            <p className="admin-hint">
              Ces valeurs ne remplacent pas celles déjà présentes. Pour un TXT,
              renseignez l’entreprise commune, la provenance et la date ; si
              chaque adresse concerne une entreprise différente, utilisez les
              colonnes Excel ou CSV.
            </p>
            <div className="outreach-grid">
              <Field label="Entreprise commune">
                {(id) => (
                  <input
                    id={id}
                    className="admin-input"
                    maxLength={160}
                    value={importDefaults.company}
                    onChange={(event) =>
                      setImportDefaults((values) => ({
                        ...values,
                        company: event.target.value,
                      }))
                    }
                  />
                )}
              </Field>
              <Field label="Provenance de la liste">
                {(id) => (
                  <input
                    id={id}
                    className="admin-input"
                    maxLength={500}
                    value={importDefaults.source}
                    onChange={(event) =>
                      setImportDefaults((values) => ({
                        ...values,
                        source: event.target.value,
                      }))
                    }
                    placeholder="Source vérifiée des coordonnées"
                  />
                )}
              </Field>
              <Field label="Date de collecte commune">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    className="admin-input"
                    max={new Date().toISOString().slice(0, 10)}
                    value={importDefaults.sourceDate}
                    onChange={(event) =>
                      setImportDefaults((values) => ({
                        ...values,
                        sourceDate: event.target.value,
                      }))
                    }
                  />
                )}
              </Field>
            </div>
            <label className="outreach-check">
              <input
                type="checkbox"
                checked={importDefaults.informationConfirmed}
                onChange={(event) =>
                  setImportDefaults((values) => ({
                    ...values,
                    informationConfirmed: event.target.checked,
                  }))
                }
              />
              <span>
                Les personnes ont été informées de cet usage professionnel et
                peuvent s’y opposer. J’ai vérifié la provenance et la pertinence
                de la liste, y compris si elle a été préparée avec une IA.
              </span>
            </label>
          </fieldset>
          <Button
            variant="secondary"
            disabled={!importFile || busy}
            loading={busy && !csv}
            onClick={() => void readImport()}
          >
            Analyser le fichier
          </Button>
          {fileError && (
            <p className="admin-error" role="alert">
              {fileError}
            </p>
          )}
          {csv && (
            <>
              <p role="status">
                {csv.contacts.length} contact(s) à vérifier · {csv.duplicates}{" "}
                doublon(s) retiré(s).
              </p>
              <div className="outreach-selection">
                {csv.contacts.slice(0, 8).map((contact) => (
                  <div key={contact.email}>
                    <strong>
                      {contact.company || contact.name || contact.email}
                    </strong>
                    <p>
                      {contact.email} · {contact.source} · {contact.sourceDate}
                    </p>
                  </div>
                ))}
              </div>
              {csv.contacts.length > 8 && (
                <p className="admin-hint">Aperçu des huit premiers contacts.</p>
              )}
              <p className="admin-hint">
                Les informations et la date de provenance sont enregistrées pour
                chaque contact.
              </p>
              <Button onClick={() => void importCsv()} loading={busy}>
                {busy
                  ? `${imported} / ${csv.contacts.length} traité(s)`
                  : imported
                    ? "Reprendre l’import"
                    : "Confirmer l’import"}
              </Button>
            </>
          )}
        </div>
      </Modal>
      <Modal open={previewOpen && Boolean(campaign)} onOpenChange={setPreviewOpen} title="Aperçu du mail final" wide>
        {campaign && <CampaignMailPreview campaignId={campaign.id} version={campaign.version}/>}
      </Modal>
      <Modal
        open={confirmSend}
        onOpenChange={(open) => {
          if (!busy) setConfirmSend(open);
        }}
        title={
          data?.transport === "simulation"
            ? "Confirmer la simulation"
            : "Confirmer la mise en file"
        }
        description={`Campagne « ${campaign?.title ?? ""} », pour ${selectedEligible.length} contact(s) sélectionné(s).`}
        wide
      >
        <div className="outreach-stack">
          <p className="outreach-warning">{schedule.scheduledAt ? `Début des envois le ${formatParisSchedule(schedule.scheduledAt)}.` : "Début au prochain passage du serveur."} {data?.transport === "smtp" ? "Les messages seront envoyés progressivement depuis la messagerie configurée." : "Le transport de recette configuré sera utilisé."}</p>
          <p className="admin-hint">Relisez ci-dessous le message destiné au premier contact sélectionné. Seuls la provenance et le lien personnel de désinscription peuvent varier d’un destinataire à l’autre.</p>
          {campaign && <CampaignMailPreview campaignId={campaign.id} contactId={selectedEligible[0]} version={campaign.version} onReady={setPreviewReady}/>}
          <div className="admin-actions"><Button disabled={!previewReady || Boolean(schedule.error)} loading={busy} onClick={()=>void sendCampaign()}>{data?.transport === "simulation" ? "Mettre en file de simulation" : schedule.scheduledAt ? "Confirmer la programmation" : "Mettre en file"}</Button><Button variant="secondary" disabled={busy} onClick={()=>setConfirmSend(false)}>Revenir aux destinataires</Button></div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(contactAction)}
        onOpenChange={(open) => {
          if (!open && !busy) setContactAction(null);
        }}
        title={
          contactAction?.action === "delete"
            ? "Effacer les coordonnées de ce contact ?"
            : contactAction?.action === "suppress"
              ? "Enregistrer l’opposition ?"
              : "Signaler une réponse reçue ?"
        }
        description={
          contactAction?.action === "delete"
            ? `Les coordonnées et l’historique individuel de ${contactAction.contact.email} seront effacés. Une empreinte d’exclusion sera conservée pour empêcher tout nouvel envoi à cette adresse.`
            : `Les prochains envois à ${contactAction?.contact.email ?? "ce contact"} seront arrêtés, dans toutes les campagnes.`
        }
        confirmLabel={
          contactAction?.action === "delete"
            ? "Effacer les coordonnées"
            : "Confirmer"
        }
        onConfirm={() => void applyContactAction()}
        busy={busy}
      />
    </div>
  );
}
