# Payments & Credits - Sistema de Pagos y Créditos

## Descripción General

Sistema de monetización que permite a los usuarios comprar créditos para generar imágenes de jugadores con IA. Integrado con MercadoPago para procesamiento de pagos seguro.

## Concepto

Los usuarios tienen **créditos de generación de imágenes** que se consumen al:
- Generar foto profesional de jugador con IA (1 crédito)
- Generar tarjeta FIFA-style del jugador (1 crédito)
- Generar imagen duo con otro jugador (2 créditos)

**Sistema de créditos**:
- **3 créditos gratis mensuales** por jugador
- Reset automático el día 1 de cada mes
- Créditos comprados **no expiran**
- Los gratuitos **no se acumulan** (se pierden si no se usan)

## Componentes Principales

### payments/credit-packages-dialog.tsx

Dialog que muestra los paquetes de créditos disponibles para compra.

**Features:**
- Lista de paquetes con pricing
- Highlight del paquete más popular
- Descuentos por volumen
- Badge "Mejor valor" en paquete recomendado
- Preview de cuántas generaciones incluye
- Método de pago: MercadoPago
- Términos y condiciones link

**Paquetes disponibles:**

```typescript
const CREDIT_PACKAGES = [
  {
    id: 'small',
    name: 'Paquete Pequeño',
    credits: 10,
    price: 500,  // ARS
    priceUSD: 5,
    popular: false,
  },
  {
    id: 'medium',
    name: 'Paquete Mediano',
    credits: 25,
    price: 1000,
    priceUSD: 10,
    discount: '20%',
    popular: true,
  },
  {
    id: 'large',
    name: 'Paquete Grande',
    credits: 50,
    price: 1500,
    priceUSD: 15,
    discount: '40%',
    popular: false,
    badge: 'Mejor Valor',
  },
  {
    id: 'mega',
    name: 'Paquete Mega',
    credits: 100,
    price: 2500,
    priceUSD: 25,
    discount: '50%',
    popular: false,
  },
];
```

## Server Actions

### payment-actions.ts

```typescript
// Crear compra de créditos
createCreditPurchaseAction(data: {
  userId: string;
  playerId: string;
  packageId: string;
  credits: number;
  amount: number;
  currency: string;
})

// Procesar pago exitoso (llamado por webhook)
processCreditPurchaseAction(paymentData: {
  paymentId: string;
  status: string;
  externalReference: string;  // purchaseId
})

// Verificar status de pago
checkPaymentStatusAction(paymentId: string)

// Obtener historial de compras
getPurchaseHistoryAction(userId: string)

// Refund (admin only)
refundPurchaseAction(purchaseId: string, reason: string)
```

## API Route: MercadoPago Webhook

### /api/webhooks/mercadopago/route.ts

Endpoint que recibe notificaciones de MercadoPago cuando cambia el estado de un pago.

**Flow:**
1. Usuario completa pago en MercadoPago
2. MercadoPago envía webhook a nuestra API
3. Webhook verifica la firma (security)
4. Consulta API de MercadoPago para confirmar pago
5. Actualiza purchase document en Firestore
6. Acredita créditos al jugador
7. Envía notificación al usuario

**Endpoint:**
```
POST /api/webhooks/mercadopago
```

**Headers requeridos:**
```
x-signature: [MercadoPago signature]
x-request-id: [Request ID]
```

**Payload example:**
```json
{
  "action": "payment.updated",
  "api_version": "v1",
  "data": {
    "id": "123456789"
  },
  "date_created": "2024-01-15T10:30:00Z",
  "id": 123,
  "live_mode": true,
  "type": "payment",
  "user_id": "987654321"
}
```

**Response:**
- `200 OK`: Webhook procesado correctamente
- `400 Bad Request`: Firma inválida o payload malformed
- `500 Internal Error`: Error al procesar

**Security:**
- Verificación de firma con secret key
- Idempotency: Evitar procesar mismo webhook dos veces
- Rate limiting en el endpoint
- IP whitelist de MercadoPago

