import {ribbonPaths} from './geometry.mjs';

/** Centre-lines follow each band from its inner, narrow tip towards its outer
 * end. The source mark in geometry.mjs remains unchanged. Times are seconds. */
export const ribbonGuides=[
 {index:3,d:'M 152 361 C 169 350 187 365 179 382 C 169 403 139 390 133 369 C 127 346 149 326 171 326 C 201 325 219 356 215 385 C 212 417 188 435 157 431 C 115 433 86 396 84 355 C 81 298 120 259 172 258 C 225 252 268 281 287 330 C 305 376 290 420 263 455',width:52,start:0,duration:.82},
 {index:0,d:'M 146 305 C 178 286 222 304 244 340 C 267 377 251 420 222 449 C 192 470 151 475 117 457 C 70 437 51 388 53 344 C 55 283 100 231 159 215 C 223 194 279 225 318 280 C 348 324 354 372 335 414 C 308 469 246 508 166 503',width:68,start:.5,duration:.74},
 {index:1,d:'M 153 487 C 79 476 30 413 25 348 C 18 279 54 199 126 166 C 187 130 262 139 315 169 C 361 202 391 263 399 321 C 409 375 382 427 346 464',width:84,start:1.05,duration:.66},
 {index:2,d:'M 16 275 C 49 209 100 142 180 105 C 249 74 332 76 377 120 C 433 153 461 226 447 295',width:96,start:1.55,duration:.55},
 {index:4,d:'M 255 48 C 309 30 373 18 410 31 C 441 48 461 101 473 139',width:56,start:1.98,duration:.36},
];
export const unfurlDuration=Math.max(...ribbonGuides.map(guide=>guide.start+guide.duration));

const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const point=(x,y)=>({x,y});
const mix=(a,b,t=.5)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function curves(path){
 const tokens=path.match(/[MCZ]|-?\d+(?:\.\d+)?/g)??[];
 const segments=[];
 let i=0,current=point(0,0),origin=current;
 while(i<tokens.length){
  const command=tokens[i++];
  if(command==='M'){current=point(Number(tokens[i++]),Number(tokens[i++]));origin=current;}
  else if(command==='C'){
   const control1=point(Number(tokens[i++]),Number(tokens[i++]));
   const control2=point(Number(tokens[i++]),Number(tokens[i++]));
   const end=point(Number(tokens[i++]),Number(tokens[i++]));
   segments.push([current,control1,control2,end]);current=end;
  }else if(command==='Z'&&distance(current,origin)>.001){segments.push([current,mix(current,origin,1/3),mix(current,origin,2/3),origin]);}
 }
 return segments;
}
function sample(curve,t){const a=mix(curve[0],curve[1],t),b=mix(curve[1],curve[2],t),c=mix(curve[2],curve[3],t);return mix(mix(a,b,t),mix(b,c,t),t);}
function split(curve){const a=mix(curve[0],curve[1]),b=mix(curve[1],curve[2]),c=mix(curve[2],curve[3]),d=mix(a,b),e=mix(b,c),f=mix(d,e);return [[curve[0],a,d,f],[f,e,c,curve[3]]];}
function subdivide(curve,depth=2){return depth?split(curve).flatMap(part=>subdivide(part,depth-1)):[curve];}
// Secondary pages import this module without paying for sampling/projection.
const prepared=new Map();
function prepare(index){
 if(prepared.has(index))return prepared.get(index);
 const guide=ribbonGuides.find(guide=>guide.index===index);
 if(!guide)throw new RangeError(`Unknown Calas ribbon: ${index}`);
 const guideCurves=curves(guide.d);
 const samples=[];let length=0,previous;
 guideCurves.forEach((curve,curveIndex)=>{
  for(let n=curveIndex?1:0;n<=32;n++){
   const p=sample(curve,n/32);
   if(previous)length+=distance(p,previous);
   samples.push({...p,length});previous=p;
  }
 });
 const normalized=samples.map(p=>({...p,progress:p.length/length}));
 const expandedGuides=guideCurves.flatMap(curve=>subdivide(curve));
 const expandedContours=curves(ribbonPaths[guide.index]).flatMap(curve=>subdivide(curve));
 const projections=new WeakMap();
 for(const curve of [...expandedGuides,...expandedContours])for(const p of curve){if(!projections.has(p))projections.set(p,nearest(p,normalized));}
 const result={...guide,samples:normalized,length,guideCurves:expandedGuides,contourCurves:expandedContours,projections};
 prepared.set(index,result);return result;
}

