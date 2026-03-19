'use server';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth/get-server-session';

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

export interface SubmitApplicationInput {
  leagueId: string;
  teamName: string;
  captainName: string;
  captainEmail: string;
  captainPhone?: string;
  playerCount?: number;
  message?: string;
}

export async function submitTeamApplicationAction(
  input: SubmitApplicationInput
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    // Basic input validation
    if (!input.leagueId || !input.teamName?.trim() || !input.captainName?.trim() || !input.captainEmail?.trim()) {
      return { success: false, error: 'Faltan datos requeridos.' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.captainEmail)) {
      return { success: false, error: 'El email no es válido.' };
    }

    // Check league exists and has registration open
    const leagueRef = db.collection('leagues').doc(input.leagueId);
    const leagueDoc = await leagueRef.get();
    if (!leagueDoc.exists) {
      return { success: false, error: 'La liga no existe.' };
    }

    const leagueData = leagueDoc.data()!;
    if (!leagueData.allowPublicRegistration) {
      return { success: false, error: 'Esta liga no tiene inscripciones abiertas.' };
    }

    // Check registration deadline
    if (leagueData.registrationDeadline) {
      const deadline = new Date(leagueData.registrationDeadline);
      if (new Date() > deadline) {
        return { success: false, error: 'El período de inscripción ya cerró.' };
      }
    }

    // Check if team name already applied
    const existing = await db
      .collection('leagues')
      .doc(input.leagueId)
      .collection('applications')
      .where('teamName', '==', input.teamName.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'Ya existe una solicitud con ese nombre de equipo.' };
    }

    // Check maxTeams (count approved applications)
    if (leagueData.maxTeams) {
      const approvedCount = await db
        .collection('leagues')
        .doc(input.leagueId)
        .collection('applications')
        .where('status', '==', 'approved')
        .count()
        .get();

      if (approvedCount.data().count >= leagueData.maxTeams) {
        return { success: false, error: 'La liga ya alcanzó el máximo de equipos.' };
      }
    }

    const docRef = await db
      .collection('leagues')
      .doc(input.leagueId)
      .collection('applications')
      .add({
        leagueId: input.leagueId,
        teamName: input.teamName.trim(),
        captainName: input.captainName.trim(),
        captainEmail: input.captainEmail.trim().toLowerCase(),
        captainPhone: input.captainPhone?.trim() || null,
        playerCount: input.playerCount || null,
        message: input.message?.trim() || null,
        status: 'pending',
        paymentStatus: leagueData.registrationFee ? 'pending' : 'not_required',
        submittedAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });

    return { success: true, applicationId: docRef.id };
  } catch (error: any) {
    console.error('[registration-actions] submitTeamApplicationAction error:', error);
    return { success: false, error: 'Hubo un problema al enviar la solicitud. Intentá de nuevo.' };
  }
}

export async function reviewTeamApplicationAction(input: {
  leagueId: string;
  applicationId: string;
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado.' };
    }

    const leagueRef = db.collection('leagues').doc(input.leagueId);
    const leagueDoc = await leagueRef.get();
    if (!leagueDoc.exists) {
      return { success: false, error: 'Liga no encontrada.' };
    }

    if (leagueDoc.data()!.ownerUid !== session.user.uid) {
      return { success: false, error: 'Sin permiso para gestionar esta liga.' };
    }

    await db
      .collection('leagues')
      .doc(input.leagueId)
      .collection('applications')
      .doc(input.applicationId)
      .update({
        status: input.status,
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: session.user.uid,
      });

    return { success: true };
  } catch (error: any) {
    console.error('[registration-actions] reviewTeamApplicationAction error:', error);
    return { success: false, error: 'Error al procesar la solicitud.' };
  }
}
