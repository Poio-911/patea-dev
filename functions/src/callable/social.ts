import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const ALLOWED_REACTIONS = ['⚽', '🔥', '👏', '💪', '😂', '🎯'] as const;
export type SocialReactionKey = (typeof ALLOWED_REACTIONS)[number];

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

export function normalizePollInput(raw: unknown): {
  question: string;
  options: Array<{ id: string; text: string }>;
  votes: Record<string, string>;
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const question = typeof obj.question === 'string' ? obj.question.trim() : '';
  if (question.length < 3 || question.length > 160) return null;
  const rawOptions = Array.isArray(obj.options) ? obj.options : [];
  const options = rawOptions
    .map((o, idx) => {
      const text = typeof o === 'string'
        ? o.trim()
        : typeof (o as any)?.text === 'string'
          ? String((o as any).text).trim()
          : '';
      return { id: `opt_${idx + 1}`, text: text.slice(0, 80) };
    })
    .filter((o) => o.text.length > 0)
    .slice(0, 4);
  if (options.length < 2) return null;
  return { question, options, votes: {} };
}

export async function publishSocialActivity(
  db: admin.firestore.Firestore,
  payload: Record<string, unknown>,
  deterministicId?: string,
): Promise<string> {
  const now = new Date().toISOString();
  const col = db.collection('socialActivities');
  const ref = deterministicId ? col.doc(deterministicId) : col.doc();
  await ref.set(
    {
      ...payload,
      id: ref.id,
      reactions: payload.reactions ?? {},
      likes: payload.likes ?? [],
      commentCount: payload.commentCount ?? 0,
      createdAt: payload.createdAt ?? now,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return ref.id;
}

/**
 * Crea una publicación en Comunidad Pateá (con texto, foto opcional, partido
 * etiquetado opcional y encuesta rápida opcional).
 */
export const createSocialPost = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const text = typeof request.data?.text === 'string' ? request.data.text.trim().slice(0, 1000) : '';
  const imageUrl = typeof request.data?.imageUrl === 'string' ? request.data.imageUrl.trim() : '';
  const matchId = typeof request.data?.matchId === 'string' ? request.data.matchId.trim() : '';
  const poll = normalizePollInput(request.data?.poll);

  if (!text && !imageUrl && !poll && !matchId) {
    throw new HttpsError('invalid-argument', 'Agregá un texto, una foto o una encuesta para publicar.');
  }

  const db = admin.firestore();
  const [playerSnap, userSnap, matchSnap] = await Promise.all([
    db.collection('players').doc(uid).get(),
    db.collection('users').doc(uid).get(),
    matchId && !matchId.includes('/') ? db.collection('matches').doc(matchId).get() : Promise.resolve(null),
  ]);

  const player = playerSnap.data() ?? {};
  const user = userSnap.data() ?? {};
  const playerName = String(player.name ?? player.displayName ?? user.displayName ?? 'Jugador');
  const playerPhotoUrl = String(player.photoURL ?? player.photoUrl ?? user.photoURL ?? '');
  const playerPosition = String(player.position ?? '');
  const playerOvr = Number(player.ovr ?? 0) || 0;
  const requestedGroupId = typeof request.data?.groupId === 'string' ? request.data.groupId.trim() : '';
  const groupId = requestedGroupId || String(user.activeGroupId ?? player.groupId ?? '');

  let metadata: Record<string, unknown> = {};
  if (matchSnap && matchSnap.exists) {
    const m = matchSnap.data()!;
    const locName = typeof m.location === 'object' && m.location
      ? String(m.location.name ?? m.location.address ?? '')
      : String(m.location ?? '');
    const teams = Array.isArray(m.teams) ? m.teams : [];
    const teamA = teams[0] ? { name: String(teams[0].name ?? 'Equipo 1'), score: Number(teams[0].score ?? 0) } : null;
    const teamB = teams[1] ? { name: String(teams[1].name ?? 'Equipo 2'), score: Number(teams[1].score ?? 0) } : null;
    metadata = {
      matchId: matchSnap.id,
      matchTitle: String(m.title ?? 'Partido'),
      matchDate: String(m.date ?? ''),
      matchLocation: locName,
      ...(teamA && teamB ? { teamAName: teamA.name, teamAScore: teamA.score, teamBName: teamB.name, teamBScore: teamB.score } : {}),
    };
  }

  const postId = await publishSocialActivity(db, {
    type: matchId ? 'match_moment' : 'user_post',
    userId: uid,
    playerId: uid,
    playerName,
    playerPhotoUrl,
    playerPosition,
    playerOvr,
    groupId,
    text,
    ...(imageUrl ? { imageUrl } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(poll ? { poll } : {}),
  });

  return { ok: true, postId };
});

/**
 * Da o quita una reacción ('⚽' | '🔥' | '👏' | '💪' | '😂' | '🎯') a una publicación.
 */
export const toggleSocialReaction = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const activityId = String(request.data?.activityId ?? '').trim();
  const reaction = String(request.data?.reaction ?? '🔥').trim() as SocialReactionKey;

  if (!activityId || activityId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Publicación inválida.');
  }
  if (!(ALLOWED_REACTIONS as readonly string[]).includes(reaction)) {
    throw new HttpsError('invalid-argument', 'Reacción no válida.');
  }

  const db = admin.firestore();
  const ref = db.collection('socialActivities').doc(activityId);

  let added = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'La publicación ya no existe.');
    const data = snap.data()!;
    const rawReactions = (data.reactions && typeof data.reactions === 'object')
      ? { ...(data.reactions as Record<string, string[]>) }
      : {};
    const currentList = Array.isArray(rawReactions[reaction]) ? [...rawReactions[reaction]] : [];

    if (currentList.includes(uid)) {
      rawReactions[reaction] = currentList.filter((id) => id !== uid);
      added = false;
    } else {
      rawReactions[reaction] = [...currentList, uid];
      added = true;
    }

    const allReactors = new Set<string>();
    Object.values(rawReactions).forEach((arr) => {
      if (Array.isArray(arr)) arr.forEach((u) => allReactors.add(u));
    });

    tx.update(ref, {
      reactions: rawReactions,
      likes: [...allReactors],
    });
  });

  return { ok: true, added };
});

