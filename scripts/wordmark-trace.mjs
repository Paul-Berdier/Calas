// Reconstruct the actual lettering from the supplied card, without substituting
// a font or redrawing individual glyphs. This does not alter the shell geometry.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const reference=process.argv[2];
if(!reference)throw new Error('Usage: node scripts/wordmark-trace.mjs <supplied-card.jpg>');
const source=await readFile(reference);
const hash=createHash('sha256').update(source).digest('hex');
const box={left:140,top:424,width:510,height:68};
const scale=4,W=box.width*scale,H=box.height*scale;
const {data,info}=await sharp(source).extract(box).resize(W,H,{kernel:'lanczos3'}).blur(1.1).removeAlpha().raw().toBuffer({resolveWithObject:true});
const n=value=>Number(value.toFixed(3));
function simplify(points,epsilon){
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1];let max=0,at=0;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    if(distance>max){max=distance;at=i;}
  }
  return max>epsilon?[...simplify(points.slice(0,at+1),epsilon).slice(0,-1),...simplify(points.slice(at),epsilon)]:[a,b];
}
function trace(part,frame={data,info,W,H}){
  const {data,info,W,H}=frame;
  const mask=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*info.channels,r=data[i],b=data[i+2];
    mask[y*W+x]=part==='calas'?Number(x<238*scale&&r<130):Number((part==='signature'||x>238*scale)&&b<210);
  }
  if(part==='conseil'){
    // Close JPEG pinholes below half a source pixel, preserving the letter counters.
    const expanded=new Uint8Array(W*H);
    for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
      let value=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dy*dy<=4)value|=mask[(y+dy)*W+x+dx];
      expanded[y*W+x]=value;
    }
    for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
      let value=1;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dy*dy<=4)value&=expanded[(y+dy)*W+x+dx];
      mask[y*W+x]=value;
    }
  }
  const edges=new Map(),key=(x,y)=>y*(W+1)+x;
  const add=(x,y,u,v)=>{const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(key(u,v));};
  const pixel=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&mask[y*W+x];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(pixel(x,y)){
    if(!pixel(x,y-1))add(x,y,x+1,y);
    if(!pixel(x+1,y))add(x+1,y,x+1,y+1);
    if(!pixel(x,y+1))add(x+1,y+1,x,y+1);
    if(!pixel(x-1,y))add(x,y+1,x,y);
  }
  const contours=[];
  while(edges.size){
    const first=edges.keys().next().value,points=[];let current=first;
    do{
      points.push([current%(W+1)/scale,Math.floor(current/(W+1))/scale]);
      const next=edges.get(current);if(!next?.length)throw new Error('Open reference contour');
      const destination=next.pop();if(!next.length)edges.delete(current);current=destination;
    }while(current!==first);
    const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2;
    if(Math.abs(area)<1.8)continue;
    let far=1;for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[far][0]-points[0][0],points[far][1]-points[0][1]))far=i;
    const reduced=[...simplify(points.slice(0,far+1),.32).slice(0,-1),...simplify([...points.slice(far),points[0]],.32).slice(0,-1)];
    // Round only the subpixel corners caused by the JPEG grid. Actual serif
    // corners and the proportions of each letter remain at their source points.
    const before=[],after=[];
    for(let i=0;i<reduced.length;i++){
      const p=reduced[i],a=reduced[(i+reduced.length-1)%reduced.length],b=reduced[(i+1)%reduced.length];
      const lengthA=Math.hypot(a[0]-p[0],a[1]-p[1]),lengthB=Math.hypot(b[0]-p[0],b[1]-p[1]);
      const radius=Math.min(.23,lengthA*.2,lengthB*.2);
      before.push([p[0]+(a[0]-p[0])*radius/lengthA,p[1]+(a[1]-p[1])*radius/lengthA]);
      after.push([p[0]+(b[0]-p[0])*radius/lengthB,p[1]+(b[1]-p[1])*radius/lengthB]);
    }
    const coord=p=>p.map(n).join(' ');
    let d=`M${coord(before[0])}`;
    for(let i=0;i<reduced.length;i++)d+=`${i?'L'+coord(before[i]):''}Q${coord(reduced[i])} ${coord(after[i])}`;
    contours.push({area:n(area),d:d+'Z'});
  }
  return contours.sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
}
const calas=trace('calas'),conseil=trace('conseil');
const result={source:'Business card supplied by Paul, 26 October 2026',sha256:hash,box,width:box.width,height:box.height,method:'4x colour segmentation, JPEG pinholes closed below half a source pixel, subpixel contour simplification; original glyph positions retained',calas:calas.map(c=>c.d).join(' '),conseil:conseil.map(c=>c.d).join(' ')};
await mkdir(new URL('../assets/brand/',import.meta.url),{recursive:true});
await writeFile(new URL('../assets/brand/wordmark-contours.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({width:result.width,height:result.height,sourceHash:hash,contours:{calas:calas.length,conseil:conseil.length}}));
