import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {parseArgs} from 'node:util';
import {prepareCms,readCmsConfig,inspectCms} from './cms-config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
 const {values,positionals}=parseArgs({allowPositionals:true,options:{'project-id':{type:'string'},dataset:{type:'string'},remote:{type:'boolean'},help:{type:'boolean'}}});
 const command=positionals[0];
 if(values.help){
  console.log('pnpm cms:prepare [--project-id ID] [--dataset staging]\npnpm cms:check [--remote]\nPréparation locale sans création de compte, import ni publication. Les jetons se renseignent dans apps/web/.env, jamais en argument.');
 }else if(command==='prepare'&&positionals.length===1&&!values.remote){
  const prepared=prepareCms(root,{projectId:values['project-id'],dataset:values.dataset});
  console.log(`Configuration locale préparée. Dataset : ${prepared.dataset}. Projet : ${prepared.projectConfigured?'renseigné':'à renseigner'}. Mode conservé : ${prepared.mode}.\nLa clé privée de prévisualisation reste dans apps/web/.env. Aucun appel réseau ni contenu transféré.`);
 }else if(command==='check'&&positionals.length===1&&!values['project-id']&&!values.dataset){
  const config=readCmsConfig(root);
  const checks=inspectCms(config);
  for(const item of checks)console.log(`${item.level==='ok'?'OK':item.level==='missing'?'À RENSEIGNER':'INFO'} — ${item.message}`);
  if(checks.some(item=>item.level==='missing')){process.exitCode=1;}
  else if(values.remote){
   const require=createRequire(resolve(root,'apps/web/package.json'));
   const {createClient}=require('@sanity/client');
   const common={projectId:config.web.PUBLIC_SANITY_PROJECT_ID,dataset:config.web.PUBLIC_SANITY_DATASET,apiVersion:'2026-10-25',useCdn:false,timeout:8000,maxRetries:0};
   // Read only. Never output document bodies, auth headers or raw SDK exceptions.
   const published=createClient({...common,perspective:'published'});
   const preview=createClient({...common,token:config.web.SANITY_API_READ_TOKEN,perspective:'drafts'});
   try{
    const visible=await published.fetch('{"settings":count(*[_type=="siteSettings" && _id=="siteSettings"]),"home":count(*[_type=="homePage" && _id=="homePage"]),"pages":count(*[_type=="page"])}');
    await preview.fetch('count(*[_type=="homePage"])');
    console.log('OK — Lecture publique sans jeton et lecture authentifiée des brouillons accessibles.');
    console.log(`Documents publiés : paramètres ${visible.settings}, accueil ${visible.home}, pages ${visible.pages}.`);
    if(!visible.settings||!visible.home)console.log('À PRÉPARER — Contenus initiaux absents ou encore en brouillon. La vérification de lecture ne valide pas le rendu des pages.');
    console.log('À TESTER DANS LE STUDIO — Connexion utilisateur, CORS, édition, remplacement d’image et prévisualisation.');
   }catch(error){
    const status=Number(error?.statusCode||error?.response?.statusCode)||'indisponible';
    console.error(`Connexion non validée (statut ${status}). Vérifier le projet, le dataset public, les droits du jeton et le réseau. Aucun secret affiché.`);
    process.exitCode=1;
   }
  }
 }else{throw new Error('Commande invalide. Utiliser pnpm cms:prepare --help.');}
}catch(error){console.error(error.message);process.exitCode=1;}
