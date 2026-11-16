# Dirigir: cancha protagonista — 1.0.22+23

## Corrección de dirección visual

El usuario rechazó el peso del marcador, el contador y los botones, y la presentación de los jugadores como círculos con cajas. La nueva composición da el centro de la pantalla a una cancha continua con ambos equipos, en lugar de una lista de jugadores que se ve de a un equipo.

- Marcador sin tarjeta: nombres y camisetas a los lados, resultado compacto y reloj digital `mm:ss`, con el período debajo.
- Controles reunidos en una franja inferior, con una sola acción destacada para el gol. Pausa/reanudación, descanso y otros eventos mantienen los callbacks existentes. El control de inicio deja de ocupar todo el ancho encima de la cancha.
- Cancha con bandas suaves, áreas, puntos de penal y detalle de redes, dibujada en Flutter sin nuevos recursos ni cargas de video.
- Retratos con recorte deportivo, contorno del equipo y tamaño uniforme en ambos lados; OVR y posición integrados al retrato, nombre directamente sobre el campo con sombra de lectura. Se eliminan los círculos y las cajas negras del nombre.
- La altura disponible se usa para mostrar ambos equipos. Con texto normal y diez jugadores, el campo y los diez jugadores caben encima de los controles. Con planteles densos o texto ampliado, se permite desplazar la cancha conservando el panel de control fijo.
- Se mantienen la ficha al tocar un jugador, su perfil y la preselección de autor/equipo al abrir el formulario de gol. No cambia el registro de eventos ni el acceso al chat.

## Validación

Goldens de Dirigir regenerados en Game y Claro, con comprobación de texto al 130 %. Se mantienen las diez regresiones de operación y chat, y se agrega una que verifica cancha protagonista, diez jugadores visibles encima de la franja inferior y reloj digital.

Analizador sin errores ni advertencias, con 28 observaciones informativas anteriores. Comparativo: `patea_mobile/build/typography-review/pitch-protagonist-final.jpg`.

Rama `feat/flutter-mobile-app`, mismo checkout. Sin despliegue de backend ni distribución externa.

## Resultado instalado

Suite completa: **204 pruebas aprobadas**. APK instalado con `adb install -r` en `emulator-5554`; versión confirmada **1.0.22**, código **23**. Se mantiene la sesión de Briseida y se deja Dirigir abierto.

En la revisión real el partido estaba activo, pausado en 02:00 y con resultado 2–0. Los diez jugadores aparecen completos sobre el campo, con retratos uniformes, nombres legibles y goles de los eventos existentes. La franja inferior muestra Reanudar, Descanso, Gol y Eventos. No se accionan controles del partido durante esta comprobación.

Captura final: `patea_mobile/build/typography-review/installed-pitch-protagonist.png`.
