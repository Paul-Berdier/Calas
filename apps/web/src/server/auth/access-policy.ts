import {productionIdentities} from './production-identities';

interface AccessUser {
  id: string;
  email: string;
  emailVerified: boolean;
  disabled?: boolean | null;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
}

/** Operator-scoped recipe access, never a public option or a production fallback. */
export function usesTestPasswordOnly(user: AccessUser): boolean {
  const target = process.env.AUTH_TEST_PASSWORD_ONLY_USER_ID;
  return process.env.SITE_ENV === 'staging' && Boolean(target) && user.id === target
    && /^[^@\s]+@example\.test$/i.test(user.email)
    && user.emailVerified === true && user.disabled === false
    && (user.role === 'administrator' || user.role === 'editor')
    && user.twoFactorEnabled === false;
}

const productionEmails = new Set<string>(productionIdentities.map(person => person.email));

/** The operator binds the three approved identities to their existing database IDs. */
export function isProductionPasswordAccount(user: AccessUser): boolean {
  if (process.env.SITE_ENV !== 'production') return false;
  const ids = new Set((process.env.AUTH_PASSWORD_ONLY_USER_IDS || '').split(',').map(id => id.trim()));
  return ids.size === productionEmails.size && !ids.has('') && ids.has(user.id)
    && productionEmails.has(user.email.toLowerCase())
    && user.emailVerified === true && user.disabled === false
    && (user.role === 'administrator' || user.role === 'editor');
}

export function usesProductionPasswordOnly(user: AccessUser): boolean {
  return user.twoFactorEnabled === false && isProductionPasswordAccount(user);
}

export function hasRequiredAuthentication(result: {user: AccessUser; session: {mfaVerified?: boolean | null}}): boolean {
  return (result.user.twoFactorEnabled === true && result.session.mfaVerified === true)
    || usesTestPasswordOnly(result.user) || usesProductionPasswordOnly(result.user);
}
