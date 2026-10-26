export interface RichMark { type: 'bold' | 'italic' | 'link' | 'strike' | 'code' | 'underline'; attrs?: Record<string, unknown> }
export interface RichNode { type: string; text?: string; attrs?: Record<string, unknown>; marks?: RichMark[]; content?: RichNode[] }
export interface RichDocument extends RichNode { type: 'doc'; content: RichNode[] }

export interface Cta { label: string; href: string }
export interface Seo { title?: string; description?: string }
export interface ContentImage {
  alt: string;
  mediaId: string; width?: number; height?: number;
  crop?: { top: number; bottom: number; left: number; right: number };
  hotspot?: { x: number; y: number; width: number; height: number };
}
export interface ContentFile {
  mediaId: string; originalFilename?: string; size?: number; mimeType?: string;
}
export interface Statistic {
  id: string; value: string; label: string; source: string; sourceUrl: string;
  year: string; note: string; verified: boolean;
}
export interface Person { id: string; name: string; role: string; bio?: string; portrait?: ContentImage }
export interface Section {
  key: string; title?: string; eyebrow?: string; text?: string;
  kind?: 'text' | 'steps' | 'list' | 'split' | 'notice';
  presentation?: 'default' | 'method' | 'faq' | 'deliverables';
  navigationLabel?: string; instruction?: string; image?: ContentImage;
  items?: Array<{ key?: string; title: string; text: string; number?: string }>;
  body?: RichDocument;
}
export interface Page {
  id: string; slug: string; title: string; eyebrow?: string; intro: string;
  sections: Section[]; cta?: Cta; image?: ContentImage; seo?: Seo;
  format?: { duration?: string; rhythm?: string; delivery?: string };
  offerExcerpt?: string;
  editorial?: { artTop?: string; artBottom?: string; methodLinkLabel?: string; invitationEyebrow?: string; invitationTitle?: string };
  journal?: { baseline?: string; topics?: string; seriesEyebrow?: string; seriesStatus?: string; seriesTitle?: string; seriesText?: string; seriesCta?: Cta; exploreEyebrow?: string; exploreTitle?: string };
  contact?: { formEyebrow?: string; formTitle?: string; directHeading?: string; context?: string; linkedinLabel?: string };
}
export interface Article {
  id: string; slug: string; title: string; date: string; excerpt: string;
  body: RichDocument; author?: Person; category?: { title: string; slug?: string };
  image?: ContentImage; sourcePdf?: ContentFile; seo?: Seo;
}
export interface SiteSettings {
  brand: string; tagline: string; phone: string; email: string; linkedin?: string;
  qualification: { status: 'pending' | 'verified'; label?: string; registration?: string; personId?: string };
  footerText?: string;
  contactText?: string;
}
export interface Home {
  eyebrow: string; title: string; intro: string; primaryCta: Cta; secondaryCta: Cta;
  statistics: Statistic[]; statisticsTitle?: string; statisticsTransition?: string;
  diagnostic: { title: string; text: string; cta: Cta; image?: ContentImage };
  reasons: Array<{ key?: string; title: string; text: string }>;
  reasonsTitle?: string;
  domainsTitle?: string; domainsIntro?: string;
  conviction: { title: string; text: string; cta: Cta };
  closingTitle?: string; closingCta?: Cta; seo?: Seo;
  editorial?: {
    heroAudience?: string; heroDisciplines?: string[]; heroArtTop?: string; heroArtBottom?: string; heroArtCaption?: string; exploreLabel?: string;
    statisticsEyebrow?: string; statisticsDescription?: string; statisticsNote?: string;
    diagnosticEyebrow?: string; diagnosticArtEyebrow?: string; diagnosticArtLegend?: string[]; diagnosticArtTitle?: string; diagnosticNote?: string;
    reasonsEyebrow?: string; reasonsLink?: Cta; reasonsMotifLabel?: string; domainsEyebrow?: string; convictionEyebrow?: string;
  };
}
export interface SiteContent { settings: SiteSettings; home: Home; pages: Page[]; people: Person[]; articles: Article[] }
