import { defineArrayMember, defineField, defineType } from 'sanity';
import { validatePdfReview } from '../lib/pdf-draft';

function dedicatedPage(value: unknown): boolean {
  const parent = value as { slug?: { current?: string } } | undefined;
  return ['contact', 'reflexions'].includes(parent?.slug?.current ?? '');
}

const shortCopy = (name: string, title: string, max = 180) => defineField({ name, title, type: 'string', validation: r => r.max(max) });
const multilineCopy = (name: string, title: string, max = 600) => defineField({ name, title, type: 'text', rows: 3, description: 'Les retours à la ligne sont conservés par la mise en page.', validation: r => r.max(max) });
const smallLabels = (name: string, title: string) => defineField({ name, title, type: 'array', of: [defineArrayMember({ type: 'string', validation: r => r.required().max(60) })], validation: r => r.min(1).max(3) });

const textItem = defineType({
  name: 'textItem', title: 'Point clé', type: 'object', fields: [
    defineField({ name: 'title', title: 'Titre', type: 'string', validation: r => r.required().max(160) }),
    defineField({ name: 'text', title: 'Explication', type: 'text', rows: 4, validation: r => r.required().max(1400) }),
  ], preview: { select: { title: 'title', subtitle: 'text' } },
});
const cta = defineType({ name: 'cta', title: 'Appel à l’action', type: 'object', fields: [
  defineField({ name: 'label', title: 'Texte du lien', type: 'string', validation: r => r.required().max(90) }),
  defineField({ name: 'href', title: 'Destination dans le site', type: 'string', description: 'Exemple : /contact/?objet=diagnostic', validation: r => r.required().custom(value => typeof value === 'string' && /^\/(?!\/)[a-z0-9\-/]*(\?objet=(diagnostic|equipes|managers|autre))?$/.test(value) ? true : 'Utilisez un chemin interne sûr commençant par /, par exemple /contact/.') }),
] });
const seo = defineType({ name: 'seo', title: 'Référencement', type: 'object', fields: [
  defineField({ name: 'title', title: 'Titre pour les moteurs', type: 'string', validation: r => r.max(70) }),
  defineField({ name: 'description', title: 'Description', type: 'text', rows: 3, validation: r => r.max(170) }),
] });
const contentImage = defineType({ name: 'contentImage', title: 'Image', type: 'image', options: { hotspot: true }, fields: [
  defineField({ name: 'alt', title: 'Description de l’image', type: 'string', description: 'Décrivez ce qui est utile à une personne qui ne voit pas l’image. Aucun faux portrait.', validation: r => r.required().min(3).max(220) }),
], validation: r => r.custom(value => !value || value.asset?._ref ? true : 'Ajoutez un fichier image ou retirez entièrement ce champ.') });
const homeEditorial = defineType({ name: 'homeEditorial', title: 'Repères et textes secondaires', type: 'object', fields: [
  multilineCopy('heroAudience', 'Publics accompagnés'), smallLabels('heroDisciplines', 'Trois dimensions du travail'),
  shortCopy('heroArtTop', 'Illustration — texte du haut'), shortCopy('heroArtBottom', 'Illustration — texte du bas'), multilineCopy('heroArtCaption', 'Illustration — signature', 180), shortCopy('exploreLabel', 'Lien de défilement'),
  shortCopy('statisticsEyebrow', 'Chiffres — surtitre'), multilineCopy('statisticsDescription', 'Chiffres — introduction'), multilineCopy('statisticsNote', 'Chiffres — précaution de lecture'),
  shortCopy('diagnosticEyebrow', 'Diagnostic — surtitre'), shortCopy('diagnosticArtEyebrow', 'Diagnostic — surtitre de l’illustration'), smallLabels('diagnosticArtLegend', 'Diagnostic — légende de l’illustration'), multilineCopy('diagnosticArtTitle', 'Diagnostic — titre de l’illustration', 180), multilineCopy('diagnosticNote', 'Diagnostic — précision sur la prévention'),
  shortCopy('reasonsEyebrow', 'Pourquoi nous — surtitre'), defineField({ name: 'reasonsLink', title: 'Pourquoi nous — lien vers le binôme', type: 'cta' }), shortCopy('reasonsMotifLabel', 'Pourquoi nous — mot du motif', 60),
  shortCopy('domainsEyebrow', 'Accompagnements — surtitre'), shortCopy('convictionEyebrow', 'Conviction — surtitre'),
] });
const pageEditorial = defineType({ name: 'pageEditorial', title: 'Repères de la page', type: 'object', fields: [
  shortCopy('artTop', 'Illustration — texte du haut'), shortCopy('artBottom', 'Illustration — texte du bas'), shortCopy('methodLinkLabel', 'Lien vers les étapes du diagnostic'),
  shortCopy('invitationEyebrow', 'Invitation finale — surtitre'), multilineCopy('invitationTitle', 'Invitation finale — titre', 180),
] });
const journalEditorial = defineType({ name: 'journalEditorial', title: 'Carnet et état sans article', type: 'object', fields: [
  shortCopy('baseline', 'Signature du carnet'), shortCopy('topics', 'Thèmes du carnet'), shortCopy('seriesEyebrow', 'Série à venir — surtitre'), shortCopy('seriesStatus', 'Série à venir — statut', 60),
  multilineCopy('seriesTitle', 'Série à venir — titre', 180), multilineCopy('seriesText', 'Série à venir — présentation', 1200), defineField({ name: 'seriesCta', title: 'Série à venir — lien', type: 'cta' }),
  shortCopy('exploreEyebrow', 'Pour poursuivre — surtitre'), multilineCopy('exploreTitle', 'Pour poursuivre — titre', 180),
] });
const contactEditorial = defineType({ name: 'contactEditorial', title: 'Invitation à prendre contact', type: 'object', fields: [
  shortCopy('formEyebrow', 'Formulaire — surtitre'), multilineCopy('formTitle', 'Formulaire — titre', 180), shortCopy('directHeading', 'Coordonnées — titre'), multilineCopy('context', 'Précision pour choisir l’objet'), shortCopy('linkedinLabel', 'Libellé du lien LinkedIn'),
] });
const richText = defineType({ name: 'richText', title: 'Texte mis en forme', type: 'array', of: [defineArrayMember({
  type: 'block', styles: [{ title: 'Paragraphe', value: 'normal' }, { title: 'Titre de section', value: 'h2' }, { title: 'Sous-titre', value: 'h3' }, { title: 'Citation', value: 'blockquote' }],
  lists: [{ title: 'Liste', value: 'bullet' }, { title: 'Liste numérotée', value: 'number' }],
  marks: { decorators: [{ title: 'Gras', value: 'strong' }, { title: 'Italique', value: 'em' }], annotations: [
    defineArrayMember({ name: 'link', title: 'Lien', type: 'object', fields: [defineField({ name: 'href', title: 'Adresse du lien', type: 'url', validation: r => r.required().uri({ scheme: ['https', 'http', 'mailto', 'tel'], allowRelative: true }) })] }),
  ] },
})] });
const section = defineType({ name: 'section', title: 'Section éditoriale', type: 'object', fields: [
  defineField({ name: 'kind', title: 'Format de contenu', type: 'string', initialValue: 'text', options: { list: [{ title: 'Texte', value: 'text' }, { title: 'Étapes', value: 'steps' }, { title: 'Points clés', value: 'list' }, { title: 'Deux idées complémentaires', value: 'split' }, { title: 'Précision importante', value: 'notice' }] }, validation: r => r.required() }),
  defineField({ name: 'presentation', title: 'Présentation', type: 'string', initialValue: 'default', description: 'Le format décrit le contenu ; la présentation choisit son affichage. Les étapes détaillées et les questions restent utilisables sans animation.', options: { list: [{ title: 'Présentation habituelle', value: 'default' }, { title: 'Méthode détaillée — cinq étapes dépliables', value: 'method' }, { title: 'Questions fréquentes dépliables', value: 'faq' }, { title: 'Livrables', value: 'deliverables' }] }, validation: r => r.custom((value, context) => !value || value === 'default' || (value === 'method' && (context.parent as { kind?: string })?.kind === 'steps') || (['faq', 'deliverables'].includes(value) && (context.parent as { kind?: string })?.kind === 'list') ? true : 'La méthode exige le format Étapes ; les questions et livrables exigent le format Points clés.') }),
  shortCopy('navigationLabel', 'Libellé dans le sommaire', 60),
  defineField({ name: 'eyebrow', title: 'Surtitre', type: 'string', validation: r => r.max(100) }),
  defineField({ name: 'title', title: 'Titre', type: 'text', rows: 2, description: 'Les retours à la ligne sont conservés.', validation: r => r.required().max(180) }),
  defineField({ name: 'text', title: 'Paragraphe', type: 'text', rows: 5, validation: r => r.max(2400) }),
  defineField({ name: 'items', title: 'Étapes ou points clés', type: 'array', hidden: ({ parent }) => !parent?.items?.length && ['text', 'notice'].includes(parent?.kind ?? 'text'), of: [defineArrayMember({ type: 'textItem' })], validation: r => r.max(8).custom((value, context) => {
    const parent = context.parent as { kind?: string; presentation?: string };
    const length = Array.isArray(value) ? value.length : 0;
    if (parent?.presentation === 'method' && length !== 5) return 'La méthode détaillée présente cinq étapes.';
    if (['steps', 'list'].includes(parent?.kind ?? '') && !length) return 'Ajoutez au moins une étape ou un point clé.';
    return !length || !['text', 'notice'].includes(parent?.kind ?? 'text') ? true : 'Ce format ne présente pas de points clés : videz la liste ou choisissez un format adapté.';
  }) }),
  defineField({ name: 'instruction', title: 'Invitation à explorer les étapes', type: 'string', hidden: ({ parent }) => !parent?.instruction && parent?.presentation !== 'method', validation: r => r.max(150).custom((value, context) => !value || (context.parent as { presentation?: string })?.presentation === 'method' ? true : 'Cette invitation est réservée à la méthode détaillée.') }),
  defineField({ name: 'image', title: 'Image de la section (facultative)', type: 'contentImage', description: 'Illustration authentique ou dont les droits sont autorisés. Le texte reste lisible en son absence.' }),
  defineField({ name: 'body', title: 'Texte complémentaire', type: 'richText', hidden: ({ parent }) => !parent?.body?.length && parent?.kind && parent.kind !== 'text', validation: r => r.custom((value, context) => !Array.isArray(value) || !value.length || ((context.parent as { kind?: string })?.kind ?? 'text') === 'text' ? true : 'Le texte mis en forme est réservé au format Texte. Videz ce champ ou changez de format.') }),
], preview: { select: { title: 'title', subtitle: 'kind' } } });
const siteSettings = defineType({ name: 'siteSettings', title: 'Coordonnées et paramètres', type: 'document', fields: [
  defineField({ name: 'brand', title: 'Nom de marque', type: 'string', initialValue: 'Calas Conseil', readOnly: true, validation: r => r.required().custom(v => v === 'Calas Conseil' ? true : 'La marque est « Calas Conseil », avec un seul s.') }),
  defineField({ name: 'tagline', title: 'Signature', type: 'string', initialValue: 'La voie de la qualité relationnelle.', readOnly: true, description: 'Signature de marque liée aux exports du logo. Une évolution nécessite la mise à jour cohérente de ces exports.', validation: r => r.required().custom(v => v === 'La voie de la qualité relationnelle.' ? true : 'La signature validée est « La voie de la qualité relationnelle. »') }),
  defineField({ name: 'phone', title: 'Téléphone affiché', type: 'string', validation: r => r.required().regex(/^[+\d\s().-]{10,25}$/) }),
  defineField({ name: 'email', title: 'Courriel public', type: 'string', validation: r => r.required().email() }),
  defineField({ name: 'linkedin', title: 'Lien LinkedIn (facultatif)', type: 'url', description: 'Laissez vide tant que l’adresse exacte n’est pas validée.', validation: r => r.uri({ scheme: ['https'] }).custom(v => !v || /^https:\/\/(www\.)?linkedin\.com\//.test(v) ? true : 'Utilisez une URL LinkedIn exacte.') }),
  defineField({ name: 'footerText', title: 'Texte de pied de page', type: 'text', rows: 3, validation: r => r.max(400) }),
  defineField({ name: 'qualification', title: 'Qualification IPRP — contrôle avant affichage', type: 'object', description: 'Ne téléversez aucune attestation privée dans ce dataset. Le libellé n’est affiché que si le statut est vérifié.', fields: [
    defineField({ name: 'person', title: 'Personne titulaire de la qualification', type: 'reference', to: [{ type: 'person' }] }),
    defineField({ name: 'status', title: 'État de vérification', type: 'string', initialValue: 'pending', options: { list: [{ title: 'Non vérifiée — ne pas afficher', value: 'pending' }, { title: 'Justificatif contrôlé', value: 'verified' }] }, validation: r => r.required() }),
    defineField({ name: 'label', title: 'Libellé public vérifié', type: 'string', description: 'Formulation proposée : IPRP enregistrée auprès de la DREETS. À confirmer sur le justificatif.', validation: r => r.max(180) }),
    defineField({ name: 'registration', title: 'Numéro / région / validité vérifiés', type: 'string', validation: r => r.max(220) }),
  ], validation: r => r.custom(v => v?.status !== 'verified' || (v?.label && v?.person) ? true : 'Renseignez la personne et le libellé contrôlés avant de valider.') }),
], preview: { prepare: () => ({ title: 'Coordonnées et paramètres' }) } });
const statistic = defineType({ name: 'statistic', title: 'Chiffre et source', type: 'document', fields: [
  defineField({ name: 'value', title: 'Chiffre affiché', type: 'string', validation: r => r.required().max(60) }),
  defineField({ name: 'label', title: 'Ce que ce chiffre mesure', type: 'text', rows: 3, validation: r => r.required().max(500) }),
  defineField({ name: 'source', title: 'Organisme et publication', type: 'string', validation: r => r.required().max(250) }),
  defineField({ name: 'sourceUrl', title: 'URL primaire', type: 'url', validation: r => r.required().uri({ scheme: ['https'] }) }),
  defineField({ name: 'year', title: 'Millésime et période d’observation', type: 'string', validation: r => r.required().max(120) }),
  defineField({ name: 'note', title: 'Périmètre / méthode', type: 'text', rows: 4, validation: r => r.required().max(1200) }),
  defineField({ name: 'verified', title: 'Source et interprétation vérifiées', type: 'boolean', initialValue: false, description: 'Le chiffre reste masqué tant que cette vérification n’est pas faite. Pour un contenu non validé, conservez un vrai brouillon Sanity.' }),
], preview: { select: { title: 'value', subtitle: 'label' } } });
const homePage = defineType({ name: 'homePage', title: 'Accueil', type: 'document', groups: [{ name: 'hero', title: 'Premier écran', default: true }, { name: 'content', title: 'Sections' }, { name: 'seo', title: 'Référencement' }], fields: [
  defineField({ name: 'eyebrow', title: 'Surtitre', type: 'string', group: 'hero', validation: r => r.required().max(140) }),
  defineField({ name: 'title', title: 'Titre principal', type: 'text', rows: 3, group: 'hero', validation: r => r.required().max(250) }),
  defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 6, group: 'hero', validation: r => r.required().max(1200) }),
  defineField({ name: 'primaryCta', title: 'Lien prioritaire', type: 'cta', group: 'hero', validation: r => r.required() }),
  defineField({ name: 'secondaryCta', title: 'Second lien', type: 'cta', group: 'hero', validation: r => r.required() }),
  defineField({ name: 'statisticsTitle', title: 'Titre des chiffres', type: 'string', group: 'content', validation: r => r.max(180) }),
  defineField({ name: 'statistics', title: 'Chiffres sourcés', type: 'array', group: 'content', of: [defineArrayMember({ type: 'reference', to: [{ type: 'statistic' }] })], validation: r => r.max(4).unique() }),
  defineField({ name: 'statisticsTransition', title: 'Transition après les chiffres', type: 'text', rows: 3, group: 'content', validation: r => r.max(400) }),
  defineField({ name: 'diagnostic', title: 'Diagnostic prioritaire', type: 'object', group: 'content', fields: [defineField({ name: 'title', title: 'Titre', type: 'text', rows: 2, validation: r => r.required().max(180) }), defineField({ name: 'text', title: 'Texte', type: 'text', rows: 5, validation: r => r.required().max(1400) }), defineField({ name: 'cta', title: 'Lien', type: 'cta', validation: r => r.required() }), defineField({ name: 'image', title: 'Image du diagnostic (facultative)', type: 'contentImage', description: 'Remplace l’illustration abstraite si une image est choisie.' })], validation: r => r.required() }),
  defineField({ name: 'reasonsTitle', title: 'Titre : pourquoi Calas Conseil', type: 'text', rows: 2, group: 'content', validation: r => r.max(180) }),
  defineField({ name: 'reasons', title: 'Trois raisons de travailler ensemble', type: 'array', group: 'content', of: [defineArrayMember({ type: 'textItem' })], validation: r => r.required().length(3) }),
  defineField({ name: 'domainsTitle', title: 'Titre des trois domaines', type: 'text', rows: 2, group: 'content', validation: r => r.max(180) }),
  defineField({ name: 'domainsIntro', title: 'Introduction des domaines', type: 'text', rows: 3, group: 'content', validation: r => r.max(600) }),
  defineField({ name: 'conviction', title: 'Notre conviction', type: 'object', group: 'content', fields: [defineField({ name: 'title', title: 'Titre', type: 'string', validation: r => r.required() }), defineField({ name: 'text', title: 'Texte', type: 'text', rows: 5, validation: r => r.required().max(1400) }), defineField({ name: 'cta', title: 'Lien', type: 'cta', validation: r => r.required() })], validation: r => r.required() }),
  defineField({ name: 'closingTitle', title: 'Invitation finale', type: 'text', rows: 2, group: 'content', validation: r => r.max(180) }),
  defineField({ name: 'closingCta', title: 'Lien de contact final', type: 'cta', group: 'content' }),
  defineField({ name: 'editorial', title: 'Repères et textes secondaires', type: 'homeEditorial', group: 'content', description: 'Textes autour des illustrations, précisions et surtitres. Les numéros et contrôles de navigation restent gérés par le site.' }),
  defineField({ name: 'seo', title: 'Référencement', type: 'seo', group: 'seo' }),
], preview: { select: { title: 'title' }, prepare: ({ title }) => ({ title: 'Accueil', subtitle: title }) } });
const page = defineType({ name: 'page', title: 'Page', type: 'document', fields: [
  defineField({ name: 'slug', title: 'Adresse de la page', type: 'slug', description: 'Adresse prédéfinie : diagnostic-rps, equipes, managers, notre-approche, qui-sommes-nous, reflexions, contact, mentions-legales ou confidentialite.', validation: r => r.required().custom(v => !v?.current || ['diagnostic-rps', 'equipes', 'managers', 'notre-approche', 'qui-sommes-nous', 'reflexions', 'contact', 'mentions-legales', 'confidentialite'].includes(v.current) ? true : 'Choisissez une adresse prévue dans l’architecture du site.') }),
  defineField({ name: 'eyebrow', title: 'Surtitre', type: 'string', validation: r => r.max(130) }),
  defineField({ name: 'title', title: 'Titre principal', type: 'text', rows: 3, description: 'Les retours à la ligne sont conservés.', validation: r => r.required().max(220) }),
  defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 6, validation: r => r.required().max(1800) }),
  defineField({ name: 'sections', title: 'Contenu de la page', type: 'array', of: [defineArrayMember({ type: 'section' })], validation: r => r.max(12) }),
  defineField({ name: 'offerExcerpt', title: 'Résumé dans les accompagnements de l’accueil', type: 'text', rows: 3, hidden: ({ parent }) => !parent?.offerExcerpt && !['diagnostic-rps', 'equipes', 'managers'].includes(parent?.slug?.current ?? ''), validation: r => r.max(320).custom((value, context) => !value || ['diagnostic-rps', 'equipes', 'managers'].includes((context.parent as { slug?: { current?: string } })?.slug?.current ?? '') ? true : 'Ce résumé concerne les trois offres de l’accueil.') }),
  defineField({ name: 'editorial', title: 'Repères et invitation finale', type: 'pageEditorial', hidden: ({ parent }) => dedicatedPage(parent) && !parent?.editorial, validation: r => r.custom((value, context) => !value || !dedicatedPage(context.parent) ? true : 'Contact et Réflexions utilisent leurs repères dédiés.') }),
  defineField({ name: 'journal', title: 'Carnet Réflexions', type: 'journalEditorial', hidden: ({ parent }) => parent?.slug?.current !== 'reflexions' && !parent?.journal, validation: r => r.custom((value, context) => !value || (context.parent as { slug?: { current?: string } })?.slug?.current === 'reflexions' ? true : 'Ces textes sont réservés à la page Réflexions.') }),
  defineField({ name: 'contact', title: 'Repères du contact', type: 'contactEditorial', hidden: ({ parent }) => parent?.slug?.current !== 'contact' && !parent?.contact, validation: r => r.custom((value, context) => !value || (context.parent as { slug?: { current?: string } })?.slug?.current === 'contact' ? true : 'Ces textes sont réservés à la page Contact.') }),
  defineField({ name: 'cta', title: 'Lien de contact ou de poursuite', type: 'cta', description: 'Facultatif. Sur Contact et Réflexions, ce lien apparaît après les contenus éditoriaux.' }),
  defineField({ name: 'image', title: 'Image éditoriale (facultative)', type: 'contentImage' }),
  defineField({ name: 'format', title: 'Format commercial confirmé', type: 'object', description: 'Ne renseignez que les modalités validées. Laissez vide une durée envisagée.', hidden: ({ parent }) => dedicatedPage(parent) && !parent?.format, validation: r => r.custom((value, context) => !value || !dedicatedPage(context.parent) ? true : 'Les modalités commerciales se règlent sur une offre, pas sur Contact ou Réflexions.'), fields: [defineField({ name: 'duration', title: 'Durée', type: 'string', validation: r => r.max(100) }), defineField({ name: 'rhythm', title: 'Rythme', type: 'string', validation: r => r.max(150) }), defineField({ name: 'delivery', title: 'Modalités', type: 'string', validation: r => r.max(220) })] }),
  defineField({ name: 'seo', title: 'Référencement', type: 'seo' }),
], preview: { select: { title: 'title', subtitle: 'slug.current' } } });
const person = defineType({ name: 'person', title: 'Personne / auteure', type: 'document', fields: [
  defineField({ name: 'name', title: 'Nom', type: 'string', validation: r => r.required().max(100) }),
  defineField({ name: 'role', title: 'Fonction et qualifications vérifiées', type: 'text', rows: 3, validation: r => r.required().max(400) }),
  defineField({ name: 'bio', title: 'Biographie approuvée', type: 'text', rows: 8, validation: r => r.max(4000) }),
  defineField({ name: 'portrait', title: 'Portrait authentique (facultatif)', type: 'contentImage' }),
  defineField({ name: 'order', title: 'Ordre de présentation', type: 'number', initialValue: 0, validation: r => r.integer().min(0) }),
], preview: { select: { title: 'name', subtitle: 'role', media: 'portrait' } } });
const category = defineType({ name: 'category', title: 'Catégorie', type: 'document', fields: [
  defineField({ name: 'title', title: 'Nom', type: 'string', validation: r => r.required().max(80) }),
  defineField({ name: 'slug', title: 'Identifiant lisible', type: 'slug', options: { source: 'title', maxLength: 96 }, validation: r => r.required().custom(v => !v?.current || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.current) ? true : 'Minuscules, chiffres et tirets uniquement.') }),
] });
const article = defineType({ name: 'article', title: 'Article', type: 'document', fields: [
  defineField({ name: 'title', title: 'Titre', type: 'string', validation: r => r.required().max(220) }),
  defineField({ name: 'slug', title: 'Adresse de l’article', type: 'slug', options: { source: 'title', maxLength: 96 }, validation: r => r.required().custom(v => !v?.current || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.current) ? true : 'Minuscules, chiffres et tirets uniquement.') }),
  defineField({ name: 'date', title: 'Date de publication', type: 'datetime', validation: r => r.required() }),
  defineField({ name: 'excerpt', title: 'Résumé', type: 'text', rows: 4, validation: r => r.required().max(500) }),
  defineField({ name: 'author', title: 'Auteure réelle', type: 'reference', to: [{ type: 'person' }], validation: r => r.required() }),
  defineField({ name: 'category', title: 'Catégorie', type: 'reference', to: [{ type: 'category' }] }),
  defineField({ name: 'image', title: 'Image principale', type: 'contentImage' }),
  defineField({ name: 'sourcePdf', title: 'PDF original à télécharger', type: 'file', options: { accept: 'application/pdf' }, description: 'Document destiné à être diffusé. Une fois téléversé, le fichier Sanity est accessible à toute personne possédant son lien, même si l’article reste en brouillon.', validation: r => r.custom(value => !value || (value.asset?._ref && /^file-[a-zA-Z0-9]+-pdf$/.test(value.asset._ref)) ? true : 'Ajoutez un fichier PDF ou retirez entièrement ce champ.') }),
  defineField({ name: 'pdfImport', title: 'Relecture du document importé', type: 'object', description: 'L’extraction automatique peut déplacer des titres, couper des phrases ou mal reconnaître des mots. Vérifiez le texte avec le PDF avant publication.', initialValue: { reviewed: false }, fields: [
    defineField({ name: 'pageCount', title: 'Nombre de pages analysées', type: 'number', readOnly: true, validation: r => r.integer().min(1).max(40) }),
    defineField({ name: 'ocrPages', title: 'Pages passées en reconnaissance de caractères', type: 'number', readOnly: true, validation: r => r.integer().min(0).max(40) }),
    defineField({ name: 'reviewed', title: 'J’ai relu et corrigé l’article à partir du PDF', type: 'boolean', initialValue: false }),
  ], validation: r => r.custom((value, context) => validatePdfReview(value, context.document)) }),
  defineField({ name: 'body', title: 'Article', type: 'richText', validation: r => r.required().min(1) }),
  defineField({ name: 'seo', title: 'Référencement', type: 'seo' }),
], preview: { select: { title: 'title', subtitle: 'author.name', media: 'image' } } });

export const schemaTypes = [cta, seo, contentImage, richText, textItem, section, homeEditorial, pageEditorial, journalEditorial, contactEditorial, siteSettings, statistic, homePage, page, person, category, article];
