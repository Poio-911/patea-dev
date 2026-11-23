import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { notifyUsers } from '../lib/notify-users';
import { teamIds } from '../lib/competition-engine';
import {
  MAX_SPONSORS,
  MAX_VENUES,
  candidateRecipients,
  canSendAnother,
  normalizeMessage,
  normalizeSponsor,
  normalizeVenue,
  parseCollection,
  safeId,
} from '../lib/competition-extras';

/**
 * Avisos, sedes y patrocinadores de una liga o copa. Solo los administra quien
 * organiza la competición. Los lee cualquiera con sesión (las sedes y
 * patrocinadores son públicos); los avisos los lee solo el organizador, y a
 * los participantes les llegan como notificación.
 */

function requireUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

/** Carga la competición y exige que quien llama sea su organizador. */
async function loadOwnedCompetition(data: any, uid: string) {
  const collection = parseCollection(data?.collection);
  const id = safeId(data?.id);
  if (!collection || !id) throw new HttpsError('invalid-argument', 'Competición no válida.');
  const ref = admin.firestore().doc(`${collection}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'La competición ya no existe.');
  const comp = snap.data()!;
  if (comp.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo quien organiza la competición puede hacerlo.');
  }
  if (comp.isArchived === true || comp.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'La competición está archivada o cancelada.');
  }
  return { ref, comp, collection, id };
}

const invalid = (e: unknown): never => {
  throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Datos no válidos.');
};

/** Manda un aviso a los equipos de la competición. */
export const sendCompetitionMessage = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  const uid = requireUid(request);
  const { ref, comp, collection, id } = await loadOwnedCompetition(request.data, uid);

  let input;
  try {
    input = normalizeMessage(request.data?.subject, request.data?.body, request.data?.audience);
  } catch (e) {
    return invalid(e);
  }

  const db = admin.firestore();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await ref.collection('messages').where('createdAt', '>=', hourAgo).count().get();
  if (!canSendAnother(recent.data().count)) {
    throw new HttpsError('resource-exhausted', 'Mandaste varios avisos en la última hora. Esperá un rato.');
  }

  const ids = teamIds(comp.teams);
  const teams = ids.length ? await db.getAll(...ids.map((t) => db.doc(`teams/${t}`))) : [];
  const candidates = candidateRecipients(
    teams.filter((t) => t.exists).map((t) => t.data()!),
    input.audience,
  );

  // Solo personas con cuenta: los jugadores manuales no tienen dónde recibirlo.
  const players = candidates.length ? await db.getAll(...candidates.map((p) => db.doc(`players/${p}`))) : [];
  const recipients = players
    .filter((p) => p.exists && p.data()?.ownerUid === p.id && p.id !== uid)
    .map((p) => p.id);

  const messageRef = await ref.collection('messages').add({
    subject: input.subject,
    body: input.body,
    audience: input.audience,
    recipientCount: recipients.length,
    createdBy: uid,
    createdAt: new Date().toISOString(),
  });

  const type = collection === 'cups' ? 'cup' : 'league';
  await notifyUsers(
    db,
    recipients,
    {
      type: 'competition_message',
      title: `${String(comp.name ?? 'Competición').slice(0, 40)}: ${input.subject}`,
      message: input.body.slice(0, 180),
      link: `/competitions/${type}/${id}`,
      metadata: { competitionId: id, messageId: messageRef.id },
    },
    'competition-message',
  ).catch(() => undefined); // El aviso queda guardado aunque el push falle.

  return { ok: true, recipientCount: recipients.length, messageId: messageRef.id };
});

/** Agrega, cambia o saca una sede de la competición. */
export const manageCompetitionVenue = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request);
  const { ref } = await loadOwnedCompetition(request.data, uid);
  const action = request.data?.action;
  const venues = ref.collection('venues');

  if (action === 'remove') {
    const venueId = safeId(request.data?.venueId);
    if (!venueId) throw new HttpsError('invalid-argument', 'Falta la sede.');
    await venues.doc(venueId).delete();
    return { ok: true };
  }
  if (action !== 'add' && action !== 'update') throw new HttpsError('invalid-argument', 'Acción no válida.');

  let venue;
  try {
    venue = normalizeVenue(request.data?.venue);
  } catch (e) {
    return invalid(e);
  }

  if (action === 'add') {
    const count = (await venues.count().get()).data().count;
    if (count >= MAX_VENUES) throw new HttpsError('resource-exhausted', `Hasta ${MAX_VENUES} sedes por competición.`);
    const added = await venues.add({ ...venue, createdAt: new Date().toISOString() });
    return { ok: true, venueId: added.id };
  }
  const venueId = safeId(request.data?.venueId);
  if (!venueId) throw new HttpsError('invalid-argument', 'Falta la sede.');
  const target = venues.doc(venueId);
  if (!(await target.get()).exists) throw new HttpsError('not-found', 'La sede ya no existe.');
  // `set` sin merge: lo que se borró en el formulario (dirección, notas) se borra de verdad.
  await target.set({ ...venue, updatedAt: new Date().toISOString() });
  return { ok: true, venueId };
});

/** Agrega, cambia o saca un patrocinador (nombre y enlace; sin logo). */
export const manageCompetitionSponsor = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request);
  const { ref, comp } = await loadOwnedCompetition(request.data, uid);
  const action = request.data?.action;
  const sponsors: Record<string, any>[] = Array.isArray(comp.sponsors) ? [...comp.sponsors] : [];

  if (action === 'remove') {
    const sponsorId = safeId(request.data?.sponsorId);
    if (!sponsorId) throw new HttpsError('invalid-argument', 'Falta el patrocinador.');
    await ref.update({ sponsors: sponsors.filter((s) => s?.id !== sponsorId) });
    return { ok: true };
  }
  if (action !== 'add' && action !== 'update') throw new HttpsError('invalid-argument', 'Acción no válida.');

  let sponsor;
  try {
    sponsor = normalizeSponsor(request.data?.sponsor);
  } catch (e) {
    return invalid(e);
  }

  if (action === 'add') {
    if (sponsors.length >= MAX_SPONSORS) {
      throw new HttpsError('resource-exhausted', `Hasta ${MAX_SPONSORS} patrocinadores.`);
    }
    const sponsorId = admin.firestore().collection('_').doc().id;
    await ref.update({ sponsors: [...sponsors, { id: sponsorId, ...sponsor, order: sponsors.length }] });
    return { ok: true, sponsorId };
  }
  const sponsorId = safeId(request.data?.sponsorId);
  const index = sponsors.findIndex((s) => s?.id === sponsorId);
  if (!sponsorId || index === -1) throw new HttpsError('not-found', 'El patrocinador ya no existe.');
  // Se conserva el logo que pudiera tener (lo cargó la web) y se reemplaza el resto.
  sponsors[index] = { id: sponsorId, ...(sponsors[index].logoUrl ? { logoUrl: sponsors[index].logoUrl } : {}), order: sponsors[index].order ?? index, ...sponsor };
  await ref.update({ sponsors });
  return { ok: true, sponsorId };
});
