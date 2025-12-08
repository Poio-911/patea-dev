# 📄 Documentación de la Arquitectura de IA - Amateur Football Manager

## 1. Resumen Ejecutivo

Este documento proporciona una referencia técnica completa sobre la implementación de funcionalidades de Inteligencia Artificial (IA) en la aplicación, utilizando **Google AI** a través del framework **Genkit**. La arquitectura está diseñada para ser modular, escalable y fácil de mantener.

**Stack Tecnológico de IA:**
-   **Framework de Orquestación**: `genkit@1.21.0`
-   **Plugin de Modelo**: `@genkit-ai/google-genai@1.21.0` (para interactuar con los modelos de Google)
-   **Integración con Next.js**: `@genkit-ai/next@1.21.0` (para exponer los flujos como Server Actions)
-   **Validación de Esquemas**: `zod` (para definir y validar las entradas y salidas de los flujos de IA)

---

## 2. Configuración del Entorno

### a. Dependencias (`package.json`)
Las siguientes dependencias son el núcleo de nuestra capa de IA. Todas las dependencias de Genkit están alineadas en la versión `1.21.0` para garantizar la compatibilidad.

```json
"dependencies": {
  "@genkit-ai/google-genai": "1.21.0",
  "@genkit-ai/next": "1.21.0",
  "genkit": "1.21.0",
  "zod": "^3.24.2",
  // ... otras dependencias
}
```

### b. Configuración Central de Genkit (`src/ai/genkit.ts`)
Este archivo es el punto de entrada para la configuración de Genkit. Aquí se inicializa el plugin de `googleAI`, que requiere una API Key para funcionar.

-   **Ubicación**: `src/ai/genkit.ts`
-   **Contenido Clave**:

    ```typescript
    import { genkit } from 'genkit';
    import { googleAI } from '@genkit-ai/google-genai';

    export const ai = genkit({
      plugins: [
        googleAI({
          apiKey: process.env.GOOGLE_GENAI_API_KEY!,
        }),
      ],
    });
    ```
-   **Importante**: La `apiKey` se carga desde las variables de entorno (`.env` o `.env.local`), lo que nos permite mantener las claves seguras y fuera del código fuente.

### c. Archivo de Desarrollo (`src/ai/dev.ts`)
Este archivo sirve para importar todos nuestros flujos de IA, permitiendo que Genkit los descubra y los haga disponibles para herramientas de desarrollo como la UI de Genkit.

-   **Ubicación**: `src/ai/dev.ts`

---

## 3. Arquitectura de Flujos de IA (Genkit)

Cada funcionalidad de IA está encapsulada en un "flujo" (Flow), que es un archivo TypeScript ubicado en `src/ai/flows/`. La estructura de cada flujo sigue un patrón consistente:

1.  **`'use server';`**: Todos los flujos comienzan con esta directiva para ser compatibles con las Server Actions de Next.js.
2.  **Esquemas de Zod**: Se definen dos esquemas principales usando `zod`:
    *   `...InputSchema`: Define la estructura y los tipos de los datos de entrada que el flujo espera.
    *   `...OutputSchema`: Define la estructura y los tipos de los datos que el flujo devolverá. Esto es crucial para que la IA genere respuestas en un formato JSON predecible.
3.  **`ai.definePrompt`**: Se crea un "prompt" de Genkit. Este es el corazón del flujo, donde se define:
    *   `input` y `output` con los esquemas de Zod.
    *   `prompt`: La plantilla de texto (usando sintaxis Handlebars `{{{...}}}`) que se enviará al modelo de lenguaje. Aquí se dan las instrucciones a la IA.
4.  **`ai.defineFlow`**: Se define el flujo principal, que envuelve la lógica.
    *   Recibe los esquemas de entrada y salida.
    *   Dentro de su lógica asíncrona, llama al `prompt` previamente definido, pasándole los datos de entrada y **especificando el modelo a usar**.
5.  **Función Exportada**: Se exporta una función `async` simple que actúa como un envoltorio público para el flujo, facilitando su llamada desde otras partes de la aplicación (generalmente, Server Actions).

