# Detalle de partido lleno oculto — 1.0.20+21

## Problema reproducido

Doroteo entra al Partido Amistoso del 16 de noviembre, con todos sus cupos ocupados. Sólo aparece «Partido completo» en el centro de una superficie que cubre la pantalla. Reproducido también en Android con la sesión real de Doroteo, entrando desde la tarjeta estable del listado (el carrusel superior alterna entre el 16 y el 17).

## Causa y corrección

En `_StickyActionBar`, el estado `isMatchFull` colocaba un `Center` sin `heightFactor` dentro de `Scaffold.bottomNavigationBar`. Ese widget se expandía a toda la altura disponible, consumiendo el espacio que debía usar el cuerpo del detalle. La prueba mide 808 px de barra antes de la corrección.

Se reemplaza el `Center` por el texto con `textAlign: TextAlign.center`, de altura natural. «Partido completo» queda como aviso de la barra inferior; el partido, la portada, los equipos y la navegación permanecen visibles. No se cambian permisos, cupos, pertenencia de jugadores ni acciones de inscripción.

## Validación

- Prueba de regresión con un usuario autenticado ajeno al plantel y un partido lleno, tanto en Game como en Claro.
- La prueba falla antes del cambio (barra de 808 px) y pasa después: barra menor a 120 px, contenido del detalle mayor a 400 px, botón Volver visible y sin acción para anotarse.
- Suite completa: **187 pruebas aprobadas**.
- La versión incluye también el filtro de fondo Game de Jugadores y Partidos de 1.0.19+20, con Claro sin cambios.
- Captura de reproducción real: `patea_mobile/build/typography-review/doroteo-full-match-before.png`.

Rama `feat/flutter-mobile-app`, mismo checkout. Distribución sólo al emulador local.

## Instalación y revisión final

Instalado APK final con `adb install -r` en `emulator-5554`, versión 1.0.20, código 21, conservando la sesión de Doroteo. Se abre el mismo Partido Amistoso del 16 de noviembre desde el listado. Ahora se ven la portada, fecha, ubicación, dos equipos y la flecha de vuelta; «Partido completo» ocupa sólo el pie inferior. Se deja este detalle abierto en Claro. Captura: `patea_mobile/build/typography-review/doroteo-full-match-after.png`.
