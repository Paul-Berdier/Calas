import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';

const projectPattern=/^[a-z0-9][a-z0-9-]{4,15}$/;
const datasetPattern=/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const read=path=>existsSync(path)?readFileSync(path,'utf8'):'';
const put=(text,key,value)=>{
 const pattern=new RegExp(`^(?:export[ \\t]+)?${key}[ \\t]*=.*$`,'gm');
 const matches=text.match(pattern)??[];
 if(matches.length>1)throw new Error(`La clé ${key} apparaît plusieurs fois. Corriger le fichier avant de continuer.`);
 return matches.length?text.replace(pattern,()=>`${key}=${value}`):`${text.trimEnd()}\n${key}=${value}\n`;
};

export function readCmsConfig(root,overrides=process.env){
 const shared=parseEnv(read(resolve(root,'.env')));
 return {
  web:{...shared,...parseEnv(read(resolve(root,'apps/web/.env'))),...overrides},
  studio:{...shared,...parseEnv(read(resolve(root,'apps/studio/.env'))),...overrides},
 };
}

/** Local preparation only: never creates a project, sends data or activates Sanity. */
export function prepareCms(root,{projectId,dataset}={}){
 const webPath=resolve(root,'apps/web/.env');
 const studioPath=resolve(root,'apps/studio/.env');
 let webText=read(webPath)||read(resolve(root,'apps/web/.env.example'));
 let studioText=read(studioPath)||read(resolve(root,'apps/studio/.env.example'));
 const web=parseEnv(webText),studio=parseEnv(studioText);
 if(!projectId&&web.PUBLIC_SANITY_PROJECT_ID&&studio.SANITY_STUDIO_PROJECT_ID&&web.PUBLIC_SANITY_PROJECT_ID!==studio.SANITY_STUDIO_PROJECT_ID){
  throw new Error('Les identifiants de projet diffèrent. Préciser --project-id pour choisir explicitement le projet.');
 }
 if(!dataset&&web.PUBLIC_SANITY_DATASET&&studio.SANITY_STUDIO_DATASET&&web.PUBLIC_SANITY_DATASET!==studio.SANITY_STUDIO_DATASET){
  throw new Error('Les datasets diffèrent. Préciser --dataset pour choisir explicitement le dataset.');
 }
 const selectedProject=projectId??(web.PUBLIC_SANITY_PROJECT_ID||studio.SANITY_STUDIO_PROJECT_ID||'');
 const selectedDataset=dataset??(web.PUBLIC_SANITY_DATASET||studio.SANITY_STUDIO_DATASET||'staging');
 if(selectedProject&&(!projectPattern.test(selectedProject)||selectedProject==='calaslocal'))throw new Error('Project ID invalide ou identifiant de compilation. Utiliser le véritable Project ID Sanity.');
 if(!datasetPattern.test(selectedDataset)||!/^(staging|development|test)(-[a-z0-9-]+)?$/.test(selectedDataset)){
  throw new Error('Préparation réservée à un dataset de test : staging, development, test ou un nom avec suffixe.');
 }
 // Prepare both buffers before writing. Existing credentials and unrelated settings survive.
 webText=put(webText,'PUBLIC_SANITY_PROJECT_ID',selectedProject);
 webText=put(webText,'PUBLIC_SANITY_DATASET',selectedDataset);
 if(!web.CONTENT_MODE)webText=put(webText,'CONTENT_MODE','demo');
 if(!web.SITE_URL)webText=put(webText,'SITE_URL','http://localhost:4321');
 if(!web.PUBLIC_SANITY_STUDIO_URL)webText=put(webText,'PUBLIC_SANITY_STUDIO_URL','http://localhost:3333');
 if(web.SANITY_WRITE_TOKEN===undefined)webText=put(webText,'SANITY_WRITE_TOKEN','');
 if(web.CALAS_ALLOW_CONTENT_WRITE===undefined)webText=put(webText,'CALAS_ALLOW_CONTENT_WRITE','no');
 if(!web.PREVIEW_SESSION_SECRET)webText=put(webText,'PREVIEW_SESSION_SECRET',randomBytes(32).toString('hex'));
 studioText=put(studioText,'SANITY_STUDIO_PROJECT_ID',selectedProject);
 studioText=put(studioText,'SANITY_STUDIO_DATASET',selectedDataset);
 if(!studio.SANITY_STUDIO_PREVIEW_URL)studioText=put(studioText,'SANITY_STUDIO_PREVIEW_URL',web.SITE_URL||'http://localhost:4321');
 writeFileSync(webPath,webText);
 writeFileSync(studioPath,studioText);
 return {projectConfigured:Boolean(selectedProject),dataset:selectedDataset,mode:web.CONTENT_MODE||'demo'};
}

export function inspectCms({web,studio}){
 const checks=[];
 const check=(ok,message)=>checks.push({level:ok?'ok':'missing',message});
 check(projectPattern.test(web.PUBLIC_SANITY_PROJECT_ID||'')&&web.PUBLIC_SANITY_PROJECT_ID!=='calaslocal','Project ID réel du frontend');
 check(Boolean(studio.SANITY_STUDIO_PROJECT_ID)&&studio.SANITY_STUDIO_PROJECT_ID===web.PUBLIC_SANITY_PROJECT_ID,'Même projet dans le Studio et le frontend');
 check(datasetPattern.test(web.PUBLIC_SANITY_DATASET||'')&&web.PUBLIC_SANITY_DATASET===studio.SANITY_STUDIO_DATASET,'Dataset valide et identique dans les deux applications');
 check(Boolean(web.SANITY_API_READ_TOKEN?.trim()),'Jeton de lecture serveur renseigné (valeur masquée)');
 check((web.PREVIEW_SESSION_SECRET?.length??0)>=32,'Clé de prévisualisation locale présente (valeur masquée)');
 const origin=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'?url.origin:null;}catch{return null;}};
 const site=origin(web.SITE_URL),preview=origin(studio.SANITY_STUDIO_PREVIEW_URL),studioUrl=origin(web.PUBLIC_SANITY_STUDIO_URL);
 check(Boolean(site)&&site===preview,'Adresse de prévisualisation identique à SITE_URL');
 check(Boolean(studioUrl),'Adresse du Studio valide');
 if(site&&studioUrl){
  const siteUrl=new URL(site),editorUrl=new URL(studioUrl);
  const local=host=>['localhost','127.0.0.1'].includes(host);
  check(!(local(siteUrl.hostname)&&local(editorUrl.hostname))||siteUrl.hostname===editorUrl.hostname,'Même nom d’hôte pour les deux applications locales');
 }
 checks.push({level:'info',message:web.CONTENT_MODE==='sanity'?'Lecture Sanity activée.':'Le site reste en démonstration jusqu’à la bascule explicite.'});
 checks.push({level:'info',message:'Le contrôle local ne vérifie pas le compte, les permissions, CORS ou la publication.'});
 return checks;
}
