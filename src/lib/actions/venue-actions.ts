'use server';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth-helpers';
import type { Venue } from '@/lib/types';
import { checkGroupPermissionAction } from '@/lib/actions/group-role-actions';

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

/**
 * Crear una nueva cancha para un grupo
 */
export async function createVenueAction(
  groupId: string,
  venueData: Omit<Venue, 'id' | 'groupId' | 'createdBy' | 'createdAt'>
): Promise<{ success: boolean; venueId?: string; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    // Verificar permisos en el grupo
    const permissionCheck = await checkGroupPermissionAction(groupId, 'matches.create');
    if (!permissionCheck.success || !permissionCheck.hasPermission) {
      return { success: false, error: 'No tienes permiso para crear canchas en este grupo' };
    }

    // Crear venue
    const venue: Omit<Venue, 'id'> = {
      ...venueData,
      groupId,
      createdBy: session.user.uid,
      createdAt: new Date().toISOString(),
    };

    const venueRef = await db.collection('venues').add(venue);
    await venueRef.update({ id: venueRef.id });

    return { success: true, venueId: venueRef.id };
  } catch (error: any) {
    console.error('Error creating venue:', error);
    return { success: false, error: error.message || 'Error al crear cancha' };
  }
}

/**
 * Actualizar una cancha existente
 */
export async function updateVenueAction(
  venueId: string,
  updates: Partial<Omit<Venue, 'id' | 'groupId' | 'createdBy' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();

    if (!venueDoc.exists) {
      return { success: false, error: 'Cancha no encontrada' };
    }

    const venueData = venueDoc.data() as Venue;

    // Verificar permisos en el grupo
    const permissionCheck = await checkGroupPermissionAction(venueData.groupId, 'matches.edit');
    if (!permissionCheck.success || !permissionCheck.hasPermission) {
      return { success: false, error: 'No tienes permiso para editar canchas en este grupo' };
    }

    // Actualizar
    await venueRef.update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating venue:', error);
    return { success: false, error: error.message || 'Error al actualizar cancha' };
  }
}

/**
 * Eliminar una cancha
 */
export async function deleteVenueAction(
  venueId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();

    if (!venueDoc.exists) {
      return { success: false, error: 'Cancha no encontrada' };
    }

    const venueData = venueDoc.data() as Venue;

    // Verificar permisos en el grupo
    const permissionCheck = await checkGroupPermissionAction(venueData.groupId, 'matches.delete');
    if (!permissionCheck.success || !permissionCheck.hasPermission) {
      return { success: false, error: 'No tienes permiso para eliminar canchas en este grupo' };
    }

    // Verificar si la cancha está en uso en algún partido
    const matchesWithVenue = await db
      .collection('matches')
      .where('venueId', '==', venueId)
      .where('status', 'in', ['pending', 'scheduled'])
      .limit(1)
      .get();

    if (!matchesWithVenue.empty) {
      return {
        success: false,
        error: 'No se puede eliminar: la cancha está asignada a partidos activos',
      };
    }

    await venueRef.delete();

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting venue:', error);
    return { success: false, error: error.message || 'Error al eliminar cancha' };
  }
}

/**
 * Obtener todas las canchas de un grupo
 */
export async function getGroupVenuesAction(
  groupId: string
): Promise<{ success: boolean; venues?: Venue[]; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    // Verificar que el usuario es miembro del grupo
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return { success: false, error: 'Grupo no encontrado' };
    }

    const groupData = groupDoc.data();
    if (!groupData?.members?.includes(session.user.uid)) {
      return { success: false, error: 'No eres miembro de este grupo' };
    }

    // Obtener venues del grupo
    const venuesSnapshot = await db
      .collection('venues')
      .where('groupId', '==', groupId)
      .orderBy('createdAt', 'desc')
      .get();

    const venues: Venue[] = venuesSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Venue[];

    return { success: true, venues };
  } catch (error: any) {
    console.error('Error getting group venues:', error);
    return { success: false, error: error.message || 'Error al obtener canchas' };
  }
}

/**
 * Obtener una cancha específica por ID
 */
export async function getVenueByIdAction(
  venueId: string
): Promise<{ success: boolean; venue?: Venue; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();

    if (!venueDoc.exists) {
      return { success: false, error: 'Cancha no encontrada' };
    }

    const venue = {
      ...venueDoc.data(),
      id: venueDoc.id,
    } as Venue;

    return { success: true, venue };
  } catch (error: any) {
    console.error('Error getting venue:', error);
    return { success: false, error: error.message || 'Error al obtener cancha' };
  }
}
