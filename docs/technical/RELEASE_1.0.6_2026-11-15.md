# Publicación 1.0.6 — equipos y experiencia

> Registro histórico de la entrega 1.0.6. La revisión móvil posterior es [1.0.10 (11)](RELEASE_1.0.10_2026-11-15.md), instalada sólo en emulador. No confundir sus pruebas y cambios con los resultados de esta entrega.

## Cambios

El reparto comparte un núcleo determinista entre web y Functions: identidades por UID, perfiles y OVR hidratados en servidor, tamaños y posiciones equilibrados, sin depender de una respuesta generativa. Para dos equipos de hasta 22 jugadores se busca la menor diferencia media de OVR entre las particiones que equilibran posiciones; los planteles mayores y múltiples equipos usan una heurística acotada.

La creación y la finalización son idempotentes. La generación tiene una reserva temporal y comprueba el plantel antes de guardar. La edición y el inicio exigen una partición completa, sin duplicados. Los abandonos recalculan los datos de los equipos.

Acceso, panel, cabecera, navegación y splash comparten la marca oficial. Se incorporó fotografía generada, movimiento reducido, recuperación de contraseña y mejores estados accesibles. Los derivados de marca incluyen iconos nativos, PWA y favicon. Véase [manifiesto visual](../design/UX_BRAND_2026-11-15.md).

## Publicación

Versión móvil: `1.0.6+7`. El número de build de Apple se calcula en Codemagic contra TestFlight. Los resultados de entrega y la validación final se registran al finalizar la publicación.

- Fuente de la entrega: `933e580a4b4e1bca37abd8d15350f87ca1bb1c1c`.
- Android: 1.0.6 (7), firmado con el certificado de Pateá y distribuido a `test-patea`.
  - [Entrega para testers](https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/3j0npvfg63ggo).
  - SHA-256 APK: `8380408A46F4229C8857D291307D9F8017590FC127B018C77C133AFCD9D21180`.
- [Build iOS de Codemagic](https://codemagic.io/app/6a9b3fecaea87264a4d6ae80/build/6afa2fabc028e6d6d50d06d8): cancelada a pedido del usuario antes de distribuir. Se retiró la publicación automática a Apple del workflow; primero se revisan los cambios en el emulador Android.
- Web principal `patea-dev-1`: rollout `build-2026-11-15-003` ya estaba completado cuando se pidió detener la distribución. Se cancelaron las compilaciones de los otros dos backends; sus rollouts quedaron en `FAILED` y conservaron la versión anterior.

Funciones afectadas: `generateBalancedTeams`, `createMatch`, `startMatch`, `joinMatch`, `leaveMatch`, `finishMatch`, `updateMatchTeams`, `shuffleTeams`.

## Validación

- Flutter: 116 pruebas aprobadas, con goldens revisados y texto a 1,3×.
- Backend: 42 pruebas aprobadas con emulador, sin omisiones.
- Web: 9 pruebas aprobadas, TypeScript y build de Next.js correctos. Acceso revisado a 390 y 1440 píxeles, sin desbordes ni errores del navegador.
- Marca: tres comprobaciones de trazo oficial, dimensiones, opacidad de iconos Apple y zona segura PWA.
- Las ocho Functions se publicaron correctamente y devolvieron `401 UNAUTHENTICATED` ante solicitudes sin sesión.
