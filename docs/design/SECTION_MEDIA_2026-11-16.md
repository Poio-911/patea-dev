# Imágenes por sección — 16/11/2026

## Actualización vigente: contenido para usuarios activos — 1.0.14 (15)

Las imágenes también forman parte de las vistas con datos: Panel y Partidos usan la escena de juego en su convocatoria real; Plantel tiene una portada persistente con cantidad total de jugadores y OVR promedio; Grupos combina la portada con nombre, jugadores, equipos y partidos jugados. Los conteos salen de los streams existentes y se omiten mientras no hay datos. No se presentan las fotografías ilustrativas como registros reales de esos partidos o miembros. Las fichas, filtros, invitaciones y acciones permanecen disponibles.

El criterio inicial de usarlas principalmente en estados vacíos quedó ampliado. No se generaron nuevos recursos en esta revisión: se aprovechan los seis assets existentes también durante el uso habitual.

## Análisis antes de integrar

La fotografía aporta contexto de fútbol amateur en accesos, portadas y estados vacíos. En formularios, controles y tablas compite con la lectura. Los nuevos recursos siguen la fotografía existente de Pateá: cancha barrial, luz de tarde, azul verdoso y focos cálidos; sin marcas ni texto incrustado.

| Lugar | Recurso decidido | Motivo y límites |
| --- | --- | --- |
| Grupos sin membresía y bienvenida del panel | Equipo adulto preparándose con pecheras | Explica el encuentro con amigos. No representa miembros reales del usuario. Las acciones existentes para crear/unirse se conservan. |
| Ligas y copas, con datos o vacías | Trofeo sencillo y pelota junto a una cancha barrial | Identifica las competiciones sin recurrir a estadios profesionales o imágenes repetidas de la portada de partidos. |
| Explorar sin jugadores o partidos disponibles | Botines, pelota y pechera al costado de la cancha | Da identidad al estado vacío; la explicación conserva los filtros y la disponibilidad reales. |
| Acceso, próximo partido y detalle | Fotografía editorial de marca existente | Ya tienen composición propia; no se sustituyen en esta iteración. |
| Perfil y fichas de jugadores | Retratos existentes | No generar retratos ficticios para suplantar fotos personales. |
| Crear partido, evaluación, ajustes, tablas y listas con datos | Superficies y tipografía, sin nuevas imágenes de fondo | Prioridad a lectura, acciones, contraste y densidad útil. |
| Clips | Videos reales aportados por participantes | No insertar videos generados como si fueran escenas del partido. |

No se agregó video automático. En estas superficies bastan imágenes estáticas y una revelación breve de encuadre (escala 1,035 → 1, 420 ms, sin bucle), omitida cuando se solicita movimiento reducido. Un video añadiría peso, decodificación y movimiento mientras se navega información.

## Recursos e integración

Generados con la herramienta integrada **image_gen**, no mediante una API de pago del proyecto. Los originales se conservan en el directorio de imágenes generadas de Codex. Los recursos finales están dentro del repositorio; el manifiesto [SECTION_MEDIA_2026-11-16.json](SECTION_MEDIA_2026-11-16.json) registra origen, dimensiones, tamaños y SHA-256.

- [patea_groups.webp](../../patea_mobile/assets/brand/patea_groups.webp): 1200 × 800, 128948 bytes.
- [patea_competitions.webp](../../patea_mobile/assets/brand/patea_competitions.webp): 1200 × 800, 110684 bytes.
- [patea_explore.webp](../../patea_mobile/assets/brand/patea_explore.webp): 1200 × 800, 129580 bytes.

Total: 369212 bytes, aproximadamente 361 KiB. WebP calidad 83. Sin dependencia de red para mostrarlas. `PateaSectionScene` limita la decodificación al ancho del dispositivo (máximo 1200), coloca el texto debajo de la fotografía en la superficie del tema y ofrece un fallback local. No reemplaza ni regenera el logotipo.

