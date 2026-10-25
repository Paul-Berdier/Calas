import type { PortableTextBlock } from '@portabletext/types';

export interface Cta { label: string; href: string }
export interface Seo { title?: string; description?: string }
export interface ContentImage {
  alt: string;
  asset: { _ref?: string; _id?: string; url?: string; metadata?: { dimensions?: { width: number; height: number }; lqip?: string } };
  crop?: { top: number; bottom: number; left: number; right: number };
  hotspot?: { x: number; y: number; width: number; height: number };
}
export interface ContentFile {
  asset?: { _id?: string; url?: string; originalFilename?: string; size?: number; mimeType?: string };
}
export interface Statistic {
  _id: string; value: string; label: string; source: string; sourceUrl: string;
  year: string; note: string; verified: boolean;
}
export interface Person { _id: string; name: string; role: string; bio?: string; portrait?: ContentImage }
export interface Section {
  _key: string; title?: string; eyebrow?: string; text?: string;
  kind?: 'text' | 'steps' | 'list' | 'split' | 'notice';
  presentation?: 'default' | 'method' | 'faq' | 'deliverables';
  navigationLabel?: string; instruction?: string; image?: ContentImage;
  items?: Array<{ _key?: string; title: string; text: string; number?: string }>;
  body?: PortableTextBlock[];
}
export interface Page {
  _id: string; slug: string; title: string; eyebrow?: string; intro: string;
  sections: Section[]; cta?: Cta; image?: ContentImage; seo?: Seo;
  format?: { duration?: string; rhythm?: string; delivery?: string };
  offerExcerpt?: string;
  editorial?: { artTop?: string; artBottom?: string; methodLinkLabel?: string; invitationEyebrow?: string; invitationTitle?: string };
  journal?: { baseline?: string; topics?: string; seriesEyebrow?: string; seriesStatus?: string; seriesTitle?: string; seriesText?: string; seriesCta?: Cta; exploreEyebrow?: string; exploreTitle?: string };
  contact?: { formEyebrow?: string; formTitle?: string; directHeading?: string; context?: string; linkedinLabel?: string };
}
export interface Article {
  _id: string; slug: string; title: string; date: string; excerpt: string;
  body: PortableTextBlock[]; author: Person; category?: { title: string; slug?: string };
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
  reasons: Array<{ _key?: string; title: string; text: string }>;
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
