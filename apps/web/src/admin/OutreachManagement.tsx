import { useEffect, useState, type FormEvent } from 'react';
import { Eye, Plus, RefreshCw } from 'lucide-react';
import { request } from './api';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Loading, Modal } from './ui';
import { formatParisSchedule, parisScheduleCandidates, validateScheduledAt } from './outreach-schedule';
import type { CampaignPreview as MailPreview, DeliveryHistoryItem as DeliveryItem, MessageTemplate, OutreachPage as PagedItems } from '../lib/outreach-management';

export type { OutreachPage as PagedItems } from '../lib/outreach-management';
export interface MessageInput { title: string; subject: string; body: string; targetPath: string }
const deliveryLabels: Record<DeliveryItem['status'], string> = {
  queued: 'En file', sending: 'En cours', accepted: 'Accepté par le serveur mail', simulated: 'Simulé',
  failed: 'Échec', uncertain: 'À vérifier', suppressed: 'Exclu',
};

/** Abort superseded requests and never label stale data as the newly selected filter. */
export function useOutreachPage<T>(path: string|null, refresh: unknown = 0) {
  const [data, setData] = useState<PagedItems<T>|null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const timer = setTimeout(() => {
      request<PagedItems<T>>(path, {signal: controller.signal})
        .then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, refresh, retry]);
  return {data, error, loading, retry: () => setRetry(value => value + 1)};
}

export function OutreachPagination({data, offset, onOffset, label, disabled = false}: {
  data: Pick<PagedItems<unknown>, 'total'|'limit'>|null; offset: number; onOffset: (offset:number)=>void; label:string; disabled?:boolean;
}) {
  const limit=data?.limit??25;
  useEffect(() => {
    if (data && offset > 0 && offset >= data.total) onOffset(Math.max(0, Math.floor((data.total - 1) / limit) * limit));
  }, [data, offset, limit, onOffset]);
  return <div className="outreach-pagination" aria-label={label}>
    <span role="status">{data ? data.total ? `${offset + 1}–${Math.min(offset + limit, data.total)} sur ${data.total}` : 'Aucun résultat' : 'Chargement…'}</span>
    <div className="admin-actions">
      <Button variant="secondary" size="sm" disabled={disabled||offset===0} onClick={()=>onOffset(Math.max(0,offset-limit))}>Précédents</Button>
      <Button variant="secondary" size="sm" disabled={disabled||!data||offset+limit>=data.total} onClick={()=>onOffset(offset+limit)}>Suivants</Button>
    </div>
  </div>;
}

