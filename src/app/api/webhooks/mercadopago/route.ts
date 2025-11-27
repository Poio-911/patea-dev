import { NextRequest, NextResponse } from 'next/server';
import { handleMercadoPagoWebhook } from '@/lib/actions/payment-actions';

/**
 * Webhook de Mercado Pago
 * Esta ruta es llamada por Mercado Pago cuando hay cambios en un pago
 *
 * Configuración en Mercado Pago:
 * - URL: https://tu-dominio.com/api/webhooks/mercadopago
 * - Eventos: payment
 */
export async function POST(request: NextRequest) {
  try {
    // Leer body del request
    const body = await request.json();

    console.log('🔔 Webhook recibido en /api/webhooks/mercadopago');
    console.log('📦 Body:', JSON.stringify(body, null, 2));

    // Headers de Mercado Pago para validación
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');

    console.log('🔐 Headers:');
    console.log('   - x-signature:', xSignature);
    console.log('   - x-request-id:', xRequestId);

    // TODO: Validar firma de Mercado Pago (opcional pero recomendado para producción)
    // https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#editor_12

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
