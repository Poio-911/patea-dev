'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth/get-server-session';
import { getAdminDb } from '@/firebase/admin-init';

const db = getAdminDb();

export interface SubmitApplicationInput {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
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
    const { competitionId, competitionType } = input;
    
    // Basic input validation
    if (!competitionId || !competitionType || !input.teamName?.trim() || !input.captainName?.trim() || !input.captainEmail?.trim()) {
      return { success: false, error: 'Faltan datos requeridos.' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.captainEmail)) {
      return { success: false, error: 'El email no es válido.' };
    }

    // Check competition exists and has registration open
    const compRef = db.collection(competitionType).doc(competitionId);
    const compDoc = await compRef.get();
    if (!compDoc.exists) {
      return { success: false, error: `${competitionType === 'leagues' ? 'La liga' : 'La copa'} no existe.` };
    }

    const compData = compDoc.data()!;
    if (!compData.allowPublicRegistration) {
      return { success: false, error: 'Inscripciones cerradas para esta competición.' };
    }

    // Check registration deadline
    if (compData.registrationDeadline) {
      const deadline = new Date(compData.registrationDeadline);
      if (new Date() > deadline) {
        return { success: false, error: 'El período de inscripción ya cerró.' };
      }
    }

    // Check if team name already applied
    const existing = await db
      .collection(competitionType)
      .doc(competitionId)
      .collection('applications')
      .where('teamName', '==', input.teamName.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'Ya existe una solicitud con ese nombre de equipo.' };
    }

    // Check maxTeams (count approved applications)
    if (compData.maxTeams) {
      const approvedCount = await db
        .collection(competitionType)
        .doc(competitionId)
        .collection('applications')
        .where('status', '==', 'approved')
        .count()
        .get();

      if (approvedCount.data().count >= compData.maxTeams) {
        return { success: false, error: 'Se alcanzó el máximo de equipos permitidos.' };
      }
    }

    const docRef = await db
      .collection(competitionType)
      .doc(competitionId)
      .collection('applications')
      .add({
        competitionId,
        competitionType,
        teamName: input.teamName.trim(),
        captainName: input.captainName.trim(),
        captainEmail: input.captainEmail.trim().toLowerCase(),
        captainPhone: input.captainPhone?.trim() || null,
        playerCount: input.playerCount || null,
        message: input.message?.trim() || null,
        status: 'pending',
        paymentStatus: compData.registrationFee ? 'pending' : 'not_required',
        submittedAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });

    return { success: true, applicationId: docRef.id };
  } catch (error: any) {
    console.error('[registration-actions] submitTeamApplicationAction error:', error);
    return { success: false, error: 'Hubo un problema al enviar la solicitud.' };
  }
}

export async function reviewTeamApplicationAction(input: {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  applicationId: string;
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado.' };
    }

    const { competitionId, competitionType } = input;
    const compRef = db.collection(competitionType).doc(competitionId);
    const compDoc = await compRef.get();

    if (!compDoc.exists) {
      return { success: false, error: 'Competición no encontrada.' };
    }

    if (compDoc.data()!.ownerUid !== session.user.uid) {
      return { success: false, error: 'Sin permiso para gestionar esta competición.' };
    }

    // Try to find the application in the root collection first (from public explorer)
    const rootAppRef = db.collection('competitionApplications').doc(input.applicationId);
    const rootAppDoc = await rootAppRef.get();

    if (rootAppDoc.exists) {
      // Application from public explorer - update in root collection
      await rootAppRef.update({
        status: input.status,
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: session.user.uid,
      });

      // If approved, add the team to the competition
      if (input.status === 'approved') {
        const appData = rootAppDoc.data()!;
        await compRef.update({
          teams: FieldValue.arrayUnion(appData.teamId),
        });
      }

      return { success: true };
    }

    // If not found in root collection, try the subcollection (from registration form)
    const subAppRef = db
      .collection(competitionType)
      .doc(competitionId)
      .collection('applications')
      .doc(input.applicationId);

    const subAppDoc = await subAppRef.get();
    if (!subAppDoc.exists) {
      return { success: false, error: 'Solicitud no encontrada.' };
    }

    await subAppRef.update({
      status: input.status,
      reviewNotes: input.reviewNotes?.trim() || null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: session.user.uid,
    });

    // If approved and application has a teamId, add team to competition
    if (input.status === 'approved') {
      const subAppData = subAppDoc.data()!;
      if (subAppData.teamId) {
        await compRef.update({ teams: FieldValue.arrayUnion(subAppData.teamId) });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[registration-actions] reviewTeamApplicationAction error:', error);
    return { success: false, error: 'Error al procesar la solicitud.' };
  }
}
