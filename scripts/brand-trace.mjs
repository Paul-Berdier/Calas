// Optional reconstruction study from an explicitly supplied reference image.
// No reference bitmap is included in the public assets.
import {writeFileSync} from 'node:fs';
import sharp from 'sharp';
if(!process.argv[2])throw new Error('Usage: node scripts/brand-trace.mjs <reference-jpeg>');
const W=490,H=510;
const {data,info}=await sharp(process.argv[2]).extract({left:400,top:165,width:W,height:H}).removeAlpha().raw().toBuffer({resolveWithObject:true});
let mask=Buffer.alloc(W*H);
for(let i=0;i<W*H;i++)mask[i]=data[i*info.channels]-data[i*info.channels+2]>6?1:0;
// Remove JPEG edge speckle before fitting, without filling the actual gaps.
for(let pass=0;pass<2;pass++){const smooth=Buffer.from(mask);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)n+=mask[(y+dy)*W+x+dx];smooth[y*W+x]=n>=5?1:0;}mask=smooth;}
const edges=new Map();
const key=(x,y)=>y*(W+1)+x;
const add=(x,y,u,v)=>{const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(key(u,v));};
const pixel=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&mask[y*W+x];
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(pixel(x,y)){
 if(!pixel(x,y-1))add(x,y,x+1,y);
 if(!pixel(x+1,y))add(x+1,y,x+1,y+1);
 if(!pixel(x,y+1))add(x+1,y+1,x,y+1);
 if(!pixel(x-1,y))add(x,y+1,x,y);
}
function perpendicular(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function simplify(points,epsilon=2.0){let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=perpendicular(points[i],points[0],points.at(-1));if(d>max){max=d;index=i;}}return max>epsilon?[...simplify(points.slice(0,index+1),epsilon).slice(0,-1),...simplify(points.slice(index),epsilon)]:[points[0],points.at(-1)];}
const contours=[];
while(edges.size){const first=edges.keys().next().value;let cur=first;const points=[];for(let n=0;n<50000;n++){points.push([cur%(W+1),Math.floor(cur/(W+1))]);const next=edges.get(cur);if(!next?.length)break;const dest=next.pop();if(!next.length)edges.delete(cur);cur=dest;if(cur===first)break;}
const area=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2;
if(Math.abs(area)>300){let far=1;for(let i=1;i<points.length;i++)if(Math.hypot(...points[i].map((v,j)=>v-points[0][j]))>Math.hypot(...points[far].map((v,j)=>v-points[0][j])))far=i;const reduced=[...simplify(points.slice(0,far+1)).slice(0,-1),...simplify([...points.slice(far),points[0]]).slice(0,-1)];contours.push({area,points:reduced});}}
contours.sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
writeFileSync(new URL('../assets/brand/contours.json',import.meta.url),JSON.stringify(contours.map(x=>x.points))+'\n');
console.log(contours.map(c=>({area:Math.round(c.area),points:c.points.length})));
