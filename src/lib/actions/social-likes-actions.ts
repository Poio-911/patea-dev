'use server';

// Funciones para dar y quitar like a una SocialActivity
import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Da like a una actividad social (agrega userId al array likes)
 */
export async function likeSocialActivityAction(activityId: string, userId: string) {
  try {
    const activityRef = getAdminDb().collection('socialActivities').doc(activityId);
    await activityRef.update({
      likes: FieldValue.arrayUnion(userId),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Quita el like de una actividad social (remueve userId del array likes)
 */
export async function unlikeSocialActivityAction(activityId: string, userId: string) {
  try {
    const activityRef = getAdminDb().collection('socialActivities').doc(activityId);
    await activityRef.update({
      likes: FieldValue.arrayRemove(userId),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
