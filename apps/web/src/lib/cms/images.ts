import type { ContentImage } from './types';
export const IMAGE_VARIANT_WIDTHS=[320,960,1920] as const;
export const isMediaId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function imageUrl(image:ContentImage,width:number,_height?:number):string|undefined {
  if(!isMediaId(image?.mediaId)||!Number.isFinite(width)||width<1)return undefined;
  const variant=IMAGE_VARIANT_WIDTHS.find(size=>size>=width)||1920;
  return `/media/${image.mediaId}/?w=${variant}`;
}

/** Sharp never enlarges originals: descriptors must describe actual bytes. */
export function imageSrcset(image:ContentImage):string|undefined {
  if(!isMediaId(image?.mediaId)||!image.width||!Number.isFinite(image.width)||image.width<1)return undefined;
  const seen=new Set<number>();
  return IMAGE_VARIANT_WIDTHS.flatMap(variant=>{
    const actual=Math.min(variant,Math.round(image.width!));
    if(seen.has(actual))return [];seen.add(actual);
    return [`${imageUrl(image,variant)} ${actual}w`];
  }).join(', ');
}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
/** Place the complete image inside a clipped viewport. The requested crop is
 * a hard boundary; the hotspot can position additional aspect-ratio cropping
 * only inside that region. No new storage variant is generated. */
export function imageCropLayout(image:ContentImage,width:number,height?:number){
  const sourceWidth=image.width,sourceHeight=image.height,crop=image.crop;
  if(!sourceWidth||!sourceHeight||!crop||!Object.values(crop).some(value=>value>0))return undefined;
  if(![sourceWidth,sourceHeight,width,...Object.values(crop)].every(Number.isFinite)||sourceWidth<=0||sourceHeight<=0||width<=0)return undefined;
  if(Object.values(crop).some(value=>value<0||value>=1)||crop.left+crop.right>=1||crop.top+crop.bottom>=1)return undefined;
  const cropWidth=sourceWidth*(1-crop.left-crop.right),cropHeight=sourceHeight*(1-crop.top-crop.bottom);
  const frameHeight=height??width*cropHeight/cropWidth;
  if(!Number.isFinite(frameHeight)||frameHeight<=0)return undefined;
  const scale=Math.max(width/cropWidth,frameHeight/cropHeight);
  const wholeWidth=sourceWidth*scale,wholeHeight=sourceHeight*scale;
  const x=clamp((image.hotspot?.x??crop.left+cropWidth/sourceWidth/2)*wholeWidth-width/2,crop.left*wholeWidth,(1-crop.right)*wholeWidth-width);
  const y=clamp((image.hotspot?.y??crop.top+cropHeight/sourceHeight/2)*wholeHeight-frameHeight/2,crop.top*wholeHeight,(1-crop.bottom)*wholeHeight-frameHeight);
  return {height:frameHeight,aspectRatio:width/frameHeight,widthPercent:wholeWidth/width*100,heightPercent:wholeHeight/frameHeight*100,leftPercent:-x/width*100,topPercent:-y/frameHeight*100};
}

export function imageSlotSizes(sizes:string,magnification=1):string {
  // Scale only the final slot size, never a media-query breakpoint.
  return sizes.split(',').map(part=>part.replace(/([\d.]+)(vw|px)\s*$/,(_match,value,unit)=>`${Math.round(Number(value)*magnification*100)/100}${unit}`)).join(',');
}
