import { createHash, randomUUID } from 'node:crypto';
import { open, rename, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const hour = 3_600_000;
const day = 24 * hour;
const names = ['site', 'backup'];
const stages = new Set(['configuration','connexion-base','capture-distante','signalement','delai']);
const labels = {site:'Site web', backup:'Sauvegarde'};

export function initialState(now) {
  return {version:1, startedAt:now, signals:Object.fromEntries(names.map(name => [name,{failures:0, openedAt:null}])), pending:[], acceptedTests:[]};
}

export async function readState(directory, now) {
  try {
    const state = JSON.parse(await readFile(join(directory,'state.json'),'utf8'));
    if (state.version !== 1 || !Number.isSafeInteger(state.startedAt) || !Array.isArray(state.pending) || !Array.isArray(state.acceptedTests) ||
      !names.every(name => Number.isInteger(state.signals?.[name]?.failures) && (state.signals[name].openedAt === null || Number.isSafeInteger(state.signals[name].openedAt)))) {
      throw new Error('État du moniteur invalide.');
    }
    return state;
  } catch(error) {
    if (error.code === 'ENOENT') return initialState(now);
    throw error;
  }
}

export async function saveState(directory, state) {
  const temp = join(directory,'state.pending');
  const file = await open(temp,'w',0o600);
  try { await file.writeFile(JSON.stringify(state)); await file.sync(); }
  finally { await file.close(); }
  await rename(temp,join(directory,'state.json'));
  if (process.platform !== 'win32') {
    const dir = await open(directory,'r');
    try { await dir.sync(); } finally { await dir.close(); }
  }
}

async function boundedText(response, maxBytes) {
  if (!response.body) throw new Error('Réponse vide.');
  const reader = response.body.getReader();
  const chunks=[];
  let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>maxBytes) throw new Error('Réponse trop longue.');
      chunks.push(value);
    }
    return Buffer.concat(chunks,size).toString('utf8');
  } finally { await reader.cancel().catch(()=>{}); }
}

export async function inspectSite(fetcher=fetch) {
  const origin='https://www.calas-conseil.fr';
  for (const path of ['/api/ready/','/']) {
    try {
      const response=await fetcher(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15_000),headers:{'User-Agent':'Calas-Conseil-Monitor/1','Cache-Control':'no-cache'}});
      if (response.status!==200) {
        await response.body?.cancel();
        return {ok:false,reason:`${path} a répondu HTTP ${response.status}.`};
      }
      const type=response.headers.get('content-type')??'';
      const text=await boundedText(response,path==='/'?1_048_576:4096);
      if (path==='/api/ready/' && (!type.includes('application/json') || JSON.parse(text).status!=='ready')) {
        return {ok:false,reason:'Le contrôle PostgreSQL et médias du site ne confirme pas la disponibilité.'};
      }
      if (path==='/' && (!type.includes('text/html') || !/<main(?:\s|>)/i.test(text) || !/<h1(?:\s|>)/i.test(text))) {
        return {ok:false,reason:'La page d’accueil ne contient pas le contenu HTML attendu.'};
      }
    } catch { return {ok:false,reason:`Impossible de lire la réponse HTTPS de ${path}.`}; }
  }
  return {ok:true,reason:'La page d’accueil et le contrôle des services répondent.'};
}

