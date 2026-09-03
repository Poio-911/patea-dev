import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Callable equivalente a src/app/api/matches/create/route.ts (web) para los
 * tipos 'manual' y 'collaborative'. Existe porque firestore.rules tiene
 * `allow create: if false` en /matches/{matchId} a propósito — la web NUNCA
 * escribe partidos directo desde el cliente, siempre pasa por esa API route
 * (Admin SDK). 'by_teams' (elegir 2 equipos de grupo) queda pendiente hasta
 * que exista el resto de Grupos/Equipos en mobile.
 */
export const createMatch = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ matchId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debés iniciar sesión para crear un partido.');
    }
    const uid = request.auth.uid;
    const data = request.data ?? {};

    const title = String(data.title ?? '').trim();
    const type = String(data.type ?? 'manual');
    const matchSize = Number(data.matchSize ?? 0);
    if (!title || title.length < 3) {
      throw new HttpsError('invalid-argument', 'El título debe tener al menos 3 caracteres.');
    }
    if (!Number.isInteger(matchSize) || matchSize < 2) {
      throw new HttpsError('invalid-argument', 'matchSize inválido.');
    }
    if (type !== 'manual' && type !== 'collaborative') {
      throw new HttpsError('invalid-argument', "Solo se soportan tipos 'manual' y 'collaborative' por ahora.");
    }

    const date = typeof data.date === 'string' ? data.date : '';
    const time = typeof data.time === 'string' ? data.time : '';
    const locationName = typeof data.locationName === 'string' ? data.locationName : '';
    const locationAddress = typeof data.locationAddress === 'string' ? data.locationAddress : '';
    const locationLat = Number(data.locationLat ?? 0) || 0;
    const locationLng = Number(data.locationLng ?? 0) || 0;
    const locationPlaceId = typeof data.locationPlaceId === 'string' ? data.locationPlaceId : '';
    const isPlanning = !date || !time;

    const db = admin.firestore();

    const userSnap = await db.doc(`users/${uid}`).get();
    const groupId = (userSnap.data()?.activeGroupId as string | undefined) ?? null;

    const players = Array.isArray(data.players) ? data.players : [];
    const playerUids = Array.isArray(data.playerUids) ? data.playerUids : [];
    const teams = Array.isArray(data.teams) ? data.teams : [];

    const matchData = {
      title,
      type,
      date,
      time,
      status: isPlanning ? 'planning' : 'upcoming',
      matchSize,
      isPublic: false,
      ownerUid: uid, // nunca confiar en un ownerUid que mande el cliente
      groupId,
      location: {
        name: locationName,
        address: locationAddress,
        lat: locationLat,
        lng: locationLng,
        placeId: locationPlaceId,
      },
      players,
      playerUids,
      teams,
      events: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(isPlanning ? { isVotingOpen: true, dateProposals: [] } : {}),
    };

    const ref = await db.collection('matches').add(matchData);
    return { matchId: ref.id };
  }
);
