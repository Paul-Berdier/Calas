import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {shellMarkup,viewBox} from '../assets/brand/geometry.mjs';
import {coilSvg,coilDuration} from '../assets/brand/coil.mjs';
import sharp from 'sharp';
import opentype from 'opentype.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'apps/web/public/brand');
const source=resolve(root,'assets/brand');
const fromWeb=createRequire(resolve(root,'apps/web/package.json'));
await mkdir(output,{recursive:true});
const fontFile=(pkg,name)=>resolve(dirname(fromWeb.resolve(`@fontsource/${pkg}/package.json`)),'files',name);
const font=async(path)=>{const data=await readFile(path);return opentype.parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));};
const titleFont=await font(fontFile('cormorant-garamond','cormorant-garamond-latin-500-normal.woff'));
const brandFont=await font(fontFile('cormorant-garamond','cormorant-garamond-latin-300-normal.woff'));
const textFont=await font(fontFile('eb-garamond','eb-garamond-latin-400-normal.woff'));
const outline=(font,text,x,y,size,fill)=>{
 const path=font.getPath(text,x,y,size);
 // Serialize explicit finite coordinates: opentype 2's optimized serializer
 // can emit NaN for certain floating-point positions.
 const n=value=>{if(!Number.isFinite(value))throw Error('Invalid glyph coordinate');return Number(value.toFixed(2));};
 const d=path.commands.map(c=>{
  if(c.type==='Z')return 'Z';
  if(c.type==='M'||c.type==='L')return `${c.type} ${n(c.x)} ${n(c.y)}`;
  if(c.type==='Q')return `Q ${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
  if(c.type==='C')return `C ${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
  throw Error(`Unsupported glyph command: ${c.type}`);
 }).join(' ');
 return `<path d="${d}" fill="${fill}"/>`;
};
const svg=(width,height,body,title='Calas Conseil — La voie de la qualité relationnelle.')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
const symbol=(x,y,w,h,id,mono=null)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}">${shellMarkup(id,mono)}</svg>`;
// The supplied card uses fine capitals, an enlarged first C and a compact
// CONSEIL. Keep these optical proportions identical in every exported lockup.
const brandSize=100,brandBaseline=82,brandHeight=86;
const word=(text,initialScale=1)=>{
 let x=0;const glyphs=[];
 for(const [index,letter]of [...text].entries()){
  const size=brandSize*(index===0?initialScale:1);
  glyphs.push({letter,x,size});
  x+=brandFont.getAdvanceWidth(letter,size)-3.2;
 }
 return {glyphs,width:x+3.2};
};
const calas=word('CALAS',1.17),conseil=word('CONSEIL',1.17),conseilScale=.89,wordGap=17;
const brandWidth=Number((calas.width+wordGap+conseil.width*conseilScale).toFixed(2));
const wordPaths=(word,fill)=>word.glyphs.map(g=>outline(brandFont,g.letter,g.x,brandBaseline,g.size,fill)).join('');
const wordmark=(dark=false,mono=null)=>wordPaths(calas,mono??(dark?'#F7F2EA':'#14213A'))+`<g transform="translate(${calas.width+wordGap} 0) scale(${conseilScale} 1)">${wordPaths(conseil,mono??(dark?'#D5B37E':'#94672F'))}</g>`;
function lettering(x,y,size,dark=false,mono=null){const scale=size/brandSize;return `<g transform="translate(${x} ${y-brandBaseline*scale}) scale(${scale})">${wordmark(dark,mono)}</g>`;}
const taglineText='LA VOIE DE LA QUALITÉ RELATIONNELLE';
const taglineTracking=2.1;
const tagline=(x,y,size,dark=false,mono=null)=>{
 let cursor=x;
 return [...taglineText].map(letter=>{
  const path=outline(textFont,letter,cursor,y,size,mono??(dark?'#D5B37E':'#94672F'));
  cursor+=textFont.getAdvanceWidth(letter,size)+taglineTracking;
  return path;
 }).join('');
};
const nameSize=65,nameWidth=brandWidth*nameSize/brandSize,taglineSize=18;
const taglineWidth=[...taglineText].reduce((width,letter)=>width+textFont.getAdvanceWidth(letter,taglineSize),0)+taglineTracking*(taglineText.length-1);
const assets={
 'wordmark':svg(brandWidth,brandHeight,wordmark(),'Calas Conseil'),
 'wordmark-dark':svg(brandWidth,brandHeight,wordmark(true),'Calas Conseil'),
 'logo-horizontal':svg(660,180,symbol(0,0,170,180,'horizontal')+lettering(184,99,nameSize)+tagline(184+(nameWidth-taglineWidth)/2,130,taglineSize)),
 'logo-horizontal-dark':svg(660,180,symbol(0,0,170,180,'horizontal-dark')+lettering(184,99,nameSize,true)+tagline(184+(nameWidth-taglineWidth)/2,130,taglineSize,true)),
 'logo-stacked':svg(600,500,symbol(135,0,330,355,'stacked')+lettering((600-nameWidth)/2,420,nameSize)+tagline((600-taglineWidth)/2,457,taglineSize)),
 'logo-stacked-dark':svg(600,500,symbol(135,0,330,355,'stacked-dark')+lettering((600-nameWidth)/2,420,nameSize,true)+tagline((600-taglineWidth)/2,457,taglineSize,true)),
 'logo-monochrome':svg(660,180,symbol(0,0,170,180,'mono','#14213A')+lettering(184,99,nameSize,false,'#14213A')+tagline(184+(nameWidth-taglineWidth)/2,130,taglineSize,false,'#14213A')),
 'logo-monochrome-light':svg(660,180,symbol(0,0,170,180,'mono-light','#F7F2EA')+lettering(184,99,nameSize,true,'#F7F2EA')+tagline(184+(nameWidth-taglineWidth)/2,130,taglineSize,true,'#F7F2EA')),
 'symbol':svg(610,590,`<g transform="translate(25 30)">${shellMarkup('symbol')}</g>`,'Symbole Calas Conseil'),
 'symbol-monochrome':svg(610,590,`<g transform="translate(25 30)">${shellMarkup('symbol-mono','#14213A')}</g>`,'Symbole Calas Conseil'),
 'favicon':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -10 530 540">${shellMarkup('favicon','#94672F')}</svg>`,
};
for(const[name,content]of Object.entries(assets)){
 await writeFile(resolve(output,`${name}.svg`),content);
 const raster=sharp(Buffer.from(content),{density:144});
 if(name==='favicon')raster.resize({width:64,height:64,fit:'contain',background:{r:0,g:0,b:0,alpha:0}});
 await raster.png().toFile(resolve(output,`${name}.png`));
}
// Editable typography source; production exports above carry vector outlines.
const editableWord=(word,x,scale,fill)=>`<g transform="translate(${x} ${99-brandBaseline*nameSize/brandSize}) scale(${scale*nameSize/brandSize} ${nameSize/brandSize})">${word.glyphs.map(g=>`<text x="${g.x}" y="${brandBaseline}" font-family="Cormorant Garamond" font-weight="300" font-size="${g.size}" fill="${fill}">${g.letter}</text>`).join('')}</g>`;
const editable=svg(660,180,symbol(0,0,170,180,'editable')+editableWord(calas,184,1,'#14213A')+editableWord(conseil,184+(calas.width+wordGap)*nameSize/brandSize,conseilScale,'#94672F')+`<text x="${184+(nameWidth-taglineWidth)/2}" y="130" font-family="EB Garamond" font-size="${taglineSize}" letter-spacing="${taglineTracking}" fill="#94672F">${taglineText}</text>`);
await writeFile(resolve(source,'logo-editable.svg'),editable);
for(const[stage,time]of [['start',.12],['middle',1.1],['end',coilDuration]]){
 const content=coilSvg(time,{background:'none'});
 await writeFile(resolve(source,`motion-${stage}.svg`),content);
 await sharp(Buffer.from(content)).png().toFile(resolve(source,`motion-${stage}.png`));
}
const grid=svg(1380,600,`<rect width="690" height="600" fill="#F7F2EA"/><rect x="690" width="690" height="600" fill="#14213A"/>${symbol(110,10,470,480,'light-grid')}${symbol(800,10,470,480,'dark-grid')}${lettering(120,540,72)}${lettering(810,540,72,true)}`);
await sharp(Buffer.from(grid)).png().toFile(resolve(source,'contrast-board.png'));
const og=svg(1200,630,
 '<rect width="1200" height="630" fill="#F7F2EA"/>'+
 '<path d="M750 510V240C750 45 1145 45 1145 240V510" fill="none" stroke="#C9A46E" stroke-opacity=".55"/>'+
 lettering(78,115,48)+
 outline(titleFont,'Prévenir les risques',78,285,68,'#14213A')+
 outline(titleFont,'psychosociaux.',78,365,68,'#14213A')+
 outline(textFont,'Comprendre le travail. Renforcer le lien.',80,433,31,'#14213A')+
 symbol(748,125,395,382,'open-graph')+
 '<path d="M80 550H1120" stroke="#C9A46E" stroke-opacity=".55"/>'+
 outline(textFont,'Diagnostic · Équipes · Managers',80,595,25,'#14213A'),
 'Calas Conseil — Diagnostic RPS et qualité du lien');
await sharp(Buffer.from(og)).png().toFile(resolve(output,'open-graph.png'));
console.log(`Exported ${Object.keys(assets).length} SVG/PNG variants, editable source and 3 motion poses.`);
