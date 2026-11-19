import * as admin from 'firebase-admin';
import { sendPushToUsers } from './fcm-push';

/** Deja la notificación en la bandeja de cada persona y manda el push. */
export async function notifyUsers(
  db: admin.firestore.Firestore,
  uids: string[],
  notification: { type: string; title: string; message: string; link: string; metadata?: Record<string, string> },
  logTag: string,
): Promise<void> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return;
  const batch = db.batch();
  const createdAt = new Date().toISOString();
  for (const uid of unique) {
    batch.set(db.collection(`users/${uid}/notifications`).doc(), {
      ...notification,
      isRead: false,
      createdAt,
    });
  }
  await batch.commit();
  await sendPushToUsers(
    unique,
    {
      title: notification.title,
      body: notification.message,
      type: notification.type,
      link: notification.link,
      extraData: notification.metadata ?? {},
    },
    logTag,
  );
}
