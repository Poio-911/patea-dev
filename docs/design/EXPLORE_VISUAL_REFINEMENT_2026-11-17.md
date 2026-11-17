# Explorar: búsqueda, personas e invitación

## Jerarquía

La búsqueda de jugadores comienza por una referencia liviana (En mi zona o un partido propio), sin la tarjeta de formulario. Zona y distancia están juntas: la ubicación permite cambiar de lugar y Hasta N km abre un menú con 5, 15, 30 y 50 km. Si todavía no hay zona guardada ni elegida se informa Zona sugerida; el nombre inicial queda como Montevideo.

Tu disponibilidad es una fila personal separada de los filtros. Informa si está publicada, permite editarla y conserva los estados de carga o error. Debajo, el encabezado de resultados y las posiciones forman un bloque de búsqueda: los filtros usan texto y una línea de selección, sin chips con borde.

## Jugadores

Filas directas sobre el fondo, separadas por una línea sutil. Retrato de 64 puntos, nombre en primer nivel, posición con color y distancia secundaria. El OVR utiliza ámbar (Game #FFD56A; Claro #885800) y un tamaño menor que el anterior. No se agregan fondos a la posición ni cajas al valor.

Los horarios se ordenan por semana, agrupan días compatibles y se resumen. Todos los días reemplaza la enumeración de siete abreviaturas. El detalle conserva las diferencias entre horarios de días distintos. Se aceptan las variantes mañana/manana y días con o sin acento sin modificar lo almacenado.

## Invitación

Hoja de una sola superficie, ajustada al contenido y desplazable. Identidad sin aro de categoría, OVR y posición integrados como texto. Puede jugar presenta frases en lugar de etiquetas monoespaciadas.

Sin partido elegido, la acción dice Elegir partido para invitar. Con una convocatoria válida, muestra su nombre y horario y la acción Invitar a [nombre]. Se mantienen las comprobaciones de organizador, fecha futura, cupos, participación existente e invitación pendiente; siempre se confirma antes del envío. Cancelar no envía nada.

La selección de distancia se comparte con la búsqueda de partidos. No se modifican documentos ni se crean datos de demostración en servicios externos.

## Validación

15 pruebas del flujo: filtros y respuestas atrasadas, errores/reintento, solicitudes y alta directa, disponibilidad legible, selección de partido, confirmación y cancelación, Game/Claro y escala 2x en jugadores. Tres verificaciones de pantalla Explorar, incluyendo Game/Claro y escala 1,3x, con sus referencias visuales actualizadas. Análisis estático de pantalla, utilidades y pruebas sin observaciones.

Capturas de revisión con fuentes e iconos reales: `patea_mobile/build/presentation_capture/explore*.png`.
