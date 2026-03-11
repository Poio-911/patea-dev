'use server';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth/get-server-session';
import type { MatchInvitationResponse, MatchInvitation, MatchDateProposal } from '@/lib/types';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountJson = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  initializeApp({
    credential: cert(serviceAccountJson),
    projectId: serviceAccountJson.project_id,
  });
}

const db = getFirestore();

export async function acceptMatchInvitationAction(
  invitationId: string,
  matchId: string
): Promise<{ success: boolean; error?: string; matchTitle?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    if (!invitationId || !matchId) {
      return { success: false, error: 'Parámetros inválidos.' };
    }

    const userId = session.user.uid;
    const matchRef = db.collection('matches').doc(matchId);
    const invitationRef = matchRef.collection('invitations').doc(invitationId);
    const playerRef = db.collection('players').doc(userId);

    let resolvedMatchTitle = 'partido';

    await db.runTransaction(async (transaction) => {
      const [matchSnap, invitationSnap, playerSnap] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(invitationRef),
        transaction.get(playerRef),
      ]);

      if (!matchSnap.exists) {
        throw new Error('No se encontró el partido.');
      }

      if (!invitationSnap.exists) {
        throw new Error('No se encontró la invitación.');
      }

      if (!playerSnap.exists) {
        throw new Error('No se encontró tu perfil de jugador.');
      }

      const matchData = matchSnap.data() as any;
      const invitationData = invitationSnap.data() as any;
      const playerData = playerSnap.data() as any;

      resolvedMatchTitle = matchData?.title || invitationData?.matchTitle || 'partido';

      if (invitationData?.playerId !== userId) {
        throw new Error('No autorizado para responder esta invitación.');
      }

      if (invitationData?.status && invitationData.status !== 'pending') {
        throw new Error('Esta invitación ya fue respondida.');
      }

      const currentPlayers = Array.isArray(matchData?.players) ? matchData.players : [];
      const currentPlayerUids = Array.isArray(matchData?.playerUids) ? matchData.playerUids : [];
      const matchSize = Number(matchData?.matchSize) || 0;

      if (currentPlayerUids.includes(userId)) {
        transaction.update(invitationRef, { status: 'accepted' });
        return;
      }

      if (matchSize > 0 && currentPlayers.length >= matchSize) {
        throw new Error('El partido ya está lleno.');
      }

      const playerPayload = {
        uid: userId,
        displayName: playerData?.name || 'Jugador',
        ovr: Number(playerData?.ovr) || 50,
        position: playerData?.position || 'MED',
        photoURL: playerData?.photoUrl || playerData?.photoURL || '',
      };

      transaction.update(matchRef, {
        players: FieldValue.arrayUnion(playerPayload),
        playerUids: FieldValue.arrayUnion(userId),
      });

      transaction.update(invitationRef, { status: 'accepted' });
    });

    return { success: true, matchTitle: resolvedMatchTitle };
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return {
      success: false,
      error: error?.message || 'No se pudo aceptar la invitación.',
    };
  }
}

