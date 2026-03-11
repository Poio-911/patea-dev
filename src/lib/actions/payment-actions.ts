'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import { FEATURE_DISABLED_MESSAGES, isFeatureEnabled } from '@/lib/feature-availability';
import type { CreditTransaction } from '@/lib/types';

const db = getAdminDb();

/**
 * Crear preferencia de pago en Mercado Pago
 * @param packageId - ID del paquete de créditos a comprar
 * @returns URL de pago de Mercado Pago y transaction ID
 */
export async function createCreditPurchaseAction(
  _packageId: string
): Promise<{ success: boolean; error?: string; initPoint?: string; transactionId?: string }> {
  if (!isFeatureEnabled('payments')) {
    return { success: false, error: FEATURE_DISABLED_MESSAGES.payments };
  }

  return { success: false, error: 'Mercado Pago deshabilitado' };
}

/**
 * Verificar estado de pago (polling desde cliente)
 * @param transactionId - ID de la transacción
 * @returns Estado actual de la transacción
 */
export async function checkPaymentStatusAction(
  _transactionId: string
): Promise<{ success: boolean; error?: string; status?: string; credits?: number; amount?: number }> {
  if (!isFeatureEnabled('payments')) {
    return { success: false, error: FEATURE_DISABLED_MESSAGES.payments };
  }

  return { success: false, error: 'Mercado Pago deshabilitado' };
}

/**
 * Webhook de Mercado Pago (llamado por MP tras pago)
 * IMPORTANTE: Esta función debe ser llamada desde /api/webhooks/mercadopago
 */
export async function handleMercadoPagoWebhook(_data: any) {
  if (!isFeatureEnabled('payments')) {
    return { success: false, error: FEATURE_DISABLED_MESSAGES.payments };
  }

  return { success: false, error: 'Mercado Pago deshabilitado' };
}

/**
 * Obtener historial de transacciones del usuario
 * @returns Lista de transacciones del usuario autenticado
 */
export async function getUserTransactionsAction() {
  try {
    // 1. Validar usuario autenticado
    const userId = await requireAuth();

    // 2. Obtener transacciones del usuario
    const transactionsSnapshot = await db
      .collection('creditTransactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const transactions = transactionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CreditTransaction[];

    return {
      success: true,
      transactions,
    };
  } catch (error) {
    console.error('Error en getUserTransactionsAction:', error);
    return {
      success: false,
      error: 'Error al obtener transacciones',
      transactions: [],
    };
  }
}
