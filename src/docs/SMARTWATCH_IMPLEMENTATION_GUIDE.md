# Guía de Implementación - Integración con Smartwatch

## 📱 Visión General

Esta integración permite a los usuarios vincular sus datos de actividad física desde Google Fit (Android/Web) o **ingresar manualmente** a sus partidos en Pateá, permitiendo que **métricas reales impacten LEVEMENTE en los atributos del jugador**.

### ⚠️ PRINCIPIO FUNDAMENTAL DE EQUIDAD

**NO TENER SMARTWATCH NO DEBE SER UNA DESVENTAJA**

Este sistema está diseñado como un **bonus opcional pequeño**, NO como la forma principal de progresar:

- ✅ **Evaluaciones normales (puntos/tags) son LA FORMA PRINCIPAL** de mejorar
- ✅ **Entrada manual disponible** para quienes no tienen smartwatch
- ✅ **Bonuses LIMITADOS**: Máximo +1 PAC y +1 PHY por partido
- ✅ **Completamente opcional**: No afecta negativamente si no se usa

### Beneficios Clave
- ✅ **Objetividad**: Datos concretos como complemento
- ✅ **Inclusivo**: Entrada manual para todos
- ✅ **Motivación**: Incentiva a los jugadores a esforzarse físicamente
- ✅ **Balanceado**: No genera desventaja para quienes no tienen tecnología

---

## 🏗️ Arquitectura Implementada

### 1. Estructura de Datos

```
users/{uid}/healthConnections/google_fit/
  - accessToken (OAuth2)
  - refreshToken (OAuth2)
  - expiresAt
  - scopes
  - connectedAt
  - lastSyncAt
  - isActive

matches/{matchId}/playerPerformance/{performanceId}/
  - playerId
  - userId
  - distance (km)
  - avgHeartRate (bpm)
  - maxHeartRate (bpm)
  - steps
  - calories (kcal)
  - duration (minutos)
  - source: 'google_fit' | 'manual'
  - activityStartTime
  - activityEndTime
  - linkedAt
  - impactOnAttributes: { pac: +2, phy: +1 }
```

### 2. Server Actions Implementadas

#### ✅ `generateGoogleFitAuthUrlAction(userId)`
- Genera URL de OAuth2 para Google Fit
- Retorna: `{ authUrl, state }`

#### ✅ `processGoogleFitCallbackAction(code, state)`
- Procesa callback de OAuth2
- Guarda tokens en Firestore
- Retorna: `{ success: true }`

#### ✅ `fetchGoogleFitActivitiesAction(userId, startTime, endTime)`
- Busca actividades en Google Fit
- Extrae métricas (distancia, HR, pasos, calorías)
- Retorna: `{ sessions: GoogleFitSession[] }`

#### ✅ `linkActivityToMatchAction(userId, playerId, matchId, activityData)`
- Vincula actividad a partido
- **Calcula automáticamente impacto en atributos**
- Guarda en `playerPerformance` subcollection
- Retorna: `{ performanceId }`

#### ✅ `getPlayerPerformanceAction(matchId, playerId)`
- Obtiene métricas físicas de un jugador en un partido
- Retorna: `{ performance: PlayerPerformance }`

#### ✅ `disconnectGoogleFitAction(userId)`
- Desvincula Google Fit del usuario

### 3. Lógica de Impacto en Atributos

**Implementada en:** `src/lib/config/google-fit.ts` → `calculateAttributeImpact()`

```typescript
// ⚠️ IMPORTANTE: Bonuses PEQUEÑOS para evitar desventaja
// El sistema de evaluación normal es la forma PRINCIPAL de progresar

// Bonuses por Distancia → PAC (Velocidad)
- ≥ 10 km: +1 PAC (antes era +2)
- ≥ 8 km:  +0.5 PAC (antes era +1)
- < 8 km:  Sin bonus

// Bonuses por Resistencia → PHY (Físico)
- HR promedio 140-175 bpm: +0.5 PHY (antes era +2)
- HR promedio 120-140 bpm: +0.25 PHY (antes era +1)
- ≥ 15,000 pasos: +0.25 PHY
- ≥ 800 kcal: +0.25 PHY
// Máximo total PHY: +1 (antes era +3)
// Máximo total PAC: +1 (nuevo límite)
```