## Modelo de Datos

### CreditPackage

```typescript
// /creditPackages/{packageId}
{
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;  // 'ARS', 'USD'
  discount?: string;  // '20%', '40%'
  popular: boolean;
  active: boolean;  // Admin puede desactivar paquetes
  badge?: string;  // 'Mejor Valor', 'Más Popular'

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### CreditPurchase

```typescript
// /creditPurchases/{purchaseId}
{
  id: string;
  userId: string;
  playerId: string;
  packageId: string;

  // Purchase details
  credits: number;
  amount: number;
  currency: string;

  // MercadoPago
  preferenceId: string;  // MP preference ID
  paymentId?: string;  // MP payment ID (después del pago)
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  paymentMethod?: string;  // 'credit_card', 'debit_card', 'bank_transfer'

  // Timestamps
  createdAt: Timestamp;
  paidAt?: Timestamp;
  refundedAt?: Timestamp;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  externalReference: string;  // Para tracking
}
```

### Player Credits (dentro de Player document)

```typescript
// /players/{playerId}
{
  // ... otros campos del player

  cardGenerationCredits: number;  // Créditos totales disponibles
  lastCreditReset?: string;  // ISO date del último reset mensual
  totalCreditsPurchased?: number;  // Histórico total comprado
  lastPurchaseDate?: string;  // ISO date de última compra

  creditBreakdown?: {
    free: number;  // Créditos gratuitos del mes
    purchased: number;  // Créditos comprados restantes
  };
}
```

## Flujo de Compra Completo

### Paso 1: Usuario inicia compra

Usuario desde perfil del jugador:

1. Ve que tiene 0 créditos restantes
2. Click "Comprar Créditos"
3. Se abre `CreditPackagesDialog`
4. Selecciona paquete (ej: Mediano - 25 créditos por $1000)
5. Click "Comprar con MercadoPago"

### Paso 2: Server crea preferencia de pago

```typescript
const purchase = await createCreditPurchaseAction({
  userId: user.uid,
  playerId: player.id,
  packageId: 'medium',
  credits: 25,
  amount: 1000,
  currency: 'ARS',
});

// Crea preferencia en MercadoPago
const preference = await mercadopago.preferences.create({
  items: [
    {
      title: 'Paquete Mediano - 25 créditos',
      unit_price: 1000,
      quantity: 1,
    }
  ],
  external_reference: purchase.id,
  notification_url: 'https://patea.app/api/webhooks/mercadopago',
  back_urls: {
    success: `https://patea.app/players/${playerId}?payment=success`,
    failure: `https://patea.app/players/${playerId}?payment=failure`,
    pending: `https://patea.app/players/${playerId}?payment=pending`,
  },
});

