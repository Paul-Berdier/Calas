export interface RibbonGuide {index:number;d:string;width:number;start:number;duration:number}
export const ribbonGuides:RibbonGuide[];
export const unfurlDuration:number;
export function ribbonFrame(index:number,progress:number):{contour:string;guide:string;width:number};
export function unfurlSvg(time:number,options?:{guides?:boolean;background?:string}):string;
