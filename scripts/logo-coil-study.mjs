import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {chromium} from '@playwright/test';
import {ribbonPaths,nucleus,gradientStops,viewBox} from '../assets/brand/geometry.mjs';
import {coilSvg,coilVariants,coilDuration} from '../assets/brand/coil.mjs';

const output=resolve('artifacts/logo-coil');await mkdir(output,{recursive:true});
const times=[.12,.7,1.4,coilDuration];
const cells=[];
for(const [row,variant]of ['A','B','C'].entries()){
 for(const [column,time]of times.entries()){
  const svg=coilSvg(time,{variant,background:'#14213a'});
  const png=await sharp(Buffer.from(svg)).resize(305,295).png().toBuffer();
  await writeFile(resolve(output,`${variant}-${column+1}.png`),png);
  cells.push({input:png,left:column*305,top:row*335+40});
 }
 const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="40"><text x="18" y="27" font-size="18" fill="#f7f2ea" font-family="Arial">${coilVariants[variant].title}</text></svg>`);
 cells.push({input:label,left:0,top:row*335});
}
await sharp({create:{width:1220,height:1005,channels:3,background:'#14213a'}}).composite(cells).png().toFile(resolve(output,'comparison.png'));
let runtime=await readFile(resolve('assets/brand/coil.mjs'),'utf8');
runtime=runtime.replace(/^import[^;]+;/,`const ribbonPaths=${JSON.stringify(ribbonPaths)},nucleus=${JSON.stringify(nucleus)},gradientStops=${JSON.stringify(gradientStops)},viewBox=${JSON.stringify(viewBox)};`).replace(/export /g,'');
const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Calas Conseil — étude d’enroulement</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f2ea;color:#14213a;font:16px Arial}header{padding:30px 40px;display:flex;align-items:center;justify-content:space-between}h1{font:32px Georgia;margin:0 0 8px}p{margin:0}button{padding:13px 20px;border:0;border-radius:6px;background:#14213a;color:white;font:inherit;cursor:pointer}.grid{padding:0 40px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:#14213a;color:#f7f2ea;border-radius:10px;padding:20px}.card h2{font:18px Arial;margin:0 0 12px}.card svg{display:block;width:100%;height:auto;overflow:visible}.note{padding:26px 40px;line-height:1.5}</style><header><div><h1>Une coquille qui s’enroule.</h1><p>Trois études · même géométrie finale · 2,2 secondes</p></div><button id="replay">Rejouer les trois variantes</button></header><main class="grid">${Object.entries(coilVariants).map(([variant,config])=>`<section class="card"><h2>${config.title}</h2><div data-study="${variant}"></div></section>`).join('')}</main><p class="note">La variante B associe la convergence vers le noyau, la courbure des contours et une succession extérieure → intérieure des cinq rubans. Les lettres et le cadre restent immobiles.</p><script>${runtime}
window.drawStudy=time=>document.querySelectorAll('[data-study]').forEach(element=>{element.innerHTML=coilSvg(time,{variant:element.dataset.study,id:'gold-'+element.dataset.study})});let animation;window.playStudy=()=>{cancelAnimationFrame(animation);const start=performance.now();const frame=()=>{const time=(performance.now()-start)/1000;window.drawStudy(Math.min(time,coilDuration));if(time<coilDuration)animation=requestAnimationFrame(frame)};frame()};document.getElementById('replay').onclick=window.playStudy;window.drawStudy(coilDuration);</script></html>`;
await writeFile(resolve(output,'study.html'),html);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:750},recordVideo:{dir:resolve(output,'video'),size:{width:1440,height:750}}});
const page=await context.newPage();await page.setContent(html);await page.evaluate(()=>window.playStudy());await page.waitForTimeout(2600);await page.screenshot({path:resolve(output,'study-final.png')});const video=page.video();await context.close();await video.saveAs(resolve(output,'comparison.webm'));await browser.close();
console.log('Étude A/B/C, planche et vidéo créées dans artifacts/logo-coil.');