### Entrada Manual (Sin Smartwatch)

**Server Action:** `addManualPerformanceAction()`

Permite a usuarios **sin smartwatch** ingresar métricas manualmente:
- ✅ Solo requiere: distancia (km) y duración (minutos)
- ✅ El sistema ESTIMA el resto (pasos, calorías, HR)
- ✅ Validación: Límites razonables (0-20 km, 0-180 min)
- ✅ Mismo cálculo de bonus que datos de smartwatch
- ✅ Marcado como `source: 'manual'` para transparencia

---

## 🔧 Configuración Requerida

### Paso 1: Google Cloud Console

1. **Ir a:** https://console.cloud.google.com/
2. **Crear proyecto** (si no existe) o seleccionar proyecto existente
3. **Habilitar APIs:**
   - Google Fitness API
   - Google People API (para perfil básico)

4. **Crear credenciales OAuth 2.0:**
   - Ir a: APIs & Services → Credentials
   - Click: "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Pateá - Google Fit Integration"

5. **Configurar URIs autorizadas:**

   **Authorized JavaScript origins:**
   ```
   http://localhost:3000
   https://tu-dominio.com
   ```

   **Authorized redirect URIs:**
   ```
   http://localhost:3000/api/auth/google-fit/callback
   https://tu-dominio.com/api/auth/google-fit/callback
   ```

6. **Descargar credenciales:**
   - Copiar `Client ID` y `Client Secret`

### Paso 2: Variables de Entorno

Agregar a `.env.local`:

```env
# Google Fit OAuth2
GOOGLE_FIT_CLIENT_ID=tu_client_id_aqui.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/api/auth/google-fit/callback

# Producción
# GOOGLE_FIT_REDIRECT_URI=https://tu-dominio.com/api/auth/google-fit/callback
```

### Paso 3: Pantalla de Consentimiento OAuth

1. Ir a: APIs & Services → OAuth consent screen
2. User Type: **External**
3. Completar información:
   - App name: **Pateá**
   - User support email: tu-email@ejemplo.com
   - Developer contact: tu-email@ejemplo.com

4. **Scopes:** Agregar los siguientes scopes:
   ```
   https://www.googleapis.com/auth/fitness.activity.read
   https://www.googleapis.com/auth/fitness.heart_rate.read
   https://www.googleapis.com/auth/fitness.location.read
   ```

5. **Test users:** Agregar emails de usuarios de prueba

6. **Publicar app** (cuando esté listo para producción)

---

## 🎨 UI Pendiente por Implementar

### 1. Componente: `LinkGoogleFitButton`

**Ubicación sugerida:** Configuración de usuario (`/settings`)

```tsx
'use client';

import { generateGoogleFitAuthUrlAction } from '@/lib/actions/server-actions';

export function LinkGoogleFitButton({ userId }: { userId: string }) {
  const handleConnect = async () => {
    const result = await generateGoogleFitAuthUrlAction(userId);
    if (result.success && result.authUrl) {
      // Redirigir a Google OAuth
      window.location.href = result.authUrl;
    }
  };

  return (
    <Button onClick={handleConnect}>
      <Activity className="mr-2 h-4 w-4" />
      Conectar Google Fit
    </Button>
  );
}
```

### 2. Página: Callback de OAuth

**Crear:** `src/app/api/auth/google-fit/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processGoogleFitCallbackAction } from '@/lib/actions/server-actions';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=auth_failed', request.url));
  }

  const result = await processGoogleFitCallbackAction(code, state);

  if (result.success) {
    return NextResponse.redirect(new URL('/settings?success=google_fit_connected', request.url));
  } else {
    return NextResponse.redirect(new URL('/settings?error=connection_failed', request.url));
  }
}
```

### 3. Componente: `ImportActivityDialog`

**Ubicación sugerida:** Página de detalle del partido completado

