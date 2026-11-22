import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { AppleIapConfig, CREDIT_PRODUCTS, PurchaseCheck, checkPurchase, fetchAppleTransaction } from '../lib/iap';

/**
 * Entrega los créditos de una compra integrada de la App Store.
 *
 * La app manda el id de la transacción y el producto; acá se le pregunta a Apple
 * y, si la compra es real y es de ese producto, se suman los créditos. Es
 * idempotente por transacción: reintentar (o restaurar) no duplica nada.
 *
 * Credenciales: `internalConfig/iap` en Firestore ({ issuerId, keyId, privateKey }
 * de una clave de «Compras integradas» de App Store Connect). Esa colección no
 * tiene reglas, así que los clientes no la pueden leer; solo el servidor.
 */
export const redeemIapPurchase = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;

  const transactionId = String(request.data?.transactionId ?? '').trim();
  const productId = String(request.data?.productId ?? '').trim();
  if (!/^\d{5,30}$/.test(transactionId) || !CREDIT_PRODUCTS[productId]) {
    throw new HttpsError('invalid-argument', 'Compra inválida.');
  }

  const db = admin.firestore();
  const txRef = db.collection('iapTransactions').doc(transactionId);

  // Ya entregada: si fue a esta misma cuenta se responde ok (reintento); si fue a
  // otra, se rechaza.
  const existing = await txRef.get();
  if (existing.exists) {
    if (existing.data()?.uid === uid) return { ok: true, credits: existing.data()?.credits ?? 0, alreadyRedeemed: true };
    throw new HttpsError('already-exists', 'Esta compra ya fue usada en otra cuenta.');
  }

  const configSnap = await db.doc('internalConfig/iap').get();
  const config = configSnap.data() as Partial<AppleIapConfig> | undefined;
  if (!config?.issuerId || !config?.keyId || !config?.privateKey) {
    throw new HttpsError('failed-precondition', 'Las compras todavía no están configuradas.');
  }

  let result: PurchaseCheck;
  try {
    const tx = await fetchAppleTransaction(transactionId, config as AppleIapConfig);
    result = checkPurchase(tx, productId);
    if (result.ok && tx) {
      const playerRef = db.collection('players').doc(uid);
      const credits = result.credits;
      await db.runTransaction(async (t) => {
        // Se relee dentro de la transacción: dos pedidos a la vez no duplican.
        if ((await t.get(txRef)).exists) return;
        if (!(await t.get(playerRef)).exists) throw new HttpsError('not-found', 'No se encontró tu perfil de jugador.');
        t.create(txRef, {
          uid,
          productId,
          credits,
          environment: tx.environment ?? 'unknown',
          originalTransactionId: tx.originalTransactionId ?? transactionId,
          createdAt: new Date().toISOString(),
        });
        t.update(playerRef, { purchasedCredits: admin.firestore.FieldValue.increment(credits) });
      });
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('redeemIapPurchase', transactionId, e);
    throw new HttpsError('unavailable', 'No pudimos validar la compra con Apple. Probá de nuevo en un momento.');
  }

  if (!result.ok) throw new HttpsError('failed-precondition', result.reason);
  return { ok: true, credits: result.credits, alreadyRedeemed: false };
});
