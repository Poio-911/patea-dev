import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  ACHIEVEMENTS,
  emptyProgress,
  matchOutcomeFor,
  newlyEarned,
  type AchievementProgress,
} from '../lib/achievements';
import { notifyUsers } from '../lib/notify-users';

/**
 * Cuenta lo que hace falta para los logros de una persona. Todo con conteos y
 * una sola lectura de sus partidos, sin recorrer colecciones enteras.
 */
async function loadProgress(db: admin.firestore.Firestore, uid: string): Promise<AchievementProgress> {
  const progress = emptyProgress();

  const [playerSnap, followers, organized, matches, leagues, cups] = await Promise.all([
    db.doc(`players/${uid}`).get(),
    db.collection('follows').where('followingId', '==', uid).count().get(),
    db.collection('matches').where('ownerUid', '==', uid).count().get(),
    db
      .collection('matches')
      .where('playerUids', 'array-contains', uid)
      .where('status', 'in', ['completed', 'evaluated'])
      .get(),
    db.collection('leagues').where('championTeamId', '!=', null).select('championTeamId').get(),
    db.collection('cups').where('championTeamId', '!=', null).select('championTeamId').get(),
  ]);

  const player = playerSnap.data() ?? {};
  progress.goals = Number(player.stats?.goals ?? 0);
  progress.matches = Number(player.stats?.matchesPlayed ?? 0);
  progress.ovr = Number(player.ovr ?? 0);
  progress.followers = followers.data().count;
  progress.organized = organized.data().count;

  for (const doc of matches.docs) {
    const { won, goals } = matchOutcomeFor(doc.data(), uid);
    if (won) progress.wins++;
    progress.goals_in_match = Math.max(progress.goals_in_match, goals);
  }

  // Campeonatos: solo los equipos que ganaron algo, y si la persona estaba en alguno.
  const champions = new Set<string>();
  for (const doc of [...leagues.docs, ...cups.docs]) {
    const id = doc.data().championTeamId;
    if (typeof id === 'string' && id) champions.add(id);
  }
  if (champions.size > 0) {
    const refs = [...champions].map((id) => db.doc(`groupTeams/${id}`));
    const teams = await db.getAll(...refs);
    const titles = new Map<string, boolean>();
    for (const t of teams) {
      titles.set(t.id, (t.data()?.members ?? []).some((m: any) => m?.playerId === uid));
    }
    for (const doc of [...leagues.docs, ...cups.docs]) {
      if (titles.get(doc.data().championTeamId)) progress.champion++;
    }
  }
  return progress;
}

/**
 * Sincroniza los logros de quien llama: calcula el progreso, desbloquea los que
 * ya se cumplen (una sola vez cada uno) y devuelve la lista completa con su
 * avance. La app la llama al abrir «Logros». Idempotente.
 */
export const syncAchievements = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;
  const db = admin.firestore();

  const player = await db.doc(`players/${uid}`).get();
  if (!player.exists) throw new HttpsError('failed-precondition', 'No se encontró tu ficha de jugador.');

  const [progress, existing] = await Promise.all([
    loadProgress(db, uid),
    db.collection('playerAchievements').where('playerId', '==', uid).get(),
  ]);

  const unlockedAt = new Map<string, string>();
  for (const doc of existing.docs) {
    const d = doc.data();
    if (typeof d.achievementId === 'string') unlockedAt.set(d.achievementId, String(d.unlockedAt ?? ''));
  }

  const earned = newlyEarned(progress, new Set(unlockedAt.keys()));
  if (earned.length > 0) {
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const a of earned) {
      // El id fijo evita duplicados si dos llamadas corren a la vez.
      batch.set(db.doc(`playerAchievements/${uid}_${a.id}`), {
        achievementId: a.id,
        playerId: uid,
        userId: uid,
        unlockedAt: now,
      });
      unlockedAt.set(a.id, now);
    }
    await batch.commit();

    // Un solo aviso, aunque se hayan juntado varios (la primera vez puede ser un montón).
    const message =
      earned.length === 1
        ? `Conseguiste «${earned[0].name}».`
        : `Conseguiste ${earned.length} logros: ${earned.map((a) => a.name).join(', ')}.`;
    await notifyUsers(
      db,
      [uid],
      {
        type: 'achievement_unlocked',
        title: earned.length === 1 ? '¡Logro desbloqueado!' : '¡Logros desbloqueados!',
        message,
        link: '/achievements',
        metadata: { achievementId: earned[0].id },
      },
      'achievements',
    ).catch(() => undefined); // El aviso no debe tirar abajo el desbloqueo.
  }

  return {
    newlyUnlocked: earned.map((a) => a.id),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      required: a.requirement.count,
      current: Math.min(progress[a.requirement.type], a.requirement.count),
      unlockedAt: unlockedAt.get(a.id) ?? null,
    })),
  };
});
