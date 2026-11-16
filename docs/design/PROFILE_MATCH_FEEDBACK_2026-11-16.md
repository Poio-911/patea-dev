# Devoluciones de partidos en perfiles

Rama `feat/flutter-mobile-app`, Android `1.0.28+29`.

El recuadro de evaluación del perfil conservaba el diseño anterior. `PlayerMatchDebrief` es compartido por el perfil propio, los perfiles de otros jugadores y el historial completo; la modificación se aplica a los tres recorridos.

## Presentación

- El partido se presenta como una sección abierta, sin la tarjeta exterior con borde.
- Título y fecha/cancha con jerarquía legible y ajuste de línea.
- Una banda de estadísticas reúne goles, asistencias y nota media con números neutros.
- El cambio de OVR se muestra como transición y variación, sin badge.
- Los cambios por atributo usan nombres completos y filas de dos columnas. Las subidas y bajadas conservan su signo y color semántico; se omiten variaciones cero.
- Devoluciones separadas por divisores, con nota explícita sobre diez. Las etiquetas son líneas de texto con indicadores discretos, sin pastillas de color.
- La identidad anónima sigue oculta. Los evaluadores identificados pueden mostrar su foto; las evaluaciones automáticas mantienen su identificación. Se conservan resúmenes y devoluciones de texto.
- El perfil compacto no repite los totales de carrera que ya aparecen arriba. El historial completo conserva su resumen y separa cada partido visualmente.

El cálculo de notas, efectos acumulados, goles y OVR no cambia. No se modifican documentos ni evaluaciones del servidor.

## Verificación

`player_match_debrief_design_test.dart` cubre perfiles propios y ajenos, Game y Claro a 320 px con texto al 130 %, anonimato, datos automáticos/textuales y modos compacto/historial. Nuevos goldens `pantalla_perfil_devoluciones_game.png` y `pantalla_perfil_devoluciones_claro.png`.

- Suite completa: **246 pruebas aprobadas**. Análisis sin errores ni advertencias, con 28 observaciones informativas anteriores.
- APK release x64 instalado con reemplazo: versión `1.0.28`, código `29`.
- Revisión manual con Briseida: partido Amistoso Fecha 2, 2 goles, 0 asistencias, nota 7 y cambios Pase +6, Regate +4, Defensa -4; comentarios anónimos preservados. Se verificó también el historial completo con sus dos partidos y el estado sin partidos evaluados de otro perfil.
- Captura: `patea_mobile/build/typography-review/profile-feedback-open-game.png`. Se dejó abierto el perfil propio en la sección actualizada.