```tsx
'use client';

import { useState } from 'react';
import { fetchGoogleFitActivitiesAction, linkActivityToMatchAction } from '@/lib/actions/server-actions';

export function ImportActivityDialog({
  matchId,
  playerId,
  userId,
  matchDate
}: Props) {
  const [sessions, setSessions] = useState<GoogleFitSession[]>([]);

  const handleSearch = async () => {
    // Buscar ±3 horas alrededor del partido
    const startTime = new Date(matchDate);
    startTime.setHours(startTime.getHours() - 3);

    const endTime = new Date(matchDate);
    endTime.setHours(endTime.getHours() + 3);

    const result = await fetchGoogleFitActivitiesAction(
      userId,
      startTime.toISOString(),
      endTime.toISOString()
    );

    if (result.success && result.sessions) {
      setSessions(result.sessions);
    }
  };

  const handleLinkActivity = async (session: GoogleFitSession) => {
    await linkActivityToMatchAction(userId, playerId, matchId, {
      distance: session.metrics?.distance,
      avgHeartRate: session.metrics?.avgHeartRate,
      maxHeartRate: session.metrics?.maxHeartRate,
      steps: session.metrics?.steps,
      calories: session.metrics?.calories,
      duration: session.duration / 60000, // ms to minutes
      activityStartTime: session.startTime,
      activityEndTime: session.endTime,
      source: 'google_fit',
      rawData: session,
    });
  };

  // ... render dialog con lista de actividades
}
```

### 4. Componente: `PhysicalMetricsCard`

**Ubicación sugerida:** Perfil del jugador / Detalles del partido

