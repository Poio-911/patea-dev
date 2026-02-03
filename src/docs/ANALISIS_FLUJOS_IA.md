
# 🧠 Análisis de Flujos de IA en Pateá

**Fecha:** 3 de Febrero 2026
**Objetivo:** Documentar exhaustivamente todos los modelos de IA integrados, sus flujos de ejecución y métodos de disparo (Automático vs Manual).

---

## 📊 Resumen Ejecutivo

- **Total de Flujos de IA:** 12
- **Modelos Utilizados:**
  - `googleai/gemini-2.0-flash` (Estándar para texto y lógica)
  - `googleai/gemini-2.5-flash` (Resúmenes avanzados)
  - `googleai/gemini-2.5-flash-image-preview` (Generación de imágenes)
- **Automatización:** La mayoría de los flujos son **Manuales** (requieren interacción explícita del usuario como botones o formularios). No se detectaron jobs cron o triggers de fondo 100% automáticos que generen contenido sin intervención humana directa.

---

## 🤖 Detalle de Flujos de IA

| Flujo de IA | Modelo | Tipo | Disparo (Trigger) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **Analyze Player Progression** | `gemini-2.0-flash` | Análisis de Datos | **Manual** (Botón en perfil) | Analiza el historial de OVR y evaluaciones recientes para explicar la evolución del jugador. |
| **Analyze Text Performance** | `gemini-2.0-flash` | Comprensión de Texto | **Acción de Usuario** (Submit) | Se ejecuta cuando un usuario envía una evaluación de tipo "Texto". Extrae atributos (+/-) del comentario natural. |
| **Coach Conversation** | `gemini-2.0-flash` | Chatbot | **Manual** (Chat Interface) | Agente conversacional que actúa como DT personal, respondiendo preguntas sobre rendimiento. |
| **Detect Player Patterns** | `gemini-2.0-flash` | Análisis de Datos | **Manual** (Botón/Vista) | Identifica tendencias (ej: "Siempre juega bien los viernes", "Baja rendimiento contra rivales fuertes"). |
| **Find Best Fit Player** | `gemini-2.0-flash` | Recomendación | **Manual** (Botón "Completar") | Busca en la base de datos jugadores que encajen tácticamente en un partido incompleto. |
| **Generate Balanced Teams** | `gemini-2.0-flash` | Lógica / Optimización | **Manual** (Botón "Auto-Balance") | Genera 2 equipos equilibrados basados en OVR y posiciones usando criterios tácticos. |
| **Generate Duo Image** | `gemini-2.5-flash-image-preview` | Generación de Imagen | **Manual** (Botón Compartir) | Crea una imagen cinemática de dos jugadores enfrentados para compartir en redes. |
| **Generate Group Summary** | `gemini-2.5-flash` | Generación de Texto | **Manual** (Botón en Grupo) | Escribe un resumen narrativo del estado y actividad de un grupo al visitarlo (Acción de usuario). |
| **Generate Match Chronicle** | `gemini-2.0-flash` | Escritura Creativa | **Manual** (Botón "Generar Relato") | Redacta una crónica deportiva humorística y literaria del partido finalizado. |
| **Generate Player Card Image** | `gemini-2.5-flash-image-preview` | Generación de Imagen | **Manual** (Pago/Crédito) | Transforma una selfie en un retrato de estilo fútbol profesional para la carta del jugador. |
| **Get App Help** | `gemini-2.0-flash` | Chat / RAG | **Manual** (Widget de Ayuda) | Asistente de soporte que responde dudas sobre cómo usar la aplicación basándose en documentación. |
| **Suggest Player Improvements** | `gemini-2.0-flash` | Asesoramiento | **Manual** (Botón en Perfil) | Genera 3 consejos concisos para mejorar el juego (Acción de usuario). |

> **Nota:** El flujo `get-match-day-forecast` existe en la carpeta de IA pero **NO usa IA**. Consulta la API de OpenMeteo (Algorítmico).

---

## 🛠️ Arquitectura de Modelos

### 1. `googleai/gemini-2.0-flash` (El "Caballo de Batalla")
Es el modelo más utilizado debido a su velocidad y bajo costo. Se encarga de todas las tareas que requieren razonamiento lógico de fútbol, análisis de datos JSON, generación de texto creativo y asesoramiento automático.
- **Archivos:** `analyze-player-progression.ts`, `analyze-text-performance.ts`, `coach-conversation.ts`, `detect-player-patterns.ts`, `find-best-fit-player.ts`, `generate-balanced-teams.ts`, `generate-match-chronicle.ts`, `get-app-help.ts`, `suggest-player-improvements.ts`.

### 2. `googleai/gemini-2.5-flash` (El "Analista Detallista")
Se utiliza selectivamente para tareas que requieren una ventana de contexto más limpia o una capacidad de resumen superior.
- **Uso exclusivo:** `generate-group-summary.ts`.

### 3. `googleai/gemini-2.5-flash-image-preview` (El "Artista")
Modelo multimodal especializado en generación de imágenes. Se usa para las dos features visuales premium de la app.
- **Uso:** `generate-player-card-image.ts` (Cartas Pro), `generate-duo-image.ts` (Social Sharing).

---

## 🔄 Integración Técnica

Todos los flujos siguen el patrón de **Genkit**:

1.  **Definición**: En `src/ai/flows/*.ts` usando `ai.defineFlow`.
2.  **Prompting**: Usan `ai.definePrompt` con Zod Schemas estrictos para Input/Output.
3.  **Ejecución**: Se llaman a través de Server Actions (`src/lib/actions/*.ts`) que manejan la autenticación, validación de datos y manejo de errores antes de invocar a la IA.
4.  **Cliente**: La UI invoca las Server Actions y maneja el estado de carga (`isLoading`).

### Ejemplo de Disparo Manual (`generateMatchChronicle`)
Aunque parece automático, el análisis del código (`match-chronicle-card.tsx`) confirma que depende de un botón "Generar Relato". Esto sugiere una decisión de diseño para ahorrar costos (no generar por defecto para todos los partidos) o dar control al usuario.

```typescript
// match-chronicle-card.tsx
const handleGenerateChronicle = async () => {
    // ...
    const result = await generateMatchChronicleAction(match.id); // Llamada manual
    // ...
}
```

---

## 📌 Conclusión
Pateá utiliza una arquitectura de IA **On-Demand**. La inteligencia no "sucede" sola en el fondo, sino que está al servicio de la acción del usuario, mejorando características específicas (crear equipos, analizar rendimiento, generar contenido) cuando se solicita. Esto es eficiente en costos y predecible en comportamiento.