// Retorna preference.id para iniciar checkout
return { preferenceId: preference.id };
```

### Paso 3: Usuario completa pago

1. Redirect a MercadoPago checkout page
2. Usuario ingresa datos de tarjeta
3. MercadoPago procesa pago
4. Redirect de vuelta a la app

### Paso 4: Webhook procesa resultado

MercadoPago envía webhook:

```typescript
export async function POST(request: Request) {
  // Verificar firma
  const signature = request.headers.get('x-signature');
  if (!verifySignature(signature, body)) {
    return new Response('Invalid signature', { status: 400 });
  }

  // Obtener payment details
  const { data } = await request.json();
  const payment = await mercadopago.payment.get(data.id);

  if (payment.status === 'approved') {
    const purchaseId = payment.external_reference;

    // Actualizar purchase
    await updateDoc(doc(db, 'creditPurchases', purchaseId), {
      status: 'approved',
      paymentId: payment.id,
      paidAt: serverTimestamp(),
    });

    // Acreditar créditos al jugador
    const purchase = await getDoc(doc(db, 'creditPurchases', purchaseId));
    const { playerId, credits } = purchase.data();

    await updateDoc(doc(db, 'players', playerId), {
      cardGenerationCredits: increment(credits),
      totalCreditsPurchased: increment(credits),
      lastPurchaseDate: new Date().toISOString(),
      'creditBreakdown.purchased': increment(credits),
    });

    // Enviar notificación
    await sendNotification({
      userId: purchase.data().userId,
      title: '✅ Compra exitosa',
      body: `Se acreditaron ${credits} créditos a tu jugador`,
    });
  }

  return new Response('OK', { status: 200 });
}
```

### Paso 5: Usuario ve confirmación

1. Redirect de vuelta a perfil del jugador
2. Toast notification: "✅ Compra exitosa"
3. Balance actualizado: "25 créditos disponibles"
4. Puede usar los créditos inmediatamente

## Sistema de Créditos Gratuitos

### Reset Mensual

Ejecutado por Cloud Function scheduled (cron):

```typescript
// Ejecuta el día 1 de cada mes a las 00:00 UTC
export const resetFreeCredits = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('America/Argentina/Buenos_Aires')
  .onRun(async (context) => {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // Obtener todos los jugadores
    const playersSnapshot = await getDocs(collection(db, 'players'));

    playersSnapshot.forEach((playerDoc) => {
      const data = playerDoc.data();
      const purchasedCredits = data.creditBreakdown?.purchased || 0;

      // Reset: 3 gratuitos + purchased que no se tocan
      batch.update(playerDoc.ref, {
        cardGenerationCredits: 3 + purchasedCredits,
        lastCreditReset: now,
        'creditBreakdown.free': 3,
      });
    });

    await batch.commit();
    console.log(`Reset ${playersSnapshot.size} players credits`);
  });
```

### Consumo de Créditos

Al generar imagen:

```typescript
async function consumeCredit(playerId: string): Promise<boolean> {
  const playerRef = doc(db, 'players', playerId);
  const player = await getDoc(playerRef);
  const data = player.data();

  if (data.cardGenerationCredits <= 0) {
    throw new Error('No credits available');
  }

  // Consumir primero créditos gratuitos, luego comprados
  const breakdown = data.creditBreakdown || { free: 0, purchased: 0 };

  if (breakdown.free > 0) {
    // Consumir gratis
    await updateDoc(playerRef, {
      cardGenerationCredits: increment(-1),
      'creditBreakdown.free': increment(-1),
    });
  } else {
    // Consumir comprados
    await updateDoc(playerRef, {
      cardGenerationCredits: increment(-1),
      'creditBreakdown.purchased': increment(-1),
    });
  }

  return true;
}
```

## UI/UX del Sistema de Créditos

### Credit Balance Display

Visible en perfil del jugador:

```
┌─────────────────────────────┐
│ 💳 Créditos: 18             │
│   ├─ Gratuitos: 3 (este mes)│
│   └─ Comprados: 15          │
│                              │
│ [Comprar Más Créditos]      │
└─────────────────────────────┘
```

### Credit Warning

Al intentar generar sin créditos:

```
⚠️ Sin créditos disponibles

Necesitas 1 crédito para generar esta imagen.

[Ver Paquetes] [Cancelar]
```

### Purchase Success

Después de compra exitosa:

```
✅ ¡Compra exitosa!

Se acreditaron 25 créditos a tu jugador.

Balance actual: 25 créditos
Válidos hasta: Sin expiración

[Generar Foto] [Ver Historial]
```

### Purchase History

Vista de historial de compras:

```
Historial de Compras
────────────────────
15/01/2024 - Paquete Mediano
  25 créditos - $1,000 ARS
  Estado: Aprobado ✅

10/12/2023 - Paquete Pequeño
  10 créditos - $500 ARS
  Estado: Aprobado ✅

