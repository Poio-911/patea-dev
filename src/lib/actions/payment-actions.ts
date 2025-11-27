'use server';

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { db } from '@/firebase/admin-init';
import { auth } from '@/firebase/index';
import { nanoid } from 'nanoid';
import type { CreditPackage, CreditTransaction } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

// Inicializar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
});

const preference = new Preference(client);
const payment = new Payment(client);

/**
 * Crear preferencia de pago en Mercado Pago
 * @param packageId - ID del paquete de créditos a comprar
 * @returns URL de pago de Mercado Pago y transaction ID
 */
export async function createCreditPurchaseAction(packageId: string) {
  try {
    // 1. Validar usuario autenticado
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      };
    }

    // 2. Obtener paquete de Firestore
    const packageDoc = await db.collection('creditPackages').doc(packageId).get();

    if (!packageDoc.exists) {
      return {
        success: false,
        error: 'Paquete no encontrado',
      };
    }

    const pkg = packageDoc.data() as CreditPackage;

    // 3. Crear transaction ID único
    const transactionId = `tx_${nanoid(12)}`;

    // 4. Crear preferencia en Mercado Pago
    const preferenceData = {
      items: [
        {
          id: pkg.id,
          title: pkg.title,
          description: pkg.description || `${pkg.credits} créditos de IA para Pateá`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: pkg.price,
        },
      ],
      payer: {
        name: user.displayName || 'Usuario',
        email: user.email || 'usuario@patea.app',
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/payments/success?transaction_id=${transactionId}`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/payments/failure?transaction_id=${transactionId}`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/payments/pending?transaction_id=${transactionId}`,
      },
      auto_return: 'approved' as const,
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/webhooks/mercadopago`,
      external_reference: transactionId,
      statement_descriptor: 'Pateá - Créditos IA',
      metadata: {
        transaction_id: transactionId,
        user_id: user.uid,
        package_id: packageId,
      },
    };

    const mpPreference = await preference.create({ body: preferenceData });

    if (!mpPreference.id || !mpPreference.init_point) {
      return {
        success: false,
        error: 'Error al crear preferencia de pago',
      };
    }

    // 5. Crear registro de transacción en Firestore
    const transaction: Omit<CreditTransaction, 'id'> = {
      userId: user.uid,
      packageId: pkg.id,
      credits: pkg.credits,
      amount: pkg.price,
      status: 'pending',
      paymentMethod: 'mercadopago',
      mpPreferenceId: mpPreference.id,
      createdAt: new Date().toISOString(),
      metadata: {
        userEmail: user.email || undefined,
        userName: user.displayName || undefined,
        packageTitle: pkg.title,
      },
    };

    await db.collection('creditTransactions').doc(transactionId).set(transaction);

    // 6. Retornar URL de pago
    return {
      success: true,
      initPoint: mpPreference.init_point,
      transactionId,
    };
  } catch (error) {
    console.error('Error en createCreditPurchaseAction:', error);
    return {
      success: false,
      error: 'Error al procesar la solicitud de pago',
    };
  }
}

/**
 * Verificar estado de pago (polling desde cliente)
 * @param transactionId - ID de la transacción
 * @returns Estado actual de la transacción
 */
export async function checkPaymentStatusAction(transactionId: string) {
  try {
    // 1. Validar usuario autenticado
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      };
    }

    // 2. Obtener transacción de Firestore
    const transactionDoc = await db
      .collection('creditTransactions')
      .doc(transactionId)
      .get();

    if (!transactionDoc.exists) {
      return {
        success: false,
        error: 'Transacción no encontrada',
      };
    }

    const transaction = transactionDoc.data() as CreditTransaction;

    // 3. Validar que la transacción pertenece al usuario
    if (transaction.userId !== user.uid) {
      return {
        success: false,
        error: 'No autorizado',
      };
    }

    // 4. Retornar estado
    return {
      success: true,
      status: transaction.status,
      credits: transaction.credits,
      amount: transaction.amount,
      completedAt: transaction.completedAt,
    };
  } catch (error) {
    console.error('Error en checkPaymentStatusAction:', error);
    return {
      success: false,
      error: 'Error al verificar el estado del pago',
    };
  }
}

