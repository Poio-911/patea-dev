import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { DELETED_PLAYER_NAME, isRecentLogin, pickNextOwner, scrubDeletedUser } from '../lib/account-deletion';

/**
 * Borra la cuenta de quien llama y sus datos personales (guideline 5.1.1(v) de
 * la App Store: si se puede crear una cuenta en la app, se tiene que poder
 * borrar desde la app).
 *
 * Qué se hace con cada cosa:
 *  - Se borra: perfil, jugador propio, disponibilidad, tokens de push,
 *    notificaciones, publicaciones y comentarios propios, seguimientos y los
 *    archivos propios de Storage.
 *  - Se anonimiza: el nombre y la foto en partidos y evaluaciones de otras
 *    personas. Son historial compartido; no se borran.
 *  - Grupos: si es el creador y hay más gente, el grupo pasa a otro integrante;
 *    si era la única persona, se borra el grupo.
 *
 * La cuenta de Authentication se borra AL FINAL: si algo falla antes, la
 * persona sigue con sesión y puede reintentar (todo es idempotente).
 */
export const deleteMyAccount = onCall(
  { region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    const uid = request.auth.uid;

    if (!isRecentLogin(request.auth.token.auth_time)) {
      throw new HttpsError('failed-precondition', 'requires-recent-login');
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // 1) Grupos.
    const groups = await db.collection('groups').where('members', 'array-contains', uid).get();
    const newOwnerByGroup = new Map<string, string | null>();
    for (const doc of groups.docs) {
      const group = doc.data();
      const members: string[] = Array.isArray(group.members) ? group.members : [];
      const remaining = members.filter((m) => m !== uid);
      if (remaining.length === 0) {
        await db.recursiveDelete(doc.ref);
        newOwnerByGroup.set(doc.id, null);
        continue;
      }
      const nextOwner = group.ownerUid === uid ? pickNextOwner(group, uid) : group.ownerUid;
      const memberRoles = (Array.isArray(group.memberRoles) ? group.memberRoles : [])
        .filter((r: { userId: string }) => r.userId !== uid)
        .map((r: { userId: string; role?: string }) => (r.userId === nextOwner ? { ...r, role: 'admin' } : r));
      await doc.ref.update({
        members: remaining,
        ownerUid: nextOwner,
        ...(Array.isArray(group.memberRoles) ? { memberRoles } : {}),
      });
      newOwnerByGroup.set(doc.id, nextOwner);
    }

    // 2) Jugadores: el propio se borra; los manuales que creó siguen con el grupo.
    const ownedPlayers = await db.collection('players').where('ownerUid', '==', uid).get();
    for (const doc of ownedPlayers.docs) {
      const groupId = doc.data().groupId as string | null | undefined;
      const nextOwner = groupId ? newOwnerByGroup.get(groupId) : null;
      if (doc.id !== uid && nextOwner) {
        await doc.ref.update({ ownerUid: nextOwner });
      } else {
        await doc.ref.delete();
      }
    }
    await db.doc(`players/${uid}`).delete();
    await db.doc(`availablePlayers/${uid}`).delete();

    // 3) Social: publicaciones propias (con sus comentarios), comentarios en las
    //    de otros y seguimientos.
    const posts = await db.collection('socialActivities').where('userId', '==', uid).get();
    for (const doc of posts.docs) await db.recursiveDelete(doc.ref);

    const comments = await db.collectionGroup('comments').where('userId', '==', uid).get();
    for (const doc of comments.docs) {
      const parent = doc.ref.parent.parent;
      await doc.ref.delete();
      if (parent) {
        await parent.update({ commentCount: admin.firestore.FieldValue.increment(-1) }).catch(() => undefined);
      }
    }

    for (const field of ['followerId', 'followingId']) {
      const follows = await db.collection('follows').where(field, '==', uid).get();
      for (const doc of follows.docs) await doc.ref.delete();
    }

    // 4) Anonimizar copias en partidos y evaluaciones.
    const matches = await db.collection('matches').where('playerUids', 'array-contains', uid).get();
    for (const doc of matches.docs) {
      const { value, changed } = scrubDeletedUser(doc.data(), uid);
      if (changed) await doc.ref.set(value);
    }
    const written = await db.collection('evaluations').where('evaluatorId', '==', uid).get();
    for (const doc of written.docs) {
      await doc.ref.update({
        evaluatorDisplayName: DELETED_PLAYER_NAME,
        evaluatorName: DELETED_PLAYER_NAME,
        evaluatorPhotoUrl: '',
        evaluatorPhotoURL: '',
      });
    }
    const about = await db.collection('evaluations').where('playerId', '==', uid).get();
    for (const doc of about.docs) await doc.ref.delete();

    // 5) Archivos propios en Storage.
    await Promise.all([
      bucket.deleteFiles({ prefix: `profile-images/${uid}/` }),
      bucket.deleteFiles({ prefix: `social-posts/${uid}/` }),
    ]);
    for (const root of ['match-clips/', 'evaluation-audios/']) {
      const [files] = await bucket.getFiles({ prefix: root });
      await Promise.all(
        files.filter((f) => f.name.split('/')[2] === uid).map((f) => f.delete().catch(() => undefined)),
      );
    }

    // 6) Perfil (con tokens y notificaciones) y, al final, la cuenta.
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await admin.auth().deleteUser(uid);

    return { ok: true };
  },
);
