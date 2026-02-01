# Salud y Fitness - Integración con Google Fit

## Descripción General
Integración completa con Google Fit API para tracking de actividad física y vinculación de datos de rendimiento con partidos jugados.

## Rutas
- `/settings` - Link Google Fit
- Dashboard - Widget de actividad

## Componentes

### LinkGoogleFitButton
- Estado: Conectado / Desconectado
- Click → OAuth flow
- Muestra usuario conectado

### ImportActivityDialog
- Lista de sesiones de Google Fit
- Seleccionar sesión
- Vincular a partido específico
- Impacto calculado en atributos

## OAuth Flow

### Conexión
1. Usuario click "Conectar Google Fit"
2. Server genera `authUrl` con state (CSRF token)
3. Redirección a Google OAuth
4. Usuario autoriza scopes
5. Google redirige a `/api/auth/google-fit/callback`
6. Exchange code por tokens
7. Guardar en Firestore
8. Redirección a dashboard

### Scopes Requeridos
```
https://www.googleapis.com/auth/fitness.activity.read
https://www.googleapis.com/auth/fitness.body.read  
https://www.googleapis.com/auth/fitness.location.read
```

## Server Actions (google-fit-actions.ts)

```typescript
generateGoogleFitAuthUrlAction(userId)
processGoogleFitCallbackAction(code, state)
fetchGoogleFitActivitiesAction(userId, startTime, endTime)
linkActivityToMatchAction(userId, playerId, matchId, activityData)
disconnectGoogleFitAction(userId)
```

## Modelo de Datos

### HealthConnection (Firestore)
```
users/{userId}/healthConnections/google_fit
{
  provider: 'google_fit';
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  grantedScopes: string[];
  connectedAt: string;
}
```

### GoogleFitSession
```typescript
{
  id: string;
  name: string;
  activityType: number;  // Código de Google Fit
  startTime: string;
  endTime: string;
  duration: number;  // Milisegundos
  metrics: {
    distance?: number;  // Metros
    calories?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    steps?: number;
  };
}
```

## Vinculación con Partidos

### Flujo
1. Usuario juega partido
2. Va a Google Fit import dialog
3. Selecciona sesión de actividad del día
4. App calcula impacto en atributos
5. Vincula sesión con partido specific
6. Atributos se actualizan

### Cálculo de Impacto
```typescript
function calculateAttributeImpact(metrics) {
  return {
    pac: distance > 5000 ? +1 : 0,  // 5km+
    phy: calories > 400 ? +1 : 0,
    // ...
  };
}
```

### Métricas Consideradas
- **Distancia** → PAC, PHY
- **Calorías** → PHY
- **Heart Rate** → PHY
- **Steps** → PAC

## Características

### Auto-Refresh Tokens
- Access tokens expiran en 1h
- Server auto-refresh con refresh token
- Transparente para usuario

### Privacy
- Datos nunca compartidos con otros usuarios
- Solo el jugador ve sus métricas
- Desconexión borra tokens

### Sync
- Pull manual (no push automático)
- Usuario decide qué sesiones vincular
- No hay sync continuo en background

## Configuración

### Environment Variables
```env
GOOGLE_FIT_CLIENT_ID=
GOOGLE_FIT_CLIENT_SECRET=
GOOGLE_FIT_REDIRECT_URI=
```

### Google Cloud Console
- OAuth 2.0 Client ID configurado
- Redirect URI whitelisteda
- Scopes aprobados

## Limitaciones

- Solo lectura (no escritura)
- Métricas limitadas por Google Fit API
- Requiere app de Google Fit instalada
- No funciona en iOS (Google Fit es Android)

## Próximas Mejoras
- [ ] Apple Health integration (iOS)
- [ ] Strava integration
- [ ] Auto-link si fecha/hora coinciden
- [ ] Badges por hitos de fitness
- [ ] Challenges basados en actividad física
