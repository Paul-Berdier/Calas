import {z} from 'zod';
import {HttpError} from '../http';

const line=(max:number)=>z.string().trim().max(max).refine(v=>!/[\r\n\u0000]/.test(v),'Utilisez une seule ligne.');
export const publicPathSchema=z.string().trim().max(240).regex(/^\/(?:[a-z0-9-]+\/)*$/,'Indiquez un chemin public du site, par exemple /diagnostic-rps/.').refine(v=>!/^\/(?:admin|api|r|media|_astro)(?:\/|$)/.test(v),'Cette adresse n’est pas une page publique.');
const sourceDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10);},'Indiquez une date de collecte valide, passée ou actuelle.');
export const prospectInputSchema=z.object({
 email:z.email().trim().toLowerCase().max(254).refine(v=>!/[\r\n<>,;]/.test(v)),name:line(120),company:line(160).min(1,'Indiquez l’entreprise.'),jobTitle:line(160),
 source:line(500).min(3,'Précisez la provenance de cette adresse.'),sourceDate,informationConfirmed:z.literal(true,'Confirmez l’information du contact et la pertinence professionnelle du message.'),
}).strict();
export const prospectUpdateSchema=prospectInputSchema.extend({version:z.number().int().nonnegative()});
export const campaignInputSchema=z.object({title:line(120).min(3),subject:line(180).min(3),body:z.string().trim().min(10).max(15000).refine(v=>!v.includes('\u0000')),targetPath:publicPathSchema}).strict();
export const campaignUpdateSchema=campaignInputSchema.extend({version:z.number().int().nonnegative()});
export const queueInputSchema=z.object({version:z.number().int().nonnegative(),contactIds:z.array(z.uuid()).min(1).max(5000).transform(v=>[...new Set(v)]),confirmation:z.literal(true)}).strict();
export const pauseCampaignSchema=z.object({version:z.number().int().nonnegative(),paused:z.boolean()}).strict();
export const importProspectsSchema=z.object({contacts:z.array(prospectInputSchema).min(1).max(200)}).strict();
export const uuidSchema=z.uuid();
export function validated<T>(schema:z.ZodType<T>,value:unknown):T{const result=schema.safeParse(value);if(!result.success)throw new HttpError(422,'VALIDATION',result.error.issues.slice(0,5).map(e=>e.message).join(' '));return result.data;}
export type ProspectInput=z.infer<typeof prospectInputSchema>;
export type CampaignInput=z.infer<typeof campaignInputSchema>;
