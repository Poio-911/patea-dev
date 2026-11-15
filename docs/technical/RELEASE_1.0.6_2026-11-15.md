# Publicación 1.0.6 — equipos y experiencia

## Cambios

El reparto comparte un núcleo determinista entre web y Functions: identidades por UID, perfiles y OVR hidratados en servidor, tamaños y posiciones equilibrados, sin depender de una respuesta generativa. Para dos equipos de hasta 22 jugadores se busca la menor diferencia media de OVR entre las particiones que equilibran posiciones; los planteles mayores y múltiples equipos usan una heurística acotada.

La creación y la finalización son idempotentes. La generación tiene una reserva temporal y comprueba el plantel antes de guardar. La edición y el inicio exigen una partición completa, sin duplicados. Los abandonos recalculan los datos de los equipos.

Acceso, panel, cabecera, navegación y splash comparten la marca oficial. Se incorporó fotografía generada, movimiento reducido, recuperación de contraseña y mejores estados accesibles. Los derivados de marca incluyen iconos nativos, PWA y favicon. Véase [manifiesto visual](../design/UX_BRAND_2026-11-15.md).

## Publicación

Versión móvil: `1.0.6+7`. El número de build de Apple se calcula en Codemagic contra TestFlight. Los resultados de entrega y la validación final se registran al finalizar la publicación.

Funciones afectadas: `generateBalancedTeams`, `createMatch`, `startMatch`, `joinMatch`, `leaveMatch`, `finishMatch`, `updateMatchTeams`, `shuffleTeams`.

## Validación

- Flutter: 116 pruebas aprobadas, con goldens revisados y texto a 1,3×.
- Backend: 42 pruebas aprobadas con emulador, sin omisiones.
- Web: 9 pruebas aprobadas, TypeScript y build de Next.js correctos. Acceso revisado a 390 y 1440 píxeles, sin desbordes ni errores del navegador.
- Marca: tres comprobaciones de trazo oficial, dimensiones, opacidad de iconos Apple y zona segura PWA.
- Las ocho Functions se publicaron correctamente y devolvieron `401 UNAUTHENTICATED` ante solicitudes sin sesión.
