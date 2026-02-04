
# 🏆 Análisis del Sistema de Competiciones

**Fecha:** 3 de Febrero 2026
**Módulo:** `src/app/competitions`

---

## 📌 Visión General
El módulo de competiciones permite a los grupos organizar torneos estructurados entre sus equipos. Soporta dos formatos principales: **Ligas** (Todos contra todos) y **Copas** (Eliminación directa).

---

## 📐 Estructura de Datos

### 1. Ligas (`League`)
Torneos de regularidad donde todos juegan contra todos.
-   **Formatos:** Ida (`round_robin`) o Ida y Vuelta (`double_round_robin`).
-   **Configuración:** Frecuencia (Semanal/Quincenal), Día/Hora por defecto para partidos.
-   **Estado:** Se generan todos los partidos (`matches`) en estado `upcoming` al momento de la creación.
-   **Tablas:** Se calcula dinámicamente un array de `LeagueStanding` que se persiste en el documento de la liga.

### 2. Copas (`Cup`)
Torneos de eliminación simple (Kill-match).
-   **Formato:** Bracket (Cuadro) de eliminación directa (`single_elimination`).
-   **Rondas:** 32avos -> 16avos -> 8avos -> Semifinal -> Final.
-   **Seeding (Cabezas de Serie):**
    -   `random`: Sorteo puro.
    -   `ovr_based`: Los mejores equipos (por OVR promedio) se ubican para no cruzarse hasta el final.

---

## 🧠 Lógica de Negocio y Reglas

### Cálculo de Posiciones (Ligas)
Ubicado en `src/lib/utils/league-standings.ts`.
El ordenamiento de la tabla sigue estrictamente este criterio de desempate:
1.  **Puntos:** (3 por victoria, 1 por empate, 0 por derrota).
2.  **Diferencia de Gol (DG):** (Goles a Favor - Goles en Contra).
3.  **Goles a Favor (GF):** Mayor cantidad de goles marcados.
4.  **Nombre:** Orden alfabético (último recurso).

### Definición del Campeón
Al finalizar todos los partidos de una liga:
-   Si el 1° y 2° tienen **diferentes puntos**: El 1° es campeón.
-   Si hay **empate en puntos**: Se revisa el historial entre ellos (**Head-to-Head**).
-   Si el H2H está empatado (mismos puntos y misma diferencia de gol entre ellos): **Se genera automáticamente una FINAL de desempate**.
    -   La función `createTiebreakerMatch` crea un nuevo partido "Final" a 3 días de la fecha actual.

### Avance de Copas
Ubicado en `src/lib/utils/cup-bracket.ts`.
-   **Bracket Estático:** El cuadro completo (`BracketMatch[]`) se genera al inicio.
-   **Avance Automático:** Cuando un partido de copa se cierra, la función `advanceWinner` toma al ganador y lo coloca en el slot correspondiente del siguiente partido (Team 1 o Team 2 según su llave).

---

## ⚙️ Automatización (Server Actions)

El archivo `src/lib/actions/league-completion-actions.ts` es el cerebro operativo.

-   **Trigger:** Se debe invocar cada vez que un partido de tipo `league` cambia a estado `completed` o `evaluated`.
-   **Función `checkAndCompleteLeague(leagueId)`**:
    1.  Verifica si *todos* los partidos de la liga están terminados.
    2.  Si faltan partidos, solo actualiza la tabla parcial.
    3.  Si todos terminaron:
        -   Calcula posiciones finales.
        -   Ejecuta lógica de campeón (detecta si hace falta desempate).
        -   Si hay campeón, cierra la liga (`status: completed`) y guarda los datos históricos.
        -   Si hay empate, crea el partido extra y mantiene la liga `in_progress`.

---

## 🖥️ Experiencia de Usuario (UI)

### Creación (`CreateLeagueDialog`)
Un wizard de 3 pasos:
1.  **Detalles:** Nombre, Logo, Formato (Ida/Vuelta), Público/Privado.
2.  **Agenda:** Fecha de inicio, Frecuencia (para espaciar los partidos creados), Día/Hora preferidos.
3.  **Equipos:** Selección manual de equipos del grupo (mínimo 4).

### Visualización
-   **Ligas:** Muestran Tabla de Posiciones, Fixture (partidos agrupados por fecha/ronda) y Goleadores.
-   **Copas:** Muestran un diagrama de árbol (Bracket) interactivo.

---

## ⚠️ Puntos Críticos / A mejorar
1.  **Race Conditions:** La lógica de actualización de tablas y campeones usa transacciones de Firestore, lo cual es robusto, pero depende de que el cliente llame correctamente a `checkAndCompleteLeague`.
2.  **Tiebreaker Infinito:** Si la final de desempate termina en empate (aunque el código trata de impedirlo), el sistema podría quedar en un estado inconsistente. El código actual lanza error si hay empate en una final.
