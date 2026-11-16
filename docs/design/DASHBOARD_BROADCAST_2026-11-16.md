# Panel: partido protagonista

Implementación en `feat/flutter-mobile-app`, Android `1.0.25+26`.

El bloque principal del Panel reemplaza el marcador separado y las camisetas flotantes por una composición de transmisión: camisetas y nombres enfrentados, resultado central, reloj y período debajo. La fotografía de la cancha ocupa el bloque con un velo que conserva contraste en ambos temas. No hay halo rojo ni pulso continuo del resultado.

El título y la fecha contextualizan el partido. Los avatares pertenecen al plantel real de cada equipo; se muestran hasta dos y la cantidad restante. La última anotación corresponde a un evento de gol guardado, ordenado por minuto. Si no hay goles registrados, no se agrega un relato ni un evento ficticio. Si los equipos aún no existen se muestra la convocatoria abierta.

El reloj usa el mismo `LiveClock` que Dirigir: minuto base más tiempo transcurrido desde `periodStartTs`. Respeta pausa y entretiempo; ya no muestra únicamente el minuto base guardado. El único refresco periódico es el del reloj cuando corresponde. Los próximos partidos conservan la cuenta regresiva y el acceso a convocatoria.

La tarjeta mantiene cancha, convocados y acceso al vivo. Un cupo sin límite se presenta como cantidad de confirmados, sin inventar un máximo de 14.

## Archivos

- `patea_mobile/lib/features/dashboard/widgets/dashboard_match_hero.dart`: presentación del partido y reloj.
- `patea_mobile/lib/features/dashboard/dashboard_screen.dart`: integra el bloque y elimina la implementación anterior.
- `patea_mobile/test/dashboard_match_hero_test.dart`: resultado/pausa, reloj derivado, datos ausentes, texto ampliado y destinos de navegación.
- `patea_mobile/test/goldens/pantallas_test.dart`: nueva cobertura del bloque en vivo, además de los goldens del Panel.

## Validación

Goldens del Panel y del bloque en vivo en Game y Claro, incluyendo texto al 130 %. Las fotografías ya pertenecían a la app: no se agregaron imágenes ni datos de partidos para esta modificación. No se modificó el marcador, cronómetro ni eventos del partido real durante la revisión.

- Suite completa: **221 pruebas aprobadas**.
- Análisis: sin errores ni advertencias; 28 observaciones informativas previas.
- APK release x64 instalado con reemplazo en el emulador, conservando sesión. Versión verificada: `1.0.25`, código `26`.
- Revisión manual en Panel → Mi fútbol con Briseida: 2–0, 02:00 en pausa, planteles y último gol registrado de José P. Captura: `patea_mobile/build/typography-review/dashboard-broadcast-final-game.png`.
