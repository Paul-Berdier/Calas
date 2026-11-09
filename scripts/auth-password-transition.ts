import {randomUUID} from 'node:crypto';
import type {getPool} from '../apps/web/src/server/db';
import {productionIdentities} from '../apps/web/src/server/auth/production-identities';

const marker = 'operator.named-password-login.20261109.';
const emailList = productionIdentities.map(person => person.email);

/** A one-time operator action, never called by a build, deployment or request. */
export async function transitionNamedAccounts(pool: ReturnType<typeof getPool>, ids: string[], apply=false) {
  if (ids.length !== emailList.length || new Set(ids).size !== ids.length || ids.some(id => !id.trim())) {
    throw new Error('Les identifiants distincts des trois comptes sont requis.');
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query('SELECT pg_advisory_xact_lock(64236909)');
    const {rows: accounts} = await db.query<{
      id:string; email:string; role:string; email_verified:boolean; two_factor_enabled:boolean;
    }>('SELECT id,email,role,email_verified,two_factor_enabled FROM auth_user WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [ids]);
    if (accounts.length !== emailList.length || !productionIdentities.every(identity =>
      accounts.some(row => row.email.toLowerCase() === identity.email && row.role === identity.role))) {
      throw new Error('Les comptes et leurs rôles ne correspondent pas aux trois identités approuvées.');
    }

    const summary = [];
    for (const account of accounts) {
      const {rows:[state]} = await db.query<{enrolled:boolean; completed:boolean; challenges:number; sessions:number}>(`
        SELECT EXISTS(SELECT 1 FROM auth_two_factor WHERE user_id=$1) AS enrolled,
          EXISTS(SELECT 1 FROM security_events WHERE action=$2) AS completed,
          (SELECT count(*)::int FROM auth_verification WHERE value=$1 AND (identifier LIKE '2fa-%' OR identifier LIKE 'trust-device-%')) AS challenges,
          (SELECT count(*)::int FROM auth_session WHERE user_id=$1) AS sessions`,[account.id,marker+account.id]);
      const needsTransition = !state.completed || account.two_factor_enabled || state.enrolled || state.challenges>0;
      if (apply && needsTransition) {
        // Revoke pending challenges and their counters; keep verification and reset links.
        await db.query(`WITH target AS (SELECT identifier FROM auth_verification
            WHERE value=$1 AND (identifier LIKE '2fa-%' OR identifier LIKE 'trust-device-%'))
          DELETE FROM auth_verification WHERE identifier IN
            (SELECT identifier FROM target UNION ALL SELECT '2fa-attempts-'||identifier FROM target
             UNION ALL SELECT '2fa-otp-'||identifier FROM target)`,[account.id]);
        await db.query('DELETE FROM auth_session WHERE user_id=$1',[account.id]);
        await db.query('DELETE FROM auth_two_factor WHERE user_id=$1',[account.id]);
        await db.query('UPDATE auth_user SET two_factor_enabled=false, updated_at=now() WHERE id=$1 AND two_factor_enabled',[account.id]);
        if (!state.completed) await db.query('INSERT INTO security_events(id,action) VALUES ($1,$2)',[randomUUID(),marker+account.id]);
      }
      summary.push({id:account.id, role:account.role, emailVerified:account.email_verified, needsTransition,
        previousFactor:account.two_factor_enabled, previousEnrollment:state.enrolled, previousSessions:state.sessions});
    }
    await db.query(apply?'COMMIT':'ROLLBACK');
    return {applied:apply, accounts:summary};
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally { db.release(); }
}
