import {matchesLevel} from 'astro/logger';
export function redactLog(value){
 let text=String(value).replace(new RegExp(String.fromCharCode(27)+'\\[[0-9;]*m','g'),'');
 if(/Failed query:|(?:^|\n)params:|(?:^|\n)parameters:/i.test(text))return 'Database operation failed; private query details omitted.';
 text=text.replace(/(\/api\/auth\/reset-password\/)[A-Za-z0-9_-]+/g,'$1[redacted]').replace(/([?&](?:token|secret|code|password|key)=)[^\s&#"']+/gi,'$1[redacted]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'postgresql://[redacted]');
 for(const [key,secret]of Object.entries(process.env))if(/SECRET|PASSWORD|TOKEN|ACCESS_KEY|ENCRYPTION_KEY|SMTP_PASS/.test(key)&&secret&&secret.length>=8)text=text.split(secret).join('[redacted]');
 return text;
}
/** Astro's official destination interface; never receive or log request bodies. */
export default function safeLogger({level='info'}={}){
 return {write(event){if(!matchesLevel(event.level,level))return;const payload=JSON.stringify({level:event.level,label:redactLog(event.label??''),message:redactLog(event.message)});(event.level==='error'?console.error:console.info)(payload);}};
}
