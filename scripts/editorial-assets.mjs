import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=new URL('../assets/editorial/symbols/',import.meta.url);
const target=new URL('../apps/web/public/images/symbols/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['threads','nautilus','roots','compass','tree','kintsugi','ripples','murmuration']){
  await sharp(fileURLToPath(new URL(`${name}.png`,source))).webp({quality:88}).toFile(fileURLToPath(new URL(`${name}.webp`,target)));
}
console.log('Huit illustrations éditoriales optimisées. Aucun contenu CMS importé ou publié.');
