# Flujos de IA - Índice Completo

Esta carpeta contiene la documentación detallada de todos los flujos de inteligencia artificial utilizados en Pateá. Todos los flujos están construidos con **Google Genkit** y utilizan el modelo **Gemini 2.5 Flash**.

## Categorías de Flujos

### 🔧 Gestión de Equipos

#### [generate-balanced-teams.md](./generate-balanced-teams.md)
**Genera equipos equilibrados basados en jugadores disponibles**
- **Input**: Lista de jugadores con OVR y posiciones
- **Output**: 2 equipos balanceados con formaciones sugeridas
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Diálogo de creación de partido, generación automática de equipos

---

### 👤 Análisis de Jugadores

#### [suggest-player-improvements.md](./suggest-player-improvements.md)
**Sugiere mejoras personalizadas para un jugador**
- **Input**: Estadísticas y evaluaciones históricas del jugador
- **Output**: 2-3 consejos concisos y accionables
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Panel de insights del jugador, diálogo de sugerencias de IA

#### [analyze-player-progression.md](./analyze-player-progression.md)
**Analiza la progresión del jugador a lo largo del tiempo**
- **Input**: Historial de OVR, evaluaciones, estadísticas
- **Output**: Análisis detallado de tendencias y áreas de mejora
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Vista de progresión del jugador

#### [detect-player-patterns.md](./detect-player-patterns.md)
**Detecta patrones de rendimiento del jugador**
- **Input**: Evaluaciones históricas, tags de rendimiento
- **Output**: Patrones identificados, fortalezas y debilidades
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Panel de insights del jugador

---

### 🔍 Búsqueda y Recomendaciones

#### [find-best-fit-player.md](./find-best-fit-player.md)
**Encuentra el mejor jugador disponible para llenar un puesto**
- **Input**: Posición necesaria, ubicación, disponibilidad
- **Output**: Jugadores recomendados ordenados por compatibilidad
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Diálogo de búsqueda de jugador ideal

---

### 💬 Asistencia Inteligente

#### [coach-conversation.md](./coach-conversation.md)
**Chat conversacional con un DT virtual**
- **Input**: Pregunta del usuario, contexto del grupo/jugador
- **Output**: Respuesta personalizada del DT
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Vista de chat con el entrenador virtual

#### [get-app-help.md](./get-app-help.md)
**Proporciona ayuda contextual sobre la aplicación**
- **Input**: Pregunta del usuario
- **Output**: Respuesta con instrucciones claras
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Diálogo de ayuda, chat de soporte

---

### 🌤️ Información de Partidos

#### [get-match-day-forecast.md](./get-match-day-forecast.md)
**Obtiene el pronóstico del clima para el día del partido**
- **Input**: Ubicación y fecha del partido
- **Output**: Pronóstico meteorológico
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Creación de partido, vista de detalles de partido

#### [generate-match-chronicle.md](./generate-match-chronicle.md)
**Genera una crónica narrativa del partido jugado**
- **Input**: Datos del partido (resultado, goleadores, tarjetas)
- **Output**: Crónica periodística del partido
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Vista post-partido, tarjeta de crónica

---

### 🎨 Generación de Contenido Visual

#### [generate-duo-image.md](./generate-duo-image.md)
**Genera imágenes de interacción entre dos jugadores**
- **Input**: Fotos de 2 jugadores, prompt de escena
- **Output**: Imagen generada (data URI)
- **Modelo**: Gemini 2.5 Flash Image Preview
- **Usado en**: Generación de imágenes de dúos

#### [generate-player-card-image.md](./generate-player-card-image.md)
**Genera tarjetas visuales estilo FIFA para jugadores**
- **Input**: Datos del jugador (nombre, posición, atributos)
- **Output**: Imagen de tarjeta (data URI)
- **Modelo**: Imagen (específico de la función)
- **Usado en**: Vista de perfil de jugador

#### [generate-group-summary.md](./generate-group-summary.md)
**Genera un resumen descriptivo del grupo**
- **Input**: Datos del grupo, jugadores, estadísticas
- **Output**: Resumen textual del grupo
- **Modelo**: Gemini 2.5 Flash
- **Usado en**: Vista de grupo

---

## Estructura Común de Documentos

Cada flujo de IA está documentado con:

1. **Propósito**: Qué problema resuelve
2. **Input Schema**: Parámetros de entrada con tipos
3. **Output Schema**: Estructura de la respuesta
4. **Modelo AI**: Modelo de Gemini utilizado
5. **Prompt**: Estrategia de prompt y contexto
6. **Ejemplos**: Casos de uso reales
7. **Integración**: Dónde se usa en la app
8. **Manejo de Errores**: Cómo se gestionan los fallos

## Tecnología Subyacente

- **Framework**: [Google Genkit](https://firebase.google.com/docs/genkit)
- **Modelos**: Google Gemini (vía Google AI)
- **Validación**: Zod schemas
- **Runtime**: Next.js Server Actions

## Configuración

Todos los flujos requieren:
```env
GOOGLE_GENAI_API_KEY=your_api_key_here
```

La configuración de Genkit se encuentra en `/src/ai/genkit.ts`.

## Uso General

Los flujos se invocan desde server actions:

```typescript
import { generateBalancedTeams } from '@/ai/flows/generate-balanced-teams';

const result = await generateBalancedTeams({
  players: [...],
  teamCount: 2
});
```

## Notas sobre Rendimiento

- Los flujos usan Gemini 2.5 Flash para balance entre velocidad y calidad
- Típicamente responden en 1-3 segundos
- Se implementa manejo de errores robusto
- Los prompts están optimizados para español rioplatense

## Futuras Mejoras

- Caché de resultados para consultas repetidas
- Soporte multi-idioma
- Integración con modelos más avanzados según necesidad
- Telemetría y logging mejorado
