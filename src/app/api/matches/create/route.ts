import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import type { Player, GroupTeam, Team, MatchType, MatchLocation, Notification } from '@/lib/types';
import { createActivityAction } from '@/lib/actions/server-actions';

const LocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(5),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().min(1),
});

const BaseMatchSchema = z.object({
  title: z.string().min(3),
  date: z.string().min(10), // ISO string
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  location: LocationSchema,
  type: z.enum(['manual', 'collaborative', 'by_teams']),
  matchSize: z.number().int().min(2),
  isPublic: z.boolean().optional(),
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

    const baseData: any = {
      title: input.title,
      date: input.date,
      time: input.time,
      location: input.location,
      type: input.type as MatchType,
      matchSize: input.matchSize,
      isPublic: !!input.isPublic,
      status: 'upcoming' as const,
      ownerUid: userId,
      groupId,
      players: [],
      playerUids: [],
      teams: [],
    };
    if (input.weather) baseData.weather = input.weather;

    const db = getAdminDb();

    if (input.type === 'manual') {
      const playerIds = input.players;
      const playersMap = await fetchPlayersChunked(playerIds);
      const selectedPlayers = playerIds
        .map(id => playersMap.get(id))
        .filter((p): p is Player => !!p);
      baseData.players = selectedPlayers.map(p => ({ uid: p.id, displayName: p.name, ovr: p.ovr, position: p.position, photoURL: p.photoURL || '' }));
      baseData.playerUids = selectedPlayers.map(p => p.id);

      if (selectedPlayers.length === input.matchSize) {
        try {
          const { generateBalancedTeams } = await import('@/ai/flows/generate-balanced-teams');
          const teamsResult = await generateBalancedTeams({
            players: selectedPlayers.map(p => ({ uid: p.id, displayName: p.name, position: p.position, ovr: p.ovr })),
            teamCount: 2,
          } as any);
          if ((teamsResult as any)?.teams) {
            baseData.teams = (teamsResult as any).teams as Team[];
          }
        } catch (e) {
          // leave teams empty on failure
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
            photoURL: p?.photoURL || '',
          };
        });
        const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
        const averageOVR = teamPlayers.length ? totalOVR / teamPlayers.length : 0;
        return { name: td.name, jersey: td.jersey, players: teamPlayers, totalOVR, averageOVR } as Team;
      });
      baseData.players = finalTeams.flatMap(t => t.players);
      baseData.playerUids = finalTeams.flatMap(t => t.players.map(p => p.uid));
      baseData.teams = finalTeams;
      baseData.matchSize = finalTeams.reduce((sum, t) => sum + t.players.length, 0);
      baseData.isPublic = false;
    } else if (input.type === 'collaborative') {
      // No players initially, open match
    }

    const matchRef = await db.collection('matches').add(baseData);

    // Fetch organizer to get photo for activity
    const organizerSnap = await db.collection('players').doc(userId).get();
    const organizerData = organizerSnap.data();

    // Create social activity
    await createActivityAction({
      type: 'match_organized',
      userId,
      playerId: userId,
      playerName: organizerData?.name || 'Organizador',
      playerPhotoUrl: organizerData?.photoURL || '',
      timestamp: new Date().toISOString(),
      metadata: {
        matchId: matchRef.id,
        matchTitle: baseData.title,
      },
    } as any);

    // Check achievements for organizer
    try {
      const { checkAndUnlockAchievementsAction } = await import('@/lib/actions/achievement-actions');
      await checkAndUnlockAchievementsAction(userId, userId);
    } catch (achievementError) {
      console.warn('Failed to check achievements after match creation', achievementError);
    }

    // Notifications for participants (manual|by_teams)
    if (baseData.playerUids?.length) {
      await Promise.all(
        baseData.playerUids
          .filter((pid: string) => pid !== userId)
          .map(async (pid: string) => {
            const notif: Omit<Notification, 'id'> = {
              type: 'match_invite',
              title: '¡Te convocaron!',
              message: `Te sumaron al partido "${baseData.title}"`,
              link: `/matches`,
              isRead: false,
              createdAt: new Date().toISOString(),
              metadata: { fromUserId: userId, matchId: matchRef.id },
            } as any;
            await db.collection(`users/${pid}/notifications`).add(notif);
          })
      );
    }

    return NextResponse.json({ success: true, matchId: matchRef.id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
