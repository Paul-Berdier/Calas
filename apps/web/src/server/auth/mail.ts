import nodemailer from 'nodemailer';
import {HttpError} from '../http';

export async function sendAuthMail(to:string,subject:string,text:string):Promise<void>{
  const local=process.env.AUTH_MAIL_TRANSPORT==='local'&&process.env.SITE_ENV!=='production';
  const host=local?process.env.AUTH_SMTP_HOST:process.env.SMTP_HOST;
  const port=Number(local?process.env.AUTH_SMTP_PORT:process.env.SMTP_PORT||587);
  if(local&&!['127.0.0.1','localhost','mail'].includes(host||''))throw new Error('Local mail host invalid');
  if(!local&&(process.env.AUTH_MAIL_TRANSPORT!=='smtp'||process.env.ALLOW_REAL_EMAIL!=='true'))throw new HttpError(503,'MAIL_UNAVAILABLE','Le transport des emails de connexion doit être configuré.');
  if(!host||!Number.isInteger(port))throw new HttpError(503,'MAIL_UNAVAILABLE','Le transport des emails de connexion doit être configuré.');
  const transport=nodemailer.createTransport({host,port,secure:!local&&process.env.SMTP_SECURE==='true',requireTLS:!local&&process.env.SMTP_SECURE!=='true',...(local?{}:{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}),logger:false,debug:false,connectionTimeout:8000,socketTimeout:10000});
  try{await transport.sendMail({from:local?process.env.AUTH_SMTP_FROM:process.env.SMTP_FROM,to,subject,text,disableFileAccess:true,disableUrlAccess:true});}finally{transport.close();}
}
