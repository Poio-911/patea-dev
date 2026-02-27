# Auditoría Técnica: Seguridad, Confiabilidad y Performance

**Fecha:** 2026-02-26
**Estado:** Pendiente de implementación

## Contexto

Revisión exhaustiva del codebase buscando problemas técnicos reales. Los hallazgos se organizan por severidad. Se excluyen intencionalmente refactors de gran escala (split de server-actions.ts, conversión masiva a Server Components) cuyo riesgo supera el beneficio a corto plazo.

---

## BLOQUE 1 — Seguridad (Crítico)

### 1.1 `firestore.rules` — Matches: update abierto a cualquier usuario autenticado

**Archivo:** `firestore.rules` línea 117
**Problema:** `allow update: if isAuthenticated()` permite que CUALQUIER usuario autenticado modifique CUALQUIER partido (cambiar `status`, `title`, `ownerUid`, etc.). Hay un TODO en el comentario que lo reconoce.

```
// TODO: Refactorizar Join/Leave a Server Actions para restringir esto.
allow update: if isAuthenticated();   // ← BUG
```

**Fix:**
```
allow update: if isAuthenticated() && (
  resource.data.ownerUid == request.auth.uid
  || request.auth.uid in resource.data.playerUids
);
```
El `playerUids` ya existe en el documento de match y se usa en otras partes de la app.

---

### 1.2 `firestore.rules` — Subcollecciones de match abiertas a escritura global

**Archivo:** `firestore.rules` líneas 123–125
**Problema:** `allow read, write: if isAuthenticated()` en `matches/{matchId}/{subcollection}/{docId}` cubre TODAS las subcollecciones (assignments, invitations, dateProposals, processedSubmissions). Cualquier usuario puede votar, aceptar invitaciones o modificar assignments de partidos en los que no participa.

**Fix:** Restringir a participantes del partido:
```
match /{subcollection}/{docId} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated() && (
    get(/databases/$(database)/documents/matches/$(matchId)).data.ownerUid == request.auth.uid
    || request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.playerUids
  );
}
```

---

### 1.3 `storage.rules` — Logos de liga/copa sin verificación de pertenencia

**Archivo:** `storage.rules` líneas 21–33
**Problema:** Cualquier usuario autenticado puede subir archivos a `/leagues/{cualquierGroupId}/` y `/cups/{cualquierGroupId}/`, incluso si no pertenece a ese grupo.

**Fix:** No se puede verificar Firestore desde Storage Rules directamente de forma eficiente. La solución más pragmática es validar ownership en el Server Action (`upload-competition-logo.ts`) antes de obtener la signed upload URL, y asegurarse de que el path incluya el UID del uploader para limitarlo:

```
// storage.rules
match /leagues/{groupId}/{userId}/{allPaths=**} {
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size <= 5 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```
Requiere también actualizar `upload-competition-logo.ts` para incluir el UID en el path de subida.

---

### 1.4 `/api/credits/reset-monthly` — Sin verificación de autenticación

**Archivo:** `src/app/api/credits/reset-monthly/route.ts`
**Problema:** El endpoint acepta cualquier request (incluyendo no autenticados) con un `userId` body. Aunque `ensureMonthlyCreditResetAction` es idempotente por mes, un actor externo puede dispararlo para cualquier usuario.

