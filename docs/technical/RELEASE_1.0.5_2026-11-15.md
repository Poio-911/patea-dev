# Publicación 1.0.5 — 15 de noviembre de 2026

## Entregas verificadas

- iOS: workflow `ios-testflight` terminado correctamente a las 18:30:45 de Montevideo, incluido `Publishing`. Fuente móvil de `7f59d9b8`; versión 1.0.5. El número de build de Apple lo calcula Codemagic contra TestFlight, no el `+6` local.
  - Build: https://codemagic.io/app/6a9b3fecaea87264a4d6ae80/build/6afa2123c028e6d6d50cbaa8
  - Check final: `132965161311`. Codemagic crea otro check al terminar; el ID inicial puede seguir mostrando progreso obsoleto.
- Android: 1.0.5 (6), firmado con la clave de Pateá y distribuido al grupo existente `test-patea`.
  - Release: https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/3ivub91vhbbs0
  - SHA-256 del APK: `E488A7C32622E076E2F3DD0221E1645F5FE06EC7F9AEF06273EA3E99D6A94825`.
- Web: los tres backends `patea-dev-1`, `patea-dev` y `studio` tienen el rollout `build-2026-11-15-002` en `SUCCEEDED`, con el código `d7e27225`.
- Firebase Hosting conserva rutas y consultas mediante redirecciones 302 a `patea-dev-1--mil-disculpis.us-central1.hosted.app`. Las URL antiguas `.web.app` y `.firebaseapp.com` siguen siendo entradas válidas.

## Backend y privacidad

Se publicaron `submitEvaluationSubmission`, `processEvaluationSubmission`, `finalizeMatchEvaluation`, `getPlayerEvaluations` y `sendMatchReminders`. Se comprobaron respuestas `401 UNAUTHENTICATED` sin sesión.

Los vínculos entre asignaciones y evaluaciones se guardan en `assignments/{id}/private/evaluation`; los IDs de evaluación son aleatorios. La idempotencia depende del marcador transaccional por partido/evaluador.

`scripts/migrate-evaluation-links.ps1 -Apply` movió 99 vínculos históricos sin eliminar evaluaciones ni asignaciones. La verificación posterior encontró 127 asignaciones y cero vínculos públicos pendientes. El script es dry-run por defecto y usa precondiciones de versión para no pisar modificaciones concurrentes.

Las reglas desplegadas coinciden con `firestore.rules`: ruleset `91542070-29fc-43eb-a690-ec5dbb5ed3a0`, publicado el 15 de noviembre a las 18:42:36 de Montevideo.

El servicio SSR antiguo `ssrmildisculpis` dejó de ser público: se retiró `allUsers` de `roles/run.invoker` y se verificó `403` sin credenciales. No se eliminaron revisiones ni datos. Los servicios internos de App Hosting conservan su IAM privado; sus dominios públicos funcionan mediante App Hosting.

Se agregaron los dos dominios propios de App Hosting que faltaban en los dominios autorizados de Firebase Authentication. No se cambiaron proveedores ni credenciales.

## Validación

- Flutter: 103 pruebas aprobadas, incluidos goldens con reloj fijo.
- Backend: 21 pruebas aprobadas con emulador, sin omisiones, incluidas concurrencia y reglas.
- Web: 9 pruebas aprobadas; TypeScript y build de Next.js correctos.
- CI de `d7e27225`: Flutter, funciones, web y reglas aprobados.

Para evitar que un push de backend cancele una build iOS en curso (`cancel_previous_builds: true`), el cierre de privacidad se publicó primero en `fix/evaluation-private-links`. Se incorporó a `feat/flutter-mobile-app` después de terminar TestFlight.
