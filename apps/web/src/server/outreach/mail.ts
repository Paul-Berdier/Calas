import nodemailer from 'nodemailer';
import {HttpError} from '../http';

export type MailOutcome='accepted'|'simulated'|'failed'|'uncertain'|'retry';
export interface OutreachMail {id:string;email:string;subject:string;body:string;campaignLink:string;unsubscribeLink:string;source:string;transport:'simulation'|'local'|'smtp'}
export function classifyMailError(error:unknown):MailOutcome{
 const e=error as {command?:string;responseCode?:number;code?:string};
 // An explicit SMTP rejection is known not accepted. A broken connection during DATA is not.
 if(e.responseCode&&e.responseCode>=500)return 'failed';
 if(e.responseCode&&e.responseCode>=400)return 'retry';
 if(e.command&&/^(CONN|AUTH|EHLO|HELO|STARTTLS|MAIL FROM|RCPT TO)$/i.test(e.command))return e.command==='AUTH'?'failed':'retry';
 return 'uncertain';
}
export function siteOrigin(){const url=new URL(process.env.SITE_URL||'http://localhost:4321');if(url.username||url.password||!['http:','https:'].includes(url.protocol))throw new HttpError(503,'OUTREACH_CONFIGURATION','L’adresse du site est incorrecte.');if(process.env.SITE_ENV==='production'&&url.protocol!=='https:')throw new HttpError(503,'OUTREACH_CONFIGURATION','Une adresse HTTPS est nécessaire.');return url.origin;}
export function mailContent(input:OutreachMail){const origin=siteOrigin();return `${input.body}\n\nDécouvrir Calas Conseil : ${origin}${input.campaignLink}\n\nCalas Conseil — La voie de la qualité relationnelle\nContact : contact@calas-conseil.fr\nCe message concerne votre activité professionnelle. Provenance de l’adresse : ${input.source}.\nInformations et droits sur vos données : ${origin}/confidentialite/\nNe plus recevoir de messages de prospection : ${origin}${input.unsubscribeLink}`;}
export async function deliverOutreachMail(input:OutreachMail):Promise<MailOutcome>{
 if(input.transport==='simulation')return 'simulated';
 const local=input.transport==='local';
 const host=local?(process.env.AUTH_SMTP_HOST||'127.0.0.1'):(process.env.SMTP_HOST||'');
 if(local&&(process.env.SITE_ENV==='production'||!['127.0.0.1','localhost','mail'].includes(host)))return 'failed';
 if(!local&&(process.env.OUTREACH_MAIL_TRANSPORT!=='smtp'||process.env.ALLOW_REAL_EMAIL!=='true'||!host||!process.env.SMTP_USER||!process.env.SMTP_PASS||!process.env.SMTP_FROM))return 'failed';
 const port=Number(local?(process.env.AUTH_SMTP_PORT||11025):(process.env.SMTP_PORT||587));
 if(!Number.isInteger(port)||port<1||port>65535)return 'failed';
 const mailer=nodemailer.createTransport({host,port,secure:!local&&process.env.SMTP_SECURE==='true',requireTLS:!local&&process.env.SMTP_SECURE!=='true',auth:local?undefined:{user:process.env.SMTP_USER!,pass:process.env.SMTP_PASS!},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000,logger:false,debug:false});
 try{const origin=siteOrigin();const result=await mailer.sendMail({from:local?'Calas Conseil <contact@example.test>':process.env.SMTP_FROM!,to:input.email,subject:input.subject,text:mailContent(input),messageId:`<calas-outreach-${input.id}@${new URL(origin).hostname}>`,headers:{'List-Unsubscribe':`<${origin}${input.unsubscribeLink}>`},disableFileAccess:true,disableUrlAccess:true});return result.accepted?.length?'accepted':'failed';}catch(error){return classifyMailError(error);}finally{mailer.close();}
}
