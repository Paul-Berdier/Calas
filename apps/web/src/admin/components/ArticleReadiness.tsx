import { CheckCircle2, ListChecks } from 'lucide-react';
import { articlePublicationIssues } from '../../lib/article-publication';
import type { ContentSummary, EditorialContent } from '../api';

export function ArticleReadiness({article, people, categories}: {
  article: EditorialContent; people: ContentSummary[]; categories: ContentSummary[];
}) {
  const issues = articlePublicationIssues(article);
  const author = people.find(item => item.id === article.authorId);
  const category = categories.find(item => item.id === article.categoryId);
  if (author && author.status !== 'published') issues.authorId = 'Choisissez une auteure dont la fiche est publiée.';
  if (category && category.status !== 'published') issues.categoryId = 'Choisissez une catégorie publiée.';
  const entries = Object.entries(issues);
  return (
    <details className="admin-readiness">
      <summary>
        {entries.length ? <ListChecks size={18} aria-hidden/> : <CheckCircle2 size={18} aria-hidden/>}
        <span>Avant de publier</span>
        <strong>{entries.length ? `${entries.length} point${entries.length > 1 ? 's' : ''} à compléter` : 'Champs renseignés'}</strong>
      </summary>
      {entries.length ? <ul>{entries.map(([key, message]) =>
        <li key={key}><button type="button" className="admin-text-link" onClick={event => {
          const field = event.currentTarget.closest('fieldset')?.querySelector<HTMLElement>(`[data-editor-field="${key}"]`);
          if (!field) return;
          const section = field.closest('details');
          if (section) section.open = true;
          const control = field.matches('input, textarea, select, button') ? field : field.querySelector<HTMLElement>('[contenteditable="true"]');
          (control ?? field).focus();
          field.scrollIntoView({block: 'center'});
        }}>{message}</button></li>
      )}</ul> : <p>Ouvrez l’aperçu pour relire l’article, puis choisissez « Publier » quand il est prêt.</p>}
    </details>
  );
}
