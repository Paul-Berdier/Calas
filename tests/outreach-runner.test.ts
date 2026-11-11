import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createOutreachRunner} from '../apps/web/src/server/outreach/runner';
import {processOutreachQueue,type WorkerResult} from '../apps/web/src/server/outreach/worker';

const empty=():WorkerResult=>({accepted:0,simulated:0,failed:0,uncertain:0,suppressed:0,retried:0,purged:0,busy:false,rateLimited:false});
function clock(){
 let id=0;const pending=new Map<ReturnType<typeof setTimeout>,{callback:()=>void;delay:number}>();
 return {pending,schedule(callback:()=>void,delay:number){const key=++id as unknown as ReturnType<typeof setTimeout>;pending.set(key,{callback,delay});return key;},clear(key:ReturnType<typeof setTimeout>){pending.delete(key);},fire(){const [key,timer]=pending.entries().next().value!;pending.delete(key);timer.callback();return timer;}};
}

test('disabled integrated runner opens no timer and no database',async()=>{
 const timers=clock();let calls=0,closes=0;
 const runner=createOutreachRunner({enabled:false,run:async()=>{calls++;return empty();},close:async()=>{closes++;},...timers});
 assert.equal(runner.enabled,false);assert.equal(timers.pending.size,0);await runner.stop();assert.equal(calls,0);assert.equal(closes,0);
});

test('first batch is deferred and later batches never overlap',async()=>{
 const timers=clock(),gate=Promise.withResolvers<WorkerResult>();let calls=0;
 const runner=createOutreachRunner({enabled:true,run:async()=>{calls++;return gate.promise;},close:async()=>{},...timers});
 assert.equal(calls,0);assert.equal([...timers.pending.values()][0]!.delay,15000);
 const callback=timers.fire().callback;callback();await nextTurn();assert.equal(calls,1);assert.equal(timers.pending.size,0);
 gate.resolve(empty());await nextTurn();assert.equal(timers.pending.size,1);assert.equal([...timers.pending.values()][0]!.delay,60000);
 await runner.stop();assert.equal(timers.pending.size,0);
});

test('shutdown aborts the batch between messages, waits for current work and closes only once',async()=>{
 const timers=clock(),gate=Promise.withResolvers<WorkerResult>();let signal:AbortSignal|undefined,closes=0;
 const runner=createOutreachRunner({enabled:true,run:async value=>{signal=value;return gate.promise;},close:async()=>{closes++;},...timers});
 timers.fire();await nextTurn();const stopped=runner.stop();assert.equal(stopped,runner.stop());assert.equal(signal?.aborted,true);assert.equal(closes,0);
 gate.resolve(empty());await stopped;assert.equal(closes,1);assert.equal(timers.pending.size,0);
});

test('a background failure is reported without details and scheduling continues',async()=>{
 const timers=clock();let failures=0,calls=0;
 const runner=createOutreachRunner({enabled:true,run:async()=>{calls++;if(calls===1)throw new Error('smtp-secret-and-recipient');return empty();},close:async()=>{},failure:()=>{failures++;},...timers});
 timers.fire();await nextTurn();assert.equal(failures,1);assert.equal(timers.pending.size,1);
 timers.fire();await nextTurn();assert.equal(calls,2);assert.equal(failures,1);await runner.stop();
});

test('an already stopped queue exits before any database work',async()=>{
 const controller=new AbortController();controller.abort();assert.deepEqual(await processOutreachQueue({signal:controller.signal}),empty());
});

test('a synchronous task exception cannot leave the runner permanently busy',async()=>{
 const timers=clock();let calls=0;
 const runner=createOutreachRunner({enabled:true,run:()=>{calls++;if(calls===1)throw new Error('Synchronous test failure');return Promise.resolve(empty());},close:async()=>{},...timers});
 timers.fire();await nextTurn();assert.equal(calls,1);assert.equal(timers.pending.size,1);timers.fire();await nextTurn();assert.equal(calls,2);await runner.stop();
});