/** Vota en la encuesta rápida de una publicación. */
export const voteSocialPoll = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const activityId = String(request.data?.activityId ?? '').trim();
  const optionId = String(request.data?.optionId ?? '').trim();
  if (!activityId || !optionId) {
    throw new HttpsError('invalid-argument', 'Faltan datos para votar.');
  }

  const db = admin.firestore();
  const ref = db.collection('socialActivities').doc(activityId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'La publicación no existe.');
    const data = snap.data()!;
    const poll = data.poll as { options?: Array<{ id: string }>; votes?: Record<string, string> } | undefined;
    if (!poll || !Array.isArray(poll.options)) {
      throw new HttpsError('failed-precondition', 'Esta publicación no tiene encuesta.');
    }
    if (!poll.options.some((o) => o.id === optionId)) {
      throw new HttpsError('invalid-argument', 'Opción de encuesta inválida.');
    }
    const nextVotes = { ...(poll.votes ?? {}), [uid]: optionId };
    tx.update(ref, { 'poll.votes': nextVotes });
  });

  return { ok: true, optionId };
});

/** Agrega un comentario a una publicación e incrementa `commentCount`. */
export const addSocialComment = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const activityId = String(request.data?.activityId ?? '').trim();
  const text = String(request.data?.text ?? '').trim();

  if (!activityId || activityId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Publicación inválida.');
  }
  if (!text || text.length > 500) {
    throw new HttpsError('invalid-argument', 'El comentario debe tener entre 1 y 500 caracteres.');
  }

  const db = admin.firestore();
  const actRef = db.collection('socialActivities').doc(activityId);
  const [actSnap, playerSnap, userSnap] = await Promise.all([
    actRef.get(),
    db.collection('players').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (!actSnap.exists) throw new HttpsError('not-found', 'La publicación no existe.');

  const player = playerSnap.data() ?? {};
  const user = userSnap.data() ?? {};
  const userName = String(player.name ?? player.displayName ?? user.displayName ?? 'Jugador');
  const userPhotoUrl = String(player.photoURL ?? player.photoUrl ?? user.photoURL ?? '');
  const now = new Date().toISOString();

  const commentRef = actRef.collection('comments').doc();
  const batch = db.batch();
  batch.set(commentRef, {
    id: commentRef.id,
    activityId,
    userId: uid,
    userName,
    userPhotoUrl,
    text,
    likes: [],
    createdAt: now,
  });
  batch.update(actRef, {
    commentCount: admin.firestore.FieldValue.increment(1),
  });
  await batch.commit();

  return { ok: true, commentId: commentRef.id };
});

/** Elimina una publicación propia. */
export const deleteSocialPost = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const activityId = String(request.data?.activityId ?? '').trim();
  if (!activityId || activityId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Publicación inválida.');
  }

  const db = admin.firestore();
  const ref = db.collection('socialActivities').doc(activityId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const data = snap.data()!;
  if (data.userId !== uid && data.playerId !== uid) {
    throw new HttpsError('permission-denied', 'Solo el autor puede borrar esta publicación.');
  }
  await ref.delete();
  return { ok: true };
});

/** Sigue o deja de seguir a un jugador (de tu grupo o de otro grupo). */
export const toggleFollowUser = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const targetUid = String(request.data?.targetUid ?? '').trim();
  if (!targetUid || targetUid.includes('/') || targetUid === uid) {
    throw new HttpsError('invalid-argument', 'Usuario inválido.');
  }

  const db = admin.firestore();
  const followId = `${uid}_${targetUid}`;
  const ref = db.collection('follows').doc(followId);

  let following = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.delete(ref);
      following = false;
    } else {
      tx.set(ref, {
        followerId: uid,
        followingId: targetUid,
        createdAt: new Date().toISOString(),
      });
      following = true;
    }
  });

  return { ok: true, following };
});

/**
 * Busca jugadores reales (con cuenta) de cualquier grupo para descubrir y seguir.
 */
export const searchSocialPlayers = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const query = typeof request.data?.query === 'string' ? request.data.query.trim().toLowerCase() : '';

  const db = admin.firestore();
  const [playersSnap, followsSnap] = await Promise.all([
    db.collection('players').orderBy('ovr', 'desc').limit(120).get(),
    db.collection('follows').where('followerId', '==', uid).get(),
  ]);

  const followingSet = new Set(followsSnap.docs.map((d) => String(d.data().followingId ?? '')));

  const players = playersSnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        ownerUid: String(d.ownerUid ?? ''),
        name: String(d.name ?? d.displayName ?? 'Jugador'),
        photoUrl: String(d.photoURL ?? d.photoUrl ?? ''),
        position: String(d.position ?? 'MED'),
        ovr: Number(d.ovr ?? 50) || 50,
        groupId: String(d.groupId ?? ''),
        isFollowing: followingSet.has(doc.id),
      };
    })
    .filter((p) => {
      // Solo jugadores con cuenta propia (no creados manualmente para terceros)
      if (p.uid === uid) return false;
      if (p.ownerUid && p.ownerUid !== p.uid) return false;
      if (!query) return true;
      return p.name.toLowerCase().includes(query) || p.position.toLowerCase().includes(query);
    })
    .slice(0, 35);

  return { ok: true, players };
});
