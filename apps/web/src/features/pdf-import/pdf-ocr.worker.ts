import type {OcrRequest,OcrResponse} from './pdf-import.types';
import type {Worker as TesseractWorker} from 'tesseract.js';

// This isolated coordinator owns the engine worker from the moment it is
// created, including while createWorker() still awaits model initialization.
// No main-window globals are changed.
const scope=globalThis as unknown as {
  postMessage:(message:OcrResponse)=>void;
  onmessage:((event:MessageEvent<OcrRequest>)=>void)|null;
  close:()=>void;
};
const NativeWorker=Worker;
const children=new Set<Worker>();
class OwnedWorker extends NativeWorker {
  constructor(url:string|URL,options?:WorkerOptions){super(url,options);children.add(this);}
  override terminate(){children.delete(this);super.terminate();}
}
Object.defineProperty(globalThis,'Worker',{value:OwnedWorker,configurable:true});
let engine:TesseractWorker|undefined;
let disposed=false;
let initializing=false;
let recognizing=false;
const send=(message:OcrResponse)=>{if(!disposed)scope.postMessage(message);};
const terminateChildren=()=>{for(const child of [...children])child.terminate();};
const fail=()=>{
  terminateChildren();
  send({type:'error',message:'La reconnaissance de texte n’a pas pu aboutir. Vérifiez la disponibilité des fichiers OCR locaux, puis réessayez.'});
};
scope.onmessage=event=>{
  const message=event.data;
  if(message.type==='cancel'){
    disposed=true;terminateChildren();
    scope.postMessage({type:'cancelled'});scope.close();return;
  }
  if(message.type==='init'&&!initializing){
    initializing=true;
    void(async()=>{
      try {
        const {createWorker,OEM,PSM}=await import('tesseract.js');
        if(disposed)return;
        engine=await createWorker(['fra','eng'],OEM.LSTM_ONLY,{
          ...message.paths,workerBlobURL:false,gzip:true,cacheMethod:'none',
          logger:progress=>send({type:'progress',progress:progress.progress,status:progress.status}),
          errorHandler:()=>fail(),
        });
        if(disposed){await engine.terminate();return;}
        await engine.setParameters({tessedit_pageseg_mode:PSM.AUTO,user_defined_dpi:'150',preserve_interword_spaces:'0'});
        send({type:'ready'});
      } catch {fail();}
    })();
  }else if(message.type==='recognize'&&engine&&!recognizing){
    recognizing=true;
    void(async()=>{
      try {
        const {data}=await engine!.recognize(message.image,{}, {text:true});
        send({type:'result',text:data.text,confidence:data.confidence});
      } catch {fail();}
      finally{recognizing=false;}
    })();
  }
};
