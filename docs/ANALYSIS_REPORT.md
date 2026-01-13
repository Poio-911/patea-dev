# Análisis de Problemas Pendientes - Pateá App

**Versión**: 2.0
**Fecha**: 8 de Diciembre, 2025 - 19:00 ART
**Baseline**: Commit `41e6391c` (branch: dev-app-Ai)
**Alcance**: Análisis de problemas pendientes post-mejoras de seguridad y data integrity
**Ver mejoras implementadas**: [IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md)

---

## 📊 Resumen Ejecutivo

**Estado General**: ✅ La aplicación compila sin errores de TypeScript y tiene una arquitectura sólida.

**Mejoras Recientes (8 Dic 2025)**: 26 problemas resueltos en commits 9c08911-41e6391c
- 🔒 Seguridad: API keys, webhooks, auth
- 🔐 Data integrity: Transacciones atómicas
- ✅ Validaciones: 23 funciones
- 🔄 Error recovery: Retry logic

**Problemas Pendientes**: **30 issues** distribuidos en 8 categorías
**Severidad**:
- 🔴 **Crítica**: 5 problemas
- 🟠 **Alta**: 8 problemas
- 🟡 **Media**: 10 problemas
- 🟢 **Baja**: 7 problemas

---

## 🔴 CATEGORÍA 1: PROBLEMAS CRÍTICOS (5 problemas)

### 1.1 Uso Excesivo de `console.log` en Producción
**Severidad**: 🔴 Crítica
**Estado**: 🔴 PENDIENTE
**Verificado**: ✅ 8 Dic 2025 (71 ocurrencias en `src/lib/actions/`)

**Archivos Afectados**:
- `src/lib/actions/server-actions.ts` (25 console.log)
- `src/lib/actions/payment-actions.ts` (12 console.log)
- `src/lib/actions/social-actions.ts` (5 console.log)
- Otros actions: 29 console.log

**Problema**: Múltiples `console.log/error/warn` en código de producción que pueden:
- Exponer información sensible en logs
- Degradar performance
- Llenar logs innecesariamente

**Solución**:
```typescript
// ❌ Actualmente
console.log('[createCupMatchAction] Cup groupId:', cup.groupId);

// ✅ Usar logger existente
import { logger } from '@/lib/logger';
logger.info('[createCupMatchAction] Cup groupId:', cup.groupId);
```

El sistema `logger.ts` ya existe y filtra automáticamente en producción.

---

### 1.2 Type Safety: Uso Excesivo de `any`
**Severidad**: 🔴 Crítica
**Estado**: 🔴 PENDIENTE

**Archivos Afectados**:
- `src/lib/actions/server-actions.ts` (10+ usos)
- `src/lib/actions/payment-actions.ts:212` - `handleMercadoPagoWebhook(data: any)`
- `src/lib/actions/social-actions.ts:14` - `as any` para FieldValue

**Problema**: Pérdida de type safety:

```typescript
// payment-actions.ts:212
export async function handleMercadoPagoWebhook(data: any) { ... }

// social-actions.ts:14
timestamp: FieldValue.serverTimestamp() as any,
```

**Solución**:
```typescript
// Crear tipos para MercadoPago
interface MercadoPagoWebhookData {
  action: string;
  api_version: string;
  data: { id: string };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: 'payment' | 'subscription' | 'invoice';
  user_id: string;
}

export async function handleMercadoPagoWebhook(data: MercadoPagoWebhookData) { ... }

// Para FieldValue
timestamp: FieldValue.serverTimestamp() as Timestamp | FieldValue,
```

---

### 1.3 Webhook de MercadoPago: Bypass de Validación en Dev
**Severidad**: 🔴 Crítica
**Estado**: ⚠️ PARCIALMENTE RESUELTO
**Archivo**: `src/app/api/webhooks/mercadopago/route.ts:16-18`

**Problema**: Aunque ya implementamos validación HMAC-SHA256, aún permite bypass:

```typescript
// route.ts:16-18
if (!secret) {
  console.warn('⚠️ MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation');
  return true; // ❌ PELIGROSO: permite webhooks sin validar en dev
}
```

**Impacto**:
- Si se despliega sin secret, acepta webhooks falsos
- Posible fraude en pagos

**Solución**:
```typescript
if (!secret) {
  logger.error('MERCADOPAGO_WEBHOOK_SECRET not configured - rejecting webhook');
  return false; // ✅ NUNCA permitir sin secret
}
```

---

### 1.4 FCM Push Notifications: No Implementadas
**Severidad**: 🟠 Alta
**Estado**: 🔴 PENDIENTE
**Archivo**: `src/lib/actions/notification-actions.ts:111`