export function DeliveryHistory({campaignId, refresh}: {campaignId?:string; refresh?:unknown}) {
  const [query,setQuery]=useState(''), [status,setStatus]=useState(''), [offset,setOffset]=useState(0);
  const params=new URLSearchParams({q:query,status,offset:String(offset),limit:'25'});
  if (!status) params.delete('status');
  if (campaignId) params.set('campaignId',campaignId);
  const list=useOutreachPage<DeliveryItem>('/api/admin/outreach/deliveries/?'+params,refresh);
  useEffect(()=>{setOffset(0);setQuery('');setStatus('');},[campaignId]);
  return <section className="admin-card outreach-history">
    <div className="admin-card-header"><div><h2>Historique complet des envois</h2><p>{campaignId?'Tous les envois conservés pour cette campagne.':'Recherchez un envoi dans toutes les campagnes.'}</p></div>
      <Button variant="ghost" size="icon" aria-label="Actualiser l’historique des envois" onClick={list.retry}><RefreshCw size={17}/></Button>
    </div>
    <div className="admin-card-body outreach-stack">
      <div className="outreach-grid">
        <Field label="Rechercher un envoi">{id=><input id={id} className="admin-input" maxLength={100} placeholder="E-mail, entreprise ou campagne" value={query} onChange={event=>{setQuery(event.target.value);setOffset(0);}}/>}</Field>
        <Field label="État de l’envoi">{id=><select id={id} className="admin-input" value={status} onChange={event=>{setStatus(event.target.value);setOffset(0);}}><option value="">Tous les états</option>{Object.entries(deliveryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</Field>
      </div>
      {list.error?<div role="alert" className="admin-error"><p>{list.error}</p><Button variant="secondary" onClick={list.retry}>Réessayer l’historique</Button></div>:list.loading?<Loading label="Chargement des envois…"/>:list.data?.items.length?<div className="outreach-list">
        {list.data.items.map(item=><article className="outreach-list-row" key={item.id}>
          <div className="outreach-grow"><h3>{item.company||item.email}</h3><p>{item.email}</p>{!campaignId&&<p>{item.campaignTitle}</p>}<small>Mise en file : {formatParisSchedule(item.createdAt)}{item.scheduledAt&&<><br/>Début prévu : {formatParisSchedule(item.scheduledAt)}</>}{item.finishedAt&&<><br/>Dernier résultat : {formatParisSchedule(item.finishedAt)}</>}<br/>{item.attempts} tentative(s)</small></div>
          <Badge status={item.status==='accepted'?'published':item.status==='failed'?'archived':'draft'}>{item.status==='queued'&&item.scheduledAt&&Date.parse(item.scheduledAt)>Date.now()?'Programmé':deliveryLabels[item.status]}</Badge>
        </article>)}
      </div>:<EmptyState title="Aucun envoi trouvé" description="Modifiez les filtres ou préparez les premiers envois de cette campagne."/>}
      <OutreachPagination data={list.data} offset={offset} onOffset={setOffset} label="Pagination des envois" disabled={list.loading}/>
      <p className="admin-hint">Un message accepté par le serveur mail peut encore arriver dans les indésirables. Les réponses et erreurs reçues dans la boîte OVH ne sont pas détectées automatiquement.</p>
    </div>
  </section>;
}

export function CampaignMailPreview({campaignId,contactId,version,onReady}: {campaignId:string;contactId?:string;version:number;onReady?:(ready:boolean)=>void}) {
  const [data,setData]=useState<MailPreview|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError('');onReady?.(false);
    request<MailPreview>(`/api/admin/outreach/campaigns/${campaignId}/preview/`,{method:'POST',body:JSON.stringify(contactId?{contactId}:{}),signal:controller.signal})
      .then(value=>{if(!controller.signal.aborted){setData(value);onReady?.(true);}})
      .catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);});
    return()=>controller.abort();
  },[campaignId,contactId,version,retry,onReady]);
  return <div className="outreach-stack outreach-mail-preview">
    {error?<div role="alert" className="admin-error"><p>{error}</p><Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>Réessayer l’aperçu</Button></div>:!data?<Loading label="Préparation du message final…"/>:<>
      <dl className="outreach-preview-meta"><div><dt>Objet</dt><dd>{data.subject}</dd></div><div><dt>Destinataire d’aperçu</dt><dd>{data.recipient?.email??'Exemple sans destinataire'}</dd></div></dl>
      <div className="outreach-message outreach-final-message" aria-label="Contenu final du courriel">{data.text}</div>
      <p className="admin-hint">La signature, la provenance des coordonnées et les liens sont inclus. {data.sourceIsExample&&'La provenance affichée est un exemple ; elle sera remplacée par celle du contact sélectionné. '}Le lien de désinscription est un exemple inactif ; chaque destinataire recevra son propre lien. Cet aperçu n’envoie aucun message et ne comptabilise aucune visite.</p>
    </>}
  </div>;
}

