async function startWeb(){
// Copied to dist/start.mjs by build-outreach-runner.mjs. No migration or email at import time.
process.env.ASTRO_NODE_AUTOSTART='disabled';
const {startServer}=await import('./server/entry.mjs');
const {server,done}=startServer();
let runner;
let stopping;

async function shutdown(exitCode){
 if(stopping)return stopping;
 stopping=(async()=>{
  const deadline=setTimeout(()=>{
   console.error('Calas : arrêt forcé après le délai de fermeture. Vérifier les envois incertains dans l’administration.');
   process.exit(1);
  },30_000);
  deadline.unref();
  try{
   // HTTP drains existing requests while the runner finishes its current message, then closes its pool.
   await Promise.all([
    new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve())),
    runner?.stop(),
   ]);
  }catch{exitCode=1;console.error('Calas : la fermeture du service a rencontré une erreur.');}
  finally{clearTimeout(deadline);process.exit(exitCode);}
 })();
 return stopping;
}

process.once('SIGTERM',()=>{void shutdown(0);});
process.once('SIGINT',()=>{void shutdown(0);});
done.catch(()=>{console.error('Calas : le serveur web a rencontré une erreur.');void shutdown(1);});

try{
 const {startOutreachRunner}=await import('./outreach-runner.mjs');
 if(!stopping)runner=startOutreachRunner();
}catch{
 // A background task configuration problem must not take the public website offline.
 console.error('Calas : le traitement intégré des campagnes n’a pas démarré. Vérifier le déploiement et la configuration.');
}

}

await startWeb().catch(()=>{console.error('Calas : le serveur web n’a pas pu démarrer. Vérifier la configuration du service.');process.exit(1);});
