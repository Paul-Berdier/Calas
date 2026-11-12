// Synthetic aggregates shared by browser acceptance checks and CSV tests.
export const dashboardCampaignId = "11111111-1111-4111-8111-111111111111";
export const missingCampaignId = "22222222-2222-4222-8222-222222222222";

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
