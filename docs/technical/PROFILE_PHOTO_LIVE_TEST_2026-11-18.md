# Prueba real de conversión de foto de perfil — 18/11/2026

## Alcance

Revisión del commit `344159d4` en `feat/flutter-mobile-app`. Se generó una fotografía de una mujer adulta ficticia con la herramienta integrada de generación de imágenes y se envió a Vertex AI, proyecto `mil-disculpis`, región `global`, usando los modelos, prompt, extracción de imagen y configuración 3:4 del backend compilado de ese commit.

La ejecución no invocó el callable desplegado ni escribió perfiles, Storage o créditos. Verifica la conversión real del proveedor, no el flujo completo de selección, recorte, guardado y sincronización en el dispositivo.

## Resultado

- Compilación TypeScript y las cinco pruebas de `generate-player-photo.test.cjs`: aprobadas.
- Modelo `gemini-nano-banana-2.1`: generación correcta en 36.342 ms; no se necesitó el fallback.
- Salida PNG, 1.617.736 bytes. Camiseta deportiva azul/dorada, brazos cruzados y fondo azul verdoso.
- Inspección visual: conserva una apariencia reconocible respecto de la referencia y cambia correctamente vestimenta y pose. No demuestra identidad facial idéntica ni preservación exacta de edad. Se perciben líneas y textura más marcadas en frente y rostro. El fondo presenta variaciones de iluminación, aunque el prompt pide un color plano sin degradados.

Los artefactos están en `output/profile-photo-smoke/2026-11-18/`: `source.png`, `converted.png` y `report.json`. El informe guarda el prompt exacto y el resultado de cada intento, sin credenciales.

## Repetir la prueba

Desde `functions/`, con la cuenta Google del proyecto autenticada:

```powershell
npm run build
node scripts/smoke-player-photo.cjs RUTA_FOTO_PNG DIRECTORIO_RESULTADO
```

El script usa el token de gcloud en memoria y la versión de `google-auth-library` resuelta por `@google/genai`, evitando incompatibilidad de headers con la dependencia de Firebase Admin. La foto debe ser PNG y no superar los 5 MB.

Prompt de la imagen de entrada: fotografía natural de smartphone de una mujer ficticia de aproximadamente 30 años, cabello castaño oscuro rizado a los hombros, pecas suaves, sonrisa leve, camiseta gris, brazos relajados y parque desenfocado. Se usó la herramienta integrada para la referencia; la transformación se hizo mediante Vertex, no mediante una segunda edición de esa herramienta.

## Segunda versión: fidelidad y composición

A pedido del usuario se ajustó el prompt del backend: prioridad del rostro sobre el estilo, conservación de expresión y textura sin acentuar edad, postura relajada, camiseta sin marcas ni escudos inventados y fondo mate uniforme. La relación de aspecto se centralizó en `PLAYER_PHOTO_ASPECT_RATIO = '2:3'`, compartida por el callable y el smoke test.

Se repitió Vertex con la misma foto original, no con la primera transformación. SHA-256 de ambas referencias: `4B2DAB03FCA4C574B1B565EC7FBA4B47CE4E5F56EB829E573C5BEE4AE39E4458`.

Resultado: `gemini-nano-banana-2.1`, 15.216 ms, PNG de 1.397.668 bytes. Artefactos comparables en `output/profile-photo-smoke/2026-11-18-v2/`. Inspección visual: menos líneas acentuadas y rostro más próximo a la referencia; camiseta azul/blanca sin emblemas; pose menos rígida y fondo más uniforme. Sigue dejando más espacio sobre el cabello que el 4% solicitado y conserva pequeñas variaciones tonales del fondo. La fidelidad facial sigue siendo una evaluación visual, no una garantía biométrica.

Compilación TypeScript y cinco pruebas del backend aprobadas tras el cambio. El código está preparado; esta prueba no despliega la función ni modifica perfiles.
