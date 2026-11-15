type ReaderCredentials = {
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<{ uid: string }>;
  requireSession: () => Promise<string>;
};

/** Una credencial explícita inválida nunca cae a una sesión de otra cuenta. */
export async function resolveEvaluationReader(
  idToken: string | undefined,
  credentials: ReaderCredentials,
): Promise<string> {
  if (idToken !== undefined) {
    if (typeof idToken !== 'string' || !idToken.trim()) throw new Error('Credencial inválida.');
    const decoded = await credentials.verifyIdToken(idToken, true);
    if (!decoded.uid) throw new Error('Credencial sin usuario.');
    return decoded.uid;
  }
  return credentials.requireSession();
}

export async function requireEvaluationReader(idToken?: string): Promise<string> {
  const [{ getAdminAuth }, { requireAuth }] = await Promise.all([
    import('../../firebase/admin-init'), import('./get-server-session'),
  ]);
  return resolveEvaluationReader(idToken, {
    verifyIdToken: (token, checkRevoked) => getAdminAuth().verifyIdToken(token, checkRevoked),
    requireSession: requireAuth,
  });
}
