# Dirigir, jugadores en cancha y chat — 1.0.21+22

## Dirección visual

Se mantiene el sistema de Pateá: carbón #0B0E13, blanco #FCFCFD, volt #CCFF33 y azul #156BF4 para acciones. Space Grotesk para lectura e identidad; numeración deportiva para marcador y reloj. La cancha usa un verde profundo común a ambos temas, con tinta clara propia de esa superficie. No se añaden fotografías de fondo ni animación ambiental.

El objetivo de Dirigir es operar durante un partido. Su estructura es: marcador y reloj fijos → controles de período → acción principal Gol y menú Más eventos → pestañas de Cancha, Minuto a minuto, Estadísticas y Clips. El contenido se desplaza dentro de la pestaña sin llevarse los controles. El nombre real del partido identifica la pantalla. Se bloquean acciones de período repetidas mientras se guarda el cambio.

## Jugadores en Dirigir

- Fotos de 52 px con aro del color del equipo y nombre completo de hasta dos líneas sobre una base oscura, legible en Game y Claro.
- Posición y OVR reales, sin asignar números de camiseta ficticios.
- Identificación de cada equipo con su nombre y camiseta.
- Distribución por puesto, con máximo tres jugadores por fila; la cancha crece con el plantel en lugar de comprimir jugadores dentro de una altura fija.
- Si un equipo sólo contiene IDs, se cruza con el plantel del partido.
- Goles derivados de eventos, excluyendo goles en contra de la cuenta personal.
- Al tocar un jugador se abre una ficha breve con su foto, nombre, posición, OVR y goles; permite abrir su perfil completo.
- Si quien mira está autorizado a dirigir y el partido está en curso, puede abrir la carga de gol con ese jugador y equipo preseleccionados. El evento sigue requiriendo confirmación en el formulario existente.

## Chat

Se sustituye la hoja fija al 82 % por una pantalla completa con nombre del partido y subtítulo de conversación. Se conservan la colección `matches/{id}/messages` y sus campos existentes; no necesita cambio de reglas ni despliegue de backend.

- Mensajes con avatar del remitente, nombre, cuerpo de 15 px, hora local y separadores de fecha.
- Estado pendiente tomado de `hasPendingWrites`; no se inventan lecturas ni confirmaciones de recepción.
- Conversación invertida con los mensajes recientes al pie. Si el usuario está cerca del final, sigue los mensajes nuevos; si está leyendo más atrás, mantiene su posición y ofrece un botón para ir a los nuevos.
- Lectura inicial de 60 mensajes, con carga explícita de mensajes anteriores en lotes de 60.
- Campo de una a cuatro líneas, límite de 2000 caracteres y adaptación al teclado.
- Botón de enviar deshabilitado cuando el texto está vacío o se está enviando. No se envía también desde Enter en un campo multilínea.
- Ante un error se conserva el borrador y se permite reintentar con el mismo ID de documento, para no duplicar el envío. Se evita usar el controlador después de cerrar la pantalla.
- Identidad tomada de la ficha del jugador, con respaldo en el perfil de autenticación.
- Los espectadores ven una explicación de acceso, sin abrir el stream privado ni ofrecerles enviar mensajes. Los participantes y el organizador mantienen el acceso que permiten las reglas existentes.
- Los errores de lectura tienen mensaje y acción para reintentar.

## Validación

Se incorporan las pantallas Dirigir y Chat a la comparación visual en ambos modos: 15 pantallas, 30 imágenes y 45 casos incluyendo texto al 130 %.

Diez pruebas nuevas cubren: borrador y reintento sin duplicados, cierre durante envío, privacidad del espectador, lectura de mensajes antiguos y llegada de nuevos (con y sin movimiento reducido), controles fijos al desplazar la cancha, jugador preseleccionado, plantel denso y exclusión de goles en contra, gol del equipo B atribuido al equipo B, recuperación de lectura y composición con teclado.

Analizador sin errores ni advertencias; 28 observaciones informativas. Rama `feat/flutter-mobile-app`, mismo checkout. Sin cambios de backend ni distribución externa.

## Resultado final

**203 pruebas aprobadas**, incluidos los 45 casos de pantalla y las diez regresiones nuevas. APK release android-x64 instalado con `adb install -r` en `emulator-5554`; Android confirma versión 1.0.21, código 22. Se conserva la sesión de Briseida.

Revisión real del partido del 16 de noviembre: panel Dirigir con controles encima de la cancha; nombres y atributos legibles en Claro; ficha breve de Fiorenzo con OVR 58; chat abierto a pantalla completa con el nombre real del encuentro. La carga de goles y los envíos se verifican con servicios de prueba; no se inicia el partido ni se envían mensajes reales durante la comprobación.

Capturas locales:

- `patea_mobile/build/typography-review/installed-new-director.png`
- `patea_mobile/build/typography-review/installed-live-player-preview.png`
- `patea_mobile/build/typography-review/installed-new-chat.png`
- Comparativo de ambos modos con datos de prueba: `patea_mobile/build/typography-review/live-chat-final.jpg`.
