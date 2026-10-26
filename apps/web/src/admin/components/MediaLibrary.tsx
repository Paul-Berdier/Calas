import {useEffect,useRef,useState} from 'react';
import {FileText,ImagePlus,Search,Upload,Trash2,RefreshCw,Check} from 'lucide-react';
import {Button,Field,Modal,ConfirmDialog,EmptyState,Loading} from '../ui';
import {mediaRequest,uploadFile,fileSize,type MediaDto} from './media-client';
import './media.css';

export function MediaLibrary({onSelect,imagesOnly=false,pdfOnly=false}:{onSelect?:(media:MediaDto)=>void;imagesOnly?:boolean;pdfOnly?:boolean}){
  const [items,setItems]=useState<MediaDto[]>([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[hasMore,setHasMore]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[files,setFiles]=useState<File[]>([]);
  const [selected,setSelected]=useState<MediaDto>(),[alt,setAlt]=useState(''),[deleteOpen,setDeleteOpen]=useState(false),[replaceFile,setReplaceFile]=useState<File>(),[replaceOpen,setReplaceOpen]=useState(false);
  const [confirmShared,setConfirmShared]=useState(false);const uploadIds=useRef(new WeakMap<File,string>()),input=useRef<HTMLInputElement>(null),sequence=useRef(0);
  const searchRef=useRef(search);searchRef.current=search;
  async function load(append=false,signal?:AbortSignal){
    const current=++sequence.current;setLoading(true);
    try{
      const result=await mediaRequest<{items:MediaDto[];hasMore:boolean}>(`/api/admin/media/?q=${encodeURIComponent(searchRef.current)}&offset=${append?items.length:0}${imagesOnly?'&kind=image':pdfOnly?'&kind=pdf':''}`,{signal});
      if(current!==sequence.current)return;
      setItems(previous=>append?[...previous,...result.items]:result.items);setHasMore(result.hasMore);
    }catch(cause){if(cause instanceof DOMException&&cause.name==='AbortError')return;if(current===sequence.current)setError(cause instanceof Error?cause.message:'La médiathèque ne répond pas.');}
    finally{if(current===sequence.current)setLoading(false);}
  }
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(false,controller.signal),200);return()=>{clearTimeout(timer);controller.abort();};},[search,imagesOnly,pdfOnly]);
  async function upload(){
    if(busy||!files.length)return;setBusy(true);setError('');let succeeded=0;
    const pending=[...files];
    try{
      for(const file of files){
        const key=uploadIds.current.get(file)??crypto.randomUUID();uploadIds.current.set(file,key);
        setNotice(`Import ${succeeded+1} sur ${files.length} : ${file.name}`);
        await uploadFile(file,key);succeeded++;pending.shift();setFiles([...pending]);
      }
      setNotice(`${succeeded} fichier${succeeded>1?'s':''} enregistré${succeeded>1?'s':''} dans la médiathèque privée.`);
      if(input.current)input.current.value='';
    }catch(cause){setError(cause instanceof Error?cause.message:'L’import a été interrompu.');setNotice(`${succeeded} fichier${succeeded>1?'s':''} enregistré${succeeded>1?'s':''}. Les fichiers restants peuvent être réessayés.`);}
    finally{setBusy(false);await load();}
  }
  function openDetail(item:MediaDto){setSelected(item);setAlt(item.altText);setError('');setNotice('');setReplaceFile(undefined);setConfirmShared(false);}
  async function saveDetail(){
    if(!selected||busy)return;setBusy(true);setError('');
    try{
      const updated=await mediaRequest<MediaDto>(`/api/admin/media/${selected.id}/`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({altText:alt,crop:selected.crop,hotspot:selected.hotspot,expectedUpdatedAt:selected.updatedAt})});
      setSelected(updated);setItems(previous=>previous.map(item=>item.id===updated.id?updated:item));setNotice('Le texte alternatif a été enregistré.');
    }catch(cause){setError(cause instanceof Error?cause.message:'L’enregistrement n’a pas abouti.');}finally{setBusy(false);}
  }
  async function remove(){
    if(!selected||busy)return;setBusy(true);setError('');
    try{
      const result=await mediaRequest<{cleanupPending:boolean}>(`/api/admin/media/${selected.id}/`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUpdatedAt:selected.updatedAt})});
      setDeleteOpen(false);setSelected(undefined);setNotice(result.cleanupPending?'Média retiré. Le nettoyage du stockage sera retenté par la maintenance.':'Le média inutilisé a été supprimé.');await load();
    }catch(cause){setDeleteOpen(false);setError(cause instanceof Error?cause.message:'La suppression n’a pas abouti.');}finally{setBusy(false);}
  }
  async function replace(){
    if(!selected||!replaceFile||busy)return;setBusy(true);setError('');
    try{
      const form=new FormData();form.set('file',replaceFile);form.set('expectedUpdatedAt',selected.updatedAt);form.set('confirmReferences',String(confirmShared));
      const updated=await mediaRequest<MediaDto>(`/api/admin/media/${selected.id}/replace/`,{method:'POST',body:form});
      setSelected(updated);setItems(previous=>previous.map(item=>item.id===updated.id?updated:item));setReplaceFile(undefined);setReplaceOpen(false);setNotice('Le fichier a été remplacé, ses références sont conservées.');
    }catch(cause){setReplaceOpen(false);setError(cause instanceof Error?cause.message:'Le remplacement n’a pas abouti.');}finally{setBusy(false);}
  }
  return <div className="admin-media-library">
    <section className="admin-card"><div className="admin-card-header"><div><p className="admin-eyebrow">Vos images et documents</p><h2>Médiathèque</h2></div><ImagePlus size={28} aria-hidden/></div><div className="admin-card-body">
      <p className="admin-hint">Les fichiers restent privés jusqu’à leur utilisation dans un contenu publié. Les PDF nécessitent aussi une autorisation de téléchargement.</p>
      <div className="admin-media-toolbar"><label className="admin-media-search"><Search size={18} aria-hidden/><span className="sr-only">Rechercher un média par son nom</span><input className="admin-input" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Rechercher un fichier…"/></label><Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>Actualiser</Button></div>
      <label className="admin-upload-zone admin-upload-zone-compact"><Upload size={24}/><strong>Ajouter {imagesOnly?'des images':pdfOnly?'des PDF':'des images ou des PDF'}</strong><span>Images : 12 Mo · PDF : 20 Mo</span><input ref={input} type="file" multiple accept={imagesOnly?'image/jpeg,image/png,image/webp':pdfOnly?'.pdf':'.pdf,image/jpeg,image/png,image/webp'} disabled={busy} onChange={event=>{setFiles(Array.from(event.target.files??[]).slice(0,20));setError('');}}/></label>
      {files.length>0&&<div className="admin-actions"><span>{files.length} fichier{files.length>1?'s':''} sélectionné{files.length>1?'s':''}</span><Button onClick={()=>void upload()} loading={busy}><Upload size={16}/>Importer les fichiers</Button></div>}
    </div></section>
    {notice&&<p className="admin-success" role="status">{notice}</p>}{error&&!selected&&<p className="admin-error" role="alert">{error}</p>}
    {loading&&!items.length?<Loading label="Chargement de la médiathèque…"/>:!items.length?<EmptyState title={search?'Aucun fichier correspondant':'Une médiathèque prête à accueillir vos contenus'} description={search?'Essayez un autre nom ou effacez votre recherche.':'Ajoutez vos photographies et documents. Vous pourrez les sélectionner depuis vos pages et articles.'}/>:<div className="admin-media-grid">{items.map(item=><article key={item.id} className="admin-media-tile"><button className="admin-media-tile-preview" onClick={()=>onSelect?onSelect(item):openDetail(item)} aria-label={`${onSelect?'Sélectionner':'Ouvrir'} ${item.originalFilename}`}>
      {item.thumbnailUrl?<img src={`${item.thumbnailUrl}&v=${encodeURIComponent(item.updatedAt)}`} alt="" loading="lazy"/>:<FileText size={54} strokeWidth={1.2}/>}</button><div className="admin-media-tile-info"><strong title={item.originalFilename}>{item.originalFilename}</strong><p>{item.width?`${item.width} × ${item.height} · `:''}{fileSize(item.size)}</p><div className="admin-actions">{onSelect&&<Button size="sm" onClick={()=>onSelect(item)}><Check size={14}/>Choisir</Button>}<Button variant="ghost" size="sm" onClick={()=>openDetail(item)}>Détails</Button></div></div></article>)}</div>}
    {hasMore&&<Button variant="secondary" loading={loading} onClick={()=>void load(true)}>Afficher plus de fichiers</Button>}
    <Modal open={Boolean(selected)} onOpenChange={open=>{if(!open&&!busy)setSelected(undefined);}} title="Détails du média" description="Les textes alternatifs décrivent l’image pour les personnes qui ne la voient pas.">
      {selected&&<div className="admin-media-detail">{selected.thumbnailUrl?<img className="admin-media-detail-image" src={`${selected.url}?w=960&v=${encodeURIComponent(selected.updatedAt)}`} alt={alt}/>:<FileText className="admin-media-document-icon" size={64}/>}
        <h3 className="admin-media-filename">{selected.originalFilename}</h3><p className="admin-hint">{selected.mimeType} · {fileSize(selected.size)}{selected.width?` · ${selected.width} × ${selected.height}`:''}</p>
        {notice&&<p className="admin-success" role="status">{notice}</p>}{error&&<p className="admin-error" role="alert">{error}</p>}
        {selected.mimeType.startsWith('image/')&&<><Field label="Texte alternatif" hint="Décrivez le contenu utile de l’image ; évitez « image de ».">{id=><textarea id={id} className="admin-textarea" rows={3} maxLength={500} value={alt} disabled={!selected.canEdit||busy} onChange={event=>setAlt(event.target.value)}/>}</Field><Button onClick={()=>void saveDetail()} loading={busy} disabled={!selected.canEdit||alt===selected.altText}>Enregistrer le texte alternatif</Button></>}
        {onSelect&&<Button onClick={()=>{onSelect(selected);setSelected(undefined);}}><Check size={16}/>Utiliser ce média</Button>}
        <a className="admin-text-link" href={selected.url} target="_blank" rel="noreferrer">Ouvrir le fichier</a>
        {selected.canEdit&&<div className="admin-media-maintenance"><h3>Gestion du fichier</h3><Field label="Remplacer le fichier" hint="Le remplacement d’une image partagée est réservé à l’administrateur et s’applique à ses utilisations existantes.">{id=><input id={id} type="file" accept={selected.mimeType==='application/pdf'?'.pdf':'image/jpeg,image/png,image/webp'} disabled={busy} onChange={event=>setReplaceFile(event.target.files?.[0])}/>}</Field>
          {replaceFile&&<><label className="admin-checkbox-line"><input type="checkbox" checked={confirmShared} onChange={event=>setConfirmShared(event.target.checked)}/>J’autorise le remplacement de cette image dans ses contenus existants.</label><Button variant="secondary" onClick={()=>setReplaceOpen(true)} disabled={busy}>Vérifier le remplacement</Button></>}
          <Button variant="danger" onClick={()=>setDeleteOpen(true)} disabled={busy}><Trash2 size={16}/>Supprimer si inutilisé</Button><p className="admin-hint">Un fichier lié à une page, un article ou une version conservée ne peut pas être supprimé.</p>
        </div>}
      </div>}
    </Modal>
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Supprimer ce fichier inutilisé ?" description="Le serveur vérifiera les références, y compris celles de l’historique, avant toute suppression." confirmLabel="Supprimer le fichier" destructive busy={busy} onConfirm={()=>void remove()}/>
    <ConfirmDialog open={replaceOpen} onOpenChange={setReplaceOpen} title="Remplacer ce fichier ?" description="L’identifiant reste le même. Pour une image déjà utilisée, le changement sera visible dans les contenus qui la référencent. Les anciens objets sont conservés pour la maintenance." confirmLabel="Confirmer le remplacement" busy={busy} onConfirm={()=>void replace()}/>
  </div>;
}
