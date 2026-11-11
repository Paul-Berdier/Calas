import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import {HttpError} from '../http';

function key(){const secret=process.env.OUTREACH_LINK_SECRET||'';if(secret.length<32)throw new HttpError(503,'OUTREACH_CONFIGURATION','La clé privée de prospection doit être configurée avant utilisation.');return createHash('sha256').update('calas:outreach:v1:'+secret).digest();}
export function digest(value:string){return createHmac('sha256',key()).update(value).digest('hex');}
export function emailDigest(value:string){return digest('email:'+value.trim().toLowerCase());}
export function makeToken(prefix:'c'|'u'){return prefix+'_'+randomBytes(32).toString('base64url');}
export function validToken(token:string,prefix:'c'|'u'){return new RegExp('^'+prefix+'_[A-Za-z0-9_-]{43}$').test(token);}
export function seal(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
export function unseal(value:string){const data=Buffer.from(value,'base64url');const cipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');}
