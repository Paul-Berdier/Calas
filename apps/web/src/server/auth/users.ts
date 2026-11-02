import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {and,eq,isNull,gt,sql} from 'drizzle-orm';
import {getDb} from '../db';
import {user,session,invitations,securityEvents} from '../db/auth-schema';
import {createAuth} from './index';
import {sendAuthMail} from './mail';
import {HttpError} from '../http';
import type {Actor} from './permissions';

export async function listUsers(){
  return getDb().select({id:user.id,name:user.name,email:user.email,role:user.role,disabled:user.disabled,emailVerified:user.emailVerified,twoFactorEnabled:user.twoFactorEnabled,createdAt:user.createdAt}).from(user).orderBy(user.createdAt);
}
export async function inviteUser(actor:Actor,input:{name:string;email:string;role:'administrator'|'editor'}){
  if(actor.role!=='administrator')throw new HttpError(403,'FORBIDDEN','Accès réservé aux administrateurs.');
  const token=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex');
  await getDb().transaction(async tx=>{
    const [existing]=await tx.select({id:user.id}).from(user).where(eq(user.email,input.email.toLowerCase()));
    if(existing)throw new HttpError(409,'EXISTS','Cette adresse possède déjà un compte.');
    await tx.insert(invitations).values({id:randomUUID(),...input,email:input.email.toLowerCase(),tokenHash,expiresAt:new Date(Date.now()+24*60*60*1000),createdBy:actor.id});
    const url=new URL('/admin/invitation/',process.env.BETTER_AUTH_URL);url.searchParams.set('token',token);
    await sendAuthMail(input.email,'Votre invitation — Calas Conseil',`Vous êtes invité·e dans l’administration Calas Conseil. Ce lien est personnel, valable 24 heures et utilisable une seule fois :\n${url.href}\n\nVous choisirez votre mot de passe, vérifierez votre adresse et activerez la double authentification.`);
    await tx.insert(securityEvents).values({id:randomUUID(),actorId:actor.id,action:'user.invited'});
  });return {sent:true};
}
export async function acceptInvitation(token:string,password:string){
  const hash=createHash('sha256').update(token).digest('hex');
  return getDb().transaction(async tx=>{
    const [invitation]=await tx.select().from(invitations).where(and(eq(invitations.tokenHash,hash),isNull(invitations.usedAt),gt(invitations.expiresAt,new Date()))).for('update');
    if(!invitation)throw new HttpError(400,'INVITATION_INVALID','Cette invitation est expirée ou a déjà été utilisée. Demandez une nouvelle invitation.');
    const created=await createAuth(tx,true).api.signUpEmail({body:{email:invitation.email,name:invitation.name,password,callbackURL:new URL('/admin/login/',process.env.BETTER_AUTH_URL).href}});
    await tx.update(user).set({role:invitation.role}).where(eq(user.id,created.user.id));
    await tx.update(invitations).set({usedAt:new Date()}).where(eq(invitations.id,invitation.id));
    await tx.insert(securityEvents).values({id:randomUUID(),actorId:created.user.id,action:'invitation.accepted'});
    return {accepted:true};
  });
}
export async function updateUser(actor:Actor,targetId:string,action:'disable'|'enable'|'revoke'|'role',role?:'administrator'|'editor'){
  if(actor.role!=='administrator')throw new HttpError(403,'FORBIDDEN','Accès réservé aux administrateurs.');
  if(actor.id===targetId&&action!=='revoke')throw new HttpError(409,'SELF_CHANGE','Un autre administrateur doit modifier vos propres droits.');
  await getDb().transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(64236001)`);
    const [target]=await tx.select().from(user).where(eq(user.id,targetId)).for('update');
    if(!target)throw new HttpError(404,'NOT_FOUND','Ce compte est introuvable.');
    if(target.role==='administrator'&&(action==='disable'||action==='role'&&role==='editor')){
      const admins=await tx.select({id:user.id}).from(user).where(and(eq(user.role,'administrator'),eq(user.disabled,false)));
      if(admins.length<2)throw new HttpError(409,'LAST_ADMIN','Le dernier administrateur actif doit être conservé.');
    }
    if(action==='role'&&!role)throw new HttpError(422,'ROLE','Choisissez un rôle.');
    if(action!=='revoke')await tx.update(user).set({...action==='role'?{role}:{disabled:action==='disable'},updatedAt:new Date()}).where(eq(user.id,targetId));
    await tx.delete(session).where(eq(session.userId,targetId));
    await tx.insert(securityEvents).values({id:randomUUID(),actorId:actor.id,action:`user.${action}`});
  });return {updated:true};
}
