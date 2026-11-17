import * as admin from 'firebase-admin';
import { getTokensForUsers, isDeadTokenError, pruneInvalidTokens } from './fcm-tokens';

export interface PushPayload {
  title: string;
  body: string;
  type: string;
  link?: string;
  extraData?: Record<string, string>;
}

export interface PushSendResult {
  tokensFound: number;
  successCount: number;
  failureCount: number;
}

export interface PushDeps {
  getTokensForUsers: (uids: string[]) => Promise<Map<string, string[]>>;
  pruneInvalidTokens: (uid: string, badTokens: string[]) => Promise<void>;
  messaging: Pick<admin.messaging.Messaging, 'sendEachForMulticast'>;
}

const DEFAULT_BATCH_SIZE = 500;

/**
 * Envía una notificación push FCM multicast a una lista de usuarios.
 *
 * Incluye prioridad alta y sonido por defecto en Android/iOS (sin fijar un
 * `channelId` custom para no romper instalaciones previas sin canal creado),
 * además de enlace webpush y limpieza automática de tokens muertos.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  logTag = 'Push',
  deps?: Partial<PushDeps>,
): Promise<PushSendResult> {
  const uniqueIds = [...new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (uniqueIds.length === 0) {
    return { tokensFound: 0, successCount: 0, failureCount: 0 };
  }

  const getTokens = deps?.getTokensForUsers ?? getTokensForUsers;
  const pruneTokens = deps?.pruneInvalidTokens ?? pruneInvalidTokens;
  const messaging = deps?.messaging ?? admin.messaging();

  try {
    const tokensByUser = await getTokens(uniqueIds);
    const tokenOwners = new Map<string, string>();
    const tokens: string[] = [];

    tokensByUser.forEach((userTokens, uid) => {
      userTokens.forEach((token) => {
        if (!token || tokenOwners.has(token)) return;
        tokenOwners.set(token, uid);
        tokens.push(token);
      });
    });

    if (tokens.length === 0) {
      return { tokensFound: 0, successCount: 0, failureCount: 0 };
    }

    const data: Record<string, string> = {
      type: payload.type,
      ...(payload.link ? { link: payload.link } : {}),
      ...(payload.extraData ?? {}),
    };

    let successCount = 0;
    let failureCount = 0;
    const deadTokensByUser = new Map<string, string[]>();

    for (let offset = 0; offset < tokens.length; offset += DEFAULT_BATCH_SIZE) {
      const batchTokens = tokens.slice(offset, offset + DEFAULT_BATCH_SIZE);
      const response = await messaging.sendEachForMulticast({
        tokens: batchTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
        ...(payload.link
          ? {
              webpush: {
                fcmOptions: { link: payload.link },
                notification: {
                  icon: '/icons/icon-192x192.png',
                  badge: '/icons/icon-48x48.png',
                },
              },
            }
          : {}),
        data,
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((resp, index) => {
        if (!resp.success && isDeadTokenError(resp.error?.code)) {
          const badToken = batchTokens[index];
          const uid = tokenOwners.get(badToken);
          if (!uid) return;
          const list = deadTokensByUser.get(uid) ?? [];
          list.push(badToken);
          deadTokensByUser.set(uid, list);
        }
      });
    }

    if (deadTokensByUser.size > 0) {
      await Promise.all(
        [...deadTokensByUser.entries()].map(([uid, badTokens]) =>
          pruneTokens(uid, badTokens),
        ),
      );
      console.info(`[${logTag}] Cleaned up ${deadTokensByUser.size} user(s) with stale FCM tokens.`);
    }

    console.info(
      `[${logTag}] Push sent. Tokens: ${tokens.length}, Success: ${successCount}, Failure: ${failureCount}`,
    );

    return { tokensFound: tokens.length, successCount, failureCount };
  } catch (error) {
    console.error(`[${logTag}] Error sending push notification:`, error);
    return { tokensFound: 0, successCount: 0, failureCount: 0 };
  }
}