```tsx
export function PhysicalMetricsCard({ performance }: { performance: PlayerPerformance }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas Físicas</CardTitle>
        <Badge variant="outline">
          <Activity className="mr-1 h-3 w-3" />
          Google Fit
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <MetricItem
            icon={<TrendingUp />}
            label="Distancia"
            value={`${performance.distance?.toFixed(2)} km`}
          />
          <MetricItem
            icon={<Heart />}
            label="FC Promedio"
            value={`${performance.avgHeartRate} bpm`}
          />
          <MetricItem
            icon={<Footprints />}
            label="Pasos"
            value={performance.steps?.toLocaleString()}
          />
          <MetricItem
            icon={<Flame />}
            label="Calorías"
            value={`${performance.calories} kcal`}
          />
        </div>

        {/* Impacto en atributos */}
        {performance.impactOnAttributes && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Bonus por rendimiento físico:
            </p>
            <div className="flex gap-3 mt-2">
              {performance.impactOnAttributes.pac && (
                <Badge variant="secondary">
                  PAC +{performance.impactOnAttributes.pac}
                </Badge>
              )}
              {performance.impactOnAttributes.phy && (
                <Badge variant="secondary">
                  PHY +{performance.impactOnAttributes.phy}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 🔄 Flujo Completo de Usuario

### Primera vez (Vinculación)

1. Usuario va a **Configuración**
2. Click en **"Conectar Google Fit"**
3. Redirige a Google → Usuario autoriza permisos
4. Callback → Tokens guardados en Firestore
5. ✅ **Google Fit conectado**

### Vincular actividad a partido

1. Usuario juega un partido con su smartwatch/teléfono
2. Después del partido, en la app Pateá:
   - Va a detalles del partido
   - Click en **"Importar Actividad Física"**
3. App busca actividades en Google Fit (±3 horas del partido)
4. Muestra lista de actividades encontradas con preview de métricas
5. Usuario selecciona la actividad correcta
6. Click en **"Vincular al Partido"**
7. ✅ **Métricas guardadas + Bonus calculado**

### Evaluación del partido

8. Organizador finaliza evaluaciones
9. Sistema:
   - Procesa evaluaciones normales (puntos/tags)
   - **Busca `playerPerformance` para cada jugador**
   - **Aplica bonus de métricas físicas si existen**
   - Actualiza OVR y atributos

---

## 📊 Ejemplo de Impacto (Valores Ajustados)

### Jugador: "Juan Pérez"
**OVR actual:** 75
**PAC:** 72, **PHY:** 70

### Escenario 1: CON Smartwatch (Google Fit)

**Métricas del Partido:**
- Distancia: 9.5 km ✅
- FC promedio: 155 bpm ✅
- Pasos: 16,000 ✅
- Calorías: 850 kcal ✅

**Cálculo de Bonus:**
```
Distancia 9.5 km (≥8km) → PAC +0.5 (redondeado a +1)
FC 155 bpm (excelente) → PHY +0.5
Pasos 16k → PHY +0.25
Calorías 850 → PHY +0.25
Total PHY: 0.5 + 0.25 + 0.25 = 1.0 (cap en +1)
```

**Resultado Final:**
- **PAC:** 72 → **73** (+1)
- **PHY:** 70 → **71** (+1)
- **OVR:** 75.0 → **75.3** (impacto leve en promedio)

### Escenario 2: SIN Smartwatch (Entrada Manual)

**Usuario ingresa:**
- Distancia estimada: 8 km
- Duración: 90 minutos

**Sistema estima:**
- Pasos: ~10,400
- Calorías: ~520
- FC promedio: ~145 bpm

**Cálculo de Bonus:**
```
Distancia 8 km → PAC +0.5 (redondeado a +1)
FC estimada 145 bpm → PHY +0.5
Total PHY: 0.5 (no alcanza otros bonuses)
```

**Resultado Final:**
- **PAC:** 72 → **73** (+1)
- **PHY:** 70 → **70.5** (redondeado a +1)
- **OVR:** 75.0 → **75.3** (mismo impacto que con smartwatch)

### Comparación con Evaluación Normal

**Para contexto:**
- Evaluación normal (puntos 7-8/10): **+1 a +2 OVR** (distribución en todos los atributos)
- Evaluación normal (tags específicos): **+1 a +3 en atributos específicos**
- **Bonus físico:** Máximo +1 PAC y +1 PHY

**Conclusión:** Las evaluaciones normales siguen siendo la forma principal de progresar. El bonus físico es un complemento pequeño que reconoce el esfuerzo extra.

---

## ⚠️ Consideraciones Importantes

### Equidad y Accesibilidad

**PRINCIPIO FUNDAMENTAL**: No crear desventaja para quienes no tienen smartwatch

✅ **Implementado:**
- Bonuses LIMITADOS: Máximo +1 por atributo
- Entrada manual disponible para todos
- Mismo cálculo de bonus para datos manuales y de smartwatch
- Evaluaciones normales siguen siendo la forma PRINCIPAL de progresar

⚠️ **Cuidado con:**
- No promover el sistema como "necesario" para competir
- No mostrar stats de smartwatch de forma que haga sentir mal a quienes no tienen
- Considerar que algunos partidos son casuales (sin registro de métricas)

### Seguridad
- ⚠️ **IMPORTANTE**: Los tokens actuales NO están encriptados
- **TODO**: Implementar encriptación de tokens antes de producción
- Usar Firebase Security Rules estrictas para `healthConnections`
- Validación en entrada manual para prevenir abuso

### Privacidad
- Solo el usuario puede ver sus propias métricas físicas raw
- Otros jugadores solo ven el impacto en atributos (ej: "+1 PAC")
- Datos de smartwatch NO son compartidos públicamente
- Source (manual vs smartwatch) es visible solo para el usuario

### Limitaciones Técnicas
- **Google Fit**: Solo Android y Web (no iOS nativo)
- **Apple Health**: Requiere app nativa iOS con HealthKit (futuro)
- Token refresh automático: **Pendiente de implementar**
- Entrada manual: Estimaciones aproximadas (no datos precisos)

---

## 🚀 Próximos Pasos

### Mínimo Viable (MVP)
1. ✅ Backend completamente implementado
2. ⬜ Crear página `/settings` con LinkGoogleFitButton
3. ⬜ Crear route handler `/api/auth/google-fit/callback`
4. ⬜ Crear ImportActivityDialog en página de partido
5. ⬜ Configurar variables de entorno
6. ⬜ Testing con usuarios reales

### Futuro (V2)
- Refresh automático de tokens
- Encriptación de tokens en reposo
- Soporte para Apple Health (requiere app nativa)
- Métricas adicionales: zonas de frecuencia cardíaca, elevación, velocidad
- Historial de métricas físicas por jugador
- Comparativas entre jugadores

---

## 📚 Referencias

- [Google Fit REST API](https://developers.google.com/fit/rest)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Fitness Data Types](https://developers.google.com/fit/datatypes/activity)