**Fix:** Verificar el JWT de Firebase en el handler:
```typescript
import { getAdminAuth } from '@/firebase/admin-init';

const authHeader = req.headers.get('Authorization');
const token = authHeader?.split('Bearer ')[1];
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const decoded = await getAdminAuth().verifyIdToken(token);
if (decoded.uid !== parse.data.userId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## BLOQUE 2 — Confiabilidad (Alto)

### 2.1 `client-providers.tsx` — Memory leak: `visibilitychange` listener no se remueve

**Archivo:** `src/components/client-providers.tsx` líneas 56–60
**Problema:** Se añade un listener `visibilitychange` con una función anónima inline, pero el `return () => cleanup` solo remueve el `focus` listener. El `visibilitychange` queda activo indefinidamente.

```typescript
// BUG actual:
document.addEventListener('visibilitychange', () => {       // anónima, no removible
  if (document.visibilityState === 'visible') clearBadge();
});
return () => window.removeEventListener('focus', clearBadge); // solo remueve 'focus'
```

**Fix:**
```typescript
const handleVisibility = () => {
  if (document.visibilityState === 'visible') clearBadge();
};
window.addEventListener('focus', clearBadge);
document.addEventListener('visibilitychange', handleVisibility);
return () => {
  window.removeEventListener('focus', clearBadge);
  document.removeEventListener('visibilitychange', handleVisibility);
};
```

---

### 2.2 Flows de IA — Sin timeout en `ai.generate()`

**Archivos:** `src/ai/flows/generate-player-card-image.ts`, `generate-duo-image.ts`, y todos los flows que llaman `ai.generate()` / `ai.generateStream()`
**Problema:** Si Gemini no responde (rate limit, error silencioso, modelo lento), el server action cuelga indefinidamente. Next.js tiene un timeout de 30s en Server Actions, pero Genkit puede extender eso.

**Fix:** Crear un wrapper `withTimeout` reutilizable en `src/ai/ai-utils.ts`:
```typescript
export function withTimeout<T>(promise: Promise<T>, ms = 25_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms)
    ),
  ]);
}
```
Usarlo en cada flow:
```typescript
const result = await withTimeout(ai.generate({ ... }), 25_000);
```

---

### 2.3 `image-generation.ts` — Sin validación de tamaño antes de `file.download()`

**Archivo:** `src/lib/actions/image-generation.ts` línea 61
**Problema:** El Admin SDK bypasea las Storage Rules (que sí limitan a 5MB). `file.download()` puede descargar archivos de cualquier tamaño si alguien subió algo grande con el Admin SDK previamente, o si la foto viene de un URL externo.

**Fix:** Verificar metadata antes de descargar:
```typescript
const [metadata] = await file.getMetadata();
if (metadata.size && Number(metadata.size) > 5 * 1024 * 1024) {
  return { error: 'La imagen es demasiado grande para procesar.' };
}
const [imageBuffer] = await file.download();
```

---

### 2.4 `google-fit-actions.ts` — Fetches secuenciales dentro de `for` loop

**Archivo:** `src/lib/actions/google-fit-actions.ts` líneas 150–171
**Problema:** Por cada sesión de Google Fit, se hace un `await fetch()` secuencial. Si hay 10 sesiones, son 10 round-trips en serie.

**Fix:** Paralelizar con `Promise.all`:
```typescript
const sessions = sessionsData.session || [];
const sessionDetails = await Promise.all(
  sessions.map(session => fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ... })
    }
  ).then(r => r.json())
));
```

---

## BLOQUE 3 — Performance Quick Wins (Bajo)

### 3.1 Variantes de Framer Motion definidas dentro del componente

**Archivos:** `src/app/matches/page.tsx`, `src/app/dashboard/page.tsx`, potencialmente otros
**Problema:** Objetos `listVariants`, `itemVariants`, `pageVariants`, `cardVariants` declarados dentro de la función del componente. Se recrean en cada render, causando que Framer Motion las trate como nuevas y re-ejecute las animaciones.

**Fix:** Mover a nivel de módulo (fuera del componente):
```typescript
// ANTES (dentro del componente):
const listVariants = { hidden: {...}, visible: {...} };

// DESPUÉS (a nivel de módulo, fuera de la función):
const LIST_VARIANTS = { hidden: {...}, visible: {...} };
```

---

## Resumen de Archivos a Modificar

| Archivo | Sección | Severidad |
|---|---|---|
| `firestore.rules` | Líneas 117, 123–125 | CRÍTICO |
| `storage.rules` | Líneas 21–33 | CRÍTICO |
| `src/app/api/credits/reset-monthly/route.ts` | Handler POST | ALTO |
| `src/components/client-providers.tsx` | Líneas 56–60 | ALTO |
| `src/ai/flows/generate-player-card-image.ts` | Llamada ai.generate | ALTO |
| `src/ai/flows/generate-duo-image.ts` | Llamada ai.generate | ALTO |
| `src/lib/actions/image-generation.ts` | Línea 61 | ALTO |
| `src/lib/actions/google-fit-actions.ts` | Líneas 150–171 | MEDIO |
| `src/app/matches/page.tsx` | Variantes framer-motion | BAJO |
| `src/app/dashboard/page.tsx` | Variantes framer-motion | BAJO |

**Archivo nuevo a crear:**
- `src/ai/ai-utils.ts` — Wrapper `withTimeout` reutilizable para todos los flows

---

## Fuera del Alcance (Deliberadamente)

- Convertir páginas a Server Components (cambio arquitectónico, riesgo alto)
- Split de `server-actions.ts` en archivos por feature (riesgo de breaking changes)
- Split de `add-match-dialog.tsx` en steps (UI refactor complejo)
- LazyMotion wrapper (micro-optimización, baja prioridad)
- Sanitización de inputs en prompts AI (Gemini ya tiene guardrails; el riesgo real es bajo)
- writeBatch límite 500 en notifications (query limita a 20)

---

## Verificación (Checklist post-implementación)

- [ ] **Reglas Firestore**: `firebase emulators:start --only firestore` + test que un usuario NO-dueño intente updatear un match → debe fallar con PERMISSION_DENIED
- [ ] **Reglas Storage**: test que usuario no-miembro intente subir a `/leagues/otroGrupo/` → debe fallar
- [ ] **Credits API**: `curl -X POST /api/credits/reset-monthly -d '{"userId":"xxx"}'` sin token → debe devolver 401
- [ ] **Client-providers**: Abrir DevTools → Performance → verificar que no se acumulan listeners en visibilitychange
- [ ] **AI timeout**: Mockear Gemini para que cuelgue → verificar que el error se retorna en <30s
- [ ] **Google Fit**: Verificar en Network tab que los fetches de sesiones salen en paralelo, no secuenciales
