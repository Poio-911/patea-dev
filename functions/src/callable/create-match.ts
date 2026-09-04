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
    if (!Number.isInteger(matchSize) || matchSize < 2) {
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
    if (type === 'by_teams' && selectedTeams.length !== 2) {
      throw new HttpsError('invalid-argument', 'Un partido por equipos necesita exactamente dos equipos.');
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

    let players = Array.isArray(data.players) ? data.players : [];
    let playerUids = Array.isArray(data.playerUids) ? data.playerUids : [];
    let teams = Array.isArray(data.teams) ? data.teams : [];

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
        if (groupId && td.groupId && td.groupId !== groupId) {
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

      teams = teamDocs.map((td) => {
        const teamPlayers = ((td.members ?? []) as Record<string, any>[]).map((m) => {
          const p = playersById.get(String(m.playerId));
          return {
            uid: String(m.playerId),
            displayName: p?.name ?? 'Jugador',
            ovr: Number(p?.ovr ?? 50),
            position: String(p?.position ?? 'MED'),
            // Los documentos de jugador tienen el campo escrito de las dos
            // formas según cuándo se crearon.
            photoURL: String(p?.photoUrl ?? p?.photoURL ?? ''),
          };
        });
        const totalOVR = teamPlayers.reduce((sum: number, p) => sum + p.ovr, 0);
        return {
          name: td.name ?? 'Equipo',
          jersey: td.jersey ?? null,
          players: teamPlayers,
          totalOVR,
          averageOVR: teamPlayers.length ? totalOVR / teamPlayers.length : 0,
        };
      });

      players = teams.flatMap((t: Record<string, any>) => t.players);
      playerUids = players.map((p: Record<string, any>) => p.uid);
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
      ...(type === 'by_teams' ? { participantTeamIds: selectedTeams } : {}),
      ...(weather ? { weather } : {}),
      events: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(isPlanning ? { isVotingOpen: true, dateProposals: [] } : {}),
    };

    const ref = await db.collection('matches').add(matchData);
    return { matchId: ref.id };
  }
);
