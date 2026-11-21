import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { assertNotTeamMatch, userCanManageMatch } from '../lib/match-access';
import { sendPushToUsers } from '../lib/fcm-push';

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
  let lat = locationOverride?.lat ?? savedLocation?.lat;
  let lng = locationOverride?.lng ?? savedLocation?.lng;

  // Si no hay coordenadas guardadas ni pasadas, usar ubicación por defecto (Montevideo)
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    lat = -34.9011;
    lng = -56.1645;
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
  const rawAvailability = request.data?.availability as Record<string, TimeOfDay[]> | undefined;
  const days = (request.data?.days ?? []) as DayOfWeek[];
  const times = (request.data?.times ?? []) as TimeOfDay[];
  const lat = request.data?.lat != null ? Number(request.data.lat) : undefined;
  const lng = request.data?.lng != null ? Number(request.data.lng) : undefined;
  const label = request.data?.label ? String(request.data.label) : undefined;

  // Si viene ubicación nueva con etiqueta, guardarla también en users/{uid}
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    await admin.firestore().collection('users').doc(uid).set(
      { savedLocation: { lat, lng, ...(label ? { label } : {}), savedAt: new Date().toISOString() } },
      { merge: true }
    );
  }

  const finalAvailability = (rawAvailability && Object.keys(rawAvailability).length > 0)
    ? rawAvailability
    : buildAvailability(days, times);

  await upsertAvailabilityDocument(
    uid,
    finalAvailability,
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
  const rawAvailability = request.data?.availability as Record<string, TimeOfDay[]> | undefined;
  const days = (request.data?.days ?? []) as DayOfWeek[];
  const times = (request.data?.times ?? []) as TimeOfDay[];

  const finalAvailability = (rawAvailability && Object.keys(rawAvailability).length > 0)
    ? rawAvailability
    : buildAvailability(days, times);

  await admin.firestore().collection('availablePlayers').doc(uid).set(
    { availability: finalAvailability },
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

  // Traer perfiles frescos de `players` para no mostrar fotos ni stats desactualizados
  const playerSnaps = await Promise.all(
    players.map((p: any) => db.collection('players').doc(p.uid).get())
  );
  const playerMap = new Map<string, any>();
  playerSnaps.forEach((snap) => {
    if (snap.exists) playerMap.set(snap.id, snap.data());
  });

  const scored = players.map((p: any) => {
    const live = playerMap.get(p.uid);
    const liveName = live?.name || live?.displayName || p.displayName || '';
    const livePhoto = live?.photoURL || live?.photoUrl || p.photoURL || p.photoUrl || '';
    const liveOvr = live?.ovr ?? p.ovr ?? 50;
    const livePosition = live?.position || p.position || 'MED';
    const livePac = live?.pac ?? liveOvr;
    const liveSho = live?.sho ?? liveOvr;
    const livePas = live?.pas ?? liveOvr;
    const liveDri = live?.dri ?? liveOvr;
    const liveDef = live?.def ?? liveOvr;
    const livePhy = live?.phy ?? liveOvr;

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
    return {
      ...p,
      displayName: liveName,
      photoURL: livePhoto,
      photoUrl: livePhoto,
      ovr: liveOvr,
      position: livePosition,
      pac: livePac,
      sho: liveSho,
      pas: livePas,
      dri: liveDri,
      def: liveDef,
      phy: livePhy,
      matchScore: score,
      isCurrentUser: p.uid === uid,
      distanceKm,
    };
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
  const rawMessage = typeof request.data?.message === 'string' ? request.data.message.trim() : '';
  const messageText = rawMessage.slice(0, 500);

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  const match = matchSnap.data()!;
  if (!(await userCanManageMatch(db, match, uid))) {
    throw new HttpsError('permission-denied', 'No tienes permiso para invitar jugadores a este partido.');
  }
  assertNotTeamMatch(match);

  const uniqueIds = [...new Set(playerIds)].filter(Boolean);
  if (uniqueIds.length === 0) throw new HttpsError('invalid-argument', 'No se seleccionaron jugadores.');

  const senderSnap = await db.collection('players').doc(uid).get();
  const senderData = senderSnap.data() ?? {};
  const fromName = String(senderData.name ?? senderData.displayName ?? 'Un jugador');
  const fromPhotoUrl = String(senderData.photoURL ?? senderData.photoUrl ?? '');

  const batch = db.batch();
  const now = new Date().toISOString();
  const notifiedIds: string[] = [];
  let sent = 0;

  for (const playerId of uniqueIds) {
    if ((match.playerUids as string[] | undefined)?.includes(playerId)) continue;
    const invitationRef = db.collection(`matches/${matchId}/invitations`).doc();
    batch.set(invitationRef, {
      matchId,
      matchTitle: match.title,
      matchDate: match.date,
      playerId,
      ...(messageText ? { message: messageText } : {}),
      invitedBy: uid,
      status: 'pending',
      createdAt: now,
    });

    const msgRef = db.collection(`users/${playerId}/messages`).doc();
    const locName = typeof match.location === 'object' && match.location
      ? String(match.location.name ?? match.location.address ?? '')
      : String(match.location ?? '');
    batch.set(msgRef, {
      type: 'match_invite',
      fromUid: uid,
      fromName,
      fromPhotoUrl,
      text: messageText || `Te invitaron al partido "${match.title ?? 'Partido'}". ¡Sumate acá!`,
      matchId,
      matchTitle: String(match.title ?? ''),
      matchDate: String(match.date ?? ''),
      matchTime: String(match.time ?? ''),
      matchLocation: locName,
      isRead: false,
      createdAt: now,
    });

    notifiedIds.push(playerId);
    sent += 1;
  }
  if (sent === 0) throw new HttpsError('failed-precondition', 'No había jugadores válidos para invitar.');

  await batch.commit();

  await sendPushToUsers(
    notifiedIds,
    {
      title: `${fromName} te invitó a jugar`,
      body: messageText || `${match.title ?? 'Partido'} · Tocá para ver y anotarte`,
      type: 'match_invite',
      link: `/matches/${matchId}`,
      extraData: { matchId },
    },
    'MatchInviteMessage',
  ).catch(() => {});

  return { ok: true, sent };
});

/**
 * Envía un mensaje directo a otro jugador (de tu grupo o de otro grupo),
 * opcionalmente adjuntando un partido para que se anote directo.
 */
export const sendPlayerMessage = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const toUid = String(request.data?.toUid ?? '').trim();
  const text = String(request.data?.text ?? '').trim();
  const matchId = typeof request.data?.matchId === 'string' ? request.data.matchId.trim() : '';

  if (!toUid || toUid.includes('/') || toUid === uid) {
    throw new HttpsError('invalid-argument', 'Destinatario inválido.');
  }
  if (!text || text.length > 500) {
    throw new HttpsError('invalid-argument', 'El mensaje debe tener entre 1 y 500 caracteres.');
  }

  const db = admin.firestore();
  const [senderPlayerSnap, senderUserSnap, matchSnap] = await Promise.all([
    db.collection('players').doc(uid).get(),
    db.collection('users').doc(uid).get(),
    matchId && !matchId.includes('/') ? db.collection('matches').doc(matchId).get() : Promise.resolve(null),
  ]);

  const senderPlayer = senderPlayerSnap.data() ?? {};
  const senderUser = senderUserSnap.data() ?? {};
  const fromName = String(
    senderPlayer.name ?? senderPlayer.displayName ?? senderUser.displayName ?? 'Un jugador',
  );
  const fromPhotoUrl = String(
    senderPlayer.photoURL ?? senderPlayer.photoUrl ?? senderUser.photoURL ?? '',
  );

  let matchPayload: Record<string, string> = {};
  if (matchSnap && matchSnap.exists) {
    const m = matchSnap.data()!;
    const locName = typeof m.location === 'object' && m.location
      ? String(m.location.name ?? m.location.address ?? '')
      : String(m.location ?? '');
    matchPayload = {
      matchId: matchSnap.id,
      matchTitle: String(m.title ?? ''),
      matchDate: String(m.date ?? ''),
      matchTime: String(m.time ?? ''),
      matchLocation: locName,
    };
  }

  const now = new Date().toISOString();
  const msgRef = db.collection(`users/${toUid}/messages`).doc();
  await msgRef.set({
    type: matchPayload.matchId ? 'match_invite' : 'direct_message',
    fromUid: uid,
    fromName,
    fromPhotoUrl,
    text,
    ...matchPayload,
    isRead: false,
    createdAt: now,
  });

  await sendPushToUsers(
    [toUid],
    {
      title: `Mensaje de ${fromName}`,
      body: text,
      type: 'player_message',
      link: matchPayload.matchId ? `/matches/${matchPayload.matchId}` : '/messages',
      extraData: matchPayload.matchId ? { matchId: matchPayload.matchId } : {},
    },
    'PlayerMessage',
  ).catch(() => {});

  return { ok: true, messageId: msgRef.id };
});
