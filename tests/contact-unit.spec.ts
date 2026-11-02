import {test,expect} from '@playwright/test';
import {createFormToken,readBoundedForm,readFields,submitContact,validateFields} from '../apps/web/src/lib/contact';
test.describe.configure({mode:'serial'});
const fields={name:'Recette Calas',company:'',jobTitle:'',email:'test@example.test',phone:'',subject:'diagnostic',message:'Message de recette, sans donnée personnelle.',consent:'yes'};
function form(){const f=new FormData();Object.entries(fields).forEach(([k,v])=>f.set(k,v));f.set('token',createFormToken());return f;}
const request=(origin='https://recette.example.test')=>new Request('https://recette.example.test/contact/',{method:'POST',headers:{Origin:origin}});
test.beforeEach(()=>{process.env.SITE_ENV='staging';process.env.MAIL_TRANSPORT='simulation';process.env.CONTACT_SIGNING_SECRET='test-only-secret-'.repeat(4);process.env.CONTACT_RATE_LIMIT='5';});
test('rejects injection, unknown subject, excessive fields',()=>{expect(validateFields({...fields,email:'test@example.test\r\nBcc:other@example.test'}).email).toBeTruthy();expect(validateFields({...fields,subject:'secret'}).subject).toBeTruthy();expect(validateFields({...fields,message:'x'.repeat(5001)}).message).toBeTruthy();});
test('requires explicit consent on the server before processing any request',async()=>{
  for(const value of ['', 'no', 'true']){const input=form();input.set('consent',value);const result=await submitContact(request(),input,`consent-${value}`);expect(result.status).toBe(422);expect(result.errors?.consent).toBeTruthy();}
  const missing=form();missing.delete('consent');expect(readFields(missing).consent).toBe('');expect((await submitContact(request(),missing,'consent-missing')).status).toBe(422);
});
test('optional role and telephone are bounded; sensitive subject is accepted',async()=>{
  expect(validateFields({...fields,subject:'sensible',jobTitle:'Responsable RH',phone:'+33 (0)6 43 16 83 81'})).toEqual({});
  expect(validateFields({...fields,jobTitle:'x'.repeat(121)}).jobTitle).toBeTruthy();
  expect(validateFields({...fields,jobTitle:'Responsable\nRH'}).jobTitle).toBeTruthy();
  for(const phone of ['123', 'x'.repeat(41), '06 43\n16 83 81', '+33<script>', '1'.repeat(16)])expect(validateFields({...fields,phone}).phone).toBeTruthy();
  const input=form();input.set('jobTitle','Directrice');input.set('phone','06 43 16 83 81');input.set('subject','sensible');const result=await submitContact(request(),input,'sensitive-case');expect(result.ok).toBe(true);expect(result.simulation).toBe(true);
});
test('rejects cross-origin, forged token and trap',async()=>{expect((await submitContact(request('https://other.example.test'),form(),'origin')).status).toBe(403);const forged=form();forged.set('token','arbitrary');expect((await submitContact(request(),forged,'forged')).status).toBe(403);const trap=form();trap.set('website','spam');expect((await submitContact(request(),trap,'trap')).ok).toBe(false);});
test('same submission is idempotent and altered reuse rejected',async()=>{const f=form();const responses=await Promise.all([submitContact(request(),f,'duplicate'),submitContact(request(),f,'duplicate')]);expect(responses.every(r=>r.ok)).toBe(true);f.set('message','Un autre message qui ne doit pas partir.');expect((await submitContact(request(),f,'duplicate')).status).toBe(409);});
test('rate limit blocks sixth unique submission',async()=>{for(let i=0;i<5;i++)expect((await submitContact(request(),form(),'rate-limit-case')).ok).toBe(true);expect((await submitContact(request(),form(),'rate-limit-case')).status).toBe(429);});
test('unavailable transport and real recipient guard never report success',async()=>{process.env.MAIL_TRANSPORT='unavailable';expect((await submitContact(request(),form(),'unavailable')).status).toBe(503);process.env.MAIL_TRANSPORT='smtp';process.env.SMTP_TO='real@example.com,test@example.test';expect((await submitContact(request(),form(),'recipient')).status).toBe(503);});
test('bounded stream rejects oversized chunked body and allows long accented input',async()=>{const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(70000)));controller.close();}});const huge=new Request('https://recette.example.test',{method:'POST',body,duplex:'half',headers:{'content-type':'application/x-www-form-urlencoded'}} as RequestInit);await expect(readBoundedForm(huge)).rejects.toThrow(RangeError);const normal=new Request('https://recette.example.test',{method:'POST',body:new URLSearchParams({message:'é'.repeat(5000)})});expect((await readBoundedForm(normal)).get('message')).toHaveLength(5000);});
