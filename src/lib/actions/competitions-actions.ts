'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import {
  createError,
  ErrorCodes,
  handleServerActionError,
  type ErrorResponse,
} from '../errors';
import type {
  GroupTeam,
  Invitation,
  Match,
  MatchLocation,
  Notification,
  TeamAvailabilityPost,
} from '../types';

export async function createTeamAvailabilityPostAction(
  teamId: string,
  userId: string,
  postData: {
    date: string;
    time: string;
    location: MatchLocation;
    description?: string;
  }
) {
  try {
    const teamSnap = await getAdminDb().doc(`teams/${teamId}`).get();
    if (!teamSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { teamId });
    }

    const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;
    if (team.createdBy !== userId) {
      throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, { userId, teamId });
    }

    const postRef = getAdminDb().collection('teamAvailabilityPosts').doc();
    const newPost: any = {
      teamId: team.id,
      teamName: team.name,
      jersey: team.jersey,
      date: postData.date,
      time: postData.time,
      location: postData.location,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    if (postData.description) {
      newPost.description = postData.description;
    }

    await postRef.set(newPost);
    return { success: true, postId: postRef.id };
  } catch (error: any) {
    return handleServerActionError(error);
  }
}

export async function getAvailableTeamPostsAction(
  userId: string
): Promise<{ success: boolean; posts: TeamAvailabilityPost[] } | ErrorResponse> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const postsSnapshot = await getAdminDb()
      .collection('teamAvailabilityPosts')
      .where('createdBy', '!=', userId)
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .orderBy('createdBy')
      .get();

    const posts = postsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as TeamAvailabilityPost))
      .filter((post) => {
        const isActive = !post.status || post.status === 'active';
        const postDateTime = new Date(`${post.date}T${post.time}`);
        const isValidTime = postDateTime > new Date();
        return isActive && isValidTime;
      });

    return { success: true, posts };
  } catch (error: any) {
    return handleServerActionError(error, { userId });
  }
}

export async function getUserTeamPostsAction(userId: string) {
  try {
    const postsSnapshot = await getAdminDb()
      .collection('teamAvailabilityPosts')
      .where('createdBy', '==', userId)
      .orderBy('date', 'asc')
      .get();

    const posts = postsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as TeamAvailabilityPost)
    );

    return { success: true, posts };
  } catch (error: any) {
    return handleServerActionError(error);
  }
}

export async function challengeTeamPostAction(
  postId: string,
  challengingTeamId: string,
  challengerUserId: string
) {
  try {
    const batch = getAdminDb().batch();

    const [postSnap, challengingTeamSnap] = await Promise.all([
      getAdminDb().doc(`teamAvailabilityPosts/${postId}`).get(),
      getAdminDb().doc(`teams/${challengingTeamId}`).get(),
    ]);

    if (!postSnap.exists || !challengingTeamSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { postId, challengingTeamId });
    }

    const post = { id: postSnap.id, ...postSnap.data() } as TeamAvailabilityPost;
    const challengingTeam = {
      id: challengingTeamSnap.id,
      ...challengingTeamSnap.data(),
    } as GroupTeam;

    const challengedTeamSnap = await getAdminDb().doc(`teams/${post.teamId}`).get();
    if (!challengedTeamSnap.exists) throw new Error('El equipo desafiado no existe.');
    const challengedTeam = {
      id: challengedTeamSnap.id,
      ...challengedTeamSnap.data(),
    } as GroupTeam;

    const invitationRef = getAdminDb().collection(`teams/${post.teamId}/invitations`).doc();
    const newInvitation: Omit<Invitation, 'id'> = {
      type: 'team_challenge',
      fromTeamId: challengingTeam.id,
      fromTeamName: challengingTeam.name,
      fromTeamJersey: challengingTeam.jersey,
      toTeamId: challengedTeam.id,
      toTeamName: challengedTeam.name,
      toTeamJersey: challengedTeam.jersey,
      postId: post.id,
      status: 'pending',
      createdBy: challengerUserId,
      createdAt: new Date().toISOString(),
    };
    batch.set(invitationRef, newInvitation);

    const notificationRef = getAdminDb().collection(`users/${challengedTeam.createdBy}/notifications`).doc();
    const notification: Omit<Notification, 'id'> = {
      type: 'match_invite',
      title: '¡Desafío Recibido!',
      message: `El equipo "${challengingTeam.name}" quiere aceptar tu postulación.`,
      link: '/competitions/challenges',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    batch.set(notificationRef, notification);

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return handleServerActionError(error);
  }
}

