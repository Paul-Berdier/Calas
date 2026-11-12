import { useEffect, useId, useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Download,
  Eye,
  MailCheck,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Users,
} from "lucide-react";
import type { DashboardCampaignOption, DashboardCampaignOptions, DashboardComparison, DashboardMetrics, DashboardPeriod } from "../lib/dashboard-metrics";
import { comparisonMetrics, metricDifference, previousDashboardRange } from "../lib/dashboard-comparison";
import { request } from "./api";
import { Button, Loading } from "./ui";
import { downloadDashboardCsv } from "./dashboard-export";
import "./dashboard-insights.css";

const integer = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const utcDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
const periodDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const refreshedAt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
});
const dayLabel = (value: string) => utcDay.format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const periodLabel = (value: string) => periodDay.format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const campaignStatus = { draft: "Brouillon", active: "Ouverte", paused: "En pause" };
const createdOn = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
type CampaignSelection = Pick<DashboardCampaignOption, "id" | "title"> | null;

function CampaignFilter({ selected, onSelect, refreshVersion, reference = false, excludeId }: {
  selected: CampaignSelection;
  onSelect: (campaign: CampaignSelection) => void;
  refreshVersion: number;
  reference?: boolean;
  excludeId?: string;
}) {
  const searchId = useId(), selectId = useId(), helpId = useId();
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<DashboardCampaignOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setOptions(null); setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), offset: String(offset), limit: "20" });
      request<DashboardCampaignOptions>(`/api/admin/outreach/analytics-campaigns/?${params}`, { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setOptions(value); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "La liste des campagnes n’est pas disponible."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query.trim() ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, offset, retry, refreshVersion]);
  function changeList(nextQuery: string, nextOffset: number) {
    setOptions(null); setLoading(true); setError(""); setQuery(nextQuery); setOffset(nextOffset);
  }
  const items = !loading ? options?.items ?? [] : [];
  return <section className="dashboard-campaign-filter" aria-label={reference ? "Choisir la campagne de référence" : "Choisir les campagnes à analyser"}>
    <div className="dashboard-filter-fields">
      <div className="dashboard-filter-select">
        <label htmlFor={selectId}>{reference ? "Campagne de référence" : "Campagne analysée"}</label>
        <select id={selectId} className="admin-input" value={selected?.id ?? ""} aria-describedby={helpId} onChange={event => {
          const next = items.find(item => item.id === event.target.value);
          if (!event.target.value) onSelect(null);
          else if (next) onSelect(next);
        }}>
          <option value="">{reference ? "Choisir une campagne" : "Toutes les campagnes"}</option>
          {selected && !items.some(item => item.id === selected.id) && <option value={selected.id}>{selected.title} · {selected.id.slice(0, 8)}</option>}
          {items.map(item => <option key={item.id} value={item.id} disabled={item.id === excludeId}>{item.title} · {campaignStatus[item.status]} · {createdOn.format(new Date(item.createdAt))} · {item.id.slice(0, 8)}</option>)}
        </select>
      </div>
      <div className="dashboard-filter-search">
        <label htmlFor={searchId}>{reference ? "Rechercher une campagne de référence" : "Rechercher une campagne"}</label>
        <input id={searchId} className="admin-input" type="search" value={query} maxLength={100} placeholder="Nom de la campagne" onChange={event => changeList(event.target.value, 0)} />
      </div>
      {selected && !reference && <Button variant="secondary" size="sm" onClick={() => onSelect(null)}>Toutes les campagnes</Button>}
    </div>
    <p id={helpId}>La liste comprend aussi les campagnes anciennes ou sans activité. La recherche et les pages ci-dessous modifient les choix de la liste.</p>
    <div className="dashboard-filter-footer">
      <p role="status">{loading ? "Chargement de la liste des campagnes…" : options ? options.items.length ? `${integer.format(options.offset + 1)}–${integer.format(Math.min(options.offset + options.items.length, options.total))} sur ${integer.format(options.total)} campagne(s)` : options.total ? "Aucune campagne sur cette page. Revenez à la page précédente." : "Aucune campagne ne correspond à cette recherche." : "Liste indisponible."}</p>
      <div>
        <Button variant="ghost" size="sm" aria-label="Campagnes précédentes" disabled={loading || offset === 0} onClick={() => changeList(query, Math.max(0, offset - 20))}>Précédentes</Button>
        <Button variant="ghost" size="sm" aria-label="Campagnes suivantes" disabled={loading || !options || options.offset + options.items.length >= options.total} onClick={() => changeList(query, offset + 20)}>Suivantes</Button>
      </div>
    </div>
    {error && <div className="dashboard-filter-error" role="alert"><p>{error} La vue sélectionnée reste inchangée.</p><Button variant="secondary" size="sm" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Réessayer la liste des campagnes</Button></div>}
  </section>;
}

