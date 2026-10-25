import {ribbonPaths} from '../assets/brand/geometry.mjs';
import {ribbonGuides,ribbonFrame,unfurlSvg,unfurlDuration} from '../assets/brand/unfurl.mjs';
import sharp from 'sharp';
import assert from 'node:assert/strict';

// Validate the current progressive reveal, not the superseded radial motion.
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
