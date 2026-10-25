export function safeHref(value:unknown):string|undefined{
  if(typeof value!=='string'||/[\u0000-\u0020\\]/.test(value))return undefined;
  if(value.startsWith('/')&&!value.startsWith('//'))return value;
  if(value.startsWith('#'))return value;
  try{const url=new URL(value);return ['https:','http:','mailto:','tel:'].includes(url.protocol)?value:undefined;}catch{return undefined;}
}
