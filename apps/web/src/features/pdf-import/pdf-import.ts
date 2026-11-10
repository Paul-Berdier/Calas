import type {PDFDocumentLoadingTask,PDFDocumentProxy,PDFWorker,RenderTask} from 'pdfjs-dist';
import {
  PDF_IMPORT_LIMITS,PdfImportError,type PdfImportOptions,type PdfImportResult,
  type OcrAssetPaths,type OcrRequest,type OcrResponse,type ExtractedParagraph,type PdfTextItem,
} from './pdf-import.types';
import {
  validatePdfFile,validatePageCount,validateCharacterCount,cleanText,titleFromFilename,
  excerptFromText,textItemsToParagraphs,ocrTextToParagraphs,paragraphsToDocument,shouldRecognizePage,
} from './pdf-import-format';

export type {PdfImportOptions,PdfImportResult,PdfImportProgress} from './pdf-import.types';
export {PDF_IMPORT_LIMITS,PdfImportError} from './pdf-import.types';

const aborted=()=>new DOMException('L’analyse du PDF a été annulée.','AbortError');
const ensureActive=(signal?:AbortSignal)=>{if(signal?.aborted)throw aborted();};
function waitFor<T>(promise:Promise<T>,signal?:AbortSignal,timeoutMs=60_000):Promise<T> {
  ensureActive(signal);
  return new Promise((resolve,reject)=>{
    const onAbort=()=>finish(()=>reject(aborted()));
    const timer=setTimeout(()=>finish(()=>reject(new PdfImportError('L’analyse prend trop de temps. Réessayez avec un document plus court ; aucun article partiel n’a été créé.'))),timeoutMs);
    const finish=(callback:()=>void)=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);callback();};
    signal?.addEventListener('abort',onAbort,{once:true});
    promise.then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
  });
}
function readFile(file:File,signal?:AbortSignal):Promise<Uint8Array> {
  ensureActive(signal);
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    const cleanup=()=>signal?.removeEventListener('abort',onAbort);
    const onAbort=()=>{reader.abort();cleanup();reject(aborted());};
    reader.onload=()=>{cleanup();resolve(new Uint8Array(reader.result as ArrayBuffer));};
    reader.onerror=()=>{cleanup();reject(new PdfImportError('Le fichier n’a pas pu être lu sur cet appareil.'));};
    reader.onabort=()=>{cleanup();reject(aborted());};
    signal?.addEventListener('abort',onAbort,{once:true});
    reader.readAsArrayBuffer(file);
  });
}
function assetUrl(path:string):string {
  const configured=(import.meta as ImportMeta&{env?:{BASE_URL?:string}}).env?.BASE_URL||'/';
  const base=new URL(configured.endsWith('/')?configured:`${configured}/`,document.baseURI);
  if(base.origin!==window.location.origin)throw new PdfImportError('Les ressources PDF/OCR doivent être hébergées avec l’administration.');
  return new URL(`ocr/${path}`,base).href;
}

interface OcrResult {text:string;confidence:number}
/** This bridge never uploads a document or an image. A Blob is sent only to a
 * local worker. The coordinator explicitly terminates its engine child before
 * acknowledging cancellation, including during model initialization. */
function createOcrBridge(paths:OcrAssetPaths,onProgress:(progress:number,status:string)=>void){
  const worker=new Worker(new URL('./pdf-ocr.worker.ts',import.meta.url),{type:'module',name:'calas-pdf-ocr'});
  let resolveReady!:()=>void,rejectReady!:(error:Error)=>void;
  let pending:{resolve:(value:OcrResult)=>void;reject:(error:Error)=>void}|undefined;
  let closed=false;
  let closing:Promise<void>|undefined;
  const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  // Closing can happen before the first caller has attached to ready.
  void ready.catch(()=>{});
  const fail=(message:string)=>{
    const error=new PdfImportError(message);rejectReady(error);pending?.reject(error);pending=undefined;
  };
  worker.onmessage=(event:MessageEvent<OcrResponse>)=>{
    if(closed)return;
    const message=event.data;
    if(message.type==='ready')resolveReady();
    else if(message.type==='progress')onProgress(message.progress,message.status);
    else if(message.type==='error')fail(message.message);
    else if(message.type==='result'){pending?.resolve({text:message.text,confidence:message.confidence});pending=undefined;}
  };
  worker.onerror=event=>{event.preventDefault();fail('Le moteur OCR local n’a pas pu démarrer. Rechargez l’administration et réessayez.');};
  const send=(message:OcrRequest)=>worker.postMessage(message);
  send({type:'init',paths});
  return {
    async recognize(image:Blob,signal?:AbortSignal):Promise<OcrResult>{
      await waitFor(ready,signal,120_000);ensureActive(signal);
      if(closed)throw aborted();
      const result=new Promise<OcrResult>((resolve,reject)=>{pending={resolve,reject};});
      send({type:'recognize',image});
      return waitFor(result,signal,120_000);
    },
    close():Promise<void>{
      if(closing)return closing;
      closed=true;rejectReady(aborted());pending?.reject(aborted());pending=undefined;
      closing=new Promise<void>(resolve=>{
        const finish=()=>{clearTimeout(timer);worker.terminate();resolve();};
        const timer=setTimeout(finish,2000);
        worker.onmessage=(event:MessageEvent<OcrResponse>)=>{if(event.data.type==='cancelled')finish();};
        worker.onerror=()=>finish();
        send({type:'cancel'});
      });
      return closing;
    },
  };
}