**Problema**:
```typescript
// notification-actions.ts:111
// TODO: Implement actual FCM sending logic
```

**Impacto**: Las notificaciones push NO están funcionando, solo se guardan en Firestore.

**Solución**: Implementar envío real usando Firebase Admin SDK:
```typescript
import { getAdminMessaging } from '@/firebase/admin-init';

const message = {
  token: userFcmToken,
  notification: {
    title: notification.title,
    body: notification.body,
  },
  data: notification.data,
};

await getAdminMessaging().send(message);
```

---

### 1.5 Índices Firestore: Documentados pero No Implementados
**Severidad**: 🟠 Alta
**Estado**: 📝 DOCUMENTADO en [FIRESTORE_INDEXES_RECOMMENDATIONS.md](./FIRESTORE_INDEXES_RECOMMENDATIONS.md)

**Problema**: 8 índices compuestos recomendados NO están implementados en Firebase Console.

**Impacto**:
- Queries ~10x más lentas
- Posibles timeouts en producción
- Mala UX en listas grandes

**Índices pendientes**:
1. Matches: `groupId` (ASC) + `status` (ASC) + `date` (ASC)
2. Players: `groupId` (ASC) + `ovr` (DESC)
3. Evaluations: `matchId` (ASC) + `evaluatorId` (ASC) + `evaluatedAt` (DESC)
4. Credit Transactions: `userId` (ASC) + `status` (ASC) + `createdAt` (DESC)
5. Social Activities: `userId` (ASC) + `timestamp` (DESC)
6. Follows: `followerId` (ASC) + `createdAt` (DESC)
7. Leagues: `groupId` (ASC) + `status` (ASC) + `createdAt` (DESC)
8. Notifications: `userId` (ASC) + `isRead` (ASC) + `createdAt` (DESC)

**Solución**: Implementar en Firebase Console o vía `firebase deploy --only firestore:indexes`

---

## 🟠 CATEGORÍA 2: PROBLEMAS DE COHERENCIA DE DATOS (8 problemas)

### 2.1 Inconsistencia en Tipos de Timestamp
**Severidad**: 🟡 Media
**Archivo**: `src/lib/types.ts:733`

**Problema**:
```typescript
timestamp: Timestamp | string;
```

**Impacto**: Confusión entre ISO strings y Firestore Timestamps.

**Solución**: Estandarizar a ISO strings, convertir Timestamps en lectura.

---

### 2.2 Match.playerUids Duplica Datos de Match.players
**Severidad**: 🟡 Media
**Archivo**: `src/lib/types.ts:119`

**Problema**:
```typescript
players: { uid: string; displayName: string; ... }[];
playerUids: string[]; // ❌ Duplicación
```

**Solución**: Eliminar `playerUids`, usar `array-contains` en `players.uid`.

---

### 2.3 League Standings: No Se Recalculan Automáticamente
**Severidad**: 🟠 Alta
**Archivo**: `src/lib/actions/server-actions.ts`

**Problema**: `updateLeagueStandingsAction` debe llamarse manualmente.

**Impacto**: Tabla de posiciones puede quedar desactualizada.

**Solución**: Llamar automáticamente desde `finalizeMatchAction` si es partido de liga.

---

### 2.4 Cup Bracket: No Valida Consistencia de Equipos
**Severidad**: 🟡 Media
**Archivo**: `src/lib/actions/server-actions.ts:2057-2063`

**Problema**: `advanceCupWinnerAction` no valida que winnerId sea uno de los equipos del partido.

**Solución**:
```typescript
if (winnerId !== bracketMatch.team1Id && winnerId !== bracketMatch.team2Id) {
  return { error: 'Equipo inválido' };
}
```

---

### 2.5 Player Stats: No Maneja Partidos Cancelados
**Severidad**: 🟡 Media
**Archivo**: `src/lib/actions/player-stats-actions.ts`

**Problema**: Si un partido se cancela después de evaluado, las stats no se revierten.

**Solución**: Implementar `revertMatchStatsAction`.

---

### 2.6 Credit Reset: Doble Implementación Temporal
**Severidad**: 🟡 Media
**Archivos**:
- `functions/src/scheduled/reset-monthly-credits.ts` (Cloud Function)
- `src/firebase/auth/use-user.tsx` (Client fallback)

**Problema**: Dos sistemas pueden causar race conditions.

**Nota**: Es **temporal** hasta activar billing en Firebase Console.

**Solución**: Deshabilitar fallback client-side cuando billing esté activo.

---

