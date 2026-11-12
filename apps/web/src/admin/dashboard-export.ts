import type { DashboardMetrics } from "../lib/dashboard-metrics";

/** Export displayed aggregates only; formula-leading user text stays inert in spreadsheets. */
function cell(value: string | number) {
  const text = String(value);
  const safe = typeof value === "string" && /^[\s\uFEFF]*[=+\-@\t\r\n]/u.test(text)
    ? "'" + text
    : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function dashboardCsv(data: DashboardMetrics): string {
  const rows: (string | number)[][] = [
    ["Calas Conseil — chiffres agrégés"],
    ["Période UTC", data.period.from, data.period.to],
    ["Actualisé le", data.generatedAt],
    ["Périmètre", "Données conservées ; visites issues des liens de campagne seulement"],
    ["Limites", "Ni visiteurs uniques, ni ouvertures, ni classement en boîte de réception mesurés"],
    [], ["Activité sur la période", "Valeur"],
    ["Messages réels mis en file", data.activity.requested],
    ["Messages acceptés par SMTP", data.activity.accepted],
    ["Échecs SMTP", data.activity.failed],
    ["Résultats SMTP incertains", data.activity.uncertain],
    ["Envois réels exclus", data.activity.suppressed],
    ["Simulations", data.activity.simulated],
    ["Acceptés par la messagerie de recette locale", data.activity.localAccepted],
    ["Nouveaux contacts", data.activity.newContacts],
    ["Nouvelles campagnes", data.activity.newCampaigns],
    ["Contacts avec une réponse signalée", data.activity.responsesRecorded],
    ["Nouvelles adresses exclues", data.activity.exclusionsAdded],
    ["Arrivées depuis les liens", data.activity.arrivals],
    ["Consultations attribuées", data.activity.consultations],
    [], ["Situation actuelle", "Valeur"],
    ["Contacts conservés", data.current.contacts.total],
    ["Contacts disponibles", data.current.contacts.eligible],
    ["Contacts avec réponse signalée", data.current.contacts.responded],
    ["Adresses exclues", data.current.contacts.excluded],
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
  return "\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function downloadDashboardCsv(data: DashboardMetrics) {
  const url = URL.createObjectURL(new Blob([dashboardCsv(data)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `calas-statistiques-${data.period.days}-jours.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
