import { SectionHeading } from './ui';

const topics = [
  {
    title: 'Publier mon premier article',
    steps: [
      'Dans Réflexions, choisissez « Écrire un article ». Donnez-lui un titre et cliquez sur « Créer le brouillon » pour le retrouver plus tard.',
      'Rédigez votre texte et un court résumé. Choisissez une auteure, une catégorie publiée et une date. La rubrique « Avant de publier » vous conduit aux champs à compléter.',
      'Enregistrez puis ouvrez « Prévisualiser ». Relisez aussi l’aperçu mobile. Quand l’article est prêt, cliquez sur « Publier » et confirmez.',
    ],
    href: '/admin/articles/new/', action: 'Écrire un article',
  },
  {
    title: 'Transformer un PDF en article',
    steps: [
      'Ouvrez l’import et choisissez votre PDF. Le navigateur extrait le texte et peut reconnaître les caractères sur les pages scannées.',
      'Vérifiez le texte extrait et le titre, puis créez le brouillon. Vous pourrez encore modifier l’article dans Réflexions.',
      'Après relecture, cochez la confirmation dans « PDF original et relecture ». Si les visiteurs doivent aussi recevoir le fichier, cochez « Autoriser le téléchargement du PDF avec cet article publié » avant de publier.',
    ],
    href: '/admin/articles/import/', action: 'Importer un PDF',
  },
  {
    title: 'Modifier une page ou une image',
    steps: [
      'Dans « Pages du site », ouvrez la page puis la section dont vous reconnaissez le titre.',
      'Pour une image, ouvrez son sélecteur, puis choisissez ou importez le fichier. Renseignez son texte alternatif et ajustez le cadrage.',
      'Enregistrez le brouillon. Vérifiez l’aperçu avant de publier sur le site.',
    ],
    href: '/admin/pages/', action: 'Ouvrir les pages',
  },
  {
    title: 'Changer un portrait ou une biographie',
    steps: [
      'Dans « Équipe », ouvrez la fiche de Sara ou d’Agnès. La fonction, la biographie et le portrait se modifient sur cette fiche.',
      'Publiez la fiche après relecture. Le portrait et la fonction sont repris sur l’accueil et sur « Qui sommes-nous ». Le numéro RPPS d’Agnès se modifie également sur sa fiche.',
    ],
    href: '/admin/people/', action: 'Ouvrir les fiches équipe',
  },
  {
    title: 'Retrouver ou restaurer une version',
    steps: [
      'Dans le tableau de bord, retrouvez le travail en cours. Pour revenir sur un changement précis, ouvrez la fiche puis « Historique ».',
      'Comparez les versions avant de choisir « Restaurer cette version ». La restauration crée un brouillon. Publiez-le pour le rendre visible.',
    ],
    href: '/admin/', action: 'Retrouver mes contenus',
  },
];

export function EditorialGuide() {
  return <>
    <SectionHeading title="Guide de l’administration" description="Choisissez la tâche que vous souhaitez réaliser."/>
    {topics.map((topic, index) => <details className="admin-editor-section admin-guide-topic" key={topic.title} open={index === 0}>
      <summary>{topic.title}</summary>
      <div className="admin-card-body">
        <ol>{topic.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <a className="admin-text-link" href={topic.href}>{topic.action}</a>
      </div>
    </details>)}
  </>;
}
