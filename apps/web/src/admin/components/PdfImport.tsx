import {useEffect,useRef,useState} from 'react';
import {FileText,Upload,RotateCcw,Check,ArrowRight} from 'lucide-react';
import {Button,Field} from '../ui';
import type {PdfImportResult,PdfImportProgress} from '../../features/pdf-import/pdf-import.types';
import type {RichDocument} from '../../lib/cms/types';
import {buildPdfArticle} from '../../features/pdf-import/pdf-draft';
import {paragraphsToDocument,ocrTextToParagraphs} from '../../features/pdf-import/pdf-import-format';
import {mediaRequest,uploadFile,fileFromMedia,fileSize,type MediaDto} from './media-client';
import './media.css';

type Phase='idle'|'analyzing'|'ready'|'saving'|'saved';
interface Snapshot {id:string;title:string;excerpt:string;body:RichDocument;analysis:PdfImportResult;file:File;media?:MediaDto;payload?:ReturnType<typeof buildPdfArticle>}
export function PdfImport({onCreated,onCancel}:{onCreated:(articleId:string)=>void;onCancel?:()=>void}){
  const [phase,setPhase]=useState<Phase>('idle');const [file,setFile]=useState<File>();const [analysis,setAnalysis]=useState<PdfImportResult>();
  const [title,setTitle]=useState(''),[excerpt,setExcerpt]=useState(''),[text,setText]=useState('');
  const [error,setError]=useState(''),[progress,setProgress]=useState<PdfImportProgress>({message:''});
  const controller=useRef<AbortController|undefined>(undefined),operation=useRef(0),saving=useRef(false),snapshot=useRef<Snapshot|undefined>(undefined);
  const input=useRef<HTMLInputElement>(null),resultHeading=useRef<HTMLHeadingElement>(null);
  const locked=Boolean(snapshot.current);
  useEffect(()=>()=>{operation.current++;controller.current?.abort();},[]);
  useEffect(()=>{if(phase==='ready'||phase==='saved')resultHeading.current?.focus();},[phase]);
  function reset(){
    if(saving.current)return;operation.current++;controller.current?.abort();snapshot.current=undefined;
    setFile(undefined);setAnalysis(undefined);setTitle('');setExcerpt('');setText('');setError('');setProgress({message:''});setPhase('idle');
    if(input.current){input.current.value='';input.current.focus();}
  }
  async function analyze(selected?:File,forceOcr=false){
    if(!selected||saving.current||snapshot.current)return;
    const retainedTitle=forceOcr?title:undefined,retainedExcerpt=forceOcr?excerpt:undefined;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++operation.current;
    setFile(selected);setAnalysis(undefined);setError('');setPhase('analyzing');setProgress({message:'Lecture du document sur votre ordinateur…'});
    try{
      const {analyzePdf}=await import('../../features/pdf-import/pdf-import');
      if(abort.signal.aborted)return;
      const result=await analyzePdf(selected,{signal:abort.signal,forceOcr,onProgress:next=>{if(operation.current===current&&!abort.signal.aborted)setProgress(next);}});
      if(operation.current!==current||abort.signal.aborted)return;
      setAnalysis(result);setTitle(retainedTitle??result.title);setExcerpt(retainedExcerpt??result.excerpt);
      setText(result.body.content.map(node=>node.content?.map(child=>child.text??'').join('')??'').join('\n\n'));
      setPhase('ready');setProgress({message:'Analyse terminée. Aucun fichier n’a encore été envoyé.'});
    }catch(cause){
      if(operation.current!==current||abort.signal.aborted)return;
      setError(cause instanceof Error?cause.message:'L’analyse n’a pas abouti.');setPhase('idle');setProgress({message:''});
      if(input.current)input.current.value='';
    }
  }
  async function createDraft(){
    if(saving.current||!analysis||!file||!title.trim()||!text.trim())return;
    saving.current=true;setPhase('saving');setError('');
    const originalText=analysis.body.content.map(node=>node.content?.map(child=>child.text??'').join('')??'').join('\n\n');
    snapshot.current??={id:crypto.randomUUID(),title,excerpt,body:text===originalText?analysis.body:paragraphsToDocument(ocrTextToParagraphs(text)),analysis,file};
    const snap=snapshot.current;
    try{
      setProgress({message:snap.media?'Création du brouillon…':'Enregistrement privé du PDF…'});
      snap.media??=await uploadFile(snap.file,snap.id);
      snap.payload??=buildPdfArticle({...snap,pdf:fileFromMedia(snap.media)});
      setProgress({message:'Création de l’article en brouillon…'});
      await mediaRequest<{id:string}>('/api/admin/content/articles/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:snap.id,content:snap.payload})});
      setPhase('saved');setProgress({message:'Le brouillon a été enregistré. Le PDF reste privé.'});
    }catch(cause){
      setPhase('ready');setProgress({message:'Enregistrement non confirmé.'});
      setError((cause instanceof Error?cause.message:'La création n’a pas abouti.')+' Réessayez : la même tentative sera reprise, sans nouvel article.');
    }finally{saving.current=false;}
  }
  return <div className="admin-pdf-import">
    <div className="admin-card"><div className="admin-card-header"><div><p className="admin-eyebrow">Un document, un nouvel article</p><h2>Importer un article depuis un PDF</h2></div><FileText size={28} aria-hidden/></div>
      <div className="admin-card-body"><p>Votre document devient un texte modifiable. Les pages scannées bénéficient d’une reconnaissance de caractères en français et en anglais.</p>
        <label className="admin-upload-zone" htmlFor="pdf-import-file"><Upload size={30}/><strong>Choisir un document PDF</strong><span>20 Mo · 40 pages maximum</span><input id="pdf-import-file" ref={input} type="file" accept="application/pdf,.pdf" disabled={phase==='saving'||locked} onChange={event=>void analyze(event.currentTarget.files?.[0])}/></label>
        <p className="admin-hint">L’analyse s’effectue localement. Le fichier sera transmis uniquement après votre confirmation de création.</p>
        {file&&<p className="admin-media-filename"><FileText size={16}/>{file.name} · {fileSize(file.size)}</p>}
        {phase==='analyzing'&&<div aria-busy="true"><progress aria-label="Progression de l’analyse PDF" max={100} value={progress.percent}/><Button variant="secondary" onClick={reset}>Annuler l’analyse</Button></div>}
        {phase==='idle'&&file&&<Button variant="secondary" onClick={()=>void analyze(file)}>Réessayer l’analyse</Button>}
      </div></div>
    <p className="admin-pdf-progress" role="status">{progress.message}</p>{error&&<p className="admin-error" role="alert">{error}</p>}
    {analysis&&phase!=='saved'&&<section className="admin-card" aria-busy={phase==='saving'}><div className="admin-card-header"><h2 ref={resultHeading} tabIndex={-1}>Vérifier le résultat</h2><span className="admin-badge">{analysis.pageCount} pages · {analysis.ocrPages} avec OCR</span></div><div className="admin-card-body">
      <details className="admin-pdf-notes" open><summary>Points à relire avant publication</summary><ul>{analysis.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>
      <Button variant="secondary" onClick={()=>void analyze(file,true)} disabled={phase==='saving'||locked}><RotateCcw size={16}/>Refaire avec reconnaissance complète</Button>
      {locked&&<p className="admin-hint">Une création a déjà été tentée. Le texte est conservé pour reprendre la même opération ; vous pourrez ensuite le modifier dans l’article.</p>}
      <Field label="Titre de l’article" required>{id=><input id={id} className="admin-input" value={title} maxLength={220} onChange={event=>setTitle(event.target.value)} disabled={phase==='saving'||locked}/>}</Field>
      <Field label="Résumé" hint="Extrait du début du document, à ajuster.">{id=><textarea id={id} className="admin-textarea" value={excerpt} maxLength={500} rows={3} onChange={event=>setExcerpt(event.target.value)} disabled={phase==='saving'||locked}/>}</Field>
      <Field label="Texte extrait" hint="Corrigez les erreurs de lecture. La mise en forme sera disponible dans l’éditeur d’article.">{id=><textarea id={id} className="admin-textarea admin-pdf-text" value={text} maxLength={200_000} rows={14} onChange={event=>setText(event.target.value)} disabled={phase==='saving'||locked}/>}</Field>
      <p className="admin-pdf-privacy">Le PDF restera privé. Son téléchargement public nécessitera votre autorisation dans l’article, puis sa publication.</p>
      <div className="admin-actions"><Button onClick={()=>void createDraft()} loading={phase==='saving'} disabled={!title.trim()||!text.trim()||title.length>220||excerpt.length>500}>{locked?'Réessayer la création':'Créer le brouillon'}<ArrowRight size={16}/></Button><Button variant="ghost" onClick={reset} disabled={phase==='saving'}>Choisir un autre document</Button></div>
    </div></section>}
    {phase==='saved'&&<section className="admin-card admin-pdf-done"><Check size={32}/><h2 ref={resultHeading} tabIndex={-1}>Votre article est prêt à relire.</h2><p>Complétez l’auteure, la catégorie et la date dans l’éditeur. Rien n’est publié.</p><div className="admin-actions"><Button onClick={()=>onCreated(snapshot.current!.id)}>Ouvrir le brouillon<ArrowRight size={16}/></Button><Button variant="secondary" onClick={reset}>Importer un autre PDF</Button></div></section>}
    {onCancel&&<Button variant="ghost" onClick={onCancel} disabled={phase==='saving'}>Revenir aux articles</Button>}
  </div>;
}
