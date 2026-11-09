import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {ALL as authRoute} from '../apps/web/src/pages/api/auth/[...all]';
import {getAuth} from '../apps/web/src/server/auth';
import {getActor, getSession, requireAdministrator} from '../apps/web/src/server/auth/permissions';
import {getPool, closeDatabase} from '../apps/web/src/server/db';
import {migrateDatabase} from '../apps/web/src/server/db/migrate';
import {transitionNamedAccounts} from '../scripts/auth-password-transition';

const origin = 'https://www.calas-conseil.fr';
const web = createRequire(new URL('../apps/web/package.json', import.meta.url));
const betterAuth = createRequire(realpathSync(new URL('../apps/web/node_modules/better-auth/package.json', import.meta.url)));
const {hashPassword} = web('better-auth/crypto');
const {createOTP} = betterAuth('@better-auth/utils/otp');
const {base32} = betterAuth('@better-auth/utils/base32');
try {loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url)));} catch { /* CI supplies its own local DB. */ }
const localDb = process.env.DATABASE_URL;
type Fixture = {id:string; email:string; password:string; role:'administrator'|'editor'};

async function addUser(email:string, role:Fixture['role'], verified=true):Promise<Fixture>{
  const id = randomUUID(), password = randomBytes(24).toString('base64url');
  await getPool().query('INSERT INTO auth_user (id,name,email,email_verified,role) VALUES ($1,$2,$3,$4,$5)',[id,'Local fixture',email,verified,role]);
  await getPool().query("INSERT INTO auth_account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",[randomUUID(),id,await hashPassword(password)]);
  return {id,email,password,role};
}