### 2.7 Team Availability Posts: Estado No Se Actualiza
**Severidad**: 🟡 Media
**Archivo**: `src/lib/actions/server-actions.ts`

**Problema**: Cuando se acepta un challenge, el post debería cambiar a `status: 'matched'`.

**Solución**: Actualizar estado en `acceptTeamChallengeAction`.

---

### 2.8 Match Invitations: No Limpia Invitaciones Expiradas
**Severidad**: 🟢 Baja
**Archivo**: `src/lib/actions/match-invitation-actions.ts`

**Problema**: Invitaciones a partidos pasados nunca se eliminan.

**Solución**: Cloud Function para limpiar invitaciones >30 días.

---

## 🟡 CATEGORÍA 3: PROBLEMAS DE VALIDACIÓN (3 problemas)

### 3.1 Match Score: Límite Irreal
**Severidad**: 🟡 Media
**Archivo**: `src/lib/validation.ts`

**Problema**: Permite scores hasta 99 goles (irreal en fútbol amateur).

**Solución**: Reducir límite a 30 goles por equipo.

---

### 3.2 Player Attributes: No Valida Coherencia con OVR
**Severidad**: 🟢 Baja

**Problema**: No valida que suma de atributos sea coherente con OVR.

**Solución**: Agregar validación de coherencia.

---

### 3.3 Jersey Colors: No Valida Contraste
**Severidad**: 🟢 Baja

**Problema**: Permite colores primario y secundario muy similares.

**Solución**: Validar contraste mínimo.

---

## 🎨 CATEGORÍA 4: PROBLEMAS UI/UX (5 problemas)

### 4.1 Game Mode: Contraste Insuficiente
**Severidad**: 🟡 Media
**Archivo**: `src/app/globals.css:81-82`

**Problema**: `--muted-foreground: 215 20% 75%` puede ser difícil de leer.

**Solución**: Aumentar a `215 20% 85%`.

---

### 4.2 Player Cards: Animaciones Pesadas en Mobile
**Severidad**: 🟡 Media
**Archivo**: `src/app/globals.css`

**Solución**: Usar `@media (prefers-reduced-motion: reduce)` para deshabilitar.

---

### 4.3 Responsive Design: Navegación Horizontal en Mobile
**Severidad**: 🟡 Media
**Archivo**: `src/app/main-nav.tsx`

**Problema**: Navegación horizontal puede ser difícil en pantallas pequeñas.

**Solución**: Bottom navigation bar en mobile.

---

### 4.4 Loading States: Faltan Skeletons
**Severidad**: 🟡 Media

**Problema**: Muchos componentes muestran "Cargando..." en lugar de skeletons.

**Solución**: Implementar skeleton screens.

---

### 4.5 Error States: Mensajes Genéricos
**Severidad**: 🟢 Baja

**Problema**: Errores muestran mensajes técnicos.

**Solución**: Diccionario de mensajes amigables.

---

## 🔧 CATEGORÍA 5: CÓDIGO Y ARQUITECTURA (2 problemas)

### 5.1 Error Handling: No Usa Sistema Centralizado
**Severidad**: 🟡 Media

**Problema**: No todos los catch blocks usan `handleServerActionError`.

**Solución**: Estandarizar uso en todos los catch blocks.

---

### 5.2 Type Imports: Mezcla de Estilos
**Severidad**: 🟢 Baja

**Problema**: Mezcla de `import type` y `import` regular.

**Solución**: Usar `import type` consistentemente.

---

## ⚡ CATEGORÍA 6: PERFORMANCE (3 problemas)

### 6.1 Player Fetching: N+1 Query Problem
**Severidad**: 🟠 Alta
**Archivo**: `src/lib/actions/server-actions.ts`

**Problema**: En algunos lugares se hace fetch individual en loops.

**Solución**: Usar `getAll` consistentemente.

---

### 6.2 Social Feed: No Usa Paginación
**Severidad**: 🟡 Media

**Problema**: Carga todas las actividades de una vez.

**Solución**: Paginación con `startAfter`.

---

### 6.3 Image Generation: No Usa Caché
**Severidad**: 🟡 Media

**Problema**: Llama a Gemini incluso si foto no cambió.

**Solución**: Cachear resultado basado en hash.

---

## 🔐 CATEGORÍA 7: SEGURIDAD (2 problemas)

### 7.1 Server Actions: Ownership Validation Inconsistente
**Severidad**: 🟠 Alta

**Problema**: No todas las acciones validan ownership.

**Solución**: Agregar validación en TODAS las acciones de modificación.

---

### 7.2 Firebase Rules: No Documentadas
**Severidad**: 🟡 Media

**Problema**: No hay documentación de reglas de seguridad.

