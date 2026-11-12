// Synthetic aggregates shared by browser acceptance checks and CSV tests.
export const dashboardCampaignId = "11111111-1111-4111-8111-111111111111";
export const secondDashboardCampaignId = "44444444-4444-4444-8444-444444444444";
export const inactiveDashboardCampaignId = "55555555-5555-4555-8555-555555555555";
export const missingCampaignId = "22222222-2222-4222-8222-222222222222";

export const dashboardCampaigns = [
  { id: dashboardCampaignId, title: "Diagnostic et qualité relationnelle", status: "active", targetPath: "/diagnostic-rps/", createdAt: "2026-11-10T12:00:00.000Z" },
  { id: secondDashboardCampaignId, title: "Entreprises de Toulouse", status: "active", targetPath: "/diagnostic-rps/", createdAt: "2026-11-01T12:00:00.000Z" },
  ...Array.from({ length: 22 }, (_, index) => ({
    id: `66666666-6666-4666-8666-${String(index).padStart(12, "0")}`,
    title: `Campagne conservée ${String(index + 1).padStart(2, "0")}`, status: "draft", targetPath: "/managers/", createdAt: "2026-10-01T12:00:00.000Z",
  })),
  { id: inactiveDashboardCampaignId, title: "Ancienne campagne sans activité", status: "paused", targetPath: "/diagnostic-rps/", createdAt: "2025-02-01T12:00:00.000Z" },
];

export function dashboardCampaignOptionsFixture(query = "", offset = 0, limit = 20) {
  const options = dashboardCampaigns.filter(campaign => campaign.title.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  return { items: options.slice(offset, offset + limit), total: options.length, offset, limit };
}

export function dashboardFixture(days = 30) {
  const until = new Date("2026-11-12T12:00:00.000Z");
  const from = new Date("2026-11-12T00:00:00.000Z");
  from.setUTCDate(from.getUTCDate() - days + 1);
  const accepted = days === 7 ? 7 : days === 90 ? 97 : 37;
  const daily = Array.from({ length: days }, (_, index) => ({
    day: new Date(from.getTime() + index * 86_400_000).toISOString().slice(0, 10),
    accepted: index === days - 1 ? accepted : 0,
    arrivals: index === days - 1 ? 12 : 0,
    consultations: index === days - 1 ? 21 : 0,
  }));
  return {
    generatedAt: until.toISOString(),
    campaign: null,
    period: { days, from: from.toISOString(), to: until.toISOString(), timeZone: "UTC" },
    current: {
      contacts: { total: 1200, eligible: 1100, responded: 40, excluded: 60 },
      campaigns: { total: 12, drafts: 5, active: 4, paused: 3 },
      queue: { waiting: 18, sending: 2, paused: 9 },
      transport: "smtp", workerEnabled: true, hourlyLimit: 100,
    },
    activity: {
      requested: accepted + 8, accepted, failed: 3, uncertain: 2,
      suppressed: 3, simulated: 11, localAccepted: 4,
      newContacts: 18, newCampaigns: 4, responsesRecorded: 6,
      exclusionsAdded: 3, arrivals: 12, consultations: 21,
    },
    daily,
    campaigns: [{
      id: dashboardCampaignId, title: "Diagnostic et qualité relationnelle", status: "active",
      targetPath: "/diagnostic-rps/", requested: accepted + 8, accepted,
      failed: 3, uncertain: 2, suppressed: 3, simulated: 11, localAccepted: 4,
      arrivals: 12, consultations: 21,
    }],
    campaignRowsTotal: 1,
    pages: [
      { title: "Diagnostic", path: "/diagnostic-rps/", arrivals: 12, consultations: 13 },
      { title: "Notre accompagnement en management et qualité relationnelle au travail", path: "/managers/", arrivals: 0, consultations: 8 },
    ],
    pageRowsTotal: 2,
  };
}

export function campaignDashboardFixture(campaignId, days = 30) {
  const option = dashboardCampaigns.find(campaign => campaign.id === campaignId);
  if (!option) throw new Error(`Unknown synthetic campaign: ${campaignId}`);
  const active = campaignId === dashboardCampaignId || campaignId === secondDashboardCampaignId;
  const first = campaignId === dashboardCampaignId;
  const data = active ? dashboardFixture(days) : emptyDashboardFixture(days);
  const accepted = active ? first ? (days === 7 ? 2 : days === 90 ? 31 : 11) : (days === 7 ? 5 : days === 90 ? 66 : 26) : 0;
  const arrivals = active ? first ? 4 : 8 : 0;
  const consultations = active ? first ? 9 : 12 : 0;
  data.campaign = { ...option, linkPath: `/r/${first ? "c_first_fixture" : campaignId === secondDashboardCampaignId ? "c_second_fixture" : "c_inactive_fixture"}`, recipientCount: active ? first ? 14 : 30 : 0 };
  data.current.contacts = null;
  data.current.campaigns = { total: 1, drafts: option.status === "draft" ? 1 : 0, active: option.status === "active" ? 1 : 0, paused: option.status === "paused" ? 1 : 0 };
  data.current.queue = active ? { waiting: first ? 5 : 13, sending: 1, paused: first ? 2 : 7 } : { waiting: 0, sending: 0, paused: 0 };
  data.activity = {
    requested: active ? accepted + (first ? 3 : 5) : 0, accepted,
    failed: active ? first ? 1 : 2 : 0, uncertain: active ? 1 : 0,
    suppressed: active ? first ? 1 : 2 : 0, simulated: active ? first ? 4 : 7 : 0,
    localAccepted: active ? first ? 1 : 3 : 0,
    newContacts: null, newCampaigns: option.createdAt >= data.period.from ? 1 : 0,
    responsesRecorded: null, exclusionsAdded: null, arrivals, consultations,
  };
  data.daily = data.daily.map((day, index) => ({ ...day, accepted: index === days - 1 ? accepted : 0, arrivals: index === days - 1 ? arrivals : 0, consultations: index === days - 1 ? consultations : 0 }));
  data.campaigns = active ? [{ ...option, ...data.activity }] : [];
  data.campaignRowsTotal = active ? 1 : 0;
  data.pages = active ? [
    { title: "Diagnostic", path: "/diagnostic-rps/", arrivals, consultations: first ? 5 : 8 },
    { title: "Notre accompagnement en management et qualité relationnelle au travail", path: "/managers/", arrivals: 0, consultations: 4 },
  ] : [];
  data.pageRowsTotal = data.pages.length;
  return data;
}

export function emptyDashboardFixture(days = 30, transport = "smtp") {
  const data = dashboardFixture(days);
  for (const bucket of [data.activity, data.current.contacts, data.current.campaigns, data.current.queue]) {
    for (const key of Object.keys(bucket)) bucket[key] = 0;
  }
  data.current.transport = transport;
  data.daily = data.daily.map(day => ({ ...day, accepted: 0, arrivals: 0, consultations: 0 }));
  data.campaigns = [];
  data.campaignRowsTotal = 0;
  data.pages = [];
  data.pageRowsTotal = 0;
  return data;
}