---

## 4. Catálogo de Flujos y Modelos Implementados

A continuación se detalla cada flujo de IA, su propósito y el modelo de Google utilizado.

### a. Pronóstico del Clima para Partidos

-   **Archivo**: `src/ai/flows/get-match-day-forecast.ts`
-   **Modelo Utilizado**: `'googleai/gemini-2.5-flash'`
-   **Propósito**: Al crear o ver un partido, este flujo toma una ubicación y una fecha, y le pide a la IA que devuelva un pronóstico del tiempo conciso, incluyendo una descripción, un ícono representativo y la temperatura en grados Celsius.
-   **Sintaxis Clave de la Llamada al Modelo**:
    ```typescript
    const { output } = await forecastPrompt(input, { model: 'googleai/gemini-2.5-flash' });
    ```

### b. Generación de Equipos Equilibrados

-   **Archivo**: `src/ai/flows/generate-balanced-teams.ts`
-   **Modelo Utilizado**: `'googleai/gemini-2.5-flash'`
-   **Propósito**: Recibe una lista de jugadores con su OVR y posición, y devuelve dos equipos optimizados para que el OVR promedio sea lo más similar posible. También genera nombres creativos para los equipos y métricas de equilibrio.
-   **Sintaxis Clave de la Llamada al Modelo**:
    ```typescript
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    ```

### c. Sugerencias de Mejora para Jugadores

-   **Archivo**: `src/ai/flows/suggest-player-improvements.ts`
-   **Modelo Utilizado**: `'googleai/gemini-2.5-flash'`
-   **Propósito**: Analiza el historial de evaluaciones y estadísticas de un jugador y genera 2-3 consejos concisos y accionables en un tono de DT profesional para que el jugador pueda mejorar.
-   **Sintaxis Clave de la Llamada al Modelo**:
    ```typescript
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    ```

### d. Asistente de Fichajes

-   **Archivo**: `src/ai/flows/find-best-fit-player.ts`
-   **Modelo Utilizado**: `'googleai/gemini-2.5-flash'`
-   **Propósito**: Ayuda a los organizadores a encontrar jugadores. Analiza un partido incompleto y una lista de jugadores disponibles, y recomienda los mejores fichajes basándose en la posición y el equilibrio del OVR.
-   **Sintaxis Clave de la Llamada al Modelo**:
    ```typescript
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    ```

### e. Transformación de Foto de Perfil (IA)

-   **Archivo**: `src/ai/flows/generate-player-card-image.ts`
-   **Modelo Utilizado**: `'googleai/gemini-1.5-flash-image-preview'` (Un modelo multimodal especializado en imagen)
-   **Propósito**: Toma la foto de perfil de un usuario (como Data URI) y la transforma en una imagen estilizada profesional, similar a una carta de jugador, con fondo transparente.
-   **Sintaxis Clave de la Llamada al Modelo**:
    ```typescript
    const { media } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-image-preview',
        prompt: [/* ... imagen y texto ... */],
        config: {
          responseModalities: ['IMAGE'],
          // ...
        },
    });
    ```
-   **Nota**: Este flujo utiliza `ai.generate` directamente en lugar de `ai.definePrompt` porque la entrada es más compleja (una combinación de imagen y texto).

---

## 5. Script de Test de Conectividad (`test-genai.js`)

Para diagnosticar rápidamente problemas de conectividad con la API de Google AI, se utiliza un script simple que no depende de Genkit.

-   **Archivo**: `test-genai.js`
-   **Propósito**: Realiza una llamada `fetch` directa al endpoint de la API de Google usando un modelo conocido (`gemini-2.5-flash`) y la API Key del proyecto.
-   **Uso**: Se ejecuta con `node test-genai.js`. Una respuesta exitosa confirma que la API Key es válida y que hay conectividad de red. Un error apunta a problemas de configuración de la clave o de red.

Este documento sirve como la fuente de verdad para toda la lógica de IA en la aplicación. Cualquier nuevo flujo o modelo deberá ser documentado aquí.