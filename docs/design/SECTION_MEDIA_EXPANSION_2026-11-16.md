# Ampliación visual de secciones — 16/11/2026

## Decisiones e integración

- **Partidos sin actividad:** cancha lista para jugar. La fotografía aparece sólo si la colección está vacía, conservando el botón «Armar partido». Una vista sin coincidencias por filtros sigue mostrando un mensaje específico.
- **Plantel vacío:** vestuario con camisetas y botines; se mantiene «Agregar Jugador» arriba. Los filtros o búsquedas sin coincidencias no se presentan como ausencia de plantel.
- **Ligas:** fotografía de un partido amateur, diferenciada de **Copas**, que conserva el trofeo creado en la primera tanda.
- **Evaluaciones al día:** composición de iconos deportivos nativos con confirmación. Es estática al visitar la bandeja. Sólo el envío exitoso dispara una animación de 420 ms en el aviso, sin retardar la navegación, sin bucles y con alternativa estática para movimiento reducido. No se anima un envío fallido.

Los tres recursos raster se generaron con la herramienta integrada **image_gen**, se inspeccionaron y se incluyeron en el proyecto como WebP de 1200 × 800, calidad 83:

| Uso | Archivo | Bytes |
| --- | --- | ---: |
| Partidos | [patea_ready_pitch.webp](../../patea_mobile/assets/brand/patea_ready_pitch.webp) | 200186 |
| Plantel | [patea_locker_room.webp](../../patea_mobile/assets/brand/patea_locker_room.webp) | 64968 |
| Ligas | [patea_league.webp](../../patea_mobile/assets/brand/patea_league.webp) | 189096 |

Nueva tanda: 454250 bytes, aproximadamente 444 KiB. Las seis imágenes de sección suman 823462 bytes, aproximadamente 804 KiB. Originales, hashes y dimensiones en [el manifiesto](SECTION_MEDIA_2026-11-16.json). Sin dependencias nuevas, video ni llamadas a API en tiempo de ejecución.

## Prompts finales

### matches

Photorealistic natural editorial sports photograph for Pateá, a Uruguayan amateur football app. Landscape 3:2. An empty modest five-a-side neighborhood football pitch in Montevideo ready for a game at blue hour, warm floodlights on, slightly worn artificial turf, a simple small goal and wire fence, low houses and trees beyond. One plain unbranded worn football resting near the right foreground touchline. Quiet inviting atmosphere, no people, no giant stadium, no professional ceremony. Rich blue green shadows, warm natural lighting, realistic textures, premium documentary photography, not a video game. Ball and goal toward right, open turf at left. No text, signage, logos, sponsors, watermark or UI.

### players

Photorealistic natural editorial sports photograph for Pateá, Uruguayan amateur football app. Wide landscape 3:2. Interior of a modest clean neighborhood football changing room, well worn wooden bench, several plain blue and orange football jerseys hanging on simple wall hooks, a pair of used football boots and a plain unbranded ball beside the bench at the right. No people, no mirrors, no names, no numbers, no letters, no logos or trademarks, no signage. Authentic humble club setting, neither luxurious professional locker room nor grimy abandoned space. Soft cool blue green ambient light from a side window with a warm practical light, natural tactile materials, restrained contrast, premium documentary photography, clear usable composition with quiet darker wall on left. No watermark or UI.

### league

Photorealistic natural editorial sports photograph for Pateá, Uruguayan amateur football app. Landscape 3:2. A candid neighborhood amateur five-a-side match in Montevideo at blue hour: four adult players, men and women aged 25-45 in plain blue and orange bibs, seen in mid distance from the sideline during a believable calm passing sequence. Small fenced artificial turf pitch, low houses, trees, warm floodlights, simple goal in the background. Ordinary adult athletes, realistic anatomy, natural grounded feet, exactly one unbranded ball at a player's foot, no impossible acrobatics or goal celebrations. Main action in right half, open turf on left, rich blue green shadows and warm lights, documentary photography. This is the recurring league season, no trophy, no confetti, no professional stadium. No text, letters, logos, watermark or UI.

## Versión y alcance

Revisión Android local 1.0.13 (14), sobre `feat/flutter-mobile-app`, conservando los cambios previos del perfil y del detalle de partido. No modifica datos ni servicios, ni implica publicación en Firebase App Distribution o TestFlight.


Validación: 169 pruebas Flutter aprobadas, incluidas dos nuevas que comprueban animación finita, estado estático y movimiento reducido. Capturas de Competiciones actualizadas y revisadas en ambos temas; pruebas a escala de texto 1,3×. Análisis sin errores ni advertencias (29 avisos informativos).

Instalación confirmada: APK release android-x64, versión 1.0.13 (14), firma oficial verificada, actualización por adb install -r en emulator-5554 y apertura correcta. Sesión y datos conservados; sin distribución externa.