// Exercise the deployed handler's origin/rate/endpoint checks as well as Better Auth.
let clientNumber = 0;
async function post(path:string, data:object, cookie='', requestOrigin=origin){
  const url = new URL('/api/auth/' + path + '/',origin);
  const request = new Request(url,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',cookie},body:JSON.stringify(data)});
  return authRoute({params:{all:path},url,request,clientAddress:'127.0.0.'+(++clientNumber)} as Parameters<typeof authRoute>[0]);
}
const login = (user:Fixture) => post('sign-in/email',{email:user.email,password:user.password});
const cookies = (response:Response) => response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const privateRequest = (cookie:string) => new Request(origin+'/api/admin/content/',{headers:{cookie}});

async function enroll(user:Fixture) {
  const first = await login(user);
  assert.equal(first.status,200);
  const session=cookies(first);
  assert.equal(await getActor(privateRequest(session)),null,'Enrollment was required before the change');
  const setup = await post('two-factor/enable',{password:user.password},session);
  assert.equal(setup.status,200);
  const details = await setup.json();
  const secret = new URL(details.totpURI).searchParams.get('secret');
  assert(secret);
  const code = await createOTP(new TextDecoder().decode(base32.decode(secret))).totp();
  const activated = await post('two-factor/verify-totp',{code},session);
  assert.equal(activated.status,200);
  const enrolledSession=cookies(activated);
  assert.equal((await getActor(privateRequest(enrolledSession)))?.id,user.id);
  return {cookie:enrolledSession,backupCode:details.backupCodes[0] as string};
}

test('named production users sign in with verified email and password, including a formerly enrolled user', {skip:!localDb,timeout:120_000}, async () => {
  const base=new URL(localDb!);
  assert(['127.0.0.1','localhost'].includes(base.hostname),'Only a local test database may be used');
  const name='calas_named_test_'+randomUUID().replaceAll('-','');
  assert.match(name,/^calas_named_test_[a-f0-9]{32}$/);
  const previous={...process.env};
  await getPool().query('CREATE DATABASE "'+name+'"');
  await closeDatabase();
  base.pathname='/'+name;
  Object.assign(process.env,{DATABASE_URL:base.href,SITE_ENV:'production',SITE_URL:origin,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),AUTH_MAIL_TRANSPORT:'disabled',ALLOW_REAL_EMAIL:'false',TRUST_RAILWAY_PROXY:'false'});
  delete process.env.AUTH_PASSWORD_ONLY_USER_IDS;
  delete process.env.AUTH_TEST_PASSWORD_ONLY_USER_ID;
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle',import.meta.url)));
    const sara=await addUser('saraserranocabeza@gmail.com','editor');
    const agnes=await addUser('a.loupias@live.fr','editor',false);
    const paul=await addUser('paul.berdo@hotmail.com','administrator');
    const other=await addUser('another-editor@example.test','editor');
    const enrolled=await enroll(sara);
    const protectedOther=await enroll(other);
    const paulOld=cookies(await login(paul));
    const ids=[paul.id,sara.id,agnes.id];

    // A started challenge and existing password/MFA sessions must not survive the conversion.
    const challenge=await login(sara);
    assert.equal((await challenge.json()).twoFactorRedirect,true);
    const challengeCookie=cookies(challenge);
    assert.equal(await getActor(privateRequest(challengeCookie)),null);
    const [challengeRow]=(await getPool().query("SELECT identifier FROM auth_verification WHERE value=$1 AND identifier LIKE '2fa-%'",[sara.id])).rows;
    assert(challengeRow,'Better Auth stored a pending challenge');
    const challengeId=challengeRow.identifier as string;
    const counter='2fa-attempts-'+challengeId, otp='2fa-otp-'+challengeId;
    assert.equal((await getPool().query('SELECT id FROM auth_verification WHERE identifier=$1',[counter])).rowCount,1,'Better Auth stored its attempt counter');
    const trusted='trust-device-'+randomUUID(), unrelatedTrusted='trust-device-'+randomUUID(), reset='reset-password:'+randomUUID();
    // Legacy trusted-device and OTP rows may predate the current TOTP-only public endpoint.
    for(const [identifier,value] of [[otp,'test-only'],[trusted,sara.id],[unrelatedTrusted,other.id],[reset,sara.id]]){
      await getPool().query("INSERT INTO auth_verification(id,identifier,value,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[randomUUID(),identifier,value]);
    }
    await assert.rejects(transitionNamedAccounts(getPool(),[paul.id,sara.id,other.id],true));
    await transitionNamedAccounts(getPool(),ids,false);
    assert.equal((await getActor(privateRequest(enrolled.cookie)))?.id,sara.id,'Dry run changed no active sessions');
    await transitionNamedAccounts(getPool(),ids,true);
    process.env.AUTH_PASSWORD_ONLY_USER_IDS=ids.join(',');
    assert.equal((await getPool().query('SELECT id FROM auth_verification WHERE identifier=ANY($1::text[])',[[challengeId,counter,otp,trusted]])).rowCount,0);
    assert.equal((await getPool().query('SELECT id FROM auth_verification WHERE identifier=ANY($1::text[])',[[unrelatedTrusted,reset]])).rowCount,2,'Preserve reset links and other users’ device records');
    for(const before of [paulOld,enrolled.cookie]) assert(!await getSession(privateRequest(before)),'Pre-transition session revoked');
    const backupAttempt=await post('two-factor/verify-backup-code',{code:enrolled.backupCode},challengeCookie);
    assert(!backupAttempt.ok,'The old MFA challenge cannot open a new session');
    assert.equal((await getActor(privateRequest(protectedOther.cookie)))?.id,other.id,'Unrelated sessions survive');
    const otherLogin=await login(other);
    assert.equal((await otherLogin.json()).twoFactorRedirect,true,'Other enrolled accounts still receive a challenge');
    const adapter=(await getAuth().$context).internalAdapter;
    const provisional=await adapter.createSession(other.id);
    const {rows:[stored]}=await getPool().query('SELECT mfa_verified FROM auth_session WHERE token=$1',[provisional.token]);
    assert.equal(stored.mfa_verified,false,'Enrollment alone must never mark a new session as MFA-verified');
    await adapter.deleteSession(provisional.token);
    const recovered=await post('two-factor/verify-backup-code',{code:protectedOther.backupCode},cookies(otherLogin));
    assert.equal(recovered.status,200);
    assert.equal((await getActor(privateRequest(cookies(recovered))))?.id,other.id,'A valid backup code completes the challenge');
    const changed=await post('change-password',{currentPassword:other.password,newPassword:randomBytes(24).toString('base64url'),revokeOtherSessions:true},cookies(recovered));
    assert.equal(changed.status,200);
    assert.equal((await getActor(privateRequest(cookies(changed))))?.id,other.id,'Password rotation preserves the already verified factor');

    const wrong=await post('sign-in/email',{email:paul.email,password:'incorrect'});
    assert(!wrong.ok,'Unknown password rejected');
    assert.equal((await post('sign-in/email',{email:paul.email,password:paul.password},'', 'https://external.example')).status,403);
    assert.equal((await post('sign-up/email',{name:'Public',email:'new@example.test',password:'testpassword56789'})).status,404);
    const unverified=await login(agnes);
    assert(!unverified.ok);assert.equal((await unverified.json()).code,'EMAIL_NOT_VERIFIED');
    assert.equal(await getActor(privateRequest(cookies(unverified))),null);
    // The verification email flow itself is exercised against Mailpit in auth-production-provision.test.ts.
    await getPool().query('UPDATE auth_user SET email_verified=true WHERE id=$1',[agnes.id]);
    let paulRequest:Request|undefined;
    for(const user of [sara,agnes,paul]){
      const signed=await login(user);
      assert.equal(signed.status,200);
      const payload=await signed.json();
      assert(!payload.twoFactorRedirect && payload.token,'A password issued a real session without a challenge');
      const cookie=cookies(signed),request=privateRequest(cookie);
      assert.equal((await getActor(request))?.id,user.id);
      assert.equal((await getSession(request))?.session.mfaVerified,false,'Password login must not claim a second factor');
      if(user.role==='administrator') {assert.equal((await requireAdministrator(request)).id,user.id);paulRequest=request;}
      else await assert.rejects(requireAdministrator(request),(error:{code:string})=>error.code==='FORBIDDEN');
      const factor=await post('two-factor/enable',{password:user.password},cookie);
      assert.equal(factor.status,409);
      assert.equal((await factor.json()).error.code,'PASSWORD_ONLY');
    }
    assert(paulRequest);
    await transitionNamedAccounts(getPool(),ids,true);
    assert.equal((await getActor(paulRequest))?.id,paul.id,'Re-running the transition preserves new sessions');
    process.env.SITE_ENV='staging';
    assert.equal(await getActor(paulRequest),null,'Production policy must not grant staging privileges');
    process.env.SITE_ENV='production';
    await getPool().query('UPDATE auth_user SET disabled=true WHERE id=$1',[paul.id]);
    assert.equal(await getActor(paulRequest),null,'Suspension applies to an existing session');
    const suspended=await login(paul);
    assert.equal(await getActor(privateRequest(cookies(suspended))),null,'Suspended account cannot obtain editorial access');
  } finally {
    await closeDatabase();
    process.env.DATABASE_URL=localDb;
    try {await getPool().query('DROP DATABASE IF EXISTS "'+name+'" WITH (FORCE)');}
    finally {
      await closeDatabase();
      for(const key of Object.keys(process.env)) if(!(key in previous))delete process.env[key];
      Object.assign(process.env,previous);
    }
  }
});