export async function rejectMatchInvitationAction(
  invitationId: string,
  matchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    if (!invitationId || !matchId) {
      return { success: false, error: 'Parámetros inválidos.' };
    }

    const userId = session.user.uid;
    const invitationRef = db.collection('matches').doc(matchId).collection('invitations').doc(invitationId);

    await db.runTransaction(async (transaction) => {
      const invitationSnap = await transaction.get(invitationRef);

      if (!invitationSnap.exists) {
        throw new Error('No se encontró la invitación.');
      }

      const invitationData = invitationSnap.data() as any;

      if (invitationData?.playerId !== userId) {
        throw new Error('No autorizado para responder esta invitación.');
      }

      if (invitationData?.status && invitationData.status !== 'pending') {
        throw new Error('Esta invitación ya fue respondida.');
      }

      transaction.update(invitationRef, { status: 'declined' });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error rejecting invitation:', error);
    return {
      success: false,
      error: error?.message || 'No se pudo rechazar la invitación.',
    };
  }
}

/**
 * Responder a una invitación de partido
 * Actualiza el documento de invitación y los contadores en el partido
 */
export async function respondToMatchInvitationAction(
  matchId: string,
  response: MatchInvitationResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const userId = session.user.uid;

    // Verificar que el partido existe
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return { success: false, error: 'Partido no encontrado' };
    }

    const matchData = matchDoc.data();

    // Verificar que el usuario está invitado (en teams o availablePlayers)
    const allPlayerIds = [
      ...(matchData?.teams?.teamA?.players || []),
      ...(matchData?.teams?.teamB?.players || []),
      ...(matchData?.availablePlayers || []),
    ];

    if (!allPlayerIds.includes(userId)) {
      return { success: false, error: 'No estás invitado a este partido' };
    }

    const invitationRef = matchRef.collection('invitations').doc(userId);
    let shouldTriggerCompletion = false;

    // Execute ALL logic inside transaction to prevent race conditions
    await db.runTransaction(async (transaction) => {
      // Read current state atomically
      const [matchSnap, invitationSnap, playerSnap] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(invitationRef),
        transaction.get(db.collection('players').doc(userId))
      ]);

      if (!matchSnap.exists) {
        throw new Error('Partido no encontrado');
      }

      const matchData = matchSnap.data();
      const previousResponse = invitationSnap.exists
        ? (invitationSnap.data()?.response as MatchInvitationResponse)
        : 'pending';

      // Calculate counter changes based on atomic data
      const counterUpdates: Record<string, any> = {};

      // Decrement previous counter (if not pending)
      if (previousResponse === 'confirmed') {
        counterUpdates.confirmedCount = FieldValue.increment(-1);
      } else if (previousResponse === 'declined') {
        counterUpdates.declinedCount = FieldValue.increment(-1);
      } else if (previousResponse === 'maybe') {
        counterUpdates.maybeCount = FieldValue.increment(-1);
      }

      // Increment new counter
      if (response === 'confirmed') {
        counterUpdates.confirmedCount = FieldValue.increment(1);
      } else if (response === 'declined') {
        counterUpdates.declinedCount = FieldValue.increment(1);
      } else if (response === 'maybe') {
        counterUpdates.maybeCount = FieldValue.increment(1);
      }

      // Roster Synchronizations (Add/Remove from players array)
      if (response === 'confirmed' && previousResponse !== 'confirmed') {
        // Add to roster
        const playerData = playerSnap.exists ? playerSnap.data() : null;
        const playerPayload = {
          uid: userId,
          displayName: playerData?.name || 'Jugador',
          ovr: playerData?.ovr || 50,
          position: playerData?.position || 'MED',
          photoUrl: playerData?.photoUrl || playerData?.photoURL || ''
        };
        counterUpdates.players = FieldValue.arrayUnion(playerPayload);
        counterUpdates.playerUids = FieldValue.arrayUnion(userId);
        shouldTriggerCompletion = true;
      } else if (response !== 'confirmed' && previousResponse === 'confirmed') {
        // Remove from roster
        // Note: arrayRemove on objects is tricky if OVR changed, so we might need a safer removal logic
        // But for now, let's look for the player in the existing match data
        const playerToRemove = matchData?.players?.find((p: any) => p.uid === userId);
        if (playerToRemove) {
          counterUpdates.players = FieldValue.arrayRemove(playerToRemove);
          counterUpdates.playerUids = FieldValue.arrayRemove(userId);
        }
      }

      // Handle waitlist logic with ATOMIC data
      const maxPlayers = matchData?.maxPlayers || (matchData?.matchSize ? matchData.matchSize * 2 : 10);
      const currentConfirmed = matchData?.confirmedCount || 0;
      const waitlist = matchData?.waitlist || [];

      if (maxPlayers && response === 'confirmed' && previousResponse !== 'confirmed') {
        // Check if match is full based on ATOMIC confirmed count
        if (currentConfirmed >= maxPlayers && !waitlist.includes(userId)) {
          // Match is full, add to waitlist instead
          counterUpdates.waitlist = FieldValue.arrayUnion(userId);
          // Don't increment confirmedCount if going to waitlist
          delete counterUpdates.confirmedCount;
          // Don't add to players array if going to waitlist
          delete counterUpdates.players;
          delete counterUpdates.playerUids;
          shouldTriggerCompletion = false;
        }
      }

      // Remove from waitlist if declining or changing response
      if (waitlist.includes(userId) && response !== 'confirmed') {
        counterUpdates.waitlist = FieldValue.arrayRemove(userId);
      }

      // Prepare invitation update
      const invitationData: MatchInvitation = {
        id: userId,
        matchId,
        userId,
        response,
        respondedAt: new Date().toISOString(),
        notifiedAt: invitationSnap.data()?.notifiedAt || new Date().toISOString(),
      };

      // Atomic updates
      transaction.set(invitationRef, invitationData);

      if (Object.keys(counterUpdates).length > 0) {
        transaction.update(matchRef, counterUpdates);
      }
    });

    // Trigger full sequence (outside transaction for cleaner async handling)
    if (shouldTriggerCompletion) {
      const { triggerMatchFullSequence } = await import('../match-logic');
      await triggerMatchFullSequence(matchId);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error responding to match invitation:', error);
    return { success: false, error: error.message || 'Error al responder invitación' };
  }
}

/**
 * Proponer una nueva fecha/hora para el partido
 * Crea un documento en la subcolección de propuestas
 */