**Solución**: Crear `docs/FIRESTORE_RULES.md`.

---

## 📱 CATEGORÍA 8: PWA Y MOBILE (2 problemas)

### 8.1 Service Worker: No Maneja Offline
**Severidad**: 🟡 Media

**Problema**: No hay manejo de estado offline.

**Solución**: Detector de conexión y banner offline.

---

### 8.2 Install Prompt: No Persiste Dismissal
**Severidad**: 🟢 Baja

**Problema**: Prompt vuelve a aparecer si usuario rechaza.

**Solución**: Guardar dismissal en localStorage.

---

## 📦 APÉNDICE: Problemas Resueltos (8 Dic 2025)

Los siguientes problemas fueron resueltos en commits `9c08911`-`41e6391c`:

### Seguridad (Commit 9c08911)
- ✅ **API Keys Hardcodeadas**: Eliminadas de `config.ts` y `genkit.ts`
- ✅ **Webhook Validation**: Implementada HMAC-SHA256 (falta remover bypass)
- ✅ **Server-side Auth**: Creado `get-server-session.ts`

### Data Integrity (Commit 2d8aa7d)
- ✅ **Race Condition Follow/Unfollow**: Resuelto con transactions + ID determinístico
- ✅ **Photo Sync**: Transaction atómica en 3 ubicaciones
- ✅ **Payment Idempotency**: Check de idempotencia completo
- ✅ **Player Stats Atomic**: `FieldValue.increment()` implementado
- ✅ **League Completion**: Transactions para declaración de campeón

### Refactoring (Commits 0ac65c5, 99d70a2)
- ✅ **OVR Level Duplication**: Centralizado en `player-utils.ts`
- ✅ **Magic Numbers**: Extraídos a `constants.ts`
- ✅ **Dead Code**: Limpiado en `data.ts`

### Nuevas Features (Commits 0ac65c5, 377d87f)
- ✅ **Validation System**: 23 funciones en `validation.ts`
- ✅ **Retry Logic**: Sistema completo con circuit breaker
- ✅ **Cloud Function**: Reset mensual de créditos

Ver detalles en [IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md).

---

## 📋 PLAN DE ACCIÓN ACTUALIZADO

### Fase 1: Críticos (Prioridad Inmediata)
1. ⏳ Reemplazar `console.log` por `logger` (71 ocurrencias)
2. ⏳ Remover bypass de webhook validation
3. ⏳ Implementar tipos específicos (eliminar `any`)
4. ⏳ Implementar índices de Firestore (8 índices)
5. ⏳ Implementar FCM real

### Fase 2: Alta Prioridad
1. ⏳ Validar ownership en todas las server actions
2. ⏳ Auto-actualizar league standings
3. ⏳ Arreglar N+1 queries

### Fase 3: Media Prioridad
1. ⏳ Mejorar contraste en game mode
2. ⏳ Implementar skeletons
3. ⏳ Agregar paginación en social feed
4. ⏳ Estandarizar error handling

### Fase 4: Baja Prioridad (Backlog)
1. ⏳ Limpieza de datos antiguos
2. ⏳ Mensajes de error amigables
3. ⏳ Optimizar animaciones mobile
4. ⏳ PWA offline experience

---

## 🎯 MÉTRICAS DE ÉXITO

**Situación Actual (Post-Mejoras 8 Dic)**:
- ✅ TypeScript: 0 errores
- ⚠️ Console logs: 71 en producción
- ⚠️ Type safety: ~20 usos de `any`
- ❌ Queries sin índices: 8 queries lentas
- ⚠️ Security: 1 bypass de webhook

**Objetivo**:
- ✅ TypeScript: 0 errores
- ✅ Console logs: 0 en producción
- ✅ Type safety: 0 usos innecesarios de `any`
- ✅ Queries: 100% con índices
- ✅ Security: 0 vulnerabilidades

---

## 📚 RECURSOS

- [IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md) - 26 mejoras implementadas hoy
- [ANALYSIS_REPORT_REVIEW.md](./ANALYSIS_REPORT_REVIEW.md) - Revisión de este documento
- [CLAUDE.md](../CLAUDE.md) - Guía de arquitectura
- [FIRESTORE_INDEXES_RECOMMENDATIONS.md](./FIRESTORE_INDEXES_RECOMMENDATIONS.md) - Índices pendientes

---

**Fin del Análisis**
**Versión**: 2.0
**Problemas Pendientes**: 30 (reducidos de 47)
**Resueltos Recientemente**: 17 problemas (8 Dic 2025)
**Prioridad Inmediata**: 5 críticos + 8 altos = 13 issues
