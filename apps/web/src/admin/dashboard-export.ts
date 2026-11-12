import type { DashboardComparison, DashboardMetrics } from "../lib/dashboard-metrics";
import { comparisonMetrics, metricDifference } from "../lib/dashboard-comparison";

/** Export displayed aggregates only; formula-leading user text stays inert in spreadsheets. */
function cell(value: string | number) {
  const text = String(value);
  const safe = typeof value === "string" && /^[\s\uFEFF]*[=+\-@\t\r\n]/u.test(text)
    ? "'" + text
    : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function dashboardCsv(data: DashboardMetrics, comparison?: DashboardComparison): string {
  const rows: (string | number)[][] = [
    ["Calas Conseil — chiffres agrégés"],
    ["Période UTC", data.period.from, data.period.to],
    ["Actualisé le", data.generatedAt],
    ["Périmètre", data.campaign ? `Campagne : ${data.campaign.title}` : "Toutes les campagnes"],
    ["Données", "Données conservées ; visites issues des liens de campagne seulement"],
    ...(data.campaign ? [
      ["Identifiant de campagne", data.campaign.id],
      ["État de la campagne", data.campaign.status],
      ["Campagne créée le", data.campaign.createdAt],
      ["Lien propre à la campagne", data.campaign.linkPath],
      ["Page de destination", data.campaign.targetPath],
      ["Destinataires inclus depuis la création (données conservées)", data.campaign.recipientCount],
    ] : []),
    ["Limites", "Ni visiteurs uniques, ni ouvertures, ni classement en boîte de réception mesurés"],
    [], ["Activité sur la période", "Valeur"],
    ["Messages réels mis en file", data.activity.requested],
    ["Messages acceptés par SMTP", data.activity.accepted],
    ["Échecs SMTP", data.activity.failed],
    ["Résultats SMTP incertains", data.activity.uncertain],
    ["Envois réels exclus", data.activity.suppressed],
    ["Simulations", data.activity.simulated],
    ["Acceptés par la messagerie de recette locale", data.activity.localAccepted],
    ["Nouveaux contacts", data.activity.newContacts ?? "Non attribuable à une campagne"],
    ["Nouvelles campagnes", data.activity.newCampaigns],
    ["Contacts avec une réponse signalée", data.activity.responsesRecorded ?? "Non attribuable à une campagne"],
    ["Nouvelles adresses exclues", data.activity.exclusionsAdded ?? "Non attribuable à une campagne"],
    ["Arrivées depuis les liens", data.activity.arrivals],
    ["Consultations attribuées", data.activity.consultations],
    [], ["Situation actuelle", "Valeur"],
    ...(data.current.contacts ? [
      ["Contacts conservés", data.current.contacts.total],
      ["Contacts disponibles", data.current.contacts.eligible],
      ["Contacts avec réponse signalée", data.current.contacts.responded],
      ["Adresses exclues", data.current.contacts.excluded],
    ] : []),
    ["Campagnes", data.current.campaigns.total],
    ["Brouillons", data.current.campaigns.drafts],
    ["Campagnes ouvertes", data.current.campaigns.active],
    ["Campagnes en pause", data.current.campaigns.paused],
    ["En attente hors pause", data.current.queue.waiting],
    ["En traitement", data.current.queue.sending],
    ["En attente dans une campagne en pause", data.current.queue.paused],
    ["Mode d’envoi", data.current.transport],
    ["Traitement automatique activé", data.current.workerEnabled ? "Oui" : "Non"],
    ["Limite d’envois du site par heure", data.current.hourlyLimit],
    [], ["Jour UTC", "Acceptés SMTP", "Arrivées", "Consultations"],
    ...data.daily.map(day => [day.day, day.accepted, day.arrivals, day.consultations]),
    [], ["Campagnes affichées", data.campaigns.length, "Campagnes avec activité", data.campaignRowsTotal],
    ["Campagne", "État", "Destination", "Mis en file réels", "Acceptés SMTP", "Échecs", "Incertains", "Exclus", "Simulés", "Recette locale", "Arrivées", "Consultations"],
    ...data.campaigns.map(c => [c.title, c.status, c.targetPath, c.requested, c.accepted, c.failed, c.uncertain, c.suppressed, c.simulated, c.localAccepted, c.arrivals, c.consultations]),
    [], ["Pages affichées", data.pages.length, "Pages avec activité", data.pageRowsTotal],
    ["Page", "Chemin", "Arrivées", "Consultations"],
    ...data.pages.map(p => [p.title, p.path, p.arrivals, p.consultations]),
  ];
  if (comparison) {
    const reference = comparison.data;
    rows.push([], ["Comparaison", comparison.kind === "previous" ? "Période précédente de même durée" : "Autre campagne sur la même période"],
      ["A — Analyse", data.campaign?.title ?? "Toutes les campagnes", data.period.from, data.period.to],
      ["B — Référence", reference.campaign?.title ?? "Toutes les campagnes", reference.period.from, reference.period.to],
      ["Actualisation de la référence", reference.generatedAt],
      ["Indicateur", "A", "B", "Écart A − B", "Variation (%)"],
      ...comparisonMetrics.map(([key, label]) => {
        const value = data.activity[key], baseline = reference.activity[key];
        const change = metricDifference(value, baseline);
        return [label, value ?? "Non attribuable", baseline ?? "Non attribuable", change.difference ?? "Non disponible",
          change.percentage === null ? baseline === 0 && value !== null ? "Non calculable : référence nulle" : "Non disponible" : Number(change.percentage.toFixed(2))];
      }));
  }
  const result = "\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n") + "\r\n";
  return comparison ? result + '\r\n"Détail de la référence B"\r\n' + dashboardCsv(comparison.data).slice(1) : result;
}

export function downloadDashboardCsv(data: DashboardMetrics, comparison?: DashboardComparison) {
  const url = URL.createObjectURL(new Blob([dashboardCsv(data, comparison)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `calas-statistiques-${data.period.from.slice(0, 10)}-${data.period.to.slice(0, 10)}${data.campaign ? `-${data.campaign.id}` : ""}${comparison ? "-comparaison" : ""}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
