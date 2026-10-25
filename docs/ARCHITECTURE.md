# Décision d’architecture — 25 octobre 2026

Le dépôt initial est vide. Le cahier des charges ODT V2 a été lu intégralement (y compris les trois liens) et le JPEG observé. Les corrections explicites du brief priment : Calas Conseil, sans second s ; Astro, sans WordPress ; formulation IPRP et statistiques à vérifier.

Monorepo pnpm : `apps/web` en Astro SSR + adaptateur Node standalone ; `apps/studio` Sanity séparé. TypeScript strict. HTML rendu serveur, CSS personnalisé, GSAP réservé au mouvement ; React réservé au Studio ; édition visuelle privée chargée par une entrée navigateur indépendante. Polices locales sous licence OFL. Aucun outil publicitaire, service 3D, paiement, espace client ou base additionnelle.

Le mode `CONTENT_MODE=demo` sélectionne explicitement les contenus de travail issus du brief. Il n’est jamais un secours silencieux en cas de panne Sanity. En mode connecté, une indisponibilité donne une réponse 503 maîtrisée. Les pages SSR publiques utilisent published ; la prévisualisation requiert un secret Sanity vérifié puis une session signée côté serveur, privée et non indexable.

Le formulaire utilise un transport mémoire simulé en développement, jamais l’adresse réelle. SMTP authentifié configurable, validation serveur, contrôle d’origine, limites de taille, honeypot, débit borné et idempotence. Le stockage de limitation est mémoire, adapté à une seule instance ; une protection mutualisée en amont est nécessaire avant plusieurs instances.

Plan : (1) sources et décisions ; (2) identité, accueil et Diagnostic ; (3) pages, CMS, contact ; (4) navigateur, accessibilité, budgets et livraison. Aucune publication avant la validation de Sara et Agnès et la relecture finale. Aucun service payant ni domaine acheté.


## Refonte éditoriale et visuelle — 25 octobre 2026

Après rejet de la première direction visuelle, l’accueil et toutes les pages éditoriales ont été recomposés. L’accueil conserve les six blocs et le titre imposés, avec un premier écran bleu nuit, une coquille de grand format, des sections différenciées et des offres présentées en lignes. Les titres restent en Cormorant Garamond et les textes en EB Garamond ; les contrôles et repères utilisent la police système Arial pour mieux distinguer la navigation du contenu. Les polices principales sont préchargées localement.

Le Diagnostic dispose d’un sommaire, de cinq étapes consultables sans JavaScript, de livrables distincts et d’une FAQ. Les pages Équipes, Managers, Approche et Équipe ont été développées à partir des éléments fournis. Ces compléments sont des propositions éditoriales à relire, sans nouveau témoignage, portrait, diplôme, tarif ou durée contractuelle. Le modèle Sanity existant conserve leur édition structurée.

Une entrée de mouvement unique dans Layout orchestre GSAP et ScrollTrigger : apparition de sections, dessin de trajectoires, progression de lecture et du diagnostic, parallaxe limitée à 18 px sur ordinateur pour les illustrations concernées. Le logo se déroule depuis son noyau, dans l’ordre des rubans intérieurs vers les rubans extérieurs ; son bloc reste fixe, sans parallaxe. LinkArt est une illustration vectorielle distincte du logo. Les actions du premier écran restent entièrement visibles pendant l’animation ; le logo complet est affiché sans JavaScript ou en mouvement réduit. Aucune dépendance à un service d’images ou de génération n’a été ajoutée.
