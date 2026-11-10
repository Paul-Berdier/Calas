import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {sql,eq} from '../apps/web/node_modules/drizzle-orm/index.js';
import {randomUUID} from 'node:crypto';
try{loadEnvFile(fileURLToPath(new URL('../apps/web/.env',import.meta.url)));}catch{/* CI injects its variables. */}
const {getDb,closeDatabase}=await import('../apps/web/src/server/db/index');
const {user,securityEvents}=await import('../apps/web/src/server/db/auth-schema');
const {createAuth}=await import('../apps/web/src/server/auth/index');
const email=process.env.INIT_ADMIN_EMAIL?.trim().toLowerCase(),name=process.env.INIT_ADMIN_NAME?.trim(),password=process.env.INIT_ADMIN_PASSWORD;
if(!email||!name||!password||password.length<12)throw new Error('Renseignez INIT_ADMIN_EMAIL, INIT_ADMIN_NAME et INIT_ADMIN_PASSWORD (12 caractères minimum) dans l’environnement privé du processus.');
try{
  await getDb().transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(64236001)`);
    const existing=await tx.select({id:user.id}).from(user).limit(1);
    if(existing.length)throw new Error('Un compte existe déjà. Utilisez les invitations depuis l’administration.');
    const result=await createAuth(tx,true).api.signUpEmail({body:{email,name,password,callbackURL:new URL('/admin/login/',process.env.BETTER_AUTH_URL).href}});
    await tx.update(user).set({role:'administrator'}).where(eq(user.id,result.user.id));
    await tx.insert(securityEvents).values({id:randomUUID(),actorId:result.user.id,action:'administrator.bootstrapped'});
  });
  console.log('Premier administrateur créé. Vérifiez son adresse via le courriel reçu, puis activez TOTP. Aucun secret affiché.');
}catch{console.error('Initialisation refusée ou service indisponible. Vérifiez les réglages privés, la base et le transport de courriel. Aucun secret affiché.');process.exitCode=1;}finally{delete process.env.INIT_ADMIN_PASSWORD;await closeDatabase();}
