# La última fecha y variedad de canchas — 16/11/2026

## Contenido real del Panel

`LatestMatchReview` reemplaza la fila de último resultado por una sección visual con el último partido en que participó el usuario. Se mantiene el filtro existente por identidad en convocados o equipos y la selección por fecha.

- Resultado únicamente cuando `hasFinalScore` está confirmado; si no, indica confirmación pendiente.
- Figura según el identificador persistido o los votos disponibles. Usa nombre y foto del roster real; no inventa personas ni votos.
- Hasta tres goleadores a partir de `matchResultStatsProvider`, con acceso al detalle para la planilla completa.
- Titular y entrada de la crónica almacenada cuando existe. Abrir el resumen no llama a Gemini ni crea contenido.
- Accesos reales al perfil de la figura y al partido.
- Carga y error del resumen se muestran sin fabricar estadísticas ni impedir ver el partido.
- Se retiró el indicador W/L anterior, que asumía que el usuario pertenecía al equipo A.

## Auditoría de fotografías de partido

Antes había una portada fija en Panel/detalle y selección entre fondos antiguos en algunas tarjetas. `MatchPhotography.forMatch(id)` unifica ahora Panel, lista, convocatoria y detalle. Una huella determinista del ID elige entre cinco ambientes; se mantiene al navegar y entre sesiones. No utiliza azar por rebuild, nombre de usuario, ubicación privada ni consultas nuevas.

El conjunto incluye la fotografía editorial nocturna existente, la cancha preparada y tres recursos nuevos claramente diferentes. Son escenarios ilustrativos: no se presentan como imágenes documentales de la cancha o el encuentro real. Las fotos de acceso y las preferencias opcionales del tema Claro no se modifican.

Generados con la herramienta integrada **image_gen**, inspeccionados y optimizados a WebP de 1200 × 800, calidad 83:

| Ambiente | Recurso | Bytes |
| --- | --- | ---: |
| Techado | [patea_indoor.webp](../../patea_mobile/assets/brand/patea_indoor.webp) | 145352 |
| Parque, césped natural | [patea_park.webp](../../patea_mobile/assets/brand/patea_park.webp) | 227680 |
| Urbana, piso pintado | [patea_urban_court.webp](../../patea_mobile/assets/brand/patea_urban_court.webp) | 167240 |

Total nuevo: 540272 bytes (aproximadamente 528 KiB). Orígenes y SHA-256 en [el manifiesto de recursos](SECTION_MEDIA_2026-11-16.json). Los originales generados se conservan fuera del bundle.

## Prompts finales

### indoor

Photorealistic editorial photograph for Pateá amateur football app, landscape 3:2. A distinctly INDOOR neighborhood futsal venue in Uruguay: modest high corrugated metal roof, steel trusses, warm industrial lamps, small enclosed blue-green synthetic turf pitch, low side boards, simple goal at right, painted walls, absolutely no outdoor sky or trees. Empty venue ready for play, realistic worn materials, inviting and maintained. Wide sideline perspective, goal and bright focal area on right, quiet darker open floor on left for separately rendered interface. No people, text, numbers, logos, brands, advertising, watermark or interface. Documentary sports photography, believable geometry and natural contrast.

### park

Photorealistic editorial photograph for Pateá amateur football app, landscape 3:2. A distinctly OPEN NATURAL GRASS neighborhood football pitch in a Uruguayan park on a soft overcast afternoon, mature eucalyptus and plane trees, simple white goal to the right, worn white field markings, low houses far behind, no tall surrounding wire cage, no stadium, no synthetic turf. Green grass with natural patches of wear, subdued cloudy daylight, no floodlights dominating the frame. Wide sideline composition with quiet darker shaded grass on left for separately rendered interface and the goal towards right. Empty setting ready for amateur friends, realistic local character. No people, text, signage, logos, watermark or UI.

### court

Photorealistic editorial photograph for Pateá amateur football app, landscape 3:2. A distinctly urban OPEN CONCRETE FIVE-A-SIDE football court in a modest Uruguayan neighborhood in late afternoon. Weathered muted blue painted concrete floor with faded white markings, low stucco side walls, a simple small goal to the right, brick and stucco houses beyond, warm sideways sunlight with long shadows, no artificial turf or grass, no big stadium. Wide low sideline perspective, main goal to the right and quiet shaded left half suitable for separate interface text. Grounded authentic architecture, maintained but well used, documentary sports photography. No people, no basketball hoops, no letters, numbers, text, signs, logos, brands, watermark or UI.

## Alcance

Revisión local 1.0.15 (16) en `feat/flutter-mobile-app`. Sin escrituras de datos, generación automática de crónicas ni distribución externa.


Validación: 174 pruebas aprobadas, cinco nuevas sobre selección estable, existencia de assets, datos reales, resultado pendiente, error de evaluaciones y navegación. Análisis sin errores ni advertencias (29 avisos informativos). Capturas de Panel, Partidos y Detalle revisadas en ambos temas y escala de texto 1,3×.

Instalación verificada: 1.0.15 (16), APK release android-x64 con firma oficial, actualización conservando datos en emulator-5554. Revisión real con Briseida: última fecha 3–4, Aurelio figura con 6 votos y goleadores cargados; crónica existente accesible. El emulador queda en esa sección. Sin distribución externa.
