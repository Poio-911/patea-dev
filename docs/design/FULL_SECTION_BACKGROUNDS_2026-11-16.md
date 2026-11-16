# Fondos completos de Jugadores y Partidos

El pedido corresponde al lienzo completo detrás de las listas, incluyendo el espacio vacío al final del plantel, no a las cabeceras ni a las tarjetas individuales.

## Implementación — 1.0.18+19

- Jugadores: vestuario de club con camisetas, bancos y equipamiento.
- Partidos: cancha de barrio al anochecer, red y luces cálidas.
- Ambas escenas son fotografías verticales generadas expresamente con `image_gen`, guardadas como WebP en `patea_mobile/assets/brand/patea_background_players.webp` y `patea_background_matches.webp`.
- `PateaBackground` permite seleccionar una escena. Cada pantalla monta su propio fondo bajo todo su Scaffold transparente, independiente del estado de sus datos. No depende de que la lista esté vacía, de una cabecera visible ni del partido destacado.
- El fondo ocupa el viewport y permanece fijo al desplazar la lista. Se eliminan las líneas genéricas de cancha en estas dos secciones; otras rutas conservan su lienzo anterior.
- El color de base y un velo se adaptan a Game o Claro; no hay animación de pantalla completa. Las fotos son decorativas, no capturan gestos ni se anuncian como contenido accesible. Si una imagen no carga, queda la base del tema.
- Se conservan las superficies de tarjetas, campos y controles existentes para sostener la legibilidad. Las portadas y los retratos no cambian.

## Recursos y trazabilidad

[Prompts completos](FULL_SECTION_BACKGROUND_PROMPTS_2026-11-16.json).
[Originales, tamaño de archivos y SHA256](FULL_SECTION_BACKGROUNDS_2026-11-16.json).

## Verificación

Se actualizan los cuatro goldens de Plantel y Partidos en Game y Claro. La revisión incluye texto a 1,3×. Comparativo: `patea_mobile/build/typography-review/full-section-backgrounds.jpg`.

Analizador sin errores ni advertencias; conserva 29 observaciones informativas previas. Trabajo en `feat/flutter-mobile-app`, sin nuevo worktree ni distribución externa.

## Resultado local

185 pruebas aprobadas, incluyendo los 39 casos de pantallas con las cuatro imágenes actualizadas. APK release android-x64 instalado con `adb install -r` en `emulator-5554`; Android confirma versión **1.0.18**, código **19**. Se conserva la sesión de Briseida.

Comprobado en Android el fondo de Jugadores al final de su lista de 15 jugadores: el área a la derecha de Santiago López muestra el bolso y la pelota del vestuario, en lugar de las líneas genéricas marcadas por el usuario. Se comprueba también Partidos, con la cancha nocturna detrás de sus controles y tarjetas. Se deja Jugadores al final del plantel para revisión.

Capturas: `patea_mobile/build/typography-review/installed-full-background-players-bottom.png` e `installed-full-background-matches.png`.

## Tratamiento Game — 1.0.19+20

A pedido del usuario se aplica un tratamiento específico a ambas fotografías de fondo en Game: desaturación del 85 %, desenfoque suave de 2,8 px y menor presencia con velo carbón. La opacidad de la imagen baja del 68 al 40 %, con oscurecimiento adicional en los extremos. La escena permanece reconocible como textura sin competir con las tarjetas. No se cambian los archivos originales ni las fotos de portadas y jugadores.

Claro conserva exactamente su tratamiento anterior: la comparación de los 26 goldens confirma que sólo cambian `pantalla_plantel_game.png` y `pantalla_partidos_game.png`. Los 39 casos de pantallas, incluyendo texto a 1,3×, pasan al regenerar las referencias. Comparativo Game: `patea_mobile/build/typography-review/game-background-filter.jpg`.

El tratamiento Game queda incluido en la versión instalada 1.0.20+21 junto con la corrección del aviso de partido lleno.