## Prompts finales

### Grupos

Photorealistic natural editorial photograph for Pateá, a Uruguayan amateur football mobile app. Wide landscape 3:2 composition. Five adult friends, diverse men and women ages 25-45, seen mostly from behind and side, casually gathering before a neighborhood five-a-side football game in Montevideo. They are pulling on plain orange and blue training bibs beside a small worn artificial turf pitch and modest wire fence. Genuine relaxed amateur scene, not a professional stadium, not a fashion shoot. Early evening soft blue hour with warm floodlights, rich deep blue green tones, natural skin, imperfect equipment. Main adult figures on the right two thirds; quiet darker turf and fence at left for separate UI text if used. No identifiable famous players. No children. No text, letters, logos, brands, sponsor signs, watermarks, or UI. Athletic but ordinary physiques, realistic anatomy and natural hands. Premium documentary sports photography, restrained natural contrast, no neon effects.

### Competiciones

Photorealistic natural editorial photograph for Pateá, Uruguayan amateur football app. Landscape 3:2 image, coherent with quiet Montevideo neighborhood football photography at blue hour, deep blue green tones and warm floodlights. A modest silver local football trophy on a worn dark wooden bench beside the sideline of a small artificial turf five-a-side pitch. A simple unbranded football sits beside the bench, wire fence and a few anonymous adult players softly blurred far in background. Trophy has NO readable engraving and NO words. No grand stadium, no professional championship spectacle, no gold confetti, no luxury, no floating objects. Trophy and ball occupy the right half of frame, left half quiet darker turf with space for separately rendered UI. Believable metal reflections, worn football texture, grounded perspective, no text logos branding watermark or UI. Editorial sports photography, inviting neighborhood competition.

### Explorar

Photorealistic natural editorial photograph for Pateá, Uruguayan amateur football app, wide landscape 3:2. Close sideline scene of plain well used football boots, a folded fluorescent yellow green training bib, and a worn unbranded football resting on artificial turf near the edge of a small Montevideo neighborhood five-a-side pitch. Camera low, warm floodlights and blue hour dusk, deep blue green background, quiet documentary mood suggesting ready to join the next game. Objects gathered on the right half, left half open darker turf and softly blurred small fence. No people in foreground, no human limbs, no giant stadium, no luxury equipment, no legible text or sports brands, no watermark, no UI, no logos. Realistic athletic gear proportions, tactile natural materials, clear focal point, natural contrast.

## Validación local

Revisión móvil 1.0.12 (13), en `feat/flutter-mobile-app`. 167 pruebas Flutter aprobadas, incluyendo capturas actualizadas de Competiciones y Explorar en ambos temas y pruebas a escala de texto 1,3×. Análisis sin errores ni advertencias (23 avisos informativos). Capturas compuestas de revisión generadas aparte de los masters. Se conservan los cambios previos del detalle de partido y del perfil de jugador.

Compilación destinada al emulador Android x64, sin distribución externa ni modificación de servicios remotos.

Instalación verificada: APK release android-x64 1.0.12 (13), firma oficial, `adb install -r` correcto en `emulator-5554`; la actualización conserva sesión y datos. Sin distribución a Firebase App Distribution ni TestFlight.

Validación de 1.0.14: 169 pruebas aprobadas. Capturas de las vistas pobladas de Panel, Plantel, Partidos y Grupos revisadas y actualizadas en ambos temas; escala de texto 1,3× incluida. Los colores del nuevo componente están centralizados en el tema, sin ampliar el presupuesto del control de paleta. Análisis del componente y del tema sin incidencias.

Instalación 1.0.14 (15) verificada por Package Manager tras adb install -r, firma oficial. Revisión real en Plantel con sesión de Briseida: portada visible junto a sus 15 jugadores y OVR promedio 56,3, sin eliminar datos. Emulador dejado en esa vista. Sin distribución externa.
