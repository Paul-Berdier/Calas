import {sharedContactSubmission} from '../../apps/web/src/server/contact-submission';
import {getPool,closeDatabase} from '../../apps/web/src/server/db';
const input=JSON.parse(process.argv[2]!);
try{
 const result=await sharedContactSubmission({...input,secret:'isolated-contact-test-key-0123456789',deliver:async()=>{await getPool().query('INSERT INTO test_deliveries DEFAULT VALUES');return {ok:true,status:200,simulation:true,message:'Local test only'};}});
 process.stdout.write(JSON.stringify(result));
}finally{await closeDatabase();}
