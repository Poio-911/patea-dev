import * as admin from 'firebase-admin';

/**
 * Lectura y limpieza de tokens FCM.
 *
 * Hasta 2026-09-03 los tokens vivían como un campo array `fcmTokens` DENTRO
 * del documento `users/{uid}`. Ese documento tiene `allow read: if isAuthenticated()`
 * en firestore.rules, así que los tokens de push de cualquier usuario eran
 * legibles por cualquier otro usuario autenticado. Las reglas ya protegían una
 * subcolección `users/{uid}/fcmTokens` que ningún código usaba.
 *
 * Ahora la fuente es esa subcolección. Se sigue leyendo el array viejo como
 * respaldo para no dejar sin notificaciones a los usuarios de la web que
 * todavía no volvieron a registrar el token; cuando ya no queden, se puede
 * borrar `legacyTokensFromUserDoc` y el campo del documento.
 */

export async function getTokensForUser(uid: string): Promise<string[]> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  const [subSnap, userSnap] = await Promise.all([
    userRef.collection('fcmTokens').get(),
    userRef.get(),
  ]);

  const tokens = new Set<string>();
  subSnap.docs.forEach((doc) => {
    const token = (doc.data().token as string | undefined) ?? doc.id;
    if (token) tokens.add(token);
  });

  legacyTokensFromUserDoc(userSnap.data()).forEach((t) => tokens.add(t));

  return [...tokens];
}

export async function getTokensForUsers(uids: string[]): Promise<Map<string, string[]>> {
  const unique = [...new Set(uids)].filter(Boolean);
  const entries = await Promise.all(
    unique.map(async (uid) => [uid, await getTokensForUser(uid)] as const)
  );
  return new Map(entries);
}

function legacyTokensFromUserDoc(data: admin.firestore.DocumentData | undefined): string[] {
  const legacy = data?.fcmTokens;
  return Array.isArray(legacy) ? legacy.filter((t): t is string => typeof t === 'string') : [];
}

/**
 * Borra de Firestore los tokens que FCM rechazó por inválidos o no registrados.
 * Limpia tanto la subcolección nueva como el array viejo.
 */
export async function pruneInvalidTokens(uid: string, badTokens: string[]): Promise<void> {
  if (badTokens.length === 0) return;

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const batch = db.batch();

  badTokens.forEach((token) => {
    batch.delete(userRef.collection('fcmTokens').doc(token));
  });
  batch.set(
    userRef,
    { fcmTokens: admin.firestore.FieldValue.arrayRemove(...badTokens) },
    { merge: true }
  );

  await batch.commit();
}

/**
 * Códigos de error de FCM que significan "este token ya no sirve, borralo".
 * Cualquier otro error (red, cuota) NO debe borrar el token.
 */
export function isDeadTokenError(code: string | undefined): boolean {
  return (
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-argument'
  );
}
