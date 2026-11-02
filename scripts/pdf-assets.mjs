import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,copyFile,cp,readdir,readFile,writeFile} from 'node:fs/promises';

// PDF/OCR assets are served by the application itself. No document or language model
// is sent to or fetched from a third-party OCR endpoint at import time.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'apps/web/package.json'));
const packageDir=name=>dirname(require.resolve(`${name}/package.json`));
const output=resolve(root,'apps/web/public/ocr');
const pdf=packageDir('pdfjs-dist');
const tesseract=packageDir('tesseract.js');
const tessRequire=createRequire(resolve(tesseract,'package.json'));
const core=dirname(tessRequire.resolve('tesseract.js-core/package.json'));
await mkdir(resolve(output,'core'),{recursive:true});
await mkdir(resolve(output,'lang'),{recursive:true});
await mkdir(resolve(output,'licenses'),{recursive:true});
await copyFile(resolve(pdf,'build/pdf.worker.min.mjs'),resolve(output,'pdf.worker.min.mjs'));
await copyFile(resolve(tesseract,'dist/worker.min.js'),resolve(output,'worker.min.js'));
for(const name of await readdir(core)){
 if(/^tesseract-core.*\.wasm(?:\.js)?$/.test(name))await copyFile(resolve(core,name),resolve(output,'core',name));
}
for(const [source,target] of [['cmaps','cmaps'],['standard_fonts','standard_fonts'],['wasm','pdf-wasm']]){
 await cp(resolve(pdf,source),resolve(output,target),{recursive:true});
}
for(const language of ['fra','eng']){
 const data=require(`@tesseract.js-data/${language}`);
 await copyFile(resolve(data.langPath,`${language}.traineddata.gz`),resolve(output,'lang',`${language}.traineddata.gz`));
}
const packages={};
for(const [name,path] of [['pdfjs-dist',pdf],['tesseract.js',tesseract],['tesseract.js-core',core],...['fra','eng'].map(lang=>[`@tesseract.js-data/${lang}`,packageDir(`@tesseract.js-data/${lang}`)])]){
 const metadata=JSON.parse(await readFile(resolve(path,'package.json'),'utf8'));
 packages[name]={version:metadata.version,license:metadata.license};
 for(const file of ['LICENSE','LICENSE.txt','LICENSE.md']){
  try{await copyFile(resolve(path,file),resolve(output,'licenses',`${name.replaceAll('/','-')}-${file}`));}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
await writeFile(resolve(output,'assets-info.json'),JSON.stringify({languages:['fra','eng'],packages},null,2));
console.log('Lecteur PDF, OCR et modèles français/anglais prêts pour l’administration. Aucun contenu importé.');
