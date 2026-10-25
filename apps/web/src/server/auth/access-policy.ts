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

export function hasRequiredAuthentication(result: {user: AccessUser; session: {mfaVerified?: boolean | null}}): boolean {
  return (result.user.twoFactorEnabled === true && result.session.mfaVerified === true)
    || usesTestPasswordOnly(result.user);
}
