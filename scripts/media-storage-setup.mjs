import {loadEnvFile} from 'node:process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(process.argv.slice(2).join(' ')!=='--local')throw new Error('Cette commande exige --local et ne crée aucun service externe.');
const endpoint=new URL(process.env.S3_ENDPOINT??'');
if(!['localhost','127.0.0.1','minio'].includes(endpoint.hostname)||!['development','test'].includes(process.env.SITE_ENV??''))throw new Error('Création du bucket réservée au service S3 local de développement/test.');
const require=createRequire(resolve(root,'apps/web/package.json'));
const {S3Client,HeadBucketCommand,CreateBucketCommand}=await import(pathToFileURL(require.resolve('@aws-sdk/client-s3')).href);
const Bucket=process.env.S3_BUCKET;if(!Bucket)throw new Error('Le nom du bucket local manque.');
const client=new S3Client({endpoint:endpoint.href,region:process.env.S3_REGION||'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID??'',secretAccessKey:process.env.S3_SECRET_ACCESS_KEY??''}});
try{await client.send(new HeadBucketCommand({Bucket}));console.log('Le bucket local existe déjà.');}
catch(error){
  if(error?.$metadata?.httpStatusCode!==404)throw new Error('Le stockage local ne répond pas ou refuse les identifiants.');
  await client.send(new CreateBucketCommand({Bucket}));console.log('Bucket local privé créé. Aucune règle d’accès public ajoutée.');
}finally{client.destroy();}