export async function analyzePdf(file:File,options:PdfImportOptions={}):Promise<PdfImportResult>{
  const {signal,onProgress}=options;
  validatePdfFile(file);ensureActive(signal);
  if(typeof window==='undefined')throw new PdfImportError('L’analyse PDF s’effectue dans votre navigateur.');
  let loadingTask:PDFDocumentLoadingTask|undefined,pdf:PDFDocumentProxy|undefined,pdfWorker:PDFWorker|undefined;
  let renderTask:RenderTask|undefined,ocr:ReturnType<typeof createOcrBridge>|undefined;
  let pdfClosing:Promise<void>|undefined;
  let canvas:HTMLCanvasElement|undefined;
  let pageNumber=0,pageCount=0,ocrPages=0,characters=0;
  const paragraphs:ExtractedParagraph[]=[];
  const warnings=new Set<string>(['Relisez le texte avant publication : les tableaux, colonnes, images, notes et la mise en page du PDF ne sont pas conservés fidèlement.']);
  const progress=(message:string,percent?:number)=>{if(!signal?.aborted)onProgress?.({message,percent});};
  const closePdf=():Promise<void>=>{
    if(pdfClosing)return pdfClosing;
    // PDF.js destroy() first asks its transport worker to acknowledge shutdown.
    // Killing that worker beforehand leaves the acknowledgment pending forever.
    // Share one teardown between abort/finally and bound the graceful shutdown.
    pdfClosing=new Promise<void>(resolve=>{
      let finished=false;
      const finish=()=>{
        if(finished)return;finished=true;clearTimeout(timer);
        pdfWorker?.destroy();resolve();
      };
      const timer=setTimeout(finish,1500);
      try{void Promise.resolve(loadingTask?.destroy()).then(finish,finish);}
      catch{finish();}
    });
    return pdfClosing;
  };
  const cancel=()=>{
    renderTask?.cancel();
    void closePdf();
    if(ocr)void ocr.close();
  };
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    progress('Lecture locale du PDF…',0);
    const bytes=await readFile(file,signal);
    const header=new TextDecoder('ascii').decode(bytes.subarray(0,Math.min(bytes.length,1024)));
    if(!header.includes('%PDF-'))throw new PdfImportError('Ce fichier ne contient pas un PDF valide.');
    const pdfjs=await waitFor(import('pdfjs-dist'),signal);ensureActive(signal);
    pdfjs.GlobalWorkerOptions.workerSrc=assetUrl('pdf.worker.min.mjs');
    pdfWorker=new pdfjs.PDFWorker();
    loadingTask=pdfjs.getDocument({
      data:bytes,worker:pdfWorker,stopAtErrors:true,enableXfa:false,
      cMapUrl:assetUrl('cmaps/'),cMapPacked:true,
      standardFontDataUrl:assetUrl('standard_fonts/'),wasmUrl:assetUrl('pdf-wasm/'),
      canvasMaxAreaInBytes:16_000_000,
    });
    pdf=await waitFor(loadingTask.promise,signal);pageCount=pdf.numPages;validatePageCount(pageCount);
    const imageOperators=new Set<number>([
      pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,pdfjs.OPS.paintImageMaskXObjectGroup,
      pdfjs.OPS.paintImageXObjectRepeat,pdfjs.OPS.paintImageMaskXObjectRepeat,
      pdfjs.OPS.paintInlineImageXObjectGroup,
    ]);
    for(pageNumber=1;pageNumber<=pageCount;pageNumber++){
      ensureActive(signal);progress(`Lecture de la page ${pageNumber} sur ${pageCount}…`,Math.round((pageNumber-1)/pageCount*100));
      const page=await waitFor(pdf.getPage(pageNumber),signal);
      try {
        const content=await waitFor(page.getTextContent(),signal);
        const items=content.items.filter((item):item is typeof content.items[number]&PdfTextItem=>'str' in item);
        let extracted=textItemsToParagraphs(items);
        const native=extracted.map(part=>part.text).join('\n\n');
        const replacementCount=(native.match(/\uFFFD/g)??[]).length;
        if(shouldRecognizePage(native,true,options.forceOcr)){
          const hasBitmap=options.forceOcr|| (await waitFor(page.getOperatorList(),signal)).fnArray.some(operator=>imageOperators.has(operator));
          if(shouldRecognizePage(native,hasBitmap,options.forceOcr)){
            ocrPages++;
            progress(`Reconnaissance du texte de la page ${pageNumber} sur ${pageCount}…`,Math.round((pageNumber-1)/pageCount*100));
            if(!ocr)ocr=createOcrBridge({workerPath:assetUrl('worker.min.js'),corePath:assetUrl('core'),langPath:assetUrl('lang')},(value,status)=>{
              const recognizing=status==='recognizing text';
              progress(recognizing?`Reconnaissance du texte de la page ${pageNumber} sur ${pageCount}…`:'Chargement du moteur OCR local (français et anglais)…',Math.round(((pageNumber-1)+(recognizing?Math.min(1,Math.max(0,value))*.9:0))/pageCount*100));
            });
            const initial=page.getViewport({scale:1});
            const scale=Math.min(PDF_IMPORT_LIMITS.dpi/72,PDF_IMPORT_LIMITS.canvasSide/Math.max(initial.width,initial.height));
            const viewport=page.getViewport({scale});
            if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0)throw new PdfImportError(`La page ${pageNumber} a des dimensions invalides.`);
            canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            renderTask=page.render({canvas,viewport,background:'#ffffff'});
            await waitFor(renderTask.promise,signal);renderTask=undefined;
            const blob=await waitFor(new Promise<Blob>((resolve,reject)=>canvas!.toBlob(value=>value?resolve(value):reject(new PdfImportError(`La page ${pageNumber} n’a pas pu être préparée pour l’OCR.`)),'image/png')),signal);
            const recognized=await ocr.recognize(blob,signal);
            const ocrParagraphs=ocrTextToParagraphs(recognized.text);
            if(ocrParagraphs.length)extracted=ocrParagraphs;
            else warnings.add(`Page ${pageNumber} : aucun texte reconnu dans l’image. Vérifiez cette page dans le PDF original et complétez le brouillon si nécessaire.`);
            if(recognized.confidence<65&&ocrParagraphs.length)warnings.add(`Page ${pageNumber} : reconnaissance incertaine ; une relecture attentive est nécessaire.`);
            canvas.width=1;canvas.height=1;canvas=undefined;
          }
        }
        if(!extracted.length)warnings.add(`Page ${pageNumber} : aucun texte extractible (page vide ou contenu graphique). Consultez le PDF original.`);
        if(replacementCount>5)warnings.add(`Page ${pageNumber} : certains caractères du texte source étaient illisibles. Vérifiez leur transcription.`);
        const pageCharacters=extracted.reduce((sum,paragraph)=>sum+paragraph.text.length,0);
        characters+=pageCharacters;validateCharacterCount(characters);paragraphs.push(...extracted);
      } finally {page.cleanup();}
      progress(`Page ${pageNumber} sur ${pageCount} traitée.`,Math.round(pageNumber/pageCount*100));
    }
    ensureActive(signal);
    if(!paragraphs.length)throw new PdfImportError('Aucun texte exploitable n’a été trouvé après analyse de toutes les pages. Essayez un scan plus lisible ou préparez le texte manuellement.');
    if(ocrPages)warnings.add(`${ocrPages} page${ocrPages>1?'s ont':' a'} nécessité l’OCR français/anglais. Des erreurs de mots, de ponctuation ou d’ordre sont possibles : relisez le brouillon avec le PDF original.`);
    const text=cleanText(paragraphs.map(paragraph=>paragraph.text).join('\n\n'));
    progress('Analyse terminée. Relisez le texte avant de créer le brouillon.',100);
    return {title:titleFromFilename(file.name),excerpt:excerptFromText(text),body:paragraphsToDocument(paragraphs),pageCount,ocrPages,warnings:[...warnings]};
  } catch(error){
    if(signal?.aborted||(error instanceof DOMException&&error.name==='AbortError'))throw aborted();
    if(error instanceof PdfImportError)throw error;
    const name=error instanceof Error?error.name:'';
    if(name==='PasswordException')throw new PdfImportError('Ce PDF est protégé par un mot de passe. Fournissez une copie déverrouillée que vous êtes autorisé à utiliser.');
    if(name==='InvalidPDFException')throw new PdfImportError('Ce PDF est invalide ou endommagé. Exportez une nouvelle copie et réessayez.');
    throw new PdfImportError(pageNumber?`L’analyse de la page ${pageNumber} a échoué. Aucun article partiel n’a été créé. Essayez une nouvelle copie du PDF.`:'Le PDF n’a pas pu être analysé. Vérifiez le fichier et les ressources PDF/OCR locales de l’administration.');
  } finally {
    signal?.removeEventListener('abort',cancel);
    renderTask?.cancel();
    if(canvas){canvas.width=1;canvas.height=1;}
    await Promise.allSettled([closePdf(),ocr?.close()]);
  }
}