function ComparisonTable({ data, comparison }: { data: DashboardMetrics; comparison: DashboardComparison }) {
  const reference = comparison.data;
  const signed = new Intl.NumberFormat("fr-FR", { signDisplay: "exceptZero", maximumFractionDigits: 1 });
  return <section className="admin-card dashboard-comparison-card" aria-label="Résultats comparés">
    <div className="admin-card-header"><div><h3>{comparison.kind === "previous" ? "Comparaison avec la période précédente" : "Comparaison des deux campagnes"}</h3><p>Écart de A par rapport à B. Les chiffres « maintenant » ne sont pas comparés.</p></div></div>
    <div className="dashboard-comparison-scopes">
      <p><strong>A · {data.campaign?.title ?? "Toutes les campagnes"}</strong><span>Du {data.period.from.slice(0, 10)} au {data.period.to.slice(0, 10)} · UTC</span></p>
      <p><strong>B · {reference.campaign?.title ?? "Toutes les campagnes"}</strong><span>Du {reference.period.from.slice(0, 10)} au {reference.period.to.slice(0, 10)} · UTC</span></p>
    </div>
    <div className="dashboard-table-scroll" role="region" aria-label="Comparaison des indicateurs" tabIndex={0}>
      <table className="dashboard-table dashboard-comparison-table"><caption>{data.period.days} jours par période · données conservées</caption>
        <thead><tr><th scope="col">Indicateur</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Écart A − B</th><th scope="col">Variation</th></tr></thead>
        <tbody>{comparisonMetrics.map(([key, label]) => {
          const value = data.activity[key], baseline = reference.activity[key], change = metricDifference(value, baseline);
          return <tr key={key}><th scope="row">{label}</th><td>{value === null ? "Non attribuable" : integer.format(value)}</td><td>{baseline === null ? "Non attribuable" : integer.format(baseline)}</td><td>{change.difference === null ? "Non disponible" : signed.format(change.difference)}</td><td>{change.percentage === null ? baseline === 0 && value !== null ? "Base nulle" : "Non disponible" : signed.format(change.percentage) + " %"}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <p className="dashboard-comparison-note">Une base nulle ne permet pas de calculer un pourcentage. Les réponses signalées restent non attribuables à une campagne. Le jour UTC en cours peut être incomplet.</p>
  </section>;
}

function SelectedCampaign({ campaign }: { campaign: NonNullable<DashboardMetrics["campaign"]> }) {
  const linkId = useId();
  const [copyState, setCopyState] = useState("");
  const [copying, setCopying] = useState(false);
  const link = campaign.linkPath ? new URL(campaign.linkPath, window.location.origin).href : "";
  async function copyLink() {
    setCopying(true); setCopyState("");
    try { await navigator.clipboard.writeText(link); setCopyState("Lien copié."); }
    catch { setCopyState("La copie n’a pas abouti. Sélectionnez le lien dans le champ puis copiez-le."); }
    finally { setCopying(false); }
  }
  return <section className="dashboard-selected-campaign" aria-label="Campagne sélectionnée">
    <div className="dashboard-selected-heading"><div><p className="dashboard-eyebrow">Une campagne, un lien</p><h3>{campaign.title}</h3></div><a className="dashboard-section-link" href={`/admin/outreach/?campaign=${encodeURIComponent(campaign.id)}`}>Gérer cette campagne <ArrowUpRight size={15} aria-hidden /></a></div>
    <dl><div><dt>État</dt><dd>{campaignStatus[campaign.status]}</dd></div><div><dt>Créée le</dt><dd><time dateTime={campaign.createdAt}>{createdOn.format(new Date(campaign.createdAt))}</time></dd></div><div><dt>Référence</dt><dd>{campaign.id.slice(0, 8)}</dd></div><div><dt>Page proposée</dt><dd>{campaign.targetPath}</dd></div></dl>
    <label htmlFor={linkId}>Lien unique de cette campagne</label>
    <div className="dashboard-copy-link"><input id={linkId} className="admin-input" readOnly value={link} onFocus={event => event.target.select()} /><Button variant="secondary" size="sm" onClick={() => void copyLink()} disabled={!link || copying}><Copy size={15} aria-hidden />Copier le lien</Button></div>
    <p className="dashboard-copy-status" role="status">{copyState}</p>
    <p className="dashboard-small-note">La copie ne crée aucune visite. Plusieurs campagnes peuvent mener à la même page : chaque lien garde ses propres chiffres.</p>
  </section>;
}

function DailyChart({ data }: { data: DashboardMetrics }) {
  const titleId = useId(), descriptionId = useId();
  const width = 760, top = 22, bottom = 206, left = 48, right = 740;
  const maximum = Math.max(1, ...data.daily.flatMap(day => [day.accepted, day.arrivals, day.consultations]));
  const x = (index: number) => left + (right - left) * index / Math.max(1, data.daily.length - 1);
  const y = (value: number) => bottom - (bottom - top) * value / maximum;
  const series = [
    { key: "accepted", label: "Acceptés par le serveur mail", color: "#14213a", dash: undefined },
    { key: "arrivals", label: "Arrivées depuis les liens", color: "#94672f", dash: "8 5" },
    { key: "consultations", label: "Consultations attribuées", color: "#286449", dash: "2 5" },
  ] as const;
  const noActivity = data.daily.every(day => !day.accepted && !day.arrivals && !day.consultations);
  return (
    <>
      <ul className="dashboard-chart-legend" aria-label="Séries du graphique">
        {series.map(item => <li key={item.key}><span className={`dashboard-chart-key dashboard-chart-key-${item.key}`} aria-hidden />{item.label}</li>)}
      </ul>
      <svg className="dashboard-chart" viewBox={`0 0 ${width} 244`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>Évolution quotidienne des envois acceptés et des consultations attribuées</title>
        <desc id={descriptionId}>Du {dayLabel(data.period.from)} au {dayLabel(data.period.to)}, en jours UTC. Les valeurs exactes sont disponibles dans le tableau sous le graphique.</desc>
        {[0, maximum / 2, maximum].map((value, index) => (
          <g key={index}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#deddd8" strokeDasharray={index ? "3 5" : undefined} />
            <text x={left - 10} y={y(value) + 4} textAnchor="end">{compact.format(value)}</text>
          </g>
        ))}
        {series.map(item => <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dash} strokeLinecap="round" strokeLinejoin="round" points={data.daily.map((day, index) => `${x(index)},${y(day[item.key])}`).join(" ")} />)}
        {data.daily.length > 0 && <>
          <text x={left} y="233" textAnchor="start">{dayLabel(data.daily[0].day)}</text>
          <text x={(left + right) / 2} y="233" textAnchor="middle">{dayLabel(data.daily[Math.floor((data.daily.length - 1) / 2)].day)}</text>
          <text x={right} y="233" textAnchor="end">{dayLabel(data.daily[data.daily.length - 1].day)}</text>
        </>}
      </svg>
      {noActivity && <p className="dashboard-empty">Aucun envoi accepté ni consultation attribuée sur cette période.</p>}
      <details className="dashboard-detail">
        <summary>Voir les valeurs jour par jour</summary>
        <div className="dashboard-table-scroll" role="region" aria-label="Valeurs quotidiennes" tabIndex={0}>
          <table className="dashboard-table">
            <caption>Jours enregistrés en UTC</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Acceptés par le serveur mail</th><th scope="col">Arrivées</th><th scope="col">Consultations</th></tr></thead>
            <tbody>{data.daily.map(day => <tr key={day.day}><th scope="row"><time dateTime={day.day}>{dayLabel(day.day)}</time></th><td>{integer.format(day.accepted)}</td><td>{integer.format(day.arrivals)}</td><td>{integer.format(day.consultations)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function DashboardInsights() {
  const [period, setPeriod] = useState<DashboardPeriod>(30);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState("");
  const [selected, setSelected] = useState<CampaignSelection>(null);
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [comparisonKind, setComparisonKind] = useState<"none" | "previous" | "campaign">("none");
  const [comparisonSelected, setComparisonSelected] = useState<CampaignSelection>(null);
  const [comparisonResult, setComparisonResult] = useState<{ key: string; value: DashboardComparison } | null>(null);
  const [comparisonError, setComparisonError] = useState("");
  const dateFromId = useId(), dateToId = useId(), comparisonId = useId();
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    const params = new URLSearchParams(range ?? { days: String(period) });
    if (selected) params.set("campaignId", selected.id);
    request<DashboardMetrics>(`/api/admin/outreach/analytics/?${params}`, { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return;
        if ((value.campaign?.id ?? null) !== (selected?.id ?? null)) throw new Error("Les chiffres reçus ne correspondent pas à la campagne sélectionnée. Réessayez l’actualisation.");
        if (range && (value.period.from.slice(0, 10) !== range.from || value.period.to.slice(0, 10) !== range.to)) throw new Error("Les dates reçues ne correspondent pas à la période sélectionnée.");
        setData(value);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Les statistiques ne sont pas disponibles."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, range, reload, selected]);
  const visible = !loading && data && (range ? data.period.from.slice(0, 10) === range.from && data.period.to.slice(0, 10) === range.to : data.period.days === period) && (data.campaign?.id ?? null) === (selected?.id ?? null) ? data : null;
  const comparisonKey = visible && comparisonKind !== "none" && (comparisonKind !== "campaign" || (selected && comparisonSelected && selected.id !== comparisonSelected.id))
    ? [visible.generatedAt, visible.period.from, visible.period.to, selected?.id ?? "all", comparisonKind, comparisonSelected?.id ?? ""].join("|") : "";
  useEffect(() => {
    const controller = new AbortController();
    setComparisonResult(null); setComparisonError("");
    if (!comparisonKey || !visible || comparisonKind === "none") return () => controller.abort();
    const bounds = comparisonKind === "previous" ? previousDashboardRange(visible.period) : { from: visible.period.from.slice(0, 10), to: visible.period.to.slice(0, 10) };
    const campaignId = comparisonKind === "previous" ? selected?.id : comparisonSelected?.id;
    const params = new URLSearchParams(bounds);
    if (campaignId) params.set("campaignId", campaignId);
    request<DashboardMetrics>(`/api/admin/outreach/analytics/?${params}`, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      if ((value.campaign?.id ?? null) !== (campaignId ?? null) || value.period.from.slice(0, 10) !== bounds.from || value.period.to.slice(0, 10) !== bounds.to) throw new Error("La référence reçue ne correspond pas à la comparaison demandée.");
      setComparisonResult({ key: comparisonKey, value: { kind: comparisonKind, data: value } });
    }).catch(cause => { if (!controller.signal.aborted) setComparisonError(cause instanceof Error ? cause.message : "La comparaison n’est pas disponible."); });
    return () => controller.abort();
  }, [comparisonKey, comparisonKind, comparisonSelected, selected, visible]);
  const comparison = comparisonResult?.key === comparisonKey ? comparisonResult.value : undefined;
  const exportReady = !!visible && (comparisonKind === "none" || !!comparison);
  function refresh() { setData(null); setLoading(true); setError(""); setReload(value => value + 1); }
  function selectCampaign(campaign: CampaignSelection) {
    if ((campaign?.id ?? null) === (selected?.id ?? null)) return;
    setData(null); setLoading(true); setError(""); setSelected(campaign);
    if (!campaign) setComparisonKind("none");
    if (campaign?.id === comparisonSelected?.id) setComparisonSelected(null);
  }
  function choosePeriod(days: DashboardPeriod) {
    setCustomOpen(false); setDateError("");
    if (!range && period === days) return;
    setData(null); setLoading(true); setRange(null); setPeriod(days);
  }
  function applyDates(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = new Date(dateFrom + "T00:00:00Z"), to = new Date(dateTo + "T00:00:00Z");
    const days = (to.getTime() - from.getTime()) / 86400000 + 1;
    if (!Number.isInteger(days) || days < 1 || days > 366 || dateFrom < "1970-01-01" || dateTo > today || from.toISOString().slice(0, 10) !== dateFrom || to.toISOString().slice(0, 10) !== dateTo) {
      setDateError("Choisissez deux dates valides, sans date future, sur 1 à 366 jours."); return;
    }
    setDateError(""); setData(null); setLoading(true); setRange({ from: dateFrom, to: dateTo });
  }

  return (
    <section className="dashboard-insights" aria-labelledby="dashboard-insights-title">
      <div className="dashboard-insights-heading">
        <div>
          <p className="dashboard-eyebrow">Campagnes & consultations</p>
          <h2 id="dashboard-insights-title" tabIndex={-1}>Les chiffres de votre activité</h2>
          <p>Suivez les envois, les retours signalés et les visites issues de vos liens de campagne.</p>
        </div>
        <a className="dashboard-section-link" href="/admin/outreach/">Ouvrir la prospection <ArrowUpRight size={16} aria-hidden /></a>
      </div>
      <CampaignFilter selected={selected} onSelect={selectCampaign} refreshVersion={reload} />
      <p className="dashboard-scope" role="status">{selected ? <>Analyse de la campagne : <strong>{selected.title}</strong></> : "Vue d’ensemble · toutes les campagnes"}</p>
      <div className="dashboard-toolbar">
        <div className="dashboard-periods" role="group" aria-label="Période des statistiques">
          {([7, 30, 90] as const).map(days => <button key={days} type="button" aria-pressed={!range && period === days} onClick={() => choosePeriod(days)}>{days} jours</button>)}
          <button type="button" aria-pressed={!!range} aria-expanded={customOpen} onClick={() => { setCustomOpen(value => !value); if (visible) { setDateFrom(visible.period.from.slice(0, 10)); setDateTo(visible.period.to.slice(0, 10)); } }}>Dates personnalisées</button>
        </div>
        <div className="dashboard-toolbar-actions">
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}><RefreshCw size={15} aria-hidden />Actualiser les chiffres</Button>
          <Button variant="ghost" size="sm" onClick={() => { if (visible && exportReady) downloadDashboardCsv(visible, comparison); }} disabled={!exportReady}><Download size={15} aria-hidden />Exporter les chiffres</Button>
        </div>
      </div>
      {customOpen && <form className="dashboard-custom-dates" onSubmit={applyDates}>
        <div><label htmlFor={dateFromId}>Du (UTC)</label><input id={dateFromId} className="admin-input" type="date" required min="1970-01-01" max={dateTo || today} value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
        <div><label htmlFor={dateToId}>Au (UTC)</label><input id={dateToId} className="admin-input" type="date" required min={dateFrom || "1970-01-01"} max={today} value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
        <Button variant="secondary" size="sm" type="submit">Appliquer les dates</Button><p>Jusqu’à 366 jours. Les dates suivent les jours UTC des statistiques.</p>
        {dateError && <p role="alert">{dateError}</p>}
      </form>}
      <div className="dashboard-comparison-controls"><label htmlFor={comparisonId}>Comparer avec</label><select id={comparisonId} className="admin-input" value={comparisonKind} onChange={event => setComparisonKind(event.target.value as typeof comparisonKind)}>
        <option value="none">Aucune comparaison</option><option value="previous">La période précédente de même durée</option><option value="campaign" disabled={!selected}>Une autre campagne</option>
      </select>{!selected && <p>Choisissez une campagne ci-dessus pour la comparer à une autre.</p>}</div>
      {comparisonKind === "campaign" && <CampaignFilter reference excludeId={selected?.id} selected={comparisonSelected} onSelect={setComparisonSelected} refreshVersion={reload} />}
      {loading && <div className="dashboard-loading"><Loading label="Chargement des statistiques…" /></div>}
      {error && <div className="dashboard-error" role="alert"><p><strong>Les chiffres n’ont pas pu être actualisés.</strong></p><p>{error}</p><p>Vos contenus restent accessibles plus bas.</p><Button variant="secondary" size="sm" onClick={refresh}>Réessayer les statistiques</Button></div>}
      {visible && <>
        {visible.campaign && <SelectedCampaign key={visible.campaign.id} campaign={visible.campaign} />}
        <div className="dashboard-period-caption">
          <p>Du {periodLabel(visible.period.from)} au {periodLabel(visible.period.to)} · jours UTC</p>
          <p>Actualisé le <time dateTime={visible.generatedAt}>{refreshedAt.format(new Date(visible.generatedAt))}</time> (Paris)</p>
        </div>
        {comparison && <ComparisonTable data={visible} comparison={comparison} />}
        {comparisonKind !== "none" && !comparison && <div className="dashboard-comparison-pending" role={comparisonError ? "alert" : "status"}>{comparisonError ? <><p>La comparaison n’a pas pu être chargée : {comparisonError}</p><Button variant="secondary" size="sm" onClick={refresh}>Réessayer la comparaison</Button></> : comparisonKey ? "Chargement de la comparaison…" : "Choisissez une autre campagne comme référence pour afficher la comparaison."}</div>}
        <div className="dashboard-kpis">
          {[
            { label: "Acceptés par le serveur mail", value: visible.activity.accepted, note: "Envois réels · réception en boîte principale non vérifiée", Icon: MailCheck },
            { label: "Arrivées depuis les liens", value: visible.activity.arrivals, note: "Affichages depuis un lien de campagne", Icon: MousePointerClick },
            { label: "Consultations attribuées", value: visible.activity.consultations, note: "Pages consultées avec le code de campagne", Icon: Eye },
            visible.campaign
              ? { label: "Destinataires inclus", value: visible.campaign.recipientCount, note: "Depuis la création · destinataires conservés, tous modes d’envoi", Icon: Users }
              : { label: "Réponses signalées", value: visible.activity.responsesRecorded, note: "Contacts marqués comme ayant répondu sur la période", Icon: MessageCircle },
          ].map(({ label, value, note, Icon }) => <div className="dashboard-kpi" key={label}><Icon size={19} aria-hidden /><p>{label}</p><strong>{value === null ? "Non disponible" : integer.format(value)}</strong><small>{note}</small></div>)}
        </div>
        {visible.campaign && <p className="dashboard-scope-note">Les chiffres concernent uniquement cette campagne. Les réponses signalées et les oppositions sont enregistrées au niveau du contact ; elles ne peuvent pas être attribuées à une campagne. Le nombre de destinataires couvre toute sa durée, les envois et consultations suivent la période choisie.</p>}
        {(visible.current.transport !== "smtp" || !visible.current.workerEnabled || visible.activity.failed > 0 || visible.activity.uncertain > 0) && <aside className="dashboard-notices" aria-label="Points à vérifier">
          {visible.current.transport === "simulation" && <p><strong>Mode simulation.</strong> Les nouveaux envois confirmés ne produisent aucun e-mail réel.</p>}
          {visible.current.transport === "local" && <p><strong>Mode de recette locale.</strong> Les nouveaux messages sont remis à la boîte de test.</p>}
          {!visible.current.workerEnabled && <p><strong>Traitement automatique désactivé.</strong> La file attend une exécution ou sa réactivation.</p>}
          {(visible.activity.failed > 0 || visible.activity.uncertain > 0) && <p><strong>{integer.format(visible.activity.failed)} échec(s) et {integer.format(visible.activity.uncertain)} résultat(s) incertain(s)</strong> sur la période. Vérifiez les destinataires dans la prospection ; un résultat incertain n’est pas renvoyé automatiquement.</p>}
        </aside>}
        <div className={`dashboard-current-grid${visible.campaign ? " dashboard-current-filtered" : ""}`}>
          <section className="dashboard-current-card">
            <h3>{visible.campaign ? "La file de cette campagne" : "La file maintenant"}</h3>
            <dl><div><dt>En attente de traitement</dt><dd>{integer.format(visible.current.queue.waiting)}</dd></div><div><dt>En cours de remise</dt><dd>{integer.format(visible.current.queue.sending)}</dd></div><div><dt>Retenus par une pause</dt><dd>{integer.format(visible.current.queue.paused)}</dd></div></dl>
            <p>Traitement automatique {visible.current.workerEnabled ? "activé" : "désactivé"}. Limite du site : {integer.format(visible.current.hourlyLimit)} envois/h.</p>
          </section>
          {!visible.campaign && visible.current.contacts && <section className="dashboard-current-card">
            <h3>Les contacts maintenant <span>{integer.format(visible.current.contacts.total)}</span></h3>
            <dl><div><dt>Éligibles à un envoi</dt><dd>{integer.format(visible.current.contacts.eligible)}</dd></div><div><dt>Marqués comme ayant répondu</dt><dd>{integer.format(visible.current.contacts.responded)}</dd></div><div><dt>Adresses exclues</dt><dd>{integer.format(visible.current.contacts.excluded)}</dd></div></dl>
            <p>{visible.activity.newContacts === null ? "Non disponible" : integer.format(visible.activity.newContacts)} nouveau(x) contact(s) et {visible.activity.exclusionsAdded === null ? "non disponible" : integer.format(visible.activity.exclusionsAdded)} exclusion(s) ajoutée(s) sur la période.</p>
          </section>}
          <section className="dashboard-current-card">
            <h3>{visible.campaign ? "Cette campagne maintenant" : "Les campagnes maintenant"} <span>{integer.format(visible.current.campaigns.total)}</span></h3>
            <dl><div><dt>Brouillons</dt><dd>{integer.format(visible.current.campaigns.drafts)}</dd></div><div><dt>Ouvertes</dt><dd>{integer.format(visible.current.campaigns.active)}</dd></div><div><dt>En pause</dt><dd>{integer.format(visible.current.campaigns.paused)}</dd></div></dl>
            <p>{!visible.campaign && <>{integer.format(visible.activity.newCampaigns)} nouvelle(s) campagne(s) sur la période. </>}Une campagne ouverte n’implique pas qu’un envoi soit en cours.</p>
          </section>
        </div>
        <div className="dashboard-analysis-grid">
          <section className="admin-card dashboard-trend-card">
            <div className="admin-card-header"><div><h3>L’activité jour après jour</h3><p>Les arrivées et consultations concernent uniquement les liens de campagne.</p></div></div>
            <div className="admin-card-body"><DailyChart data={visible} /></div>
          </section>
          <section className="admin-card dashboard-outcomes-card">
            <div className="admin-card-header"><div><h3>Les résultats d’envoi</h3><p>Résultats enregistrés sur la période.</p></div></div>
            <div className="admin-card-body">
              <dl className="dashboard-outcomes">
                <div><dt>Acceptés par SMTP</dt><dd>{integer.format(visible.activity.accepted)}</dd></div>
                <div><dt>Échecs</dt><dd>{integer.format(visible.activity.failed)}</dd></div>
                <div><dt>Résultats incertains</dt><dd>{integer.format(visible.activity.uncertain)}</dd></div>
                <div><dt>Envois exclus avant remise</dt><dd>{integer.format(visible.activity.suppressed)}</dd></div>
                <div className="dashboard-outcomes-test"><dt>Simulations</dt><dd>{integer.format(visible.activity.simulated)}</dd></div>
                <div><dt>Acceptés en recette locale</dt><dd>{integer.format(visible.activity.localAccepted)}</dd></div>
              </dl>
              <p className="dashboard-small-note">{integer.format(visible.activity.requested)} demande(s) d’envoi réel créée(s) sur la période. Leur date peut différer de celle du résultat.</p>
            </div>
          </section>
        </div>
        {!visible.campaign && <section className="admin-card dashboard-campaign-card">
          <div className="admin-card-header"><div><h3>Les campagnes sur la période</h3><p>{visible.campaignRowsTotal > visible.campaigns.length ? `${visible.campaigns.length} campagnes affichées sur ${integer.format(visible.campaignRowsTotal)} avec une activité.` : "Création, envoi ou consultation enregistrés sur la période."}</p></div><a className="dashboard-section-link" href="/admin/outreach/">Toutes les campagnes <ArrowUpRight size={15} aria-hidden /></a></div>
          {visible.campaigns.length ? <div className="dashboard-table-scroll" role="region" aria-label="Statistiques par campagne" tabIndex={0}>
            <table className="dashboard-table dashboard-campaign-table">
              <caption>Envois réels, consultations et simulations sur la période sélectionnée</caption>
              <thead><tr><th scope="col">Campagne</th><th scope="col">Acceptés SMTP</th><th scope="col">Arrivées</th><th scope="col">Consultations</th><th scope="col">Échecs</th><th scope="col">Incertains</th><th scope="col">Simulés</th><th scope="col">Analyse</th></tr></thead>
              <tbody>{visible.campaigns.map(campaign => <tr key={campaign.id}><th scope="row"><a href={`/admin/outreach/?campaign=${encodeURIComponent(campaign.id)}`}>{campaign.title}</a><small>{campaignStatus[campaign.status]} · {campaign.targetPath}</small></th><td>{integer.format(campaign.accepted)}</td><td>{integer.format(campaign.arrivals)}</td><td>{integer.format(campaign.consultations)}</td><td>{integer.format(campaign.failed)}</td><td>{integer.format(campaign.uncertain)}</td><td>{integer.format(campaign.simulated)}</td><td><Button variant="secondary" size="sm" aria-label={`Analyser ${campaign.title}`} onClick={() => { selectCampaign({ id: campaign.id, title: campaign.title }); document.getElementById("dashboard-insights-title")?.focus(); }}>Analyser</Button></td></tr>)}</tbody>
            </table>
          </div> : <p className="dashboard-empty">Aucune campagne avec une activité sur cette période. Les autres campagnes restent accessibles dans Prospection.</p>}
        </section>}
        <section className="admin-card dashboard-pages-card">
          <div className="admin-card-header"><div><h3>{visible.campaign ? "Les pages consultées depuis cette campagne" : "Les pages consultées depuis vos campagnes"}</h3><p>{visible.pageRowsTotal > visible.pages.length ? `${visible.pages.length} pages affichées sur ${integer.format(visible.pageRowsTotal)}.` : "Les pages vues avec un code de campagne, y compris après l’arrivée initiale."}</p></div></div>
          {visible.pages.length ? <div className="dashboard-table-scroll" role="region" aria-label="Consultations par page" tabIndex={0}>
            <table className="dashboard-table dashboard-page-table">
              <caption>Consultations attribuées aux liens de campagne</caption>
              <thead><tr><th scope="col">Page</th><th scope="col">Arrivées</th><th scope="col">Consultations</th></tr></thead>
              <tbody>{visible.pages.map(page => <tr key={page.path}><th scope="row">{page.title}<small>{page.path}</small></th><td>{integer.format(page.arrivals)}</td><td>{integer.format(page.consultations)}</td></tr>)}</tbody>
            </table>
          </div> : <p className="dashboard-empty">Aucune consultation attribuée sur cette période.</p>}
        </section>
        <details className="dashboard-explanation">
          <summary>Comprendre ces chiffres et leurs limites</summary>
          <ul>
            <li>Une acceptation SMTP confirme la remise au serveur mail, pas l’arrivée en boîte principale, le classement en indésirables ou l’ouverture du message.</li>
            <li>Les arrivées et consultations comptent des affichages, pas des personnes distinctes. Les visites sans lien de campagne ne sont pas mesurées ici.</li>
            <li>Les réponses sont signalées manuellement. La boîte mail et les demandes reçues par le formulaire ne sont pas lues automatiquement par ce tableau.</li>
            <li>Les adresses exclues comprennent les retraits manuels et les oppositions ; elles peuvent être conservées après effacement d’un contact. Leur total peut dépasser le nombre de fiches.</li>
            <li>Les résultats reposent sur les données conservées. Les courbes suivent les jours UTC enregistrés par le site ; les chiffres « maintenant » ne changent pas de périmètre avec le filtre de période.</li>
          </ul>
        </details>
      </>}
    </section>
  );
}
