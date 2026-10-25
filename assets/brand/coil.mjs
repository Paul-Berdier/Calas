import {ribbonPaths,nucleus,gradientStops,viewBox} from './geometry.mjs';

/** Three motion studies share the exact reference contours. No rigid SVG
 * rotation or image scaling is used: the polar twist varies continuously with
 * distance to the nucleus, so the outer portions bend more than the inner ones. */
export const coilVariants={
 A:{title:'A — Extérieur vers intérieur',twist:.42,opening:.045,wave:0,stagger:0,duration:2.1},
 B:{title:'B — Cinq rubans en succession',twist:.42,opening:.045,wave:.025,stagger:.1,duration:1.8},
 C:{title:'C — Courbure organique',twist:.39,opening:.04,wave:.065,stagger:0,duration:2.1},
};
export const coilOrder=[4,2,1,0,3];
export const coilDuration=2.2;
export const coilSelected='B';
const clamp=value=>Math.min(1,Math.max(0,value));
const numeric=value=>Math.round(value*1000)/1000;
const mix=(a,b,t=.5)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function split(curve){
 const a=mix(curve[0],curve[1]),b=mix(curve[1],curve[2]),c=mix(curve[2],curve[3]),d=mix(a,b),e=mix(b,c),f=mix(d,e);
 return [[curve[0],a,d,f],[f,e,c,curve[3]]];
}
function subdivide(curve,depth=1){return depth?split(curve).flatMap(part=>subdivide(part,depth-1)):[curve];}
const prepared=new Map();
function contours(index){
 if(prepared.has(index))return prepared.get(index);
 if(!ribbonPaths[index])throw new RangeError('Unknown Calas ribbon');
 const tokens=ribbonPaths[index].match(/[MCZ]|-?\d+(?:\.\d+)?/g);
 let i=0,current=[0,0];const curves=[];
 while(i<tokens.length){
  const command=tokens[i++];
  if(command==='M')current=[Number(tokens[i++]),Number(tokens[i++])];
  else if(command==='C'){
   const c1=[Number(tokens[i++]),Number(tokens[i++])],c2=[Number(tokens[i++]),Number(tokens[i++])],end=[Number(tokens[i++]),Number(tokens[i++])];
   curves.push(...subdivide([current,c1,c2,end]));current=end;
  }
 }
 prepared.set(index,curves);return curves;
}
/** Smooth bijective radial expansion + radius-dependent angular bending.
 * The nucleus is fixed. Radius strictly decreases as the ribbon settles.
 * progress=1 returns the source path byte-for-byte, including its precision. */
export function coilPoint(x,y,progress,variant='B'){
 const config=coilVariants[variant];if(!config)throw new RangeError('Unknown coil study');
 const p=clamp(progress);if(p===1)return [x,y];
 const amount=(1+Math.cos(Math.PI*p))/2;
 const dx=x-nucleus[0],dy=y-nucleus[1],radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const radial=Math.min(1.3,radius/430);
 const twist=config.twist*radial**1.25+config.wave*Math.sin(angle*2+.4)*radial;
 const curvedAngle=angle+amount*twist;
 const openedRadius=radius*(1+config.opening*amount*radial**.8);
 return [nucleus[0]+Math.cos(curvedAngle)*openedRadius,nucleus[1]+Math.sin(curvedAngle)*openedRadius];
}
export function coilFrame(index,progress,variant='B'){
 if(progress>=1)return ribbonPaths[index];
 const config=coilVariants[variant];if(!config)throw new RangeError('Unknown coil study');
 const curves=contours(index),amount=(1+Math.cos(Math.PI*clamp(progress)))/2;
 const warp=p=>{
  let polar=polarPoints.get(p);
  if(!polar){
   const dx=p[0]-nucleus[0],dy=p[1]-nucleus[1],radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),radial=Math.min(1.3,radius/430);
   polar={radius,angle,bend:radial**1.25,wave:Math.sin(angle*2+.4)*radial,expansion:radial**.8};polarPoints.set(p,polar);
  }
  const angle=polar.angle+amount*(config.twist*polar.bend+config.wave*polar.wave);
  const radius=polar.radius*(1+config.opening*amount*polar.expansion);
  return `${numeric(nucleus[0]+Math.cos(angle)*radius)} ${numeric(nucleus[1]+Math.sin(angle)*radius)}`;
 };
 return `M ${warp(curves[0][0])} `+curves.map(curve=>'C '+curve.slice(1).map(warp).join(' ')).join(' ')+' Z';
}
const polarPoints=new WeakMap();
export function coilState(index,time,variant='B'){
 const config=coilVariants[variant];if(!config)throw new RangeError('Unknown coil study');
 const start=coilOrder.indexOf(index)*config.stagger;
 const progress=clamp((time-start)/config.duration);
 // A short entry accompanies the actual deformation; it never substitutes it.
 const opacity=clamp((time-start)/.18);
 return {progress,opacity,contour:opacity===0?ribbonPaths[index]:coilFrame(index,progress,variant)};
}
export function coilSvg(time,{variant='B',background='none',id='coil-gold'}={}){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="610" height="590"><rect x="-25" y="-30" width="610" height="590" fill="${background}"/><defs><linearGradient id="${id}" x1="0" y1="0.65" x2="1" y2="0.25" gradientUnits="objectBoundingBox">${gradientStops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient></defs>${ribbonPaths.map((_,index)=>{const frame=coilState(index,time,variant);return `<path d="${frame.contour}" fill="url(#${id})" opacity="${frame.opacity}"/>`;}).join('')}</svg>`;
}
