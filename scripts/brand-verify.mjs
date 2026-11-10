import {ribbonPaths} from '../assets/brand/geometry.mjs';
import {ribbonGuides,ribbonFrame,unfurlSvg,unfurlDuration} from '../assets/brand/unfurl.mjs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {coilPoint,coilFrame,coilState,coilDuration} from '../assets/brand/coil.mjs';
import {nucleus} from '../assets/brand/geometry.mjs';

// Current coiling: differential bending and radial convergence, not a rotation.
let coilChecks=0;
for(const variant of ['A','B','C'])for(let index=0;index<5;index++){
 assert.equal(coilFrame(index,1,variant),ribbonPaths[index]);
 for(let step=0;step<=100;step++){
  const p=step/100,contour=coilFrame(index,p,variant);
  assert(!/NaN|Infinity/.test(contour));
  const coordinates=[...contour.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  for(const match of coordinates){assert(+match[1]>=-25&&+match[1]<=585,'Motion stays inside the SVG horizontally');assert(+match[2]>=-30&&+match[2]<=560,'Motion stays inside the SVG vertically');}
  assert.deepEqual(coilPoint(...nucleus,p,variant),nucleus,'The nucleus never translates');
  coilChecks++;
 }
}
for(const radius of [20,80,160,300,420]){
 let previous=Infinity;
 for(let step=0;step<=100;step++){
  const [x,y]=coilPoint(nucleus[0]+radius,nucleus[1],step/100);
  const distance=Math.hypot(x-nucleus[0],y-nucleus[1]);assert(distance<=previous+1e-8,'Every sampled radius contracts towards the fixed nucleus');previous=distance;
 }
}
const angles=[40,400].map(r=>{const [x,y]=coilPoint(nucleus[0]+r,nucleus[1],0);return Math.atan2(y-nucleus[1],x-nucleus[0]);});
assert(angles[1]-angles[0]>.2,'Outer and inner portions bend differently: no rigid rotation');
assert(coilState(4,.12).opacity>0&&coilState(3,.12).opacity===0,'The outer ribbon arrives before the nucleus');
assert(coilDuration>=1.8&&coilDuration<=2.5);
console.log(`PASS: ${coilChecks} current coil frames, all 3 studies bounded; fixed nucleus; radial convergence; exact final paths.`);

// Preserve geometry coverage for the previous unfurl study kept as an archive.
const progressSamples=[0,.01,.05,.125,.25,.375,.5,.625,.75,.875,.95,.99,.999,1];
for(const guide of ribbonGuides){
 assert.equal(ribbonFrame(guide.index,1).contour,ribbonPaths[guide.index],`Ribbon ${guide.index}: exact final source`);
 assert.equal(ribbonFrame(guide.index,1).guide,guide.d,`Ribbon ${guide.index}: exact final guide`);
 for(const progress of progressSamples){
  const frame=ribbonFrame(guide.index,progress);
  assert(!/NaN|Infinity/.test(frame.contour+frame.guide),`Ribbon ${guide.index}, ${progress}: non-finite path`);
  assert(Number.isFinite(frame.width)&&frame.width>0,'Finite positive reveal width');
 }
}

async function areaAt(time){
 // Absolute dash lengths keep this study compatible with librsvg. The live
 // application uses browser-native pathLength masks and separate browser QA.
 const {data,info}=await sharp(Buffer.from(unfurlSvg(time,{background:'none'}))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let area=0;
 for(let pixel=0;pixel<info.width*info.height;pixel++)if(data[pixel*info.channels+info.channels-1]>=128)area++;
 return area;
}
const times=[0,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,1,1.15,1.3,1.45,1.6,1.75,1.9,2.05,2.2,2.3,unfurlDuration];
const areas=[];
for(const time of times)areas.push({time,area:await areaAt(time)});
assert.equal(areas[0].area,0,'No whole-shell flash at the start');
const finalArea=areas.at(-1).area;
assert(finalArea>100000,'Final reference silhouette is fully present');
assert(areas[1].area>0&&areas[1].area<finalArea*.05,'The first frame contains only a small strand');
for(let i=1;i<areas.length;i++)assert(areas[i].area>=areas[i-1].area,`Visible area regresses at ${areas[i].time}s`);
assert(areas.find(frame=>frame.time===1.15).area<finalArea*.8,'Outer bands remain absent midway through the reveal');
console.log(`PASS: 5 exact final contours; ${ribbonGuides.length*progressSamples.length} finite ribbon frames; ${areas.length} progressive visible-area samples.`);
console.log(JSON.stringify({duration:unfurlDuration,areas},null,2));
