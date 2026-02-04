
# 🎨 Análisis de UI/UX - Módulo de Competiciones

**Fecha:** 3 de Febrero 2026
**Objetivo:** Evaluar la interfaz actual de Ligas y Copas y proponer mejoras estéticas y funcionales ("Premium Feel").

---

## 1. 🏆 Visualización de Ligas (`LeagueDetailPage`)

### Estado Actual
-   **Estructura:** Tabs estándar (Posiciones, Fixture, Goleadores).
-   **Tabla de Posiciones (`LeagueStandingsTable`):** Funcional pero visualmente "plana". Solo muestra texto y números.
-   **Fixture:** Lista vertical de partidos.

### 🚀 Mejoras Propuestas
1.  **Tabla de Posiciones "Vibrante":**
    -   [ ] **Incorporar Escudos/Camisetas:** Agregar la `JerseyPreview` (versión `xs` o `sm`) junto al nombre del equipo en la tabla. Esto da identidad visual inmediata.
    -   [ ] **Punteros de Tendencia:** Agregar indicadores visuales de "Racha" (últimos 5 partidos: ✅ ➖ ❌) si el espacio lo permite, o al menos un indicador de cambio de posición (🔼 🔽) respecto a la fecha anterior (requeriría guardar historia de posiciones, por ahora quizás solo racha).
    -   [ ] **Destacado del Líder:** Darle un estilo más "premium" al primer lugar (borde dorado, fondo sutil gradiente).

2.  **Fixture Interactivo:**
    -   [ ] **Scroll Horizontal de Fechas:** En lugar de una lista vertical infinita, un selector de "Ronda" (Fecha 1, Fecha 2...) con navegación horizontal, mostrando solo los partidos de esa fecha activa.
    -   [ ] **Tarjetas de Partido:** Mejorar el `MatchCard` en el fixture para que se vea como un "Ticket" de entrada o un marcador televisivo.

---

## 2. 🥊 Visualización de Copas (`CupDetailPage`)

### Estado Actual
-   **Bracket (`CupBracket.tsx`):** Implementación híbrida SVG/HTML.
    -   Usa curvas Bezier para las conexiones (¡Bien!).
    -   Dimensiones fijas (`w-64`). Puede romper el layout en móviles o pantallas pequeñas.
    -   Estilo "Wireframe": Fondo gris, lineas simples.

### 🚀 Mejoras Propuestas
1.  **Bracket "Torneo Pro":**
    -   [ ] **Fondo Temático:** Usar un fondo sutil (patrón de hexágonos o gradiente oscuro) detrás del bracket para que no parezca flotando en el vacío.
    -   [ ] **Lineas de Conexión Animadas:** Animar el `stroke-dasharray` de las líneas cuando un equipo avanza, dando la sensación de "flujo de energía" hacia la final.
    -   [ ] **Zoom/Pan:** En móviles, el bracket fijo es inusable. Implementar un contenedor con scroll bidireccional (overflow-auto) o una librería de Pan/Zoom simple.
    -   [ ] **Resaltado de Ruta:** Al hacer hover en un equipo, resaltar toda su trayectoria (partidos pasados y futura ruta) en el bracket.

2.  **Cards del Bracket:**
    -   [ ] **Micro-interacciones:** Hover effects que levanten la tarjeta (`scale-105`).
    -   [ ] **Marcador "Live":** Si el partido está en juego, mostrar un indicador "EN VIVO" pulsante en la tarjeta del bracket.

---

## 3. ✨ Experiencia General y "Feel"

1.  **Empty States (Estados Vacíos):**
    -   Actualmente son íconos grises.
    -   **Propuesta:** Usar ilustraciones SVG o componentes visuales más ricos que inviten a la acción ("¡Creá tu primera copa y hacé historia!").

2.  **Celebración de Campeón:**
    -   Actualmente existe `ChampionCelebration`.
    -   **Propuesta:** Asegurar que use efectos de partículas (confeti) y una animación de "Trofeo apareciendo".

3.  **Transiciones:**
    -   Usar `framer-motion` para las transiciones entre Tabs (Posiciones -> Fixture) para que se sienta fluido y nátivo ("App-like").

---

## 📝 Plan de Acción Inmediato

Prioridad por impacto visual/esfuerzo:

1.  **High Impact / Low Effort:** Agregar `JerseyPreview` a la Tabla de Posiciones.
2.  **High Impact / Medium Effort:** Estilizar el Bracket (Fondo, Hover effects, Cards más lindas).
3.  **High Impact / High Effort:** Implementar navegación de fixture por fechas (carrusel) en lugar de lista vertical.
