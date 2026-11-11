import {closeDatabase} from '../db';
import {processOutreachQueue,type WorkerResult} from './worker';

type Timer=ReturnType<typeof setTimeout>;
type Schedule=(callback:()=>void,delay:number)=>Timer;
export interface OutreachRunner {enabled:boolean;stop():Promise<void>}
export interface RunnerOptions {
 enabled:boolean;
 run:(signal:AbortSignal)=>Promise<WorkerResult>;
 close:()=>Promise<void>;
 schedule?:Schedule;
 clear?:(timer:Timer)=>void;
 activity?:(result:WorkerResult)=>void;
 failure?:()=>void;
}

/** One deferred batch at a time. Shutdown never interrupts an SMTP acceptance acknowledgement. */
export function createOutreachRunner(options:RunnerOptions):OutreachRunner{
 const schedule=options.schedule??((callback,delay)=>{const timer=setTimeout(callback,delay);timer.unref();return timer;});
 const clear=options.clear??clearTimeout;
 const controller=new AbortController();
 let stopped=false,timer:Timer|undefined,active:Promise<void>|undefined,closing:Promise<void>|undefined;
 const next=(delay:number)=>{if(!stopped)timer=schedule(tick,delay);};
 function tick(){
  timer=undefined;
  if(stopped||active)return;
  active=(async()=>{
   // Assign active before invoking an injected task that could throw synchronously.
   await Promise.resolve();
   try{const result=await options.run(controller.signal);options.activity?.(result);}
   catch{options.failure?.();}
   finally{active=undefined;next(60_000);}
  })();
 }
 if(options.enabled)next(15_000);
 return {enabled:options.enabled,stop(){
  if(closing)return closing;
  stopped=true;controller.abort();if(timer){clear(timer);timer=undefined;}
  closing=(async()=>{await active;if(options.enabled)await options.close();})();
  return closing;
 }};
}

/** Built as its own module, with a separate PostgreSQL pool capped at two connections. */
export function startOutreachRunner():OutreachRunner{
 const batch=Math.min(10,Math.max(1,Math.floor(Number(process.env.OUTREACH_WORKER_BATCH)||10)));
 return createOutreachRunner({
  enabled:process.env.OUTREACH_RUNNER_ENABLED==='true',
  run:signal=>processOutreachQueue({limit:batch,signal}),close:closeDatabase,
  activity:result=>{if(result.accepted+result.simulated+result.failed+result.uncertain+result.suppressed+result.retried+result.purged>0)console.log(JSON.stringify({task:'outreach',...result}));},
  failure:()=>console.error('Calas : le traitement intégré des campagnes est momentanément indisponible. La file sera vérifiée au prochain passage ; consulter les états dans l’administration.'),
 });
}
