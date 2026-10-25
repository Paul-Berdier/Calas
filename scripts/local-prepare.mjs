import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
const read=path=>existsSync(path)?Object.fromEntries(readFileSync(path,'utf8').split(/\r?\n/).filter(line=>/^[A-Z][A-Z0-9_]*=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];})):{};
export function prepareLocal(root){
const localPath=resolve(root,'.env');
const webPath=resolve(root,'apps/web/.env');
const web=read(webPath);
if(web.SITE_ENV==='production')throw new Error('La préparation locale refuse une configuration de production.');
const local=read(localPath);
const key=()=>randomBytes(32).toString('hex');
local.POSTGRES_PASSWORD ||= key();
local.S3_ACCESS_KEY_ID ||= `calas-${randomBytes(6).toString('hex')}`;
local.S3_SECRET_ACCESS_KEY ||= key();
writeFileSync(localPath,Object.entries(local).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
const defaults={DATABASE_URL:`postgresql://calas:${encodeURIComponent(local.POSTGRES_PASSWORD)}@127.0.0.1:15432/calas_development`,BETTER_AUTH_SECRET:key(),BETTER_AUTH_URL:'http://localhost:4321',S3_ENDPOINT:'http://127.0.0.1:19000',S3_REGION:'us-east-1',S3_BUCKET:'calas-development',S3_ACCESS_KEY_ID:local.S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY:local.S3_SECRET_ACCESS_KEY,S3_FORCE_PATH_STYLE:'true',AUTH_MAIL_TRANSPORT:'local',AUTH_SMTP_HOST:'127.0.0.1',AUTH_SMTP_PORT:'11025',AUTH_SMTP_FROM:'Calas Conseil <cms@example.test>',CONTENT_MODE:'demo',SITE_ENV:'development',SITE_URL:'http://localhost:4321',MAIL_TRANSPORT:'simulation',CONTACT_SIGNING_SECRET:key()};
for(const [k,v]of Object.entries(defaults))if(!web[k])web[k]=v;
web.BACKUP_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
web.BACKUP_POSTGRES_CONTAINER ||= 'calas-development-postgres-1';
writeFileSync(webPath,Object.entries(web).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
return {webPath,localPath};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
prepareLocal(fileURLToPath(new URL('../',import.meta.url)));
console.log('Configuration locale préparée ; secrets conservés dans les .env ignorés. Aucun compte créé, aucun contenu modifié.');
}
