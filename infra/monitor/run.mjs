import nodemailer from 'nodemailer';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { runCheck } from './checks.mjs';

function required(name) {
  const value=process.env[name];
  if (!value) throw new Error('Configuration incomplète.');
  return value;
}

async function run() {
  const to=required('MONITOR_ALERT_EMAIL').trim();
  if (!/^[^\s,;@<>]+@[^\s,;@<>]+\.[^\s,;@<>]+$/.test(to)) throw new Error('Un destinataire individuel est requis.');
  const utcHour=Number(process.env.MONITOR_BACKUP_UTC_HOUR??'6');
  const testRequest=process.env.MONITOR_TEST_EMAIL_ONCE;
  if (!Number.isInteger(utcHour) || utcHour<0 || utcHour>23 || (testRequest && !/^[a-zA-Z0-9_-]{8,64}$/.test(testRequest))) throw new Error('Paramètres de surveillance invalides.');
  const endpoint=new URL(required('STATUS_S3_ENDPOINT')), bucket=required('STATUS_S3_BUCKET');
  if (endpoint.protocol!=='https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Endpoint du stockage invalide.');
  const storage=new S3Client({
    endpoint:endpoint.href,region:required('STATUS_S3_REGION'),forcePathStyle:process.env.STATUS_S3_FORCE_PATH_STYLE==='true',
    credentials:{accessKeyId:required('STATUS_S3_ACCESS_KEY_ID'),secretAccessKey:required('STATUS_S3_SECRET_ACCESS_KEY')},
    maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',
  });
  const port=Number(required('SMTP_PORT'));
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('Port SMTP invalide.');
  const secure=required('SMTP_SECURE')==='true';
  const from=required('SMTP_FROM');
  const transport=nodemailer.createTransport({
    host:required('SMTP_HOST'),port,secure,requireTLS:!secure,auth:{user:required('SMTP_USER'),pass:required('SMTP_PASS')},
    logger:false,debug:false,connectionTimeout:12_000,greetingTimeout:10_000,socketTimeout:15_000,
    disableFileAccess:true,disableUrlAccess:true,
  });
  async function marker(key) {
    try {
      const file=await storage.send(new GetObjectCommand({Bucket:bucket,Key:'backup/'+key+'.json'}),{abortSignal:AbortSignal.timeout(12_000)});
      const body=file.Body;
      try {
        if (!body || !Number.isSafeInteger(file.ContentLength) || file.ContentLength<1 || file.ContentLength>2048) throw new Error('Marqueur invalide.');
        const text=await body.transformToString();
        if (Buffer.byteLength(text)>2048) throw new Error('Marqueur trop long.');
        return JSON.parse(text);
      }finally { body?.destroy?.(); }
    }catch(error){
      if (error.name==='NoSuchKey' || error.name==='NotFound') return null;
      throw error;
    }
  }
  try{
    const result=await runCheck({
      directory:required('MONITOR_STATE_DIR'),utcHour,testRequest,
      readMarkers:async()=>{
        const [success,failure]=await Promise.all([marker('success'),marker('failure')]);
        return {success,failure};
      },
      send:async message=>{
        const result=await transport.sendMail({...message,from,to,disableFileAccess:true,disableUrlAccess:true});
        if (!Array.isArray(result.accepted) || !result.accepted.some(address=>String(address).toLowerCase()===to.toLowerCase())) throw new Error('Destinataire refusé.');
      },
    });
    console.log(JSON.stringify({status:'complete',...result}));
  } finally {storage.destroy(); transport.close();}
}

run().catch(()=>{console.error('Échec du contrôle, du stockage de son état ou de la remise SMTP. Nouvelle tentative au prochain passage.');process.exitCode=1;});
