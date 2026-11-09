/** Explicit operator command for the three accounts approved by Paul on 3 Nov.
 * Never imported by the application/build. No external email and no verification
 * or MFA bypass: signup messages go to a local Mailpit, users activate later.
 * On Windows the caller must first restrict the output directory's ACL.
 */
import {randomBytes, randomUUID} from 'node:crypto';
import {open, realpath} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {eq, inArray, sql} from '../apps/web/node_modules/drizzle-orm/index.js';
import {getDb, closeDatabase} from '../apps/web/src/server/db/index';
import {user, securityEvents} from '../apps/web/src/server/db/auth-schema';
import {createAuth} from '../apps/web/src/server/auth/index';
import {productionIdentities} from '../apps/web/src/server/auth/production-identities';
export {productionIdentities} from '../apps/web/src/server/auth/production-identities';

export interface ProvisionOptions {
  apply: boolean;
  expectedOrigin: string;
  expectedDatabase: string;
  operatorId: string;
  outputFile?: string;
}

function requirePrivateDestination(file:string) {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const within = relative(root,file);
  if (!within.startsWith(`..${sep}`) && !isAbsolute(within) && !within.startsWith(`.cache${sep}`)) throw new Error('Dans le dépôt, utiliser uniquement un dossier privé sous .cache.');
}

export function validateProvisionConfiguration(options: ProvisionOptions, env: NodeJS.ProcessEnv = process.env) {
  if (!['https://calas-conseil.fr','https://www.calas-conseil.fr'].includes(options.expectedOrigin)) throw new Error('Origine Calas approuvée requise.');
  if (!options.expectedDatabase || !options.operatorId || !env.DATABASE_URL) throw new Error('Base et opérateur attendus requis.');
  if (env.SITE_URL?.replace(/\/$/,'') !== options.expectedOrigin || env.BETTER_AUTH_URL?.replace(/\/$/,'') !== options.expectedOrigin) throw new Error('Origine canonique différente.');
  // These are the local operator process settings, not the hosted application.
  if (env.SITE_ENV !== 'staging' || env.AUTH_MAIL_TRANSPORT !== 'local' || !['127.0.0.1','localhost'].includes(env.AUTH_SMTP_HOST || '') || env.ALLOW_REAL_EMAIL === 'true') throw new Error('Capture locale des emails obligatoire.');
  const port = Number(env.AUTH_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !env.AUTH_SMTP_FROM || (env.BETTER_AUTH_SECRET?.length || 0) < 32) throw new Error('Configuration privée incomplète.');
  if (options.apply && (!options.outputFile || !isAbsolute(options.outputFile))) throw new Error('Chemin absolu de sortie privée requis.');
  if(options.apply)requirePrivateDestination(options.outputFile!);
}

export async function provisionProductionAccounts(options: ProvisionOptions) {
  validateProvisionConfiguration(options);
  let accessFile: Awaited<ReturnType<typeof open>> | undefined;
  let credentials: Array<{name:string;email:string;role:string;password:string}> = [];
  try {
    return await getDb().transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(64236001)`);
      const target = await tx.execute(sql`select current_database() as database`);
      if (target.rows[0]?.database !== options.expectedDatabase) throw new Error('Destination PostgreSQL différente.');
      const [operator] = await tx.select().from(user).where(eq(user.id,options.operatorId));
      if (!operator || operator.disabled || !operator.emailVerified || operator.role !== 'administrator') throw new Error('Opérateur administrateur actif attendu.');
      const existing = await tx.select({id:user.id}).from(user).where(inArray(user.email,productionIdentities.map(identity => identity.email)));
      if (existing.length) throw new Error('Un compte cible existe déjà ; aucun remplacement autorisé.');
      const plan = {origin:options.expectedOrigin,database:options.expectedDatabase,accounts:productionIdentities.length,editors:2,administrators:1,externalEmailsSent:0,emailVerificationRequired:true};
      if (!options.apply) return {...plan,applied:false};

      const output = resolve(options.outputFile!);
      const parent = await realpath(dirname(output)); // Directory must already exist with private ACLs.
      requirePrivateDestination(resolve(parent,relative(dirname(output),output)));
      accessFile = await open(output,'wx',0o600);
      credentials = productionIdentities.map(identity => ({...identity,password:randomBytes(24).toString('base64url')}));
      const handoff = {
        origin:options.expectedOrigin,
        loginUrl:`${options.expectedOrigin}/admin/login/`,
        createdAt:new Date().toISOString(),
        status:'prepared',
        instructions:'Comptes personnels. Vérifiez votre adresse une première fois, puis connectez-vous par e-mail et mot de passe. Les liens de vérification se demandent sur la page de connexion du site.',
        accounts:credentials,
      };
      await accessFile.writeFile(JSON.stringify(handoff,null,2)+'\n','utf8');
      await accessFile.sync(); // Preserve passwords before any account is committed.
      const created: Array<{id:string;role:string;emailVerified:boolean;twoFactorEnabled:boolean}> = [];
      for (const identity of credentials) {
        const result = await createAuth(tx,true).api.signUpEmail({body:{email:identity.email,name:identity.name,password:identity.password,callbackURL:`${options.expectedOrigin}/admin/login/`}});
        await tx.update(user).set({role:identity.role}).where(eq(user.id,result.user.id));
        const [stored] = await tx.select().from(user).where(eq(user.id,result.user.id));
        if (!stored || stored.emailVerified || stored.twoFactorEnabled || stored.disabled || stored.role !== identity.role) throw new Error('État de compte inattendu.');
        created.push({id:stored.id,role:stored.role,emailVerified:stored.emailVerified,twoFactorEnabled:stored.twoFactorEnabled});
      }
      await tx.insert(securityEvents).values({id:randomUUID(),actorId:operator.id,action:'production.accounts.provisioned.20261103'});
      return {...plan,applied:true,created};
    });
  } finally {
    await accessFile?.close();
    credentials = [];
    // A prepared file remains recoverable after a failure; never overwrite it.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--dry-run','--apply'].includes(args[0]!)) throw new Error('Choisir --dry-run ou --apply.');
    const result = await provisionProductionAccounts({apply:args[0] === '--apply',expectedOrigin:process.env.PROVISION_EXPECTED_ORIGIN || '',expectedDatabase:process.env.PROVISION_EXPECTED_DATABASE || '',operatorId:process.env.PROVISION_OPERATOR_ID || '',outputFile:process.env.PROVISION_OUTPUT_FILE});
    console.log(JSON.stringify(result));
  } catch {
    console.error('Provisionnement refusé ou service indisponible. Vérifier destination, opérateur, doublons, Mailpit et dossier privé. Aucun secret affiché ; contrôler la base avant de réutiliser un fichier préparé.');
    process.exitCode = 1;
  } finally { await closeDatabase(); }
}