export interface ScheduleChoice {enabled:boolean;scheduledAt:string|null;error:string}
export function ScheduleChooser({onChange}: {onChange:(choice:ScheduleChoice)=>void}) {
  const [enabled,setEnabled]=useState(false),[value,setValue]=useState(''),[occurrence,setOccurrence]=useState('');
  const candidates=parisScheduleCandidates(value);
  const iso=candidates.length===1?candidates[0]:candidates.includes(occurrence)?occurrence:null;
  const error=!enabled?'':!value?'Renseignez la date et l’heure de début.':!candidates.length?'Cette date ou cette heure n’existe pas à Paris. Choisissez une autre heure.':!iso?'Cette heure existe deux fois lors du changement d’heure. Choisissez laquelle.':validateScheduledAt(iso);
  useEffect(()=>{onChange({enabled,scheduledAt:enabled?iso:null,error});},[enabled,iso,error,onChange]);
  return <fieldset className="outreach-fieldset">
    <legend>Quand commencer les envois ?</legend>
    <label className="outreach-check"><input type="radio" name="outreach-schedule" checked={!enabled} onChange={()=>setEnabled(false)}/><span>Au prochain passage du serveur</span></label>
    <label className="outreach-check"><input type="radio" name="outreach-schedule" checked={enabled} onChange={()=>setEnabled(true)}/><span>À une date et une heure choisies</span></label>
    {enabled&&<><Field label="Début des envois — heure de Paris" hint="Fuseau Europe/Paris, y compris les changements d’heure. Dans les 366 prochains jours.">{id=><input id={id} type="datetime-local" className="admin-input" value={value} onChange={event=>{setValue(event.target.value);setOccurrence('');}}/>}</Field>
      {candidates.length>1&&<Field label="Occurrence de cette heure">{id=><select id={id} className="admin-input" value={occurrence} onChange={event=>setOccurrence(event.target.value)}><option value="">Choisir l’heure</option>{candidates.map((candidate,index)=><option key={candidate} value={candidate}>{index===0?'Première occurrence — heure d’été (UTC+2)':'Deuxième occurrence — heure d’hiver (UTC+1)'}</option>)}</select>}</Field>}
      {value&&error&&<p className="admin-error" role="alert">{error}</p>}
      {iso&&!error&&<p className="admin-notice" role="status">Début prévu le {formatParisSchedule(iso)}.</p>}
    </>}
    <p className="admin-hint">Les messages partiront progressivement à partir de ce moment, selon la cadence autorisée. Une campagne en pause n’envoie rien.</p>
  </fieldset>;
}