export async function acceptTeamChallengeAction(
  invitationId: string,
  teamId: string,
  userId: string
): Promise<{ success: boolean; matchId: string } | ErrorResponse> {
  try {
    const result = await getAdminDb().runTransaction(async (transaction) => {
      const invitationRef = getAdminDb().doc(`teams/${teamId}/invitations/${invitationId}`);
      const invitationSnap = await transaction.get(invitationRef);

      if (!invitationSnap.exists || invitationSnap.data()?.status !== 'pending') {
        throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: 'Invitation not found or already processed.' });
      }

      const invitation = invitationSnap.data() as Invitation;
      const team1Ref = getAdminDb().doc(`teams/${invitation.toTeamId}`);
      const team2Ref = getAdminDb().doc(`teams/${invitation.fromTeamId}`);
      const [team1Snap, team2Snap] = await Promise.all([transaction.get(team1Ref), transaction.get(team2Ref)]);

      if (!team1Snap.exists || !team2Snap.exists) {
        throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: 'One of the teams does not exist.' });
      }

      const team1Data = { id: team1Snap.id, ...team1Snap.data() } as GroupTeam;
      const team2Data = { id: team2Snap.id, ...team2Snap.data() } as GroupTeam;

      if (team1Data.createdBy !== userId) {
        throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
      }

      const allPlayerIds = new Set<string>();
      (team1Data.members || []).forEach((m: any) => allPlayerIds.add(m.playerId));
      (team2Data.members || []).forEach((m: any) => allPlayerIds.add(m.playerId));

      const playersArr = Array.from(allPlayerIds);
      const playersMap = new Map<string, any>();
      const chunkSize = 10;
      for (let i = 0; i < playersArr.length; i += chunkSize) {
        const chunk = playersArr.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          const pSnaps = await getAdminDb().collection('players').where('__name__', 'in', chunk).get();
          pSnaps.forEach((doc) => playersMap.set(doc.id, { id: doc.id, ...doc.data() }));
        }
      }

      const buildTeam = (td: GroupTeam) => {
        const teamPlayers = (td.members || []).map((m: any) => {
          const p = playersMap.get(m.playerId);
          const photo = p?.photoURL || p?.photoUrl || '';
          return {
            uid: m.playerId,
            displayName: p?.name || 'Jugador',
            ovr: p?.ovr || 50,
            position: p?.position || 'MED',
            photoURL: photo,
          };
        });
        const totalOVR = teamPlayers.reduce((sum: number, p: any) => sum + p.ovr, 0);
        const avgOVR = teamPlayers.length ? Math.round(totalOVR / teamPlayers.length) : 0;
        return {
          name: td.name,
          jersey: td.jersey,
          players: teamPlayers,
          totalOVR,
          averageOVR: avgOVR,
        };
      };

      const finalTeam1 = buildTeam(team1Data);
      const finalTeam2 = buildTeam(team2Data);
      const finalTeams = [finalTeam1, finalTeam2];
      const finalPlayers = finalTeams.flatMap((t) => t.players);
      const finalPlayerUids = finalPlayers.map((p) => p.uid);

      let matchDate: string = new Date().toISOString().split('T')[0];
      let matchTime: string = '19:00';
      let matchLocation: MatchLocation = { name: 'A confirmar', address: '', lat: 0, lng: 0, placeId: '' };

      if (invitation.postId) {
        const postRef = getAdminDb().doc(`teamAvailabilityPosts/${invitation.postId}`);
        const postSnap = await transaction.get(postRef);
        if (postSnap.exists) {
          const postData = postSnap.data() as TeamAvailabilityPost;
          matchDate = postData.date;
          matchTime = postData.time;
          matchLocation = postData.location;
          transaction.update(postRef, { status: 'matched' });
        }
      }

      const cleanTime = (matchTime || '').replace(' hs', '').replace('hs', '').trim();
      const startTimestampStr = `${matchDate}T${cleanTime}`;
      let startTimestamp: string | undefined;
      try {
        const dateObj = new Date(startTimestampStr);
        if (!isNaN(dateObj.getTime())) {
          startTimestamp = dateObj.toISOString();
        }
      } catch (_e) {
        // no-op
      }

      const matchRef = getAdminDb().collection('matches').doc();
      const newMatch: Omit<Match, 'id'> = {
        title: `${team1Data.name} vs ${team2Data.name}`,
        date: matchDate,
        time: matchTime,
        location: matchLocation,
        type: 'intergroup_friendly',
        matchSize: finalPlayers.length > 0 ? finalPlayers.length : 22,
        players: finalPlayers,
        playerUids: finalPlayerUids,
        teams: finalTeams,
        status: 'upcoming',
        ownerUid: team1Data.createdBy,
        groupId: team1Data.groupId,
        participantGroupIds: [team1Data.groupId, team2Data.groupId].filter(Boolean) as string[],
        isPublic: false,
        startTimestamp: startTimestamp || new Date().toISOString(),
        participantTeamIds: [team1Data.id!, team2Data.id!],
        captains: [team1Data.createdBy, team2Data.createdBy],
        createdAt: new Date().toISOString(),
      };

      transaction.set(matchRef, newMatch);
      transaction.update(invitationRef, { status: 'accepted' });

      if (invitation.createdBy) {
        const challengerNotificationRef = getAdminDb().collection(`users/${invitation.createdBy}/notifications`).doc();
        transaction.set(challengerNotificationRef, {
          type: 'challenge_accepted',
          title: '¡Desafío Aceptado!',
          message: `"${team1Data.name}" ha aceptado tu desafío. El partido ha sido creado.`,
          link: `/matches/${matchRef.id}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: {
            matchId: matchRef.id,
            fromUserId: userId,
            fromUserName: team1Data.name,
          },
        });
      }

      return { success: true, matchId: matchRef.id };
    });

    return result;
  } catch (error) {
    return handleServerActionError(error, { invitationId, teamId, userId });
  }
}

export async function rejectTeamChallengeAction(invitationId: string, teamId: string, userId: string) {
  try {
    const batch = getAdminDb().batch();
    const invitationSnap = await getAdminDb().doc(`teams/${teamId}/invitations/${invitationId}`).get();
    if (!invitationSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { invitationId });
    }
    const invitation = invitationSnap.data() as Invitation;

    const challengedTeamSnap = await getAdminDb().doc(`teams/${teamId}`).get();
    if (challengedTeamSnap.exists) {
      if (challengedTeamSnap.data()?.createdBy !== userId) {
        throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
      }
    }

    batch.update(invitationSnap.ref, { status: 'declined' });

    const challengingTeamSnap = await getAdminDb().doc(`teams/${invitation.fromTeamId}`).get();
    if (challengingTeamSnap.exists) {
      const challengingTeam = challengingTeamSnap.data() as GroupTeam;
      const notificationRef = getAdminDb().collection(`users/${challengingTeam.createdBy}/notifications`).doc();
      batch.set(notificationRef, {
        type: 'match_update',
        title: 'Desafío Rechazado',
        message: `"${invitation.toTeamName || 'Un equipo'}" ha rechazado tu desafío.`,
        link: '/competitions',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }
    await batch.commit();
    return { success: true };
  } catch (error) {
    return handleServerActionError(error, { invitationId, teamId, userId });
  }
}

export async function deleteTeamAvailabilityPostAction(postId: string, userId: string) {
  try {
    const postRef = getAdminDb().doc(`teamAvailabilityPosts/${postId}`);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND);
    }

    if (postSnap.data()?.createdBy !== userId) {
      throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
    }

    await postRef.delete();
    return { success: true };
  } catch (error) {
    return handleServerActionError(error);
  }
}

export async function sendTeamChallengeAction(challengingTeamId: string, challengedTeamId: string, challengerUserId: string) {
  try {
    const batch = getAdminDb().batch();

    const [challengingTeamSnap, challengedTeamSnap] = await Promise.all([
      getAdminDb().doc(`teams/${challengingTeamId}`).get(),
      getAdminDb().doc(`teams/${challengedTeamId}`).get(),
    ]);

    if (!challengingTeamSnap.exists || !challengedTeamSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { challengingTeamId, challengedTeamId });
    }

    const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;
    const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;

    const invitationRef = getAdminDb().collection(`teams/${challengedTeam.id}/invitations`).doc();
    const newInvitation: Omit<Invitation, 'id'> = {
      type: 'team_challenge',
      fromTeamId: challengingTeam.id,
      fromTeamName: challengingTeam.name,
      fromTeamJersey: challengingTeam.jersey,
      toTeamId: challengedTeam.id,
      toTeamName: challengedTeam.name,
      toTeamJersey: challengedTeam.jersey,
      status: 'pending',
      createdBy: challengerUserId,
      createdAt: new Date().toISOString(),
    };
    batch.set(invitationRef, newInvitation);

    const notificationRef = getAdminDb().collection(`users/${challengedTeam.createdBy}/notifications`).doc();
    const notification: Omit<Notification, 'id'> = {
      type: 'match_invite',
      title: '¡Nuevo Desafío!',
      message: `El equipo "${challengingTeam.name}" te ha desafiado a un amistoso.`,
      link: '/competitions/challenges',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    batch.set(notificationRef, notification);

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return handleServerActionError(error);
  }
}
