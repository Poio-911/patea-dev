import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Solicitudes de unión a un partido, con aprobación del organizador.
 *
 * Port de `requestJoinMatchAction` / `respondJoinRequestAction`
 * (src/lib/actions/match-actions.ts:250 y :320).
 *
 * La regla que decide entre pedir permiso y anotarse derecho vive en la web
 * en `use-match-actions.ts:88`: un partido **manual** que no es tuyo se pide;
 * cualquier otro (colaborativo, o el tuyo propio) se une directo. El móvil
 * hasta ahora llamaba siempre a `joinMatch`, así que un jugador entraba a un
 * partido manual ajeno sin que el organizador se enterara.
 *
 * Las solicitudes viven en `matches/{id}/joinRequests/{uid}` — un documento
 * por jugador, con su perfil adentro para que el organizador pueda decidir
 * sin tener que ir a buscar nada.
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

export const requestJoinMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  if (!matchId) throw new HttpsError('invalid-argument', 'Falta el partido.');

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const match = matchSnap.data()!;

  const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
  if (playerUids.includes(uid)) {
    throw new HttpsError('failed-precondition', 'Ya estás en este partido.');
  }

  const pending: string[] = Array.isArray(match.pendingPlayerUids) ? match.pendingPlayerUids : [];
  // Idempotente: volver a pedir no es un error, es no hacer nada.
  if (pending.includes(uid)) return { ok: true, alreadyPending: true };

  const players: Array<unknown> = Array.isArray(match.players) ? match.players : [];
  const matchSize = Number(match.matchSize ?? 0);
  if (matchSize > 0 && players.length >= matchSize) {
    throw new HttpsError('failed-precondition', 'El partido está lleno.');
  }

  const playerSnap = await db.collection('players').doc(uid).get();
  if (!playerSnap.exists) {
    throw new HttpsError('failed-precondition', 'No se encontró tu perfil de jugador.');
  }
  const player = playerSnap.data()!;

  const batch = db.batch();

  batch.set(db.collection(`matches/${matchId}/joinRequests`).doc(uid), {
    uid,
    displayName: player.name ?? '',
    // Los documentos de jugador tienen el campo escrito de las dos formas
    // según cuándo se crearon.
    photoURL: player.photoURL || player.photoUrl || '',
    ovr: player.ovr ?? 0,
    position: player.position ?? '',
    requestedAt: new Date().toISOString(),
  });

  batch.update(matchRef, {
    pendingPlayerUids: admin.firestore.FieldValue.arrayUnion(uid),
  });

  if (match.ownerUid) {
    batch.set(db.collection(`users/${match.ownerUid}/notifications`).doc(), {
      type: 'join_request',
      title: '📋 Nueva solicitud',
      message: `${player.name ?? 'Un jugador'} quiere unirse a "${match.title ?? ''}". Revisá su perfil y aceptá o rechazá.`,
      link: `/matches/${matchId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { fromUserId: uid, matchId },
    });
  }

  await batch.commit();
  return { ok: true, alreadyPending: false };
});

export const respondJoinRequest = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const requesterId = String(request.data?.requesterId ?? '');
  const accepted = request.data?.accepted === true;
  if (!matchId || !requesterId) {
    throw new HttpsError('invalid-argument', 'Falta el partido o el jugador.');
  }

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const match = matchSnap.data()!;

  if (match.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Sólo el organizador decide quién entra.');
  }

  const requestRef = db.collection(`matches/${matchId}/joinRequests`).doc(requesterId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) throw new HttpsError('not-found', 'La solicitud ya no existe.');
  const joinRequest = requestSnap.data()!;

  const players: Array<unknown> = Array.isArray(match.players) ? match.players : [];
  const matchSize = Number(match.matchSize ?? 0);
  if (accepted && matchSize > 0 && players.length >= matchSize) {
    throw new HttpsError('failed-precondition', 'El partido ya está lleno.');
  }

  const batch = db.batch();

  if (accepted) {
    batch.update(matchRef, {
      players: admin.firestore.FieldValue.arrayUnion({
        uid: requesterId,
        displayName: joinRequest.displayName ?? '',
        ovr: joinRequest.ovr ?? 0,
        position: joinRequest.position ?? '',
        photoURL: joinRequest.photoURL ?? '',
      }),
      playerUids: admin.firestore.FieldValue.arrayUnion(requesterId),
      pendingPlayerUids: admin.firestore.FieldValue.arrayRemove(requesterId),
    });
  } else {
    batch.update(matchRef, {
      pendingPlayerUids: admin.firestore.FieldValue.arrayRemove(requesterId),
    });
  }

  batch.delete(requestRef);

  batch.set(db.collection(`users/${requesterId}/notifications`).doc(), {
    type: accepted ? 'join_accepted' : 'join_rejected',
    title: accepted ? '¡Solicitud aceptada! 🎉' : 'Solicitud rechazada',
    message: accepted
      ? `Fuiste aceptado en "${match.title ?? ''}". ¡Ya estás en la lista!`
      : `Tu solicitud para "${match.title ?? ''}" fue rechazada.`,
    link: `/matches/${matchId}`,
    isRead: false,
    createdAt: new Date().toISOString(),
    metadata: { matchId },
  });

  await batch.commit();
  return { ok: true };
});
