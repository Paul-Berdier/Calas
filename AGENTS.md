# Calas Conseil — règles du projet

- Lire `docs/ARCHITECTURE.md`, `docs/VALIDATION.md` et le README avant modification.
- Marque : Calas Conseil (un seul s). Signature : La voie de la qualité relationnelle.
- Astro SSR et Sanity Studio séparé. Aucun WordPress, CRM, paiement ou espace client.
- Les données locales dans `apps/web/src/lib/cms/demo.ts` sont un mode explicite de recette, jamais un repli après panne du CMS.
- Brouillons : session signée, validation du secret Sanity, jeton exclusivement serveur, absence de cache. Le public utilise published.
- Ne pas publier avant validation de l’accueil/Diagnostic par Sara et Agnès puis relecture finale. Aucun achat ou service payant sans instruction explicite.
- Aucun email de test à Sara. Utiliser la simulation ; SMTP réel exige son raccordement et l’autorisation de recette.
- Ne pas inventer portraits, qualification IPRP, biographie, témoignage, implantations ou articles signés.
- Préserver la source unique du logo dans `assets/brand/geometry.mjs`. Tester mouvement réduit et absence de JavaScript.
- Après modification : typecheck, lint et tests adaptés. Rebuild avant tests du serveur standalone. Ne pas reconstruire `dist` pendant qu’un serveur de recette utilise ses chunks.
- Utiliser Node24.19.0 / pnpm11.25.0. Les installations et compilations ne doivent jamais importer ou publier des contenus.
