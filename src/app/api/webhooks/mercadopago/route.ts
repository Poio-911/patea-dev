import { NextRequest, NextResponse } from 'next/server';
import { handleMercadoPagoWebhook } from '@/lib/actions/payment-actions';
import crypto from 'crypto';

/**
 * Valida la firma de MercadoPago para asegurar que el webhook es auténtico
 * Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
function validateMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  body: any
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('⚠️ MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation');
    return true; // En desarrollo podemos permitir sin secret
  }

  try {
    // Parse signature header: "ts=123456,v1=hash"
    const parts = xSignature.split(',');
    const tsMatch = parts.find(p => p.startsWith('ts='));
    const hashMatch = parts.find(p => p.startsWith('v1='));

    if (!tsMatch || !hashMatch) {
      console.error('❌ Invalid signature format');
      return false;
    }

    const ts = tsMatch.split('=')[1];
    const receivedHash = hashMatch.split('=')[1];

    // Construir manifest según documentación de MercadoPago
    // Format: id:paymentId;request-id:requestId;ts:timestamp;
    const dataId = body.data?.id || body.id || '';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Generar HMAC-SHA256
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    const isValid = hmac === receivedHash;

    if (!isValid) {
      console.error('❌ Signature validation failed');
      console.error('   Expected:', hmac);
      console.error('   Received:', receivedHash);
      console.error('   Manifest:', manifest);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error validating signature:', error);
    return false;
  }
}

/**
 * Webhook de Mercado Pago
 * Esta ruta es llamada por Mercado Pago cuando hay cambios en un pago
 *
 * Configuración en Mercado Pago:
 * - URL: https://tu-dominio.com/api/webhooks/mercadopago
 * - Eventos: payment
 * - Secret: Configurar MERCADOPAGO_WEBHOOK_SECRET en variables de entorno
 */
export async function POST(request: NextRequest) {
  try {
    // Headers de Mercado Pago para validación
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');

    console.log('🔔 Webhook recibido en /api/webhooks/mercadopago');
    console.log('🔐 Headers:');
    console.log('   - x-signature:', xSignature ? 'present' : 'missing');
    console.log('   - x-request-id:', xRequestId);

    // Validar que existan los headers requeridos
    if (!xSignature || !xRequestId) {
      console.error('❌ Missing required headers');
      return NextResponse.json(
        { error: 'Missing signature or request ID' },
        { status: 401 }
      );
    }

    // Leer body del request
    const body = await request.json();
    console.log('📦 Body type:', body.type);
    console.log('📦 Body action:', body.action);

    // Validar firma de Mercado Pago
    const isValidSignature = validateMercadoPagoSignature(xSignature, xRequestId, body);

    if (!isValidSignature) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    console.log('✅ Signature validated');

    // Procesar webhook con server action
    const result = await handleMercadoPagoWebhook(body);

    if (result.success) {
      console.log('✅ Webhook procesado exitosamente');
      return NextResponse.json({ received: true, message: result.message }, { status: 200 });
    } else {
      console.error('❌ Error al procesar webhook:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Error en webhook de Mercado Pago:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint para verificar que la ruta está activa
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Webhook de Mercado Pago activo',
    endpoint: '/api/webhooks/mercadopago',
  });
}
