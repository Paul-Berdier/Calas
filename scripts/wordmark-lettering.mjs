// Reproduce clean lettering from native OFL glyphs and an analytic initial C.
// Operator-only export; builds never import or run this script.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import opentype from 'opentype.js';
import {optimize} from 'svgo';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'assets/brand');
const require=createRequire(resolve(root,'apps/web/package.json'));
const fontFile=require.resolve('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff');
const bytes=await readFile(fontFile);
const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));

// Card coordinate space: crop left=140, top=424, width=510, height=68.
// Bounds measured from the original card; rectilinear baseline normalized to 62.5.
// The first A is connected to C in the bitmap, so its visible bounds are explicit.
const targets=[
  {group:'calas',letter:'A',box:[65.5,9.8,115.0,62.0]},
  {group:'calas',letter:'L',box:[120.4,9.8,150.0,62.0]},
  {group:'calas',letter:'A',box:[152.1,9.5,199.4,62.0]},
  {group:'calas',letter:'S',box:[198.7,9.3,229.2,62.3]},
  {group:'conseil',letter:'C',box:[244.5,9.0,287.4,62.3]},
  {group:'conseil',letter:'O',box:[284.0,8.9,332.6,62.9]},
  {group:'conseil',letter:'N',box:[330.4,8.8,374.1,62.5]},
  {group:'conseil',letter:'S',box:[377.9,8.6,409.6,63.7]},
  {group:'conseil',letter:'E',box:[413.8,8.8,450.6,62.5]},
  {group:'conseil',letter:'I',box:[452.0,8.8,463.8,62.5]},
  {group:'conseil',letter:'L',box:[469.4,9.0,504.8,62.5]},
];

// One continuous ribbon: thin top/bottom, thick left stem, fine tail into the A.
// Four main cubic arcs on each side preserve smoothness without JPEG microgeometry.
const initialC='M59.8 8.2L58.8 16.7C55.2 8.4 47.5 4.3 37.0 4.3C22.0 4.3 12.0 16.9 12.0 33.5C12.0 51.1 21.4 63.2 35.5 63.2C48.0 63.2 57.2 55.3 64.3 48.0C68.2 44.0 72.2 41.8 77.2 41.0L77.5 42.1C72.7 42.9 68.7 45.3 65.1 49.3C57.1 58.4 47.6 64.5 35.0 64.5C16.4 64.5 4.0 52.4 4.0 34.2C4.0 16.5 18.3 3.2 37.2 3.2C46.8 3.2 54.0 5.3 59.8 8.2Z';
const paths={calas:[initialC],conseil:[]};
for(const {group,letter,box:[x1,y1,x2,y2]} of targets){
  const p=font.getPath(letter,0,0,100);const b=p.getBoundingBox();
  const sx=(x2-x1)/(b.x2-b.x1),sy=(y2-y1)/(b.y2-b.y1);
  for(const command of p.commands)for(const key of Object.keys(command)){
    if(key.startsWith('x'))command[key]=x1+(command[key]-b.x1)*sx;
    if(key.startsWith('y'))command[key]=y1+(command[key]-b.y1)*sy;
  }
  const n=v=>{if(!Number.isFinite(v))throw Error('Non-finite glyph coordinate');return Number(v.toFixed(1));};
  const d=p.commands.map(c=>{
    if(c.type==='Z')return 'Z';
    if(c.type==='M'||c.type==='L')return c.type+n(c.x)+' '+n(c.y);
    if(c.type==='Q')return 'Q'+n(c.x1)+' '+n(c.y1)+' '+n(c.x)+' '+n(c.y);
    if(c.type==='C')return 'C'+n(c.x1)+' '+n(c.y1)+' '+n(c.x2)+' '+n(c.y2)+' '+n(c.x)+' '+n(c.y);
    throw Error('Unsupported glyph command '+c.type);
  }).join('');
  paths[group].push(d);
}
// Only rewrite equivalent path commands; keep every curve and all metadata.
const compact=parts=>{
  const input='<svg xmlns="http://www.w3.org/2000/svg"><path d="'+parts.join('')+'"/></svg>';
  const result=optimize(input,{plugins:[{name:'convertPathData',params:{floatPrecision:2}}]}).data;
  const d=result.match(/\bd="([^"]+)"/)?.[1];
  if(!d)throw Error('Missing optimized lettering');
  return d;
};
const data={source:'Business card supplied by Paul, 26 October 2026',sha256:'25dbf2b134b4160c951b3507daa6abe3622815ce021d1516f32a20dfb477fff3',box:{left:140,top:424,width:510,height:68},width:510,height:68,method:'Native Cormorant Garamond 400 outlines fitted to the card proportions; analytic initial C and tail. Typographic reconstruction, not identification of the original font.',font:'Cormorant Garamond 400',fontLicense:'SIL OFL 1.1',calas:compact(paths.calas),conseil:compact(paths.conseil)};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'wordmark-contours.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({width:data.width,height:data.height,calasBytes:data.calas.length,conseilBytes:data.conseil.length,initialCCubicCount:(initialC.match(/C/g)||[]).length}));