Total gastado: $1,500 ARS
Total créditos comprados: 35
```

## Pricing Strategy

### Argentina (ARS)

- Pequeño: 10 créditos - $500 ($50/crédito)
- Mediano: 25 créditos - $1,000 ($40/crédito) - 20% descuento
- Grande: 50 créditos - $1,500 ($30/crédito) - 40% descuento
- Mega: 100 créditos - $2,500 ($25/crédito) - 50% descuento

### Internacional (USD)

- Pequeño: 10 créditos - $5 ($0.50/crédito)
- Mediano: 25 créditos - $10 ($0.40/crédito)
- Grande: 50 créditos - $15 ($0.30/crédito)
- Mega: 100 créditos - $25 ($0.25/crédito)

### Pricing Dinámico

Admin puede ajustar precios desde Firebase console sin código:

```typescript
// /config/pricing
{
  ars: {
    small: 500,
    medium: 1000,
    large: 1500,
    mega: 2500,
  },
  usd: {
    small: 5,
    medium: 10,
    large: 15,
    mega: 25,
  }
}
```

## Transaction Security

### Medidas de Seguridad

1. **Verificación de firma** en webhook
2. **Idempotency keys** para evitar doble procesamiento
3. **IP whitelist** de MercadoPago
4. **HTTPS only** en endpoints
5. **Rate limiting** en webhook endpoint
6. **Logging completo** de todas las transacciones
7. **Alertas** en Slack para transacciones fallidas

### Fraud Prevention

- Verificar que `external_reference` (purchaseId) no fue procesado antes
- Verificar que monto pagado coincide con monto esperado
- Verificar que playerId existe y pertenece al userId
- Rate limiting: Max 5 compras por usuario por hora

### Refund Policy

Usuario puede solicitar refund si:
- Error en procesamiento de créditos
- Doble cobro
- Arrepentimiento dentro de 7 días (sin haber usado créditos)

Admin procesa refund:
```typescript
await refundPurchaseAction(purchaseId, 'User request - unused credits');
```

## Analytics y Métricas

### Tracking de Conversión

- **Funnel de compra**:
  - Vistas del dialog de paquetes
  - Clicks en "Comprar"
  - Redirects a MercadoPago
  - Pagos completados
  - Tasa de conversión %

### Revenue Metrics

- **MRR** (Monthly Recurring Revenue)
- **ARPU** (Average Revenue Per User)
- **LTV** (Lifetime Value)
- Paquete más vendido
- Hora/día con más ventas

### User Behavior

- Tiempo desde registro hasta primera compra
- Frecuencia de compra
- Créditos promedio por usuario
- Tasa de uso de créditos gratuitos vs comprados

## Integraciones

### Con Player Profile

- Balance de créditos visible
- Botón "Comprar Créditos"
- Warning cuando quedan <3 créditos
- Historial de compras en settings

### Con Image Generation

- Validar créditos antes de generar
- Consumir crédito después de generación exitosa
- Mostrar balance restante después de generar

### Con Notifications

- Notificar cuando compra es exitosa
- Notificar cuando quedan pocos créditos (1-2)
- Notificar en reset mensual de créditos gratuitos
- Recordar créditos gratuitos sin usar al fin de mes

## Limitaciones Actuales

- Solo método de pago: MercadoPago
- Solo soporta ARS y USD
- No hay suscripciones recurrentes
- No hay gifting de créditos entre usuarios
- No hay sistema de referral/affiliate

## Próximas Mejoras

- [ ] Suscripción mensual ($X/mes = Y créditos/mes)
- [ ] Gifting: Enviar créditos a otro usuario
- [ ] Referral system: Invita amigo → 5 créditos gratis
- [ ] Bulk discount para grupos (compra grupal)
- [ ] Más métodos de pago (PayPal, Stripe, crypto)
- [ ] Promociones estacionales (Black Friday, etc.)
- [ ] Loyalty program: Acumular puntos por compras
- [ ] Family plan: Compartir créditos entre jugadores
- [ ] Enterprise plan para academias/clubes

---

**Nota**: El sistema de créditos está diseñado para ser justo (3 gratis mensuales) mientras genera revenue sostenible. Los créditos comprados nunca expiran, lo que incentiva compras de paquetes grandes con descuento.
