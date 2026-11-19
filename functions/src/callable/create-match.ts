import { generateBalancedTeamsCore } from './generate-balanced-teams';
import { buildMatchDateTime } from '../lib/match-date';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Callable equivalente a src/app/api/matches/create/route.ts (web) para los
 * tipos 'manual' y 'collaborative'. Existe porque firestore.rules tiene
 * `allow create: if false` en /matches/{matchId} a propósito — la web NUNCA
 * escribe partidos directo desde el cliente, siempre pasa por esa API route
 * (Admin SDK).
 *
 * Soporta los tres tipos de amistoso: 'manual' (los equipos los arma la IA
 * después), 'collaborative' (arranca vacío y la gente se anota) y 'by_teams'
 * (dos equipos ya armados del grupo, que se resuelven acá desde `teams/`).
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
    if (!Number.isInteger(matchSize) || matchSize < 2 || matchSize > 100) {
      throw new HttpsError('invalid-argument', 'matchSize inválido.');
    }
    if (type !== 'manual' && type !== 'collaborative' && type !== 'by_teams') {
      throw new HttpsError('invalid-argument', `Tipo de partido desconocido: ${type}`);
    }

    // Pronóstico del día del partido.
    //
    // La API route de la web (src/app/api/matches/create/route.ts:28) recorta
    // el pronóstico a {description, icon, temperature} y descarta lluvia,
    // viento y UV — que es justo lo que mira MatchWeatherAlert, así que allá
    // esa alerta casi nunca puede dispararse. Acá se guarda entero: es un
    // superset, la web sigue leyendo los tres campos que espera.
    const rawWeather = data.weather;
    const weather = rawWeather && typeof rawWeather === 'object'
      ? {
          description: String(rawWeather.description ?? ''),
          icon: String(rawWeather.icon ?? ''),
          temperature: Number(rawWeather.temperature ?? 0),
          feelsLike: Number(rawWeather.feelsLike ?? 0),
          humidity: Number(rawWeather.humidity ?? 0),
          windSpeed: Number(rawWeather.windSpeed ?? 0),
          precipitation: Number(rawWeather.precipitation ?? 0),
          uvIndex: Number(rawWeather.uvIndex ?? 0),
        }
      : null;

    const selectedTeams: string[] = Array.isArray(data.selectedTeams)
      ? data.selectedTeams.filter((t: unknown): t is string => typeof t === 'string' && !!t)
      : [];
    if (type === 'by_teams' && (selectedTeams.length !== 2 || new Set(selectedTeams).size !== 2 || selectedTeams.some(id => id.includes('/')))) {
      throw new HttpsError('invalid-argument', 'Un partido por equipos necesita exactamente dos equipos.');
    }

    const date = typeof data.date === 'string' ? data.date : '';
    const time = typeof data.time === 'string' ? data.time : '';
    const locationName = typeof data.locationName === 'string' ? data.locationName : '';
    const locationAddress = typeof data.locationAddress === 'string' ? data.locationAddress : '';
    const locationLat = Number(data.locationLat ?? 0) || 0;
    const locationLng = Number(data.locationLng ?? 0) || 0;
    const locationPlaceId = typeof data.locationPlaceId === 'string' ? data.locationPlaceId : '';
    const isPlanning = !date && !time;
    if (!isPlanning && (!date || !time || !buildMatchDateTime(date, time))) {
      throw new HttpsError('invalid-argument', 'Elegí una fecha y hora válidas, o dejá ambas por definir.');
    }
    if (!isPlanning && buildMatchDateTime(date, time)!.getTime() < Date.now() - 60000) {
      throw new HttpsError('invalid-argument', 'El horario del partido ya pasó.');
    }

    const db = admin.firestore();

    const userSnap = await db.doc(`users/${uid}`).get();
    const groupId = (userSnap.data()?.activeGroupId as string | undefined) ?? null;

    if (groupId) {
      const group = (await db.doc(`groups/${groupId}`).get()).data();
      if (!group || (group.ownerUid !== uid && !group.members?.includes(uid))) {
        throw new HttpsError('permission-denied', 'No pertenecés al grupo activo. Elegí un grupo válido.');
      }
    }
    // Sólo IDs del cliente: atributos, fotos y equipos se resuelven en servidor.
    let players: Array<Record<string, any>> = [];
    let playerUids: string[] = [];
    let teams: Array<Record<string, any>> = [];
    let teamCreators: string[] = [];
    const canonicalPlayer = (id: string, p: Record<string, any>) => ({
      uid: id, displayName: String(p.name ?? p.displayName ?? 'Jugador'),
      ovr: Number(p.ovr ?? 50), position: String(p.position ?? 'MED'),
      photoURL: String(p.photoUrl ?? p.photoURL ?? ''),
    });
    if (type === 'manual') {
      const ids: unknown[] = Array.isArray(data.playerUids) && data.playerUids.length
        ? data.playerUids : (Array.isArray(data.players) ? data.players.map((p: any) => p?.uid) : []);
      if (ids.some(id => typeof id !== 'string' || !id || id.includes('/')) ||
          new Set(ids).size !== ids.length || ids.length < Math.ceil(matchSize / 2) || ids.length > matchSize) {
        throw new HttpsError('invalid-argument', 'Elegí un plantel sin repetidos, entre medio cupo y el cupo completo.');
      }
      const docs = await db.getAll(...(ids as string[]).map(id => db.doc(`players/${id}`)));
      for (const doc of docs) {
        const player = doc.data();
        if (!player) throw new HttpsError('not-found', 'Un jugador seleccionado ya no existe. Actualizá el plantel.');
        if (player.ownerUid !== uid && doc.id !== uid && (!groupId || player.groupId !== groupId)) {
          throw new HttpsError('permission-denied', 'Seleccioná jugadores de tu grupo.');
        }
        players.push(canonicalPlayer(doc.id, player));
      }
      playerUids = players.map(p => p.uid);
      if (players.length === matchSize) teams = (await generateBalancedTeamsCore(players as any, 2)).teams;
    }

    if (type === 'by_teams') {
      // Los planteles NO se toman de lo que mande el cliente: se resuelven acá
      // desde `teams/` y `players/`, igual que hace la API route de la web
      // (src/app/api/matches/create/route.ts:195).
      const teamSnaps = await db.getAll(...selectedTeams.map((id) => db.doc(`teams/${id}`)));

      const teamDocs: Record<string, any>[] = teamSnaps.map((snap) => {
        if (!snap.exists) {
          throw new HttpsError('not-found', 'Alguno de los equipos elegidos ya no existe.');
        }
        return { id: snap.id, ...(snap.data() as Record<string, any>) };
      });

      for (const td of teamDocs) {
        if (!groupId || td.groupId !== groupId) {
          throw new HttpsError('permission-denied', 'Los equipos tienen que ser del mismo grupo.');
        }
      }

      const memberIds = Array.from(
        new Set(
          teamDocs.flatMap((td) =>
            ((td.members ?? []) as Record<string, any>[])
              .map((m) => String(m.playerId ?? ''))
              .filter(Boolean)
          )
        )
      );

      const playerDocs = memberIds.length
        ? await db.getAll(...memberIds.map((id) => db.doc(`players/${id}`)))
        : [];
      const playersById = new Map<string, Record<string, any>>();
      for (const d of playerDocs) {
        if (d.exists) playersById.set(d.id, d.data() as Record<string, any>);
      }

      if (playerDocs.some(doc => !doc.exists)) {
        throw new HttpsError('failed-precondition', 'Un equipo tiene jugadores sin perfil. Revisá sus planteles.');
      }
      const assigned = new Set<string>();
      teams = teamDocs.map(td => {
        const teamPlayers: Array<Record<string, any>> = [];
        for (const member of (Array.isArray(td.members) ? td.members : [])) {
          const id = String(member.playerId ?? '');
          if (!id || assigned.has(id)) continue;
          const profile = playersById.get(id);
          if (!profile) throw new HttpsError('failed-precondition', 'Falta un jugador del equipo.');
          assigned.add(id);
          teamPlayers.push(canonicalPlayer(id, profile));
        }
        const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
        return { teamId: td.id, score: 0, name: td.name ?? 'Equipo', jersey: td.jersey ?? null,
          players: teamPlayers, totalOVR, averageOVR: teamPlayers.length ? totalOVR / teamPlayers.length : 0 };
      });
      if (teams.some(team => team.players.length === 0)) throw new HttpsError('failed-precondition', 'Cada equipo necesita un plantel propio. Revisá jugadores compartidos.');
      players = teams.flatMap(t => t.players);
      if (players.length > matchSize) throw new HttpsError('failed-precondition', 'Los planteles superan el cupo del partido. Aumentá el tamaño o ajustá los equipos.');

      playerUids = players.map((p: Record<string, any>) => p.uid);
      teamCreators = teamDocs
        .map((td) => td.createdBy)
        .filter((id): id is string => typeof id === 'string' && !!id);
    }

    const matchData = {
      title,
      type,
      date,
      time,
      status: isPlanning ? 'planning' : 'upcoming',
      matchSize,
      // Un partido público aparece en "Partidos Abiertos" para gente de
      // otros grupos. Estaba hardcodeado en false, así que el switch del
      // asistente no hacía nada y ningún partido creado desde la app podía
      // encontrarse desde afuera.
      isPublic: data.isPublic === true,
      ownerUid: uid, // nunca confiar en un ownerUid que mande el cliente
      // En un partido entre equipos los responsables de cada equipo lo gestionan
      // (el DT puede no jugar). Se toman de los equipos, no del cliente.
      ...(type === 'by_teams'
        ? { captains: [...new Set([uid, ...teamCreators])] }
        : {}),
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
      teamsGenerated: teams.length === 2,
      ...(type === 'by_teams'
        ? { participantTeamIds: selectedTeams, participantGroupIds: groupId ? [groupId] : [] }
        : {}),
      ...(weather ? { weather } : {}),
      events: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(isPlanning ? { isVotingOpen: true, dateProposals: [] } : {}),
    };

    const requestId = data.requestId;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(requestId))) {
      throw new HttpsError('invalid-argument', 'Identificador de creación inválido.');
    }
    const ref = requestId ? db.collection('matches').doc(`${uid}_${requestId}`) : db.collection('matches').doc();
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.ownerUid !== uid) throw new HttpsError('permission-denied', 'No podés reutilizar esta creación.');
        return;
      }
      tx.create(ref, matchData);
    });
    return { matchId: ref.id };
  }
);
