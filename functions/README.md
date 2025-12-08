# Cloud Functions - Pateá

## ⚠️ Estado Actual: NO DESPLEGADAS (Billing Requerido)

Las Cloud Functions están **preparadas y compiladas** pero NO desplegadas en producción debido a requisitos de billing.

### Función Disponible

**`resetMonthlyCredits`**
- **Propósito**: Reset mensual automático de créditos de IA (3 créditos gratuitos por mes)
- **Trigger**: Scheduled - 1ro de cada mes a 00:00 (Argentina timezone)
- **Runtime**: Node.js 20
- **Región**: us-central1

### Fallback Implementado

**Mientras tanto, existe un fallback en el cliente:**
- Ubicación: `src/firebase/auth/use-user.tsx` (líneas 67-95)
- Se ejecuta cuando el usuario hace login
- Verifica si necesita reset usando localStorage para deduplicación
- Es menos confiable que Cloud Function pero funciona como respaldo

### Para Desplegar en el Futuro

1. **Habilitar Billing:**
   - Firebase Console > Proyecto Settings > Billing
   - Asociar cuenta de facturación
   - Seleccionar plan Blaze (pay-as-you-go)

2. **Habilitar APIs requeridas:**
   - Cloud Functions API
   - Cloud Scheduler API
   - App Engine (para Cloud Scheduler)

3. **Desplegar:**
   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions:resetMonthlyCredits
   ```

### Costos Estimados

- **Cloud Scheduler**: ~$0.10/mes (1 ejecución por mes)
- **Cloud Function**: ~$0.01/invocación (muy bajo dado el uso)
- **Total estimado**: < $1/mes

### Desarrollo Local

```bash
# Instalar dependencias
cd functions
npm install

# Compilar TypeScript
npm run build

# Ejecutar emulador local (requiere Firebase CLI)
npm run serve
```

## Estructura

```
functions/
├── src/
│   ├── index.ts                           # Entry point - exporta todas las funciones
│   └── scheduled/
│       └── reset-monthly-credits.ts       # Función de reset mensual
├── lib/                                   # Código compilado (generado por tsc)
├── package.json                          # Dependencias y scripts
└── tsconfig.json                         # Configuración TypeScript
```

## Notas de Implementación

- Usa Firebase Functions v2 API (firebase-functions v7.0.1)
- Batches de 500 operaciones para respetar límites de Firestore
- Logging a collection `systemLogs` para monitoreo
- Manejo de errores con retry automático de Firebase