export function inspectBackup({success,failure}, now, startedAt, utcHour=6) {
  const today = Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z');
  const expectedDate = new Date(now>=today+(utcHour+1)*hour ? today : today-day).toISOString().slice(0,10);
  const timestamp = value => typeof value==='string' && Number.isFinite(Date.parse(value)) && Date.parse(value)<=now+5*60_000;
  if (success && (success.version!==1 || !timestamp(success.capturedAt) || !timestamp(success.verifiedAt) ||
    new Date(success.capturedAt).toISOString().slice(0,10)!==success.day || Date.parse(success.verifiedAt)<Date.parse(success.capturedAt))) {
    return {ok:false,reason:'Le marqueur de réussite est invalide.'};
  }
  if (failure && (failure.version!==1 || !timestamp(failure.failedAt) || !stages.has(failure.stage))) {
    return {ok:false,reason:'Le marqueur d’échec est invalide.'};
  }
  if (failure && (!success || Date.parse(failure.failedAt)>Date.parse(success.verifiedAt))) {
    return {ok:false,immediate:true,reason:`Le traitement a signalé un échec à l’étape ${failure.stage}.`};
  }
  if (!success) {
    const startDay=Date.parse(new Date(startedAt).toISOString().slice(0,10)+'T00:00:00Z');
    const firstRun=startDay+utcHour*hour+(startedAt>startDay+utcHour*hour?day:0);
    if (now<firstRun+hour) return {ok:null,reason:'Première sauvegarde attendue.'};
  }
  if (!success || success.day<expectedDate) return {ok:false,immediate:true,reason:`Aucune archive vérifiée pour le ${expectedDate} UTC ou une date ultérieure.`};
  return {ok:true,reason:`Archive du ${success.day} UTC vérifiée.`};
}

export function observe(state, samples, now) {
  for (const name of names) {
    const sample=samples[name], signal=state.signals[name];
    if(sample.ok===null) continue;
    signal.failures=sample.ok ? 0 : Math.min(2,signal.failures+1);
    const open = !sample.ok && signal.openedAt===null && (sample.immediate || signal.failures>=2);
    const close = sample.ok && signal.openedAt!==null;
    if(!open && !close) continue;
    signal.openedAt=open?now:null;
    state.pending.push({id:randomUUID(),name,open,at:now,reason:sample.reason});
  }
}

export function compose(events, test=false) {
  const subject=test ? 'Test Calas – alertes de panne et de sauvegarde' : 'Calas Conseil – '+events.map(e=>`${labels[e.name]} ${e.open?'en alerte':(e.name==='backup'?'rétablie':'rétabli')}`).join(' / ');
  const paragraphs=events.map(e=>`${labels[e.name]} — ${e.open?'alerte':'rétablissement'}\n${new Date(e.at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} (Paris)\n${e.reason}`);
  return {subject,text:[...(test?['Exercice de supervision demandé par Paul. Les deux incidents ci-dessous sont simulés.']:[]),...paragraphs].join('\n\n'),messageId:`<calas-monitor-${events[0].id}@calas-conseil.fr>`};
}

export async function runCheck({directory,readMarkers,probe=inspectSite,send,utcHour=6,now=Date.now(),testRequest}) {
  const state=await readState(directory,now);
  const backupSample=readMarkers().then(markers=>inspectBackup(markers,now,state.startedAt,utcHour))
    .catch(()=>({ok:false,reason:'Le stockage des marqueurs de sauvegarde est inaccessible.'}));
  const [site,backup]=await Promise.all([probe(),backupSample]);
  observe(state,{site,backup},now);
  await saveState(directory,state);
  const notified=state.pending.length;
  // Keep the event (and its Message-ID) until the SMTP relay accepts it.
  while (state.pending.length) {
    await send(compose([state.pending[0]]));
    state.pending.shift();
    await saveState(directory,state);
  }
  let testEmail='disabled';
  if (testRequest) {
    const key=createHash('sha256').update('calas-monitor-test:'+testRequest).digest('hex');
    if (state.acceptedTests.includes(key)) testEmail='already-accepted';
    else {
      const events=[
        {id:key,name:'site',open:true,at:now,reason:'Exemple : le contrôle de disponibilité ne répond plus.'},
        {id:key,name:'backup',open:true,at:now,reason:'Exemple : la sauvegarde quotidienne attendue n’a pas été confirmée.'},
      ];
      await send(compose(events,true));
      state.acceptedTests.push(key);
      await saveState(directory,state);
      testEmail='accepted';
    }
  }
  return {site:site.ok,backup:backup.ok,notified,testEmail};
}
