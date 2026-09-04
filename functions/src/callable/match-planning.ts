import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

/**
 * Votación de fecha y de cancha para un partido que todavía no tiene ninguna
 * de las dos cosas.
 *
 * Port de `match-planning-actions.ts` (fecha) y `match-voting-actions.ts`
 * (cancha).
 *
 * Un partido nace 'planning' cuando se crea sin fecha ni hora — el móvil ya
 * lo permite con el switch "definir después" —, y en ese estado
 * `createMatch` le deja `isVotingOpen: true` y `dateProposals: []`. Hasta
 * ahora el móvil podía crear ese partido y después no tenía forma de ponerle
 * fecha: quedaba colgado esperando que alguien entrara por la web.
 *
 * Ojo con una diferencia entre las dos votaciones, que es de la web y se
 * respeta acá: la de **fecha** deja votar varias opciones a la vez (cada voto
 * es un toggle independiente, para marcar "puedo estos tres días"), mientras
 * que la de **cancha** es de voto único (votar una borra tu voto de las
 * demás).
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

/**
 * Quién puede proponer y cerrar la votación.
 *
 * En la web esto vive sólo en la UI (date-voting.tsx:42 muestra el botón a
 * capitanes y organizador). Acá es una Cloud Function, que es el borde real
 * de seguridad, así que la misma regla se aplica de verdad.
 */
function requireCaptain(match: Record<string, unknown>, uid: string) {
  const captains: string[] = Array.isArray(match.captains) ? (match.captains as string[]) : [];
  if (match.ownerUid === uid || captains.includes(uid)) return;
  throw new HttpsError('permission-denied', 'Sólo el organizador o los capitanes deciden esto.');
}

async function getMatch(matchId: string) {
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  return { ref, data: snap.data()! };
}

// --------------------------------------------------------------------------
// Fecha
// --------------------------------------------------------------------------

export const proposeMatchDate = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const date = String(request.data?.date ?? '');
  const time = String(request.data?.time ?? '');

  if (!matchId || !date || !time) {
    throw new HttpsError('invalid-argument', 'Falta el partido, la fecha o la hora.');
  }
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new HttpsError('invalid-argument', 'La hora tiene que ser HH:MM.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;

    if (match.status !== 'planning') {
      throw new HttpsError('failed-precondition', 'El partido ya tiene fecha.');
    }
    requireCaptain(match, uid);

    const proposals: Array<Record<string, unknown>> = Array.isArray(match.dateProposals)
      ? match.dateProposals
      : [];

    // Proponer dos veces lo mismo no aporta nada y ensucia la lista.
    if (proposals.some((p) => p.date === date && p.time === time)) {
      throw new HttpsError('already-exists', 'Esa fecha ya está propuesta.');
    }

    proposals.push({
      id: randomUUID(),
      matchId,
      proposedBy: uid,
      date,
      time,
      // El que propone vota lo suyo: no tiene sentido proponer algo que no te sirve.
      votes: [uid],
      createdAt: new Date().toISOString(),
    });

    transaction.update(ref, { dateProposals: proposals });
  });

  return { ok: true };
});

export const voteMatchDate = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const proposalId = String(request.data?.proposalId ?? '');
  if (!matchId || !proposalId) {
    throw new HttpsError('invalid-argument', 'Falta el partido o la propuesta.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;

    if (match.isVotingOpen === false) {
      throw new HttpsError('failed-precondition', 'La votación está cerrada.');
    }

    const proposals: Array<Record<string, unknown>> = Array.isArray(match.dateProposals)
      ? match.dateProposals
      : [];
    const index = proposals.findIndex((p) => p.id === proposalId);
    if (index === -1) throw new HttpsError('not-found', 'La propuesta ya no existe.');

    const votes: string[] = Array.isArray(proposals[index].votes)
      ? (proposals[index].votes as string[])
      : [];

    // Toggle, e independiente de las demás: se puede marcar más de un día.
    proposals[index] = {
      ...proposals[index],
      votes: votes.includes(uid) ? votes.filter((v) => v !== uid) : [...votes, uid],
    };

    transaction.update(ref, { dateProposals: proposals });
  });

  return { ok: true };
});

export const confirmMatchDate = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const proposalId = String(request.data?.proposalId ?? '');
  if (!matchId || !proposalId) {
    throw new HttpsError('invalid-argument', 'Falta el partido o la propuesta.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;
    requireCaptain(match, uid);

    const proposals: Array<Record<string, unknown>> = Array.isArray(match.dateProposals)
      ? match.dateProposals
      : [];
    const winner = proposals.find((p) => p.id === proposalId);
    if (!winner) throw new HttpsError('not-found', 'La propuesta ya no existe.');

    transaction.update(ref, {
      status: 'upcoming',
      date: winner.date,
      time: winner.time,
      isVotingOpen: false,
    });
  });

  return { ok: true };
});

// --------------------------------------------------------------------------
// Cancha
// --------------------------------------------------------------------------

export const proposeMatchLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const raw = request.data?.location;
  if (!matchId || !raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', 'Falta el partido o la cancha.');
  }

  const location = {
    name: String(raw.name ?? ''),
    address: String(raw.address ?? ''),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    placeId: String(raw.placeId ?? ''),
  };
  if (!location.name) throw new HttpsError('invalid-argument', 'La cancha necesita un nombre.');

  const { ref, data: match } = await getMatch(matchId);
  requireCaptain(match, uid);

  await ref.update({
    locationProposals: admin.firestore.FieldValue.arrayUnion({
      id: randomUUID(),
      location,
      proposedBy: uid,
      votes: [],
      createdAt: new Date().toISOString(),
    }),
    // Proponer una cancha abre la votación sola, igual que en la web.
    isVotingOpen: true,
  });

  return { ok: true };
});

export const voteMatchLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const proposalId = String(request.data?.proposalId ?? '');
  if (!matchId || !proposalId) {
    throw new HttpsError('invalid-argument', 'Falta el partido o la propuesta.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;

    if (match.isVotingOpen === false) {
      throw new HttpsError('failed-precondition', 'La votación está cerrada.');
    }

    const proposals: Array<Record<string, unknown>> = Array.isArray(match.locationProposals)
      ? match.locationProposals
      : [];
    const index = proposals.findIndex((p) => p.id === proposalId);
    if (index === -1) throw new HttpsError('not-found', 'La propuesta ya no existe.');

    const hadVoted = (proposals[index].votes as string[] | undefined)?.includes(uid) ?? false;

    // Voto único: se juega en una sola cancha, así que votar una borra el
    // voto anterior en vez de sumarlo.
    const cleaned = proposals.map((p) => ({
      ...p,
      votes: (Array.isArray(p.votes) ? (p.votes as string[]) : []).filter((v) => v !== uid),
    }));
    if (!hadVoted) {
      cleaned[index].votes = [...cleaned[index].votes, uid];
    }

    transaction.update(ref, { locationProposals: cleaned });
  });

  return { ok: true };
});

export const confirmMatchLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const proposalId = String(request.data?.proposalId ?? '');
  if (!matchId || !proposalId) {
    throw new HttpsError('invalid-argument', 'Falta el partido o la propuesta.');
  }

  const { ref, data: match } = await getMatch(matchId);
  requireCaptain(match, uid);

  const proposals: Array<Record<string, unknown>> = Array.isArray(match.locationProposals)
    ? match.locationProposals
    : [];
  const winner = proposals.find((p) => p.id === proposalId);
  if (!winner) throw new HttpsError('not-found', 'La propuesta ya no existe.');

  await ref.update({
    location: winner.location,
    isVotingOpen: false,
  });

  return { ok: true };
});
