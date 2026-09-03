import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

/**
 * Callables de Explorar — port de src/lib/actions/{recruitment-actions,
 * availability-actions,location-actions,match-invitation-actions (parcial)}.ts.
 * `users`, `availablePlayers` y las invitaciones de partido bloquean toda
 * escritura de cliente en firestore.rules a propósito.
 *
 * Geohash (2026-09-03): `getAvailableLocalPlayers` traía la colección
 * `availablePlayers` ENTERA y recién después filtraba por distancia con
 * Haversine en memoria — un escaneo completo por cada búsqueda. Ahora cada
 * documento guarda su `geohash` al escribir la ubicación (que pasa sólo por
 * las dos funciones de acá abajo), y la búsqueda consulta por rangos de
 * geohash. Haversine se sigue usando, pero sólo para afinar el borde del
 * radio sobre los pocos candidatos que devuelve el índice.
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

/** Port de saveUserLocationAction. */
export const saveUserLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const lat = Number(request.data?.lat);
  const lng = Number(request.data?.lng);
  const label = request.data?.label ? String(request.data.label) : undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpsError('invalid-argument', 'Coordenadas inválidas.');
  }

  const savedLocation = { lat, lng, ...(label ? { label } : {}), savedAt: new Date().toISOString() };
  await admin.firestore().collection('users').doc(uid).set({ savedLocation }, { merge: true });
  return { ok: true };
});

type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
type TimeOfDay = 'mañana' | 'tarde' | 'noche';

function buildAvailability(days: DayOfWeek[], times: TimeOfDay[]): Record<string, TimeOfDay[]> {
  const finalDays = days.length > 0 ? days : (['sabado', 'domingo'] as DayOfWeek[]);
  const finalTimes = times.length > 0 ? times : (['tarde', 'noche'] as TimeOfDay[]);
  const availability: Record<string, TimeOfDay[]> = {};
  finalDays.forEach((day) => { availability[day] = finalTimes; });
  return availability;
}

async function upsertAvailabilityDocument(
  uid: string,
  availability: Record<string, TimeOfDay[]>,
  locationOverride?: { lat: number; lng: number }
) {
  const db = admin.firestore();
  const [userSnap, playerSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('players').doc(uid).get(),
  ]);

  if (!playerSnap.exists) {
    throw new HttpsError('failed-precondition', 'No se encontró tu perfil de jugador.');
  }

  const savedLocation = userSnap.data()?.savedLocation;
  const lat = locationOverride?.lat ?? savedLocation?.lat;
  const lng = locationOverride?.lng ?? savedLocation?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new HttpsError('failed-precondition', 'Primero debes guardar una ubicación.');
  }

  const player = playerSnap.data()!;
  await db.collection('availablePlayers').doc(uid).set(
    {
      uid,
      displayName: player.name ?? '',
      photoURL: player.photoURL || player.photoUrl || '',
      photoUrl: player.photoUrl || player.photoURL || '',
      position: player.position ?? '',
      ovr: player.ovr ?? 0,
      location: { lat, lng },
      // Índice geoespacial: permite consultar por rangos en vez de escanear
      // toda la colección. Se escribe acá porque `upsertAvailabilityDocument`
      // es el único camino por el que se guarda una ubicación.
      geohash: geohashForLocation([lat, lng]),
      availability,
    },
    { merge: true }
  );
}

/** Port de enableAvailabilityAction. */
export const enableAvailability = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const days = (request.data?.days ?? []) as DayOfWeek[];
  const times = (request.data?.times ?? []) as TimeOfDay[];
  const lat = request.data?.lat != null ? Number(request.data.lat) : undefined;
  const lng = request.data?.lng != null ? Number(request.data.lng) : undefined;

  await upsertAvailabilityDocument(
    uid,
    buildAvailability(days, times),
    lat != null && lng != null ? { lat, lng } : undefined
  );
  return { ok: true };
});

/** Port de disableAvailabilityAction. */
export const disableAvailability = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  await admin.firestore().collection('availablePlayers').doc(uid).delete();
  return { ok: true };
});

/** Port de updateAvailabilityPreferencesAction. */
export const updateAvailabilityPreferences = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const days = (request.data?.days ?? []) as DayOfWeek[];
  const times = (request.data?.times ?? []) as TimeOfDay[];
  await admin.firestore().collection('availablePlayers').doc(uid).set(
    { availability: buildAvailability(days, times) },
    { merge: true }
  );
  return { ok: true };
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Port de getGroupMateUids + getAvailableLocalPlayersAction: excluye
 * compañeros de cualquier grupo del organizador (ya invitables desde el
 * propio partido) y a quienes ya están en el partido, filtra por radio real
 * (Haversine, no geohash), y rankea por coincidencia de disponibilidad
 * (día/horario) sin descartar a nadie por no coincidir.
 */
