import { isLinkedInArticleUrl } from './article-links';

interface BodyNode { type?: string; text?: string; content?: BodyNode[] }
interface ArticleInput {
  title?: string; slug?: string; excerpt?: string; body?: BodyNode; externalUrl?: string;
  authorId?: string; categoryId?: string; date?: string;
  pdfImport?: { reviewed: boolean }; sourcePdf?: { mediaId: string };
}

export const articleSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hasRichContent(node?: BodyNode): boolean {
  return Boolean(node?.text?.trim() || node?.type === 'image' || node?.content?.some(hasRichContent));
}

/** Used by the live editorial checklist and by the server before publication. */
export function articlePublicationIssues(article: ArticleInput, now = Date.now()): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!article.title?.trim()) fields.title = 'Ajoutez le titre de l’article.';
  if (!article.slug || !articleSlugPattern.test(article.slug) || article.slug.length > 96) fields.slug = 'Renseignez une adresse en minuscules, chiffres et tirets.';
  if (!article.excerpt?.trim()) fields.excerpt = 'Ajoutez un résumé.';
  if (!article.authorId) fields.authorId = 'Choisissez une auteure.';
  if (!article.categoryId) fields.categoryId = 'Choisissez une catégorie.';
  const date = Date.parse(article.date ?? '');
  if (!Number.isFinite(date) || date > now) fields.date = 'Indiquez une date de publication qui ne soit pas dans le futur.';
  if (article.externalUrl) {
    if (!isLinkedInArticleUrl(article.externalUrl)) fields.externalUrl = 'Vérifiez le lien vers l’article LinkedIn.';
  } else if (!hasRichContent(article.body)) fields.body = 'L’article ne contient pas encore de texte.';
  if ((article.pdfImport || article.sourcePdf) && !article.pdfImport?.reviewed) fields.pdfImport = 'Confirmez la relecture du document importé.';
  return fields;
}
