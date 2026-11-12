/** Aggregated administration metrics. No recipient address or tracking token. */
export type DashboardPeriod = 7 | 30 | 90;

export interface DashboardOutcomes {
  accepted: number;
  failed: number;
  uncertain: number;
  suppressed: number;
  simulated: number;
  localAccepted: number;
}

export interface DashboardMetrics {
  generatedAt: string;
  period: { days: DashboardPeriod; from: string; to: string; timeZone: "UTC" };
  current: {
    contacts: { total: number; eligible: number; responded: number; excluded: number };
    campaigns: { total: number; drafts: number; active: number; paused: number };
    queue: { waiting: number; sending: number; paused: number };
    transport: "simulation" | "local" | "smtp";
    workerEnabled: boolean;
    hourlyLimit: number;
  };
  activity: DashboardOutcomes & {
    requested: number;
    newContacts: number;
    newCampaigns: number;
    responsesRecorded: number;
    exclusionsAdded: number;
    arrivals: number;
    consultations: number;
  };
  daily: { day: string; accepted: number; arrivals: number; consultations: number }[];
  campaigns: (DashboardOutcomes & {
    id: string;
    title: string;
    status: "draft" | "active" | "paused";
    targetPath: string;
    requested: number;
    arrivals: number;
    consultations: number;
  })[];
  campaignRowsTotal: number;
  pages: { path: string; title: string; arrivals: number; consultations: number }[];
  pageRowsTotal: number;
}
