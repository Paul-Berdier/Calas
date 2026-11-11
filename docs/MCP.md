# Connexion IA à l’administration Calas Conseil

Le connecteur permet aux applications IA de travailler avec le compte de Sara, Agnès ou Paul. Il utilise le SDK MCP officiel (`@modelcontextprotocol/server` 2.4.0) et propose deux transports : **Streamable HTTP distant avec OAuth**, pour ChatGPT et Claude sur le web ainsi que leurs clients compatibles ; **stdio local**, pour un poste configuré avec Codex ou Claude Desktop. L’IA ne reçoit ni mot de passe administrateur, ni clé SMTP, ni accès à PostgreSQL ou au stockage.

L’URL du serveur distant est **https://www.calas-conseil.fr/mcp/**. `/api/agent/tools/` reste une API privée pour le pont local : ce n’est pas l’URL à saisir dans les applications web. Le serveur, les migrations et le domaine HTTPS doivent être déployés avant la connexion externe. Les tests locaux ne constituent pas une connexion effective aux comptes personnels ChatGPT/Claude.

## Connexion depuis ChatGPT ou Claude sur le web

Pour ChatGPT, ouvrir **Plugins**, utiliser **Ajouter un serveur MCP personnalisé**, saisir le nom « Calas Conseil » et l’URL ci-dessus, puis choisir **OAuth**. Laisser l’identification du client en enregistrement automatique (DCR), sans inventer d’identifiant ni de secret. Créer puis installer le plugin dans le compte ou l’espace de travail autorisé. L’accès à cette fonction dépend des permissions et restrictions de l’espace ChatGPT. [Guide OpenAI des serveurs MCP personnalisés](https://developers.openai.com/api/docs/guides/custom-mcp-server).

Pour Claude, ouvrir **Personnaliser → Connecteurs → Ajouter un connecteur personnalisé**, renseigner le nom et l’URL, puis choisir la connexion OAuth et **Register automatically / Enregistrer automatiquement**. L’identité publiée CIMD n’est pas prise en charge par cette première version ; l’enregistrement automatique DCR l’est. Dans une organisation, le propriétaire doit parfois ajouter le connecteur avant que chaque personne puisse se connecter. [Guide officiel Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

Dans les deux cas :

1. L’application ouvre le site Calas. Se connecter avec son adresse et son mot de passe habituels ; le TOTP reste demandé uniquement pour les comptes dont la politique l’exige déjà.
2. Vérifier le nom de l’application, **le domaine de retour** et les permissions demandées. Le nom fourni lors de l’enregistrement d’un client n’est pas une identité certifiée.
3. Sélectionner les permissions souhaitées puis cliquer sur **Autoriser**. Le raccordement propose les permissions complètes ; un éditeur ne voit pas la gestion des utilisateurs. Une demande explicite en lecture seule reste en lecture seule. **Refuser** termine la demande sans accès.
4. Revenir à l’application IA et commencer par demander le tableau de bord. Conserver les approbations avant publication ou envoi de campagne.
5. Dans **Administration → Connexions IA**, la liste des connexions distantes permet de révoquer l’autorisation de l’application.

Le jeton d’accès dure quinze minutes et se renouvelle automatiquement si le client le demande. La connexion autorisée est bornée à huit heures et à la session Calas ayant donné son accord. Après expiration ou déconnexion, l’application doit proposer une nouvelle connexion OAuth. Chaque personne autorise son propre compte, avec ses propres droits. Aucun secret n’est à copier dans la conversation.

Pour Codex, le transport distant peut également être ajouté au lieu du pont local :

```powershell
codex mcp add calas --url https://www.calas-conseil.fr/mcp/
codex mcp login calas --scopes read,draft,publish,outreach,send,users
```

Un éditeur ne peut pas autoriser `users`. Les permissions demandées peuvent être réduites au consentement. Le client doit conserver ses propres `state`, vérificateur PKCE et identifiants d’enregistrement. [Configuration MCP Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Alternative locale : créer l’accès personnel

1. Se connecter à l’administration avec son compte habituel.
2. Ouvrir **Connexions IA**, choisir un nom (« Claude sur mon ordinateur » par exemple), puis les permissions.
3. Le choix complet donne les actions disponibles pour son rôle. Décocher les permissions inutiles pour une tâche de lecture ou de préparation.
4. Créer l’accès et copier le jeton affiché une seule fois dans la configuration privée du connecteur. Ne pas le coller dans une conversation, un document partagé ou Git.
5. L’accès expire au plus tard huit heures après sa création, et plus tôt si la session se termine. Une déconnexion, une révocation de session ou un changement de droits peut donc imposer un nouvel accès. L’écran permet de révoquer immédiatement ses propres accès.

| Permission | Actions |
| --- | --- |
| `read` | Identité, tableau de bord, contenus, révisions, historique, médias, campagnes et statistiques |
| `draft` | Créer, enregistrer, restaurer des brouillons ; modifier les métadonnées d’un média ; supprimer un média inutilisé |
| `publish` | Publier, dépublier ou archiver avec la version relue et la confirmation demandée |
| `outreach` | Préparer des campagnes, gérer/importer les prospects, enregistrer réponses/oppositions et effacer une fiche |
| `send` | Mettre en file, suspendre ou reprendre les envois de campagne |
| `users` | Lister, inviter et gérer les comptes ; administrateur uniquement |

Une permission ne dépasse jamais les droits du compte. Les paramètres du site restent réservés aux administrateurs. L’import de nouveaux fichiers et l’OCR des PDF restent disponibles dans l’administration ; le MCP utilise les médias existants. Les aperçus privés restent soumis à la connexion du navigateur.

## Installer le programme local

Sur l’ordinateur qui exécute Claude Desktop ou Codex, récupérer le dépôt puis utiliser Node **24.19.0** et pnpm **11.25.0** :

```powershell
pnpm install --frozen-lockfile
pnpm build:mcp
```

Le programme produit est `apps/mcp/dist/index.mjs`. Dans les exemples suivants, adapter les chemins absolus à l’ordinateur. Le site doit déjà disposer de la migration et de la version d’application comprenant l’API MCP. Aucune installation ou compilation ne crée de jeton, n’importe de contenu et n’envoie de message.

## Codex local

Ajouter ce bloc au fichier personnel `~/.codex/config.toml`, sans écraser les autres réglages. Le jeton est transmis depuis l’environnement du processus Codex, jamais inscrit dans le dépôt. Vérifier la connexion dans la liste MCP du client après redémarrage. Les réglages stdio et `env_vars` sont documentés dans [OpenAI Docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

```toml
[mcp_servers.calas]
command = "node"
args = ['C:\Users\Paul\Documents\Codage\Calas\apps\mcp\dist\index.mjs']
env_vars = ["CALAS_MCP_TOKEN"]
startup_timeout_sec = 40
tool_timeout_sec = 40
default_tools_approval_mode = "prompt"

[mcp_servers.calas.env]
CALAS_MCP_URL = "https://www.calas-conseil.fr"
```

Pour un démarrage ponctuel du CLI, saisir le jeton dans PowerShell sans qu’il apparaisse à l’écran ni dans l’historique :

```powershell
$calasSecureToken = Read-Host 'Jeton personnel Calas' -AsSecureString
$env:CALAS_MCP_TOKEN = [System.Net.NetworkCredential]::new('', $calasSecureToken).Password
codex
Remove-Item Env:CALAS_MCP_TOKEN
```

L’application de bureau doit recevoir la variable dans son propre environnement au démarrage ; la définir dans un terminal déjà ouvert ne modifie pas une application déjà lancée. Garder le réglage d’approbation des outils actif.

## Claude Desktop

Dans **Paramètres → Développeur → Modifier la configuration**, ajouter l’entrée `calas` au fichier personnel, puis fermer et relancer Claude Desktop. Sous Windows, ce fichier se trouve habituellement dans `%APPDATA%\Claude\claude_desktop_config.json`. Voir le [guide MCP officiel pour les serveurs locaux](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

```json
{
  "mcpServers": {
    "calas": {
      "command": "node",
      "args": ["C:\\Users\\Paul\\Documents\\Codage\\Calas\\apps\\mcp\\dist\\index.mjs"],
      "env": {
        "CALAS_MCP_URL": "https://www.calas-conseil.fr",
        "CALAS_MCP_TOKEN": ""
      }
    }
  }
}
```

Le champ vide est volontaire : coller le jeton uniquement dans ce fichier privé sur l’ordinateur, puis l’effacer ou le remplacer après expiration. Ne pas remplacer la configuration des autres connecteurs. Aucun fichier personnel Claude/Codex n’est modifié automatiquement par ce dépôt.

## Utilisation

Commencer par « Montre-moi le tableau de bord Calas et le mode d’envoi des campagnes ». Pour un article : lire le contenu et sa version, préparer/enregistrer un brouillon, puis demander sa publication après relecture. Pour une campagne : vérifier les coordonnées, la source, la date de collecte et la pertinence professionnelle ; préparer le message et présenter la liste de destinataires avant mise en file. Les listes suggérées par ChatGPT ne prouvent pas l’existence des contacts ni leur consentement.

Les envois respectent `OUTREACH_MAIL_TRANSPORT` : **simulation par défaut**. Le MCP ne bascule pas ce réglage et ne lance pas SMTP lui-même. Le worker traite la file ; un envoi déjà accepté par SMTP ne peut pas être rappelé. Les outils de publication/envoi/invitation portent une indication d’effet externe et exigent des paramètres explicites. Ces indications ne sont pas un verrou de sécurité du client : les droits sont contrôlés par le serveur et l’opérateur doit conserver les demandes d’approbation dans son application IA.

Les réponses et contenus peuvent contenir des instructions malveillantes. Ils doivent être traités comme des données, pas comme une autorisation de publier, d’envoyer ou de changer un compte.

## Exploitation et garanties vérifiables

Le transport distant publie `/.well-known/oauth-protected-resource` et `/.well-known/oauth-protected-resource/mcp`, ainsi que `/.well-known/oauth-authorization-server`. La réponse non authentifiée de `/mcp/` indique la découverte par `WWW-Authenticate`. DCR est fourni par `/oauth/register/`, l’autorisation par `/oauth/authorize/`, l’échange par `/oauth/token/` et la révocation par `/oauth/revoke/`.

Le serveur OAuth est intégré à Calas : pas de service d’identité payant supplémentaire. Il impose PKCE S256, une URI de retour enregistrée exacte, `state`, l’audience exacte `/mcp/`, un code utilisable une fois pendant deux minutes et une décision de consentement liée à la session navigateur. Les jetons opaques sont conservés uniquement sous forme d’empreintes. La rotation d’un refresh token interdit sa réutilisation ; un rejeu prouvé révoque toute la connexion. Un ancien code présenté avec un mauvais vérificateur PKCE n’invalide pas l’accès légitime. L’API vérifie le compte et sa session à chaque appel. Les jetons locaux ne sont pas acceptés par `/mcp/`, ni les jetons OAuth par l’API du pont local.

L’enregistrement DCR est limité par adresse et globalement, avec un plafond de 10 000 clients. Les demandes d’autorisation sont également limitées ; un compte ne peut pas avoir plus de vingt connexions OAuth actives. Les requêtes et jetons expirés sont purgés après une journée de grâce, les connexions expirées après trente jours lors d’un enregistrement. Les identifiants clients restent stables ; aucun logo, URL de métadonnées ou document client arbitraire n’est téléchargé par le serveur. CIMD, implicit grant et client credentials ne sont pas proposés.

- Un jeton aléatoire de 256 bits, seul son SHA-256 stocké ; dix accès actifs maximum par compte, liste limitée à ses propres accès.
- Lien vers une **session Better Auth réelle** ; adresse vérifiée, suspension, rôle et politique de connexion revérifiés à chaque appel. Aucun TOTP fictif. Les exceptions nominatives existantes restent inchangées.
- HTTPS obligatoire sauf loopback local ; redirections refusées ; cookies et Origin navigateur refusés par l’API bearer. Les actions de création/révocation depuis l’interface gardent la protection d’origine habituelle.
- Requête bornée à 1 100 000 octets ; réponse du pont bornée à 2 Mio ; délai 30 secondes ; limites de débit serveur. Pas de relance automatique d’une mutation après une coupure.
- Catalogue fermé de services métier, contrôle des versions, règles du dernier administrateur et protections médias conservés. Ni SQL/shell arbitraire, ni lecture de variables d’environnement, ni outil de création de jetons.
- Journal des tentatives autorisées avec nom d’outil et auteur avant exécution ; aucun jeton, paramètre de message ou mot de passe journalisé. Une indisponibilité de ce journal empêche l’action. Les opérations métier conservent leur historique de réussite habituel dans leur transaction.

Les administrateurs du poste et les programmes qui lisent son environnement peuvent lire son jeton : il faut conserver la configuration privée. Les données envoyées aux applications IA relèvent également des réglages et engagements du fournisseur retenu.

API privée : `GET /api/agent/tools/` retourne les outils autorisés ; `POST` prend `{ "name": "calas_identity", "arguments": {} }`. Gestion depuis une session navigateur autorisée : `GET/POST /api/admin/integrations/tokens/`, `POST /api/admin/integrations/tokens/:id/revoke/`.

Validation locale : `pnpm test:mcp` compile le pont, lance `tests/agent-mcp.test.ts` (client MCP officiel + faux serveur local), `tests/agent-access.test.ts` et `tests/agent-oauth.test.ts` contre PostgreSQL local isolé. Les tests de base refusent une adresse distante. La recette HTTP du projet ajoute le vrai parcours navigateur Better Auth et consentement. La migration reste une commande opérateur explicite. La compatibilité avec les comptes ChatGPT/Claude de Sara, Agnès et Paul doit enfin être vérifiée par chacun après déploiement, sans partager leurs mots de passe.

Références d’implémentation : [SDK TypeScript officiel](https://github.com/modelcontextprotocol/typescript-sdk), [transport stdio](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio), [authentification MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
