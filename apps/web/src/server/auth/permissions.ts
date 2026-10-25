import {getAuth} from './index';
import {HttpError} from '../http';

export interface Actor {id:string;name:string;email:string;role:'administrator'|'editor'}
export async function getSession(request:Request){
  if(!process.env.BETTER_AUTH_SECRET||!process.env.DATABASE_URL)return null;
  return getAuth().api.getSession({headers:request.headers,query:{disableCookieCache:true}});
}
export async function getActor(request:Request):Promise<Actor|null>{
  const result=await getSession(request);
  if(!result||result.user.disabled||!result.user.emailVerified||!result.user.twoFactorEnabled||!result.session.mfaVerified)return null;
  const {id,name,email,role}=result.user;
  return role==='administrator'||role==='editor'?{id,name,email,role}:null;
}
export async function requireEditor(request:Request):Promise<Actor>{
  const session=await getSession(request);
  if(!session||session.user.disabled)throw new HttpError(401,'UNAUTHENTICATED','Connectez-vous pour continuer.');
  if(!session.user.emailVerified)throw new HttpError(403,'EMAIL_REQUIRED','Vérifiez votre adresse email.');
  if(!session.user.twoFactorEnabled||!session.session.mfaVerified)throw new HttpError(403,'MFA_REQUIRED','Activez la double authentification puis reconnectez-vous pour accéder aux contenus.');
  const {id,name,email,role}=session.user;
  if(role!=='administrator'&&role!=='editor')throw new HttpError(403,'FORBIDDEN','Cet accès n’est pas autorisé.');
  return {id,name,email,role};
}
export async function requireAdministrator(request:Request):Promise<Actor>{
  const actor=await requireEditor(request);if(actor.role!=='administrator')throw new HttpError(403,'FORBIDDEN','Cette action est réservée aux administrateurs.');return actor;
}
