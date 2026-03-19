'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';

export interface CompetitionTemplate {
  id?: string;
  name: string;
  format: 'league' | 'cup';
  subFormat?: string;
  sportType?: string;
  rules?: {
    pointsForWin?: number;
    pointsForDraw?: number;
    pointsForLoss?: number;
    tiebreaker?: 'goal_difference' | 'goals_for' | 'head_to_head';
    yellowsForSuspension?: number;
    redsForSuspension?: number;
  };
  registrationConfig?: {
    allowRegistrations: boolean;
    maxTeams?: number;
    registrationDeadline?: string;
    requirePayment: boolean;
    registrationFee?: number;
    requireDocuments: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveTemplateAction(
  uid: string,
  template: Omit<CompetitionTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!uid) return { success: false, error: 'No autenticado' };

  try {
    const ref = getAdminDb()
      .collection('users')
      .doc(uid)
      .collection('competitionTemplates')
      .doc();

    await ref.set({
      ...template,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: ref.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, error: message };
  }
}

export async function loadTemplatesAction(
  uid: string
): Promise<{ success: boolean; templates?: CompetitionTemplate[]; error?: string }> {
  if (!uid) return { success: false, error: 'No autenticado' };

  try {
    const snap = await getAdminDb()
      .collection('users')
      .doc(uid)
      .collection('competitionTemplates')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const templates: CompetitionTemplate[] = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: d.id,
      ...(d.data() as Omit<CompetitionTemplate, 'id'>),
    }));

    return { success: true, templates };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, error: message };
  }
}

export async function deleteTemplateAction(
  uid: string,
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  if (!uid || !templateId) return { success: false, error: 'Parámetros inválidos' };

  try {
    await getAdminDb()
      .collection('users')
      .doc(uid)
      .collection('competitionTemplates')
      .doc(templateId)
      .delete();

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, error: message };
  }
}
