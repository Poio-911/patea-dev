import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendPushToUsers } from '../lib/fcm-push';
import { assertCanJoinMatch, assertOpenRoster, userCanManageMatch } from '../lib/match-access';
import { assertConvocationOpen, staleTeamsPatch } from '../lib/match-state';
import { regenerateMatchTeams } from './match-management';

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

  // Sólo se pide entrada a un partido que admite jugadores sueltos y que es
  // público, o del propio grupo.
  await assertCanJoinMatch(db, match, uid);
  assertConvocationOpen(match);

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

  if (match.ownerUid) {
    await sendPushToUsers(
      [String(match.ownerUid)],
      {
        title: '📋 Nueva solicitud',
        body: `${player.name ?? 'Un jugador'} quiere unirse a "${match.title ?? ''}".`,
        type: 'join_request',
        link: `/matches/${matchId}`,
        extraData: { matchId },
      },
      'RequestJoinMatch',
    );
  }
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

  if (!(await userCanManageMatch(db, match, uid))) {
    throw new HttpsError('permission-denied', 'Sólo los organizadores deciden quién entra.');
  }
  // Rechazar siempre se puede (limpia la solicitud); aceptar, sólo con la
  // convocatoria abierta y en un partido que admite jugadores sueltos. Antes se
  // aceptaba gente en partidos en vivo, terminados o de equipos.
  if (accepted) {
    assertConvocationOpen(match);
    assertOpenRoster(match, 'join');
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
      ...staleTeamsPatch(match),
    });
  } else {
    batch.update(matchRef, {
      pendingPlayerUids: admin.firestore.FieldValue.arrayRemove(requesterId),
    });
  }

  batch.delete(requestRef);

  const title = accepted ? '¡Solicitud aceptada! 🎉' : 'Solicitud rechazada';
  const message = accepted
    ? `Fuiste aceptado en "${match.title ?? ''}". ¡Ya estás en la lista!`
    : `Tu solicitud para "${match.title ?? ''}" fue rechazada.`;
  const type = accepted ? 'join_accepted' : 'join_rejected';

  batch.set(db.collection(`users/${requesterId}/notifications`).doc(), {
    type,
    title,
    message,
    link: `/matches/${matchId}`,
    isRead: false,
    createdAt: new Date().toISOString(),
    metadata: { matchId },
  });

  await batch.commit();

  await sendPushToUsers(
    [requesterId],
    {
      title,
      body: message,
      type,
      link: `/matches/${matchId}`,
      extraData: { matchId },
    },
    'RespondJoinRequest',
  );

  // Si con esta persona se completa el cupo, se arman los equipos (igual que
  // `joinMatch`). Antes el organizador tenía que hacerlo a mano.
  if (accepted) {
    await regenerateMatchTeams(db, matchId, undefined, true).catch((error) => {
      console.error('[respondJoinRequest] Error generando equipos al completarse el cupo', error);
    });
  }
  return { ok: true };
});

/**
 * Responder una invitación del organizador ("Falta uno" / invitar jugadores).
 *
 * Hasta ahora la invitación se creaba pero el invitado no tenía forma de
 * aceptarla: `joinMatch` incluso devolvía en silencio si había una invitación
 * pendiente. Acá la persona acepta (entra sin otra aprobación: ya la aprobó
 * quien invita) o rechaza.
 */
export const respondMatchInvitation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const accepted = request.data?.accepted === true;
  if (!matchId || matchId.includes('/')) throw new HttpsError('invalid-argument', 'Falta el partido.');

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  let notify: { ownerUid: string; title: string; body: string } | null = null;

  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = matchSnap.data()!;
    const invitations = await tx.get(
      db.collection(`matches/${matchId}/invitations`).where('playerId', '==', uid).where('status', '==', 'pending'),
    );
    if (invitations.empty) throw new HttpsError('not-found', 'La invitación ya no existe.');
    const respondedAt = new Date().toISOString();

    if (!accepted) {
      for (const doc of invitations.docs) tx.update(doc.ref, { status: 'declined', respondedAt });
      return;
    }

    assertConvocationOpen(match);
    assertOpenRoster(match, 'join');
    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    const players: Array<Record<string, unknown>> = Array.isArray(match.players) ? match.players : [];
    if (!playerUids.includes(uid)) {
      const matchSize = Number(match.matchSize ?? 0);
      if (matchSize > 0 && players.length >= matchSize) {
        throw new HttpsError('failed-precondition', 'El partido está lleno.');
      }
      const playerSnap = await tx.get(db.doc(`players/${uid}`));
      if (!playerSnap.exists) {
        throw new HttpsError('failed-precondition', 'No se encontró tu perfil de jugador.');
      }
      const player = playerSnap.data()!;
      const payload = {
        uid,
        displayName: player.name ?? '',
        ovr: player.ovr ?? 0,
        position: player.position ?? '',
        photoURL: player.photoURL || player.photoUrl || '',
      };
      tx.update(matchRef, {
        players: admin.firestore.FieldValue.arrayUnion(payload),
        playerUids: admin.firestore.FieldValue.arrayUnion(uid),
        pendingPlayerUids: admin.firestore.FieldValue.arrayRemove(uid),
        ...staleTeamsPatch(match),
      });
      if (match.ownerUid && match.ownerUid !== uid) {
        const body = `${payload.displayName || 'Un jugador'} aceptó tu invitación a "${match.title ?? ''}".`;
        tx.set(db.collection(`users/${match.ownerUid}/notifications`).doc(), {
          type: 'new_joiner',
          title: 'Invitación aceptada',
          message: body,
          link: `/matches/${matchId}`,
          isRead: false,
          createdAt: respondedAt,
          metadata: { fromUserId: uid, matchId },
        });
        notify = { ownerUid: String(match.ownerUid), title: 'Invitación aceptada', body };
      }
    }
    for (const doc of invitations.docs) tx.update(doc.ref, { status: 'accepted', respondedAt });
  });

  if (notify) {
    const n: { ownerUid: string; title: string; body: string } = notify;
    await sendPushToUsers(
      [n.ownerUid],
      { title: n.title, body: n.body, type: 'new_joiner', link: `/matches/${matchId}`, extraData: { matchId } },
      'RespondMatchInvitation',
    );
  }
  if (accepted) {
    await regenerateMatchTeams(db, matchId, undefined, true).catch((error) => {
      console.error('[respondMatchInvitation] Error generando equipos', error);
    });
  }
  return { ok: true };
});
