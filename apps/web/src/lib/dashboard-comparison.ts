import type { DashboardMetrics } from "./dashboard-metrics";

export const comparisonMetrics = [
  ["requested", "Messages réels mis en file"],
  ["accepted", "Acceptés par le serveur mail"],
  ["arrivals", "Arrivées depuis les liens"],
  ["consultations", "Consultations attribuées"],
  ["failed", "Échecs SMTP"],
  ["uncertain", "Résultats SMTP incertains"],
  ["suppressed", "Envois exclus"],
  ["responsesRecorded", "Réponses signalées"],
  ["simulated", "Simulations"],
] as const;

export function previousDashboardRange(period: DashboardMetrics["period"]) {
  const start = Date.parse(period.from.slice(0, 10) + "T00:00:00Z");
  return {
    from: new Date(start - period.days * 86400000).toISOString().slice(0, 10),
    to: new Date(start - 86400000).toISOString().slice(0, 10),
  };
}

/** A zero or unavailable reference must never become an invented growth rate. */
export function metricDifference(value: number | null, reference: number | null) {
  return {
    difference: value === null || reference === null ? null : value - reference,
    percentage: value === null || reference === null || reference === 0 ? null : (value - reference) / reference * 100,
  };
}
