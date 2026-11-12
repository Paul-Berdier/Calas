/** Private administration contracts; never include opposition tokens or SMTP credentials. */
export interface OutreachPage<T> { items: T[]; total: number; offset: number; limit: number }
export type DeliveryStatus = 'queued' | 'sending' | 'accepted' | 'simulated' | 'failed' | 'uncertain' | 'suppressed';
export interface DeliveryHistoryItem {
  id: string; campaignId: string; campaignTitle: string; contactId: string;
  email: string; company: string; status: DeliveryStatus; transport: 'simulation' | 'local' | 'smtp';
  attempts: number; createdAt: string; finishedAt: string | null; scheduledAt: string | null; nextAttemptAt: string;
}
export interface MessageTemplate {
  id: string; version: number; title: string; subject: string; body: string; targetPath: string;
  createdAt: string; updatedAt: string;
}
export interface CampaignPreview {
  subject: string; text: string; campaignLink: string;
  recipient: { id: string; email: string; source: string } | null;
  unsubscribeIsExample: true; sourceIsExample: boolean;
}
export interface ManagedProspect {
  id: string; version: number; email: string; name: string; company: string; jobTitle: string;
  source: string; sourceDate: string; informationConfirmed: boolean;
  status: 'active' | 'responded' | 'suppressed'; lastResponseAt: string | null; createdAt: string;
  alreadyIncluded?: boolean; eligible: boolean;
}
export interface ManagedCampaign {
  id: string; version: number; title: string; subject: string; body: string; targetPath: string;
  status: 'draft' | 'active' | 'paused'; linkPath: string; createdAt: string;
}