/**
 * Webhook de Mercado Pago (llamado por MP tras pago)
 * IMPORTANTE: Esta función debe ser llamada desde /api/webhooks/mercadopago
 */
export async function handleMercadoPagoWebhook(data: any) {
  try {
    console.log('📥 Webhook recibido de Mercado Pago:', JSON.stringify(data, null, 2));

    // Validar que es una notificación de pago
    if (data.type !== 'payment') {
      console.log('⚠️  Tipo de notificación no soportado:', data.type);
      return { success: true, message: 'Tipo de notificación ignorado' };
    }

    // Obtener detalles del pago de MP
    const paymentId = data.data.id;
    const paymentInfo = await payment.get({ id: paymentId });

    console.log('💳 Información del pago:', JSON.stringify(paymentInfo, null, 2));

    // Obtener transaction ID del external_reference
    const transactionId = paymentInfo.external_reference;

    if (!transactionId) {
      console.error('❌ No se encontró transaction ID en external_reference');
      return { success: false, error: 'Transaction ID no encontrado' };
    }

    // Obtener transacción de Firestore
    const transactionRef = db.collection('creditTransactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      console.error('❌ Transacción no encontrada:', transactionId);
      return { success: false, error: 'Transacción no encontrada' };
    }

    const transaction = transactionDoc.data() as CreditTransaction;

    // Actualizar estado según el pago
    let newStatus: CreditTransaction['status'] = 'pending';

    switch (paymentInfo.status) {
      case 'approved':
        newStatus = 'approved';
        break;
      case 'rejected':
      case 'cancelled':
        newStatus = 'rejected';
        break;
      default:
        newStatus = 'pending';
    }

    // Si el pago fue aprobado, acreditar créditos
    if (newStatus === 'approved' && transaction.status !== 'approved') {
      console.log('✅ Pago aprobado, acreditando créditos...');

      // Actualizar transacción
      await transactionRef.update({
        status: newStatus,
        mpPaymentId: paymentId.toString(),
        completedAt: new Date().toISOString(),
      });

      // Actualizar créditos del player
      const playerRef = db.collection('players').doc(transaction.userId);
      await playerRef.update({
        cardGenerationCredits: FieldValue.increment(transaction.credits),
        totalCreditsPurchased: FieldValue.increment(transaction.credits),
        lastPurchaseDate: new Date().toISOString(),
      });

      console.log(`✅ ${transaction.credits} créditos acreditados al usuario ${transaction.userId}`);

      // TODO: Opcional - Crear social activity
      // await db.collection('socialActivities').add({
      //   type: 'credits_purchased',
      //   userId: transaction.userId,
      //   timestamp: FieldValue.serverTimestamp(),
      //   metadata: {
      //     credits: transaction.credits,
      //     amount: transaction.amount,
      //   },
      // });

      return { success: true, message: 'Créditos acreditados exitosamente' };
    } else if (newStatus !== transaction.status) {
      // Solo actualizar estado si cambió
      await transactionRef.update({
        status: newStatus,
        mpPaymentId: paymentId.toString(),
        completedAt: newStatus === 'rejected' ? new Date().toISOString() : undefined,
      });

      console.log(`📝 Estado de transacción actualizado a: ${newStatus}`);
    }

    return { success: true, message: 'Webhook procesado correctamente' };
  } catch (error) {
    console.error('❌ Error en handleMercadoPagoWebhook:', error);
    return { success: false, error: 'Error al procesar webhook' };
  }
}

/**
 * Obtener historial de transacciones del usuario
 * @returns Lista de transacciones del usuario autenticado
 */
export async function getUserTransactionsAction() {
  try {
    // 1. Validar usuario autenticado
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
        transactions: [],
      };
    }

    // 2. Obtener transacciones del usuario
    const transactionsSnapshot = await db
      .collection('creditTransactions')
      .where('userId', '==', user.uid)
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