function nearest(p,samples){
 let bestDistance=Infinity,result;
 for(let i=0;i<samples.length-1;i++){
  const a=samples[i],b=samples[i+1];
  const dx=b.x-a.x,dy=b.y-a.y,squared=dx*dx+dy*dy;
  const fraction=squared?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/squared):0;
  const foot=mix(a,b,fraction),away=distance(foot,p);
  if(away<bestDistance){const length=Math.sqrt(squared)||1;bestDistance=away;result={progress:a.progress+(b.progress-a.progress)*fraction,nx:-dy/length,ny:dx/length,distance:away};}
 }
 return result;
}
const numeric=value=>Number(value.toFixed(3));
function stringify(segments,warp,closed=false){
 const p=warp(segments[0][0]);
 return `M ${numeric(p.x)} ${numeric(p.y)} `+segments.map(curve=>'C '+curve.slice(1).map(p=>{const next=warp(p);return `${numeric(next.x)} ${numeric(next.y)}`;}).join(' ')).join(' ')+(closed?' Z':'');
}

/** A local bend travels with the revealed head. Earlier body points are
 * untouched, so the silhouette cannot rock left/right as one rigid object.
 * Both the printed contour and its reveal guide receive the SAME deformation.
 * At progress=1 the original d strings are returned byte for byte. */
export function ribbonFrame(index,progress){
 const guide=prepare(index);
 const p=clamp(progress);
 if(p===1||p===0)return {contour:ribbonPaths[index],guide:guide.d,width:guide.width};
 const headWindow=.115;
 const amplitude=Math.min(guide.width*.12,7)*Math.sin(Math.PI*clamp(p/.1)/2)*Math.sin(Math.PI*clamp((1-p)/.1)/2);
 const warp=point=>{
  const hit=guide.projections.get(point);
  if(!hit||hit.distance>guide.width*.85)return point;
  const position=(hit.progress-p)/headWindow;
  if(position<=-1||position>=.55)return point;
  // A compact, smooth bend: already laid down body (>11.5% behind the head)
  // never moves. The deformation relaxes to exactly zero at completion.
  const wave=Math.sin(Math.PI*(position+1)/1.55)**2;
  const bend=amplitude*wave;
  return {x:point.x+hit.nx*bend,y:point.y+hit.ny*bend};
 };
 return {contour:stringify(guide.contourCurves,warp,true),guide:stringify(guide.guideCurves,warp),width:guide.width};
}

/** Read-only diagnostics and storyboard rendering for the independent study. */
export function unfurlSvg(time,{guides=false,background='#F7F2EA'}={}){
 const frames=ribbonGuides.map((guide)=>({...guide,progress:clamp((time-guide.start)/guide.duration)}));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -30 610 590" width="610" height="590"><rect x="-25" y="-30" width="610" height="590" fill="${background}"/><defs><linearGradient id="unfurl-gold"><stop stop-color="#C9A46E"/><stop offset=".48" stop-color="#E3C391"/><stop offset="1" stop-color="#8C5F27"/></linearGradient>${frames.map(guide=>{const frame=ribbonFrame(guide.index,guide.progress);const length=prepared.get(guide.index).length;return `<mask id="r${guide.index}" maskUnits="userSpaceOnUse" x="-25" y="-30" width="610" height="590"><path d="${frame.guide}" fill="none" stroke="white" stroke-width="${guide.width}" stroke-linecap="butt" stroke-dasharray="${length} ${length}" stroke-dashoffset="${(1-guide.progress)*length}"/></mask>`;}).join('')}</defs>${frames.map(guide=>{const frame=ribbonFrame(guide.index,guide.progress);return guide.progress?`<path d="${frame.contour}" fill="url(#unfurl-gold)" ${guide.progress===1?'':`mask="url(#r${guide.index})"`}/>`:'';}).join('')}${guides?frames.map(guide=>`<path d="${guide.d}" fill="none" stroke="#d93060" stroke-width="1" opacity=".7"/>`).join(''):''}</svg>`;
}
