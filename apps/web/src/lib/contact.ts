import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {env,isProductionSite} from './environment';

export const subjects={diagnostic:'Diagnostic',equipes:'Équipes',managers:'Managers',autre:'Autre'} as const;
export type Subject=keyof typeof subjects;
export interface ContactFields {name:string;company:string;email:string;subject:string;message:string}
export interface ContactResult {ok:boolean;status:number;message:string;errors?:Partial<Record<keyof ContactFields,string>>;simulation?:boolean}
const localKey=randomBytes(32).toString('hex');
const ttl=60*60*1000;
const rates=new Map<string,{count:number;expires:number}>();
const submissions=new Map<string,{expires:number;hash:string;result:Promise<ContactResult>}>();
const secret=()=>{const key=env('CONTACT_SIGNING_SECRET');if(isProductionSite()&&key.length<32)throw new Error('Contact configuration incomplete');return key||localKey;};
function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url');}
export function createFormToken(){const value=`${Date.now()}.${randomBytes(18).toString('base64url')}`;return `${value}.${sign(value)}`;}
function validToken(token:string){
  try{const parts=token.split('.');if(parts.length!==3||token.length>180)return false;const time=Number(parts[0]);if(!Number.isFinite(time)||time>Date.now()+1000||Date.now()-time>ttl)return false;const expected=Buffer.from(sign(`${parts[0]}.${parts[1]}`));const supplied=Buffer.from(parts[2]||'');return expected.length===supplied.length&&timingSafeEqual(expected,supplied);}catch{return false;}
}
export const emptyFields:ContactFields={name:'',company:'',email:'',subject:'autre',message:''};
export async function readBoundedForm(request:Request):Promise<FormData>{
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new Error('Unsupported content type');
  if(Number(request.headers.get('content-length')||0)>65536)throw new RangeError('Body too large');
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new RangeError('Body too large');}chunks.push(value);}}finally{reader.releaseLock();}}
  const raw=Buffer.concat(chunks).toString('utf8');const form=new FormData();new URLSearchParams(raw).forEach((v,k)=>form.append(k,v));return form;
}
export function readFields(form:FormData):ContactFields{
  const get=(name:string,max:number)=>{const value=form.get(name);return typeof value==='string'?value.trim().slice(0,max+1):'';};
  return {name:get('name',100),company:get('company',160),email:get('email',254),subject:get('subject',30),message:get('message',5000)};
}
export function validateFields(fields:ContactFields){
  const errors:Partial<Record<keyof ContactFields,string>>={};
  if(fields.name.length<2||fields.name.length>100||/[\r\n]/.test(fields.name))errors.name='Indiquez votre nom (2 à 100 caractères).';
  if(fields.company.length>160||/[\r\n]/.test(fields.company))errors.company='Limitez le nom de l’entreprise à 160 caractères.';
  if(fields.email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fields.email))errors.email='Indiquez une adresse courriel valide.';
  if(!Object.hasOwn(subjects,fields.subject))errors.subject='Choisissez un objet dans la liste.';
  if(fields.message.length<10||fields.message.length>5000)errors.message='Votre message doit contenir entre 10 et 5 000 caractères.';
  return errors;
}
function prune(){const now=Date.now();for(const [key,value]of rates)if(value.expires<now)rates.delete(key);for(const [key,value]of submissions)if(value.expires<now)submissions.delete(key);}
async function transport(fields:ContactFields):Promise<ContactResult>{
  const mode=env('MAIL_TRANSPORT','simulation');
  if(mode==='simulation'&&!isProductionSite())return {ok:true,status:200,simulation:true,message:'Votre demande de test a bien été traitée. Aucun courriel n’a été envoyé et le message n’est pas conservé.'};
  if(mode!=='smtp')return {ok:false,status:503,message:'L’envoi est momentanément indisponible. Votre saisie est conservée ; vous pouvez réessayer ou nous joindre directement.'};
  const recipient=env('SMTP_TO');
  const singleAddress=/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
  if(!singleAddress.test(recipient))return {ok:false,status:503,message:'Le transport de courriel n’est pas disponible. Votre saisie est conservée.'};
  const domain=recipient.split('@')[1]?.toLowerCase()||'';
  if(!isProductionSite()&&env('ALLOW_REAL_EMAIL')!=='true'&&domain!=='example.test'&&!domain.endsWith('.invalid'))return {ok:false,status:503,message:'Le transport de recette n’est pas disponible. Votre saisie est conservée.'};
  if(!env('SMTP_HOST')||!env('SMTP_FROM')||!recipient||!env('SMTP_USER')||!env('SMTP_PASS'))return {ok:false,status:503,message:'L’envoi est momentanément indisponible. Contactez-nous directement par téléphone ou courriel.'};
  const mailer=nodemailer.createTransport({host:env('SMTP_HOST'),port:Number(env('SMTP_PORT','587')),secure:env('SMTP_SECURE')==='true',requireTLS:env('SMTP_SECURE')!=='true',auth:{user:env('SMTP_USER'),pass:env('SMTP_PASS')},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,logger:false,debug:false});
  try{
    const result=await mailer.sendMail({from:env('SMTP_FROM'),to:recipient,replyTo:{name:fields.name,address:fields.email},subject:`Calas Conseil — ${subjects[fields.subject as Subject]}`,text:`Nom : ${fields.name}\nEntreprise : ${fields.company||'Non renseignée'}\nCourriel : ${fields.email}\nObjet : ${subjects[fields.subject as Subject]}\n\n${fields.message}`,disableFileAccess:true,disableUrlAccess:true});
    if(!result.accepted?.length)throw new Error('Not accepted');
    return {ok:true,status:200,message:'Votre demande a bien été envoyée. Merci pour votre confiance ; nous reviendrons vers vous.'};
  }catch{return {ok:false,status:503,message:'Le serveur de courriel n’a pas confirmé l’envoi. Votre saisie est conservée. Réessayez dans un instant ou contactez-nous directement.'};}finally{mailer.close();}
}
export async function submitContact(request:Request,form:FormData,clientAddress:string):Promise<ContactResult>{
  const origin=request.headers.get('origin');
  const requestOrigin=new URL(request.url).origin;
  if(origin!==requestOrigin)return {ok:false,status:403,message:'La demande ne peut pas être vérifiée. Rechargez la page et réessayez.'};
  const token=String(form.get('token')||'');
  if(!validToken(token))return {ok:false,status:403,message:'Ce formulaire a expiré. Rechargez la page après avoir copié votre message.'};
  const fields=readFields(form);
  const errors=validateFields(fields);
  if(Object.keys(errors).length)return {ok:false,status:422,message:'Quelques informations sont à corriger.',errors};
  if(form.get('website'))return {ok:false,status:422,message:'La demande ne peut pas être traitée.'};
  prune();
  const hash=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  const existing=submissions.get(token);
  if(existing){if(existing.hash!==hash)return {ok:false,status:409,message:'Ce formulaire a déjà été utilisé. Rechargez la page pour une nouvelle demande.'};return existing.result;}
  // Never trust X-Forwarded-For directly. Adapter address + keyed hash, 15-minute retention.
  const addressHash=createHmac('sha256',secret()).update(clientAddress).digest('hex');
  const rate=rates.get(addressHash)||{count:0,expires:Date.now()+15*60*1000};
  if(rate.count>=Number(env('CONTACT_RATE_LIMIT','5'))||rates.size>10000||submissions.size>10000)return {ok:false,status:429,message:'Trop de tentatives rapprochées. Patientez 15 minutes ou contactez-nous directement.'};
  rate.count++;rates.set(addressHash,rate);
  const pending=transport(fields);submissions.set(token,{expires:Date.now()+ttl,hash,result:pending});
  const result=await pending;if(!result.ok)submissions.delete(token);return result;
}
