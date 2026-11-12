/** Aggregated private metrics. A selected campaign exposes only its shared public link, never recipient data. */
export type DashboardPeriod = 7 | 30 | 90;

export interface DashboardCampaignOption {
  id: string;
  title: string;
  status: "draft" | "active" | "paused";
  targetPath: string;
  createdAt: string;
}

export interface DashboardCampaignOptions {
  items: DashboardCampaignOption[];
  total: number;
  offset: number;
  limit: number;
}

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
  campaign: (DashboardCampaignOption & { linkPath: string; recipientCount: number }) | null;
  period: { days: DashboardPeriod; from: string; to: string; timeZone: "UTC" };
  current: {
    contacts: { total: number; eligible: number; responded: number; excluded: number } | null;
    campaigns: { total: number; drafts: number; active: number; paused: number };
    queue: { waiting: number; sending: number; paused: number };
    transport: "simulation" | "local" | "smtp";
    workerEnabled: boolean;
    hourlyLimit: number;
  };
  activity: DashboardOutcomes & {
    requested: number;
    newContacts: number | null;
    newCampaigns: number;
    responsesRecorded: number | null;
    exclusionsAdded: number | null;
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
