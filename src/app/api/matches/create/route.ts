import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import type { Player, GroupTeam, Team, MatchType, MatchLocation, Notification } from '@/lib/types';
import { createActivityAction } from '@/lib/actions/server-actions';
import { sendNotificationToUsersAction } from '@/lib/actions/notification-actions';
import * as geohash from 'ngeohash';
import { rateLimiter } from '@/lib/rate-limiter';

const LocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(5),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().min(1),
});

const BaseMatchSchema = z.object({
  title: z.string().min(3),
  date: z.string().optional().or(z.literal('')),
  time: z.string().optional().or(z.literal('')),
  location: LocationSchema,
  type: z.enum(['manual', 'collaborative', 'by_teams']),
  matchSize: z.number().int().min(2),
  isPublic: z.boolean().optional(),
  isPlanning: z.boolean().optional(),
  weather: z
    .object({
      description: z.string(),
      icon: z.string().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
});

const ManualSchema = BaseMatchSchema.extend({
  type: z.literal('manual'),
  players: z.array(z.string()).min(1),
});

const ByTeamsSchema = BaseMatchSchema.extend({
  type: z.literal('by_teams'),
  selectedTeams: z.array(z.string()).length(2),
});

const CollaborativeSchema = BaseMatchSchema.extend({
  type: z.literal('collaborative'),
});

const CreateMatchSchema = z.discriminatedUnion('type', [ManualSchema, ByTeamsSchema, CollaborativeSchema]);

async function getActiveGroupId(userId: string): Promise<string | null> {
  const snap = await getAdminDb().doc(`users/${userId}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return data?.activeGroupId || null;
}

async function fetchPlayersChunked(ids: string[]): Promise<Map<string, Player>> {
  const db = getAdminDb();
  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(c => db.collection('players').where('__name__', 'in', c).get())
  );
  const map = new Map<string, Player>();
  results.forEach(r => {
    r.docs.forEach(d => map.set(d.id, { id: d.id, ...(d.data() as any) } as Player));
  });
  return map;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    // Rate limiting: max 5 match creations per user per minute
    const rl = rateLimiter.check(`match:${userId}`, 5, 60_000);
    if (!rl.allowed) {
      const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
      );
    }

    const body = await request.json();
    const parse = CreateMatchSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ success: false, error: 'Invalid body', issues: parse.error.issues }, { status: 400 });
    }
    const input = parse.data;

    const groupId = await getActiveGroupId(userId);
    if (!groupId) {
      return NextResponse.json({ success: false, error: 'No active group' }, { status: 400 });
    }

    const isPlanning = input.isPlanning || !input.date || !input.time;

    const baseData: any = {
      title: input.title,
      date: input.date || '',
      time: input.time || '',
      location: {
        ...input.location,
        geohash: geohash.encode(input.location.lat, input.location.lng, 10),
      },
      type: input.type as MatchType,
      matchSize: input.matchSize,
      isPublic: !!input.isPublic,
      status: isPlanning ? 'planning' : 'upcoming',
      ownerUid: userId,
      groupId,
      players: [],
      playerUids: [],
      teams: [],
      ...(isPlanning ? { isVotingOpen: true, dateProposals: [] } : {}),
    };
    if (input.weather) baseData.weather = input.weather;

    const db = getAdminDb();

    if (input.type === 'manual') {
      const playerIds = input.players;
      const playersMap = await fetchPlayersChunked(playerIds);
      const selectedPlayers = playerIds
        .map(id => playersMap.get(id))
        .filter((p): p is Player => !!p);
      baseData.players = selectedPlayers.map(p => ({ uid: p.id, displayName: p.name, ovr: p.ovr, position: p.position, photoURL: (p as any).photoUrl || (p as any).photoURL || '' }));
      baseData.playerUids = selectedPlayers.map(p => p.id);

      if (selectedPlayers.length === input.matchSize) {
        try {
          const { generateBalancedTeams } = await import('@/ai/flows/generate-balanced-teams');
          const teamsResult = await generateBalancedTeams({
            players: selectedPlayers.map(p => ({ uid: p.id, displayName: p.name, position: p.position, ovr: p.ovr })),
            teamCount: 2,
          } as any);
          if ((teamsResult as any)?.teams && (teamsResult as any).teams.length === 2) {
            const aiTeams = (teamsResult as any).teams as Team[];
            // Fix UIDs and enrich with photos (AI returns sequential UIDs)
            aiTeams.forEach(team => {
              team.players.forEach(player => {
                const original = selectedPlayers.find(p => p.name === player.displayName && p.position === player.position)
                  || selectedPlayers.find(p => p.name === player.displayName);
                if (original) {
                  player.uid = original.id;
                  (player as any).photoURL = (original as any).photoUrl || original.photoURL || '';
                }
              });
            });
            baseData.teams = aiTeams;
          } else {
            throw new Error("AI returned invalid or empty teams");
          }
        } catch (e) {
          // Fallback manual: Dividir alfabéticamente si la IA falla
          console.warn("AI team generation failed, using alphabet fallback", e);
          const sortedPlayers = [...selectedPlayers].sort((a, b) => a.name.localeCompare(b.name));
          const mid = Math.ceil(sortedPlayers.length / 2);
          const team1Players = sortedPlayers.slice(0, mid);
          const team2Players = sortedPlayers.slice(mid);

          const mapToTeamPlayer = (p: Player) => ({
            uid: p.id,
            displayName: p.name,
            ovr: p.ovr || 50,
            position: p.position || 'MED',
            photoURL: (p as any).photoUrl || p.photoURL || ''
          });

          baseData.teams = [
            {
              name: "Equipo 1 (Fallback)",
              jersey: "blanca",
              players: team1Players.map(mapToTeamPlayer),
              totalOVR: team1Players.reduce((acc, p) => acc + (p.ovr || 50), 0),
              averageOVR: team1Players.length ? team1Players.reduce((acc, p) => acc + (p.ovr || 50), 0) / team1Players.length : 0
            },
            {
              name: "Equipo 2 (Fallback)",
              jersey: "negra",
              players: team2Players.map(mapToTeamPlayer),
              totalOVR: team2Players.reduce((acc, p) => acc + (p.ovr || 50), 0),
              averageOVR: team2Players.length ? team2Players.reduce((acc, p) => acc + (p.ovr || 50), 0) / team2Players.length : 0
            }
          ];
        }
      }
    } else if (input.type === 'by_teams') {
      const teamsSnap = await Promise.all(input.selectedTeams.map(id => db.doc(`teams/${id}`).get()));
      const teamDocs = teamsSnap.map(s => ({ id: s.id, ...(s.data() as any) })) as GroupTeam[];
      const allPlayerIds = Array.from(new Set(teamDocs.flatMap(t => t.members?.map((m: any) => m.playerId) || [])));
      const playersMap = await fetchPlayersChunked(allPlayerIds);
      const finalTeams: Team[] = teamDocs.map(td => {
        const teamPlayers = (td.members || []).map((m: any) => {
          const p = playersMap.get(m.playerId);
          return {
            uid: m.playerId,
            displayName: p?.name || 'Jugador',
            ovr: p?.ovr || 50,
            position: p?.position || 'MED',
            photoURL: (p as any)?.photoUrl || p?.photoURL || '',
          };
        });
        const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
        const averageOVR = teamPlayers.length ? totalOVR / teamPlayers.length : 0;
        return { name: td.name, jersey: td.jersey, players: teamPlayers, totalOVR, averageOVR } as Team;
      });
      baseData.players = finalTeams.flatMap(t => t.players);
      baseData.playerUids = finalTeams.flatMap(t => t.players.map(p => p.uid));
      baseData.teams = finalTeams;
      baseData.participantTeamIds = input.selectedTeams;
      baseData.matchSize = finalTeams.reduce((sum, t) => sum + t.players.length, 0);
      baseData.isPublic = false;
    } else if (input.type === 'collaborative') {
      // No players initially, open match
    }

    const matchRef = await db.collection('matches').add(baseData);

    // Fetch organizer to get photo for activity
    const organizerSnap = await db.collection('players').doc(userId).get();
    const organizerData = organizerSnap.data();

    // Create social activity (Non-critical, wrapped in try-catch to avoid throwing 500 on failure)
    try {
      await createActivityAction({
        type: 'match_organized',
        userId,
        playerId: userId,
        playerName: organizerData?.name || 'Organizador',
        playerPhotoUrl: organizerData?.photoUrl || organizerData?.photoURL || '',
        timestamp: new Date().toISOString(),
        metadata: {
          matchId: matchRef.id,
          matchTitle: baseData.title,
        },
      } as any);
    } catch (activityError) {
      console.warn('Failed to create match social activity:', activityError);
    }

    // Check achievements for organizer
    try {
      const { checkAndUnlockAchievementsAction } = await import('@/lib/actions/achievement-actions');
      await checkAndUnlockAchievementsAction(userId, userId);
    } catch (achievementError) {
      console.warn('Failed to check achievements after match creation', achievementError);
    }

    return NextResponse.json({ success: true, matchId: matchRef.id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
