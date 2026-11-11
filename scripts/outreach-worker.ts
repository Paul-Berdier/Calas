import {processOutreachQueue} from '../apps/web/src/server/outreach/worker';
import {closeDatabase} from '../apps/web/src/server/db';

try{
 if(!process.argv.includes('--run'))throw new Error('Explicit --run required');
 const result=await processOutreachQueue({limit:Number(process.env.OUTREACH_WORKER_BATCH)||10});
 console.log(JSON.stringify({task:'outreach',...result}));
}catch{
 console.error('Le traitement de prospection a échoué. Aucun secret ni destinataire affiché ; vérifier la configuration et les états en administration.');
 process.exitCode=1;
}finally{await closeDatabase();}
