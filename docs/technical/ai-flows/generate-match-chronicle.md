# generate-match-chronicle

## Vertex AI — 16/11/2026

Las crónicas móviles usan Vertex AI en el proyecto `mil-disculpis`, ubicación `global`, modelo `gemini-3.1-flash-lite`, autenticación de la identidad de servicio de Functions y sin claves de AI Studio. No se guardaron las claves proporcionadas en el chat.

Se intentó `gemini-2.5-flash-lite`, pero el proyecto devolvió 404 tanto en `global` como en `us-central1`. Flash-Lite 3.1 sí generó contenido. El flow web también está adaptado a Vertex mediante una instancia Genkit independiente; ese código requiere un despliegue web posterior y permisos Vertex para su identidad. No se cambian los proveedores de los demás flows.

## Costo y límites

Tarifa estándar global consultada: USD 0,25 por millón de tokens de entrada y USD 1,50 por millón de salida. Fuente: https://cloud.google.com/model-garden/pricing.

Prueba real con datos ficticios y prompt completo: 1293 tokens de entrada, 536 de salida, 1829 totales, finalización STOP y JSON válido. Costo calculado: USD 0,00112725 (aproximadamente USD 1,13 por mil crónicas de ese tamaño). No es una cuota gratuita ni un costo fijo; no incluye impuestos, infraestructura Firebase, reintentos o regeneraciones.

La generación usa máximo 2048 tokens de salida y pensamiento MINIMAL. Sin búsqueda web, herramientas externas ni fallback a un modelo más caro. No se modificaron cuentas de facturación, créditos ni presupuestos.

## Propósito y contrato

Crónica narrativa rioplatense de un partido evaluado. Se conservan el prompt, sus reglas y el contexto: resultado, equipos, eventos, MVP, ubicación, testimonios y etiquetas destacadas cuando existen. Entrada canónica: `GenerateMatchChronicleInputSchema` en `src/lib/types.ts`.

```typescript
{
  headline: string;
  story: string;
  playerVoices?: { playerName: string; quote: string }[];
}
```

Se valida JSON, texto no vacío, testimonios y finalización STOP antes de guardar. Campos ajenos al contrato se descartan; errores internos del proveedor no se devuelven al cliente. La generación no garantiza exactitud editorial: requiere revisar los hechos y el estilo del resultado.

## Integración y caché

- Móvil: callable `generateMatchChronicle`, `functions/src/callable/match-chronicle.ts`.
- Verifica sesión, estado evaluado y participación/organizador antes de devolver también contenido cacheado.
- Guarda en `matches/{id}.chronicle` y `chronicleGeneratedAt`; reutiliza la crónica salvo `force: true`. Peticiones concurrentes iniciales aún pueden generar más de una llamada.
- Web: `src/ai/flows/generate-match-chronicle.ts`, instancia `chronicleAI` en `src/ai/genkit.ts`, caché de 24 horas. Pendiente publicar esa versión web.
- La identidad runtime móvil existente tiene permisos Vertex mediante su rol actual; no se amplió IAM.

## Validación

- Functions: 32 pruebas aprobadas, incluidas cuatro nuevas de contrato, datos inválidos y truncamiento; diez pruebas de integración omitidas por no ejecutar Firestore Emulator en esta comprobación.
- Typecheck de Next.js y compilación TypeScript de Functions aprobados.
- Prueba real por SDK con prompt completo, esquema JSON, modelo y configuración de producción; datos ficticios, sin crear ni editar partidos.
- Distribución de APK e iOS permanece detenida. El despliegue de esta tarea afecta sólo `generateMatchChronicle`.

Despliegue confirmado: `generateMatchChronicle` ACTIVE, actualización `2026-11-16T03:31:41Z`. Prueba HTTP sin sesión devuelve 401 UNAUTHENTICATED, sin generar ni escribir datos. El binding heredado de `GOOGLE_GENAI_API_KEY` permanece en la configuración desplegada de Firebase, pero este código no lo lee ni lo usa; los otros servicios que usan esa credencial no se modificaron.
