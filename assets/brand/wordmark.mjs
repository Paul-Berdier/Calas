// Original lettering traced from the supplied business card, including spacing.
// Rebuild contours with scripts/wordmark-trace.mjs; the shell is independent.
import contours from './wordmark-contours.json' with {type:'json'};
export const wordmarkWidth=contours.width;
export const wordmarkHeight=contours.height;
export const wordmarkViewBox='0 0 '+wordmarkWidth+' '+wordmarkHeight;
export function wordmarkMarkup({dark=false,mono=null}={}){
 const ink=mono??(dark?'#F7F2EA':'#14213A');
 const id=dark?'wordmark-gold-dark':'wordmark-gold-light';
 const stops=dark?['#E6CDA9','#D5B17B','#BE945F']:['#DCC29B','#BE955F','#9B6A31'];
 const gradient=mono?'':'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0"><stop stop-color="'+stops[0]+'"/><stop offset=".45" stop-color="'+stops[1]+'"/><stop offset="1" stop-color="'+stops[2]+'"/></linearGradient></defs>';
 return gradient+'<path fill="'+ink+'" fill-rule="evenodd" d="'+contours.calas+'"/><path fill="'+(mono??'url(#'+id+')')+'" fill-rule="evenodd" d="'+contours.conseil+'"/>';
}