export function TemplateLibrary({targets,onUse,onDirtyChange}: {targets:{path:string;title:string}[];onUse:(input:MessageInput)=>void;onDirtyChange:(dirty:boolean)=>void}) {
  const [query,setQuery]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
  const list=useOutreachPage<MessageTemplate>('/api/admin/outreach/templates/?'+new URLSearchParams({q:query,offset:String(offset),limit:'20'}),revision);
  const [editing,setEditing]=useState<MessageTemplate|'new'|null>(null),[input,setInput]=useState<MessageInput>({title:'',subject:'',body:'',targetPath:''});
  const [deleting,setDeleting]=useState<MessageTemplate|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false);
  const close=()=>{setEditing(null);setDirty(false);setDiscard(false);onDirtyChange(false);};
  const edit=(value:MessageTemplate|'new')=>{setEditing(value);setError('');setDirty(false);setInput(value==='new'?{title:'',subject:'',body:'',targetPath:targets[0]?.path??''}:{title:value.title,subject:value.subject,body:value.body,targetPath:value.targetPath});};
  async function save(event:FormEvent){
    event.preventDefault();if(!editing)return;setBusy(true);setError('');
    try{await request('/api/admin/outreach/templates/'+(editing==='new'?'':editing.id+'/'),{method:editing==='new'?'POST':'PATCH',body:JSON.stringify({...input,...(editing==='new'?{}:{version:editing.version})})});close();setRevision(value=>value+1);setNotice('Modèle enregistré. Les campagnes déjà créées sont inchangées.');}
    catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
  }
  async function remove(){if(!deleting)return;setBusy(true);setError('');try{await request(`/api/admin/outreach/templates/${deleting.id}/`,{method:'DELETE',body:JSON.stringify({version:deleting.version})});setDeleting(null);setOffset(0);setRevision(value=>value+1);setNotice('Modèle supprimé. Les campagnes déjà créées sont conservées.');}catch(cause){setError((cause as Error).message);setDeleting(null);}finally{setBusy(false);}}
  return <div className="outreach-stack">
    <div className="admin-actions"><Button onClick={()=>edit('new')}><Plus size={16} aria-hidden/>Créer un modèle</Button></div>
    <p className="admin-hint">Préparez des messages réutilisables. Utiliser un modèle prépare un nouveau brouillon ; cela ne choisit aucun destinataire et n’envoie rien.</p>
    {notice&&<p className="admin-notice" role="status">{notice}</p>}{error&&!editing&&<p className="admin-error" role="alert">{error}</p>}
    <Field label="Rechercher un modèle">{id=><input id={id} className="admin-input" maxLength={100} value={query} onChange={event=>{setQuery(event.target.value);setOffset(0);}}/>}</Field>
    {list.error?<div className="admin-error" role="alert"><p>{list.error}</p><Button variant="secondary" onClick={list.retry}>Réessayer les modèles</Button></div>:list.loading?<Loading label="Chargement des modèles…"/>:<section className="admin-card">{list.data?.items.length?<div className="outreach-list">{list.data.items.map(item=><article className="outreach-list-row" key={item.id}><div className="outreach-grow"><h2>{item.title}</h2><p>{item.subject}</p><small>{item.targetPath}</small></div><div className="admin-actions"><Button variant="secondary" size="sm" onClick={()=>onUse({title:item.title,subject:item.subject,body:item.body,targetPath:item.targetPath})}>Utiliser</Button><Button variant="ghost" size="sm" onClick={()=>edit(item)}>Modifier</Button><Button variant="ghost" size="sm" onClick={()=>setDeleting(item)}>Supprimer</Button></div></article>)}</div>:<EmptyState title="Votre premier modèle" description="Enregistrez un message que vous souhaitez réutiliser dans plusieurs campagnes."/>}</section>}
    <OutreachPagination data={list.data} offset={offset} onOffset={setOffset} label="Pagination des modèles" disabled={list.loading}/>
    <Modal open={Boolean(editing)} onOpenChange={open=>{if(!open&&!busy){if(dirty)setDiscard(true);else close();}}} title={editing==='new'?'Créer un modèle de message':'Modifier le modèle'} wide>
      <form className="outreach-stack" onSubmit={event=>void save(event)} onChange={()=>{setDirty(true);onDirtyChange(true);}}>
        <fieldset className="outreach-stack outreach-form-fields" disabled={busy}>
        {error&&<p role="alert" className="admin-error">{error}</p>}
        <Field label="Nom du modèle" required>{id=><input id={id} className="admin-input" required minLength={3} maxLength={120} value={input.title} onChange={event=>setInput({...input,title:event.target.value})}/>}</Field>
        <Field label="Objet du message" required>{id=><input id={id} className="admin-input" required minLength={3} maxLength={180} value={input.subject} onChange={event=>setInput({...input,subject:event.target.value})}/>}</Field>
        <Field label="Texte du modèle" required hint="La signature et les liens seront ajoutés au message final de chaque campagne.">{id=><textarea id={id} className="admin-textarea" required minLength={10} maxLength={15000} rows={8} value={input.body} onChange={event=>setInput({...input,body:event.target.value})}/>}</Field>
        <Field label="Page proposée par le modèle" required>{id=><select id={id} className="admin-input" required value={input.targetPath} onChange={event=>setInput({...input,targetPath:event.target.value})}><option value="">Choisir une page publiée</option>{!targets.some(target=>target.path===input.targetPath)&&input.targetPath&&<option value={input.targetPath} disabled>{input.targetPath} — indisponible</option>}{targets.map(target=><option key={target.path} value={target.path}>{target.title} ({target.path})</option>)}</select>}</Field>
        <div className="admin-actions"><Button type="submit" loading={busy}>Enregistrer le modèle</Button><Button variant="secondary" disabled={busy} onClick={()=>dirty?setDiscard(true):close()}>Annuler</Button></div>
        </fieldset>
      </form>
    </Modal>
    <ConfirmDialog open={discard} onOpenChange={setDiscard} title="Abandonner les modifications ?" description="Les modifications de ce modèle n’ont pas encore été enregistrées." confirmLabel="Abandonner" onConfirm={close}/>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}} title="Supprimer ce modèle ?" description={`Le modèle « ${deleting?.title??''} » sera supprimé. Les campagnes créées à partir de ce modèle sont conservées.`} confirmLabel="Supprimer le modèle" destructive busy={busy} onConfirm={()=>void remove()}/>
  </div>;
}

export function PreviewButton({onClick}: {onClick:()=>void}) {
  return <Button variant="secondary" onClick={onClick}><Eye size={16} aria-hidden/>Aperçu du mail final</Button>;
}
