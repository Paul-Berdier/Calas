import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {twoFactor} from 'better-auth/plugins';
import {getDb,type DatabaseExecutor} from '../db';
import * as schema from '../db/auth-schema';
import {sendAuthMail} from './mail';
import {eq} from 'drizzle-orm';

export function createAuth(database:DatabaseExecutor=getDb(),allowRegistration=false){
  const secret=process.env.BETTER_AUTH_SECRET||'';
  if(secret.length<32)throw new Error('Better Auth secret missing');
  const origin=process.env.BETTER_AUTH_URL||process.env.SITE_URL||'http://localhost:4321';
  return betterAuth({
    appName:'Calas Conseil',baseURL:origin,secret,basePath:'/api/auth',trustedOrigins:[new URL(origin).origin],
    database:drizzleAdapter(database,{provider:'pg',schema}),
    emailAndPassword:{enabled:true,disableSignUp:!allowRegistration,minPasswordLength:12,maxPasswordLength:128,autoSignIn:false,requireEmailVerification:true,revokeSessionsOnPasswordReset:true,
      sendResetPassword:async({user,url})=>sendAuthMail(user.email,'Réinitialiser votre mot de passe — Calas Conseil',`Pour choisir un nouveau mot de passe, ouvrez ce lien personnel valable une heure :\n${url}\n\nSi vous n’avez pas demandé cette opération, ignorez ce message.`)},
    emailVerification:{sendOnSignUp:true,sendOnSignIn:false,autoSignInAfterVerification:false,expiresIn:3600,
      sendVerificationEmail:async({user,url})=>sendAuthMail(user.email,'Vérifier votre adresse — Calas Conseil',`Confirmez votre adresse en ouvrant ce lien personnel valable une heure :\n${url}`)},
    user:{additionalFields:{role:{type:'string',defaultValue:'editor',input:false},disabled:{type:'boolean',defaultValue:false,input:false}}},
    session:{expiresIn:8*60*60,updateAge:15*60,freshAge:15*60,cookieCache:{enabled:false},additionalFields:{mfaVerified:{type:'boolean',defaultValue:false,input:false}}},
    databaseHooks:{session:{create:{before:async session=>{
      const [person]=await database.select().from(schema.user).where(eq(schema.user.id,session.userId));
      if(!person||person.disabled)return false;
      // Better Auth deletes the provisional password session before its MFA challenge response.
      // Enrollment rotates the session after enabling TOTP; earlier sessions remain restricted.
      return {data:{...session,mfaVerified:person.twoFactorEnabled}};
    }}}},
    advanced:{useSecureCookies:new URL(origin).protocol==='https:',defaultCookieAttributes:{httpOnly:true,sameSite:'lax'},ipAddress:{ipAddressHeaders:['x-calas-client-ip']}},
    rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:8},'/request-password-reset':{window:300,max:4},'/two-factor/*':{window:60,max:8}}},
    plugins:[twoFactor({issuer:'Calas Conseil',skipVerificationOnEnable:false,twoFactorCookieMaxAge:300,accountLockout:{enabled:true,maxFailedAttempts:8,durationSeconds:900}})],
    logger:{disabled:true},
  });
}
let singleton:ReturnType<typeof createAuth>|undefined;
export function getAuth(){return singleton??=createAuth();}
