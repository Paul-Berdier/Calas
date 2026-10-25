import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {shellMarkup,viewBox} from '../assets/brand/geometry.mjs';
import {unfurlSvg} from '../assets/brand/unfurl.mjs';
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
const textFont=await font(fontFile('eb-garamond','eb-garamond-latin-400-normal.woff'));
const titleWidth=(text,size)=>titleFont.getAdvanceWidth(text,size);
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
function lettering(x,y,size,dark=false,mono=null){const ink=mono??(dark?'#F7F2EA':'#14213A');const bronze=mono??(dark?'#D5B37E':'#94672F');return outline(titleFont,'Calas',x,y,size,ink)+outline(titleFont,'Conseil',x+titleWidth('Calas ',size),y,size,bronze);}
const tagline=(x,y,size,dark=false,mono=null)=>outline(textFont,'La voie de la qualité relationnelle.',x,y,size,mono??(dark?'#F7F2EA':'#14213A'));
const nameWidth=titleWidth('Calas Conseil',72);
const assets={
 'logo-horizontal':svg(660,180,symbol(0,0,170,180,'horizontal')+lettering(184,99,72)+tagline(188,136,24)),
 'logo-horizontal-dark':svg(660,180,symbol(0,0,170,180,'horizontal-dark')+lettering(184,99,72,true)+tagline(188,136,24,true)),
 'logo-stacked':svg(600,500,symbol(135,0,330,355,'stacked')+lettering((600-nameWidth)/2,420,72)+tagline((600-textFont.getAdvanceWidth('La voie de la qualité relationnelle.',24))/2,457,24)),
 'logo-stacked-dark':svg(600,500,symbol(135,0,330,355,'stacked-dark')+lettering((600-nameWidth)/2,420,72,true)+tagline((600-textFont.getAdvanceWidth('La voie de la qualité relationnelle.',24))/2,457,24,true)),
 'logo-monochrome':svg(660,180,symbol(0,0,170,180,'mono','#14213A')+lettering(184,99,72,false,'#14213A')+tagline(188,136,24,false,'#14213A')),
 'logo-monochrome-light':svg(660,180,symbol(0,0,170,180,'mono-light','#F7F2EA')+lettering(184,99,72,true,'#F7F2EA')+tagline(188,136,24,true,'#F7F2EA')),
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
const editable=svg(660,180,symbol(0,0,170,180,'editable')+'<text x="184" y="99" font-family="Cormorant Garamond" font-weight="500" font-size="72" fill="#14213A">Calas <tspan fill="#94672F">Conseil</tspan></text><text x="188" y="136" font-family="EB Garamond" font-size="24" fill="#14213A">La voie de la qualité relationnelle.</text>');
await writeFile(resolve(source,'logo-editable.svg'),editable);
for(const[stage,time]of [['start',.2],['middle',1.15],['end',2.34]]){
 const content=unfurlSvg(time,{background:'none'});
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