export const getAvailableLocalPlayers = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const lat = Number(request.data?.lat);
  const lng = Number(request.data?.lng);
  const radiusInKm = Number(request.data?.radiusInKm ?? 50);
  const dayOfWeek = request.data?.dayOfWeek as DayOfWeek | undefined;
  const timeOfDay = request.data?.timeOfDay as TimeOfDay | undefined;
  const matchPlayerUids: string[] = Array.isArray(request.data?.matchPlayerUids) ? request.data.matchPlayerUids : [];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpsError('invalid-argument', 'El partido no tiene coordenadas de ubicación válidas.');
  }

  const db = admin.firestore();

  const myPlayersSnap = await db.collection('players').where('ownerUid', '==', uid).get();
  const groupIds = [...new Set(myPlayersSnap.docs.map((d) => d.data().groupId as string | null).filter((id): id is string => !!id))];

  // Las consultas por grupo van en paralelo. Antes era un `await` por grupo,
  // en serie.
  const groupMateUids = new Set<string>();
  const groupSnaps = await Promise.all(
    groupIds.map((groupId) => db.collection('players').where('groupId', '==', groupId).get())
  );
  groupSnaps.forEach((snap) =>
    snap.docs.forEach((d) => {
      const ownerUid = d.data().ownerUid as string | undefined;
      if (ownerUid) groupMateUids.add(ownerUid);
    })
  );
  const excludedUids = new Set([...groupMateUids, ...matchPlayerUids]);

  // Consulta por rangos de geohash en vez de traer la colección entera.
  // `geohashQueryBounds` devuelve unos pocos rangos que cubren el círculo con
  // algo de sobrante; el filtro exacto por distancia se hace después, sobre
  // ese conjunto chico.
  const radiusInM = radiusInKm * 1000;
  const bounds = geohashQueryBounds([lat, lng], radiusInM);
  const boundSnaps = await Promise.all(
    bounds.map(([start, end]) =>
      db
        .collection('availablePlayers')
        .orderBy('geohash')
        .startAt(start)
        .endAt(end)
        .get()
    )
  );

  const byId = new Map<string, any>();
  boundSnaps.forEach((snap) =>
    snap.docs.forEach((doc) => byId.set(doc.id, { id: doc.id, ...doc.data() }))
  );

  // Los documentos previos al campo `geohash` ya se migraron con
  // scripts/backfill-geohash.ts (22/22 el 2026-09-03), y desde entonces
  // `upsertAvailabilityDocument` lo escribe siempre — no hace falta respaldo.
  let players = [...byId.values()];

  players = players.filter((p: any) => {
    if (p.location?.lat == null || p.location?.lng == null) return false;
    // `distanceBetween` devuelve km, igual que el haversine de acá abajo.
    return distanceBetween([lat, lng], [p.location.lat, p.location.lng]) <= radiusInKm;
  });
  players = players.filter((p: any) => !excludedUids.has(p.uid));

  const scored = players.map((p: any) => {
    let score = 1;
    if (dayOfWeek || timeOfDay) {
      if (p.availability && Object.keys(p.availability).length > 0) {
        let matchDay = true;
        let matchTime = true;
        if (dayOfWeek && p.availability[dayOfWeek] !== undefined) {
          const timesForDay: string[] = p.availability[dayOfWeek] || [];
          if (timeOfDay) matchTime = timesForDay.includes(timeOfDay);
        } else if (dayOfWeek) {
          matchDay = false;
        }
        if (matchDay && matchTime) score = 2;
        else if (!matchDay && !matchTime) score = 0;
        else score = 1;
      }
    }
    const distanceKm = p.location?.lat != null ? Math.round(haversineKm(lat, lng, p.location.lat, p.location.lng) * 10) / 10 : undefined;
    return { ...p, matchScore: score, isCurrentUser: p.uid === uid, distanceKm };
  });
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return { ok: true, players: scored };
});

/**
 * Port de sendMatchInvitationsAction. Simplificación consciente respecto a
 * la web: solo el ownerUid puede invitar (igual que el resto de las Cloud
 * Functions de partidos ya desplegadas) — la web también permite un rol de
 * grupo con permiso `matches.edit`, no portado acá.
 */
export const sendMatchInvitations = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const playerIds: string[] = Array.isArray(request.data?.playerIds) ? request.data.playerIds : [];

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  const match = matchSnap.data()!;
  if (match.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'No tienes permiso para invitar jugadores a este partido.');
  }

  const uniqueIds = [...new Set(playerIds)].filter(Boolean);
  if (uniqueIds.length === 0) throw new HttpsError('invalid-argument', 'No se seleccionaron jugadores.');

  const batch = db.batch();
  let sent = 0;
  for (const playerId of uniqueIds) {
    if ((match.playerUids as string[] | undefined)?.includes(playerId)) continue;
    const invitationRef = db.collection(`matches/${matchId}/invitations`).doc();
    batch.set(invitationRef, {
      matchId,
      matchTitle: match.title,
      matchDate: match.date,
      playerId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    sent += 1;
  }
  if (sent === 0) throw new HttpsError('failed-precondition', 'No había jugadores válidos para invitar.');

  await batch.commit();
  return { ok: true, sent };
});
