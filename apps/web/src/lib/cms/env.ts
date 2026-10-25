/** Server-only configuration. Never import this module from a client script. */
export function serverEnv(name:string):string{return process.env[name]??(import.meta.env as Record<string,string|undefined>|undefined)?.[name]??'';}
export function contentMode():'demo'|'database'{const mode=serverEnv('CONTENT_MODE');if(mode!=='demo'&&mode!=='database')throw new Error('CONTENT_MODE must explicitly be demo or database.');if(serverEnv('SITE_ENV')==='production'&&mode!=='database')throw new Error('Production requires PostgreSQL content.');return mode;}