export async function proposeMatchDateAction(
  matchId: string,
  proposedDate: string,
  proposedTime: string
): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const userId = session.user.uid;

    // Verificar que el partido existe
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return { success: false, error: 'Partido no encontrado' };
    }

    const matchData = matchDoc.data();

    // Verificar que el usuario está invitado
    const allPlayerIds = [
      ...(matchData?.teams?.teamA?.players || []),
      ...(matchData?.teams?.teamB?.players || []),
      ...(matchData?.availablePlayers || []),
    ];

    if (!allPlayerIds.includes(userId)) {
      return { success: false, error: 'No estás invitado a este partido' };
    }

    // Crear propuesta de fecha
    const proposalData: MatchDateProposal = {
      id: '', // Se asignará por Firestore
      matchId,
      date: proposedDate,
      time: proposedTime,
      proposedBy: userId,
      votes: [userId], // El propositor vota automáticamente por su propuesta
      createdAt: new Date().toISOString(),
    };

    const proposalRef = await matchRef.collection('dateProposals').add(proposalData);

    // Actualizar con el ID generado
    await proposalRef.update({ id: proposalRef.id });

    return { success: true, proposalId: proposalRef.id };
  } catch (error: any) {
    console.error('Error proposing match date:', error);
    return { success: false, error: error.message || 'Error al proponer fecha' };
  }
}

/**
 * Votar por una propuesta de fecha
 * Agrega/quita el voto del usuario (toggle)
 */
export async function voteMatchDateProposalAction(
  matchId: string,
  proposalId: string
): Promise<{ success: boolean; error?: string; voted?: boolean }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const userId = session.user.uid;

    // Verificar que el partido existe
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return { success: false, error: 'Partido no encontrado' };
    }

    const matchData = matchDoc.data();

    // Verificar que el usuario está invitado
    const allPlayerIds = [
      ...(matchData?.teams?.teamA?.players || []),
      ...(matchData?.teams?.teamB?.players || []),
      ...(matchData?.availablePlayers || []),
    ];

    if (!allPlayerIds.includes(userId)) {
      return { success: false, error: 'No estás invitado a este partido' };
    }

    // Obtener propuesta
    const proposalRef = matchRef.collection('dateProposals').doc(proposalId);
    const proposalDoc = await proposalRef.get();

    if (!proposalDoc.exists) {
      return { success: false, error: 'Propuesta no encontrada' };
    }

    const proposalData = proposalDoc.data();
    const currentVotes = proposalData?.votes || [];
    const hasVoted = currentVotes.includes(userId);

    // Toggle: agregar o quitar voto
    let voted: boolean;
    if (hasVoted) {
      // Quitar voto
      await proposalRef.update({
        votes: FieldValue.arrayRemove(userId),
        votesCount: FieldValue.increment(-1),
      });
      voted = false;
    } else {
      // Agregar voto
      await proposalRef.update({
        votes: FieldValue.arrayUnion(userId),
        votesCount: FieldValue.increment(1),
      });
      voted = true;

      // Verificar si alcanzó mayoría para auto-seleccionar
      const newVoteCount = (proposalData?.votesCount || 0) + 1;
      const totalPlayers = allPlayerIds.length;
      const majority = Math.ceil(totalPlayers / 2);

      if (newVoteCount >= majority) {
        // Auto-seleccionar esta fecha como la definitiva
        await matchRef.update({
          date: proposalData?.proposedDate,
          time: proposalData?.proposedTime,
          dateConfirmedByVoting: true,
        });
      }
    }

    return { success: true, voted };
  } catch (error: any) {
    console.error('Error voting on date proposal:', error);
    return { success: false, error: error.message || 'Error al votar' };
  }
}

/**
 * Obtener todas las invitaciones de un partido
 */
export async function getMatchInvitationsAction(
  matchId: string
): Promise<{ success: boolean; invitations?: MatchInvitation[]; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const matchRef = db.collection('matches').doc(matchId);
    const invitationsSnapshot = await matchRef.collection('invitations').get();

    const invitations: MatchInvitation[] = invitationsSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as MatchInvitation[];

    return { success: true, invitations };
  } catch (error: any) {
    console.error('Error getting match invitations:', error);
    return { success: false, error: error.message || 'Error al obtener invitaciones' };
  }
}

/**
 * Obtener todas las propuestas de fecha de un partido
 */
export async function getMatchDateProposalsAction(
  matchId: string
): Promise<{ success: boolean; proposals?: MatchDateProposal[]; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const matchRef = db.collection('matches').doc(matchId);
    const proposalsSnapshot = await matchRef
      .collection('dateProposals')
      .orderBy('votesCount', 'desc')
      .get();

    const proposals: MatchDateProposal[] = proposalsSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as MatchDateProposal[];

    return { success: true, proposals };
  } catch (error: any) {
    console.error('Error getting date proposals:', error);
    return { success: false, error: error.message || 'Error al obtener propuestas' };
  }
}
