import {useState} from 'react';
import {ImagePlus,X} from 'lucide-react';
import type {ContentImage} from '../../lib/cms/types';
import {Button,Modal,Field} from '../ui';
import {MediaLibrary} from './MediaLibrary';
import {imageFromMedia} from './media-client';
import './media.css';

export function MediaPicker({value,onChange,label='Image'}:{value?:ContentImage;onChange:(value?:ContentImage)=>void;label?:string}){
  const [open,setOpen]=useState(false),[cropOpen,setCropOpen]=useState(false);
  function position(axis:'x'|'y',next:number){if(value)onChange({...value,hotspot:{x:.5,y:.5,width:1,height:1,...value.hotspot,[axis]:next}});}
  return <div className="admin-media-picker"><p className="admin-field-label">{label}</p>{value?<div className="admin-media-picked"><img src={`/media/${value.mediaId}/?w=320`} alt={value.alt} style={{objectPosition:`${(value.hotspot?.x??.5)*100}% ${(value.hotspot?.y??.5)*100}%`}}/><div><strong>{value.alt||'Image sélectionnée'}</strong><p className="admin-hint">{value.width&&value.height?`${value.width} × ${value.height} pixels`:'Média de votre bibliothèque'}</p><div className="admin-actions"><Button size="sm" variant="secondary" onClick={()=>setOpen(true)}>Changer l’image</Button><Button size="sm" variant="ghost" onClick={()=>onChange(undefined)}><X size={14}/>Retirer</Button></div></div></div>:<Button variant="secondary" onClick={()=>setOpen(true)}><ImagePlus size={17}/>Choisir une image</Button>}
    {value&&<><Field label={`Description de ${label.toLowerCase()}`} hint="Ce texte alternatif s’applique à cette utilisation de l’image.">{id=><input id={id} className="admin-input" value={value.alt} maxLength={500} onChange={event=>onChange({...value,alt:event.target.value})}/>}</Field><Button variant="ghost" size="sm" onClick={()=>setCropOpen(!cropOpen)} aria-expanded={cropOpen}>Ajuster le point d’intérêt</Button>{cropOpen&&<div className="admin-media-position"><p className="admin-hint">Le point d’intérêt reste visible lorsque le format de la page recadre l’image.</p><Field label="Position horizontale">{id=><input id={id} type="range" min={0} max={100} value={Math.round((value.hotspot?.x??.5)*100)} onChange={event=>position('x',Number(event.target.value)/100)}/>}</Field><Field label="Position verticale">{id=><input id={id} type="range" min={0} max={100} value={Math.round((value.hotspot?.y??.5)*100)} onChange={event=>position('y',Number(event.target.value)/100)}/>}</Field></div>}</>}
    <Modal open={open} onOpenChange={setOpen} title={`Choisir ${label.toLowerCase()}`} description="Sélectionnez une image existante ou importez un nouveau fichier." wide><MediaLibrary imagesOnly onSelect={media=>{onChange(imageFromMedia(media));setOpen(false);}}/></Modal>
  </div>;
}
