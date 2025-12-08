
# Lógica del Sistema de Evaluación y Progresión de Jugadores

Este documento detalla el funcionamiento interno del sistema que permite que las estadísticas y el OVR (Overall Rating) de los jugadores evolucionen basándose en su rendimiento en los partidos evaluados. La lógica principal se encuentra en el archivo `src/app/matches/[id]/evaluate/page.tsx`.

---

## 1. Resumen del Sistema

El objetivo del sistema es crear una progresión realista y gratificante para los jugadores. Después de cada partido evaluado, las estadísticas de un jugador (como su OVR, PAC, SHO, etc.) cambian según la calificación (de 1 a 10) que el organizador del partido le haya asignado.

El sistema está diseñado para:
-   **Recompensar el buen rendimiento**: Calificaciones altas resultan en mejoras de estadísticas.
-   **Penalizar el mal rendimiento**: Calificaciones bajas provocan una ligera disminución.
-   **Evitar la inflación de OVR**: La progresión se vuelve más lenta a medida que un jugador se acerca a su potencial máximo, haciendo que sea más difícil mejorar.
-   **Ser específico por posición**: Las mejoras de atributos se centran en las habilidades clave para la posición del jugador.

---

## 2. Constantes de Progresión (`OVR_PROGRESSION`)

Estas constantes son el núcleo del sistema y controlan cómo cambian las estadísticas.

```javascript
const OVR_PROGRESSION = {
    BASELINE_RATING: 5,   // Calificación neutral. Un 5/10 no produce casi ningún cambio.
    SCALE: 0.6,           // Multiplicador principal. Controla la intensidad del cambio.
    MAX_STEP: 2,          // El OVR no puede cambiar más de 2 puntos en un solo partido.
    DECAY_START: 70,      // A partir de 70 de OVR, la progresión empieza a ser más lenta.
    SOFT_CAP: 95,         // A partir de 95, la progresión se reduce drásticamente.
    HARD_CAP: 99,         // El OVR máximo absoluto que un jugador puede alcanzar.
    MIN_OVR: 40,          // El OVR mínimo absoluto.
    MIN_ATTRIBUTE: 20,    // El valor mínimo para cualquier atributo específico (PAC, SHO, etc.).
    MAX_ATTRIBUTE: 90     // El valor máximo para cualquier atributo específico.
};
```

---

## 3. Cálculo del Cambio de OVR (`calculateOvrChange`)

Esta función determina cuántos puntos subirá o bajará el OVR de un jugador.

1.  **Delta de Calificación**: Se calcula la diferencia entre la calificación recibida y la `BASELINE_RATING` (5). Por ejemplo, un 8/10 da un delta de +3.
2.  **Delta Bruto**: Este delta se multiplica por el `SCALE` (0.6). Siguiendo el ejemplo: `3 * 0.6 = 1.8`.
3.  **Decaimiento (Decay)**:
    -   Si el OVR actual del jugador está entre 70 (`DECAY_START`) y 95 (`SOFT_CAP`), el delta bruto se reduce progresivamente. Cuanto más cerca de 95, mayor es la reducción.
    -   Si el OVR es 95 o más, la reducción es aún más drástica.
4.  **Delta Final**: El resultado se redondea y se limita por `MAX_STEP` (entre -2 y +2) para evitar cambios demasiado bruscos.
5.  **Nuevo OVR**: El OVR final se calcula sumando el delta final al OVR actual, siempre manteniéndose dentro de los límites `MIN_OVR` y `HARD_CAP`.

---

## 4. Cálculo del Cambio de Atributos (`calculateAttributeChanges`)

Esta función determina qué atributos específicos mejoran según la posición del jugador.

1.  **Intensidad**: Se calcula un valor de "intensidad" basado en la calificación del jugador. Una calificación alta genera una intensidad positiva, y una baja, negativa.
2.  **Distribución por Posición**:
    -   **DEL (Delantero)**: Recibe una mejora principal en **Tiro (SHO)**, y mejoras secundarias en **Ritmo (PAC)** y **Regate (DRI)**.
    -   **MED (Centrocampista)**: Mejora principal en **Pase (PAS)**, y secundarias en **Regate (DRI)** y **Tiro (SHO)**.
    -   **DEF (Defensa)**: Mejora principal en **Defensa (DEF)**, y secundarias en **Físico (PHY)** y **Pase (PAS)**.
    -   **POR (Portero)**: Actualmente, su progresión es similar a la de un defensa, centrada en **DEF** y **PHY**.
3.  **Nuevos Atributos**: Los cambios calculados se suman a los atributos actuales del jugador, respetando siempre los límites `MIN_ATTRIBUTE` y `MAX_ATTRIBUTE`.

---

## 5. Flujo de la Transacción en Firestore (`onSubmit`)

Para garantizar la integridad de los datos, todas las actualizaciones se realizan dentro de una **transacción de Firestore**. Esto significa que todas las operaciones se completan con éxito o ninguna lo hace.

1.  **Validación**: El sistema comprueba primero si el partido ya ha sido evaluado para evitar duplicados.
2.  **Obtención de Datos**: Dentro de la transacción, se obtienen los documentos de todos los jugadores que participaron en el partido.
3.  **Cálculo y Actualización en Bucle**:
    -   Para cada jugador, se calculan los nuevos atributos y el nuevo OVR utilizando las funciones descritas anteriormente.
    -   Se actualizan también sus estadísticas generales (partidos jugados, goles, rating promedio).
    -   Se prepara la actualización del documento del jugador con todos estos nuevos datos.
4.  **Creación del Documento de Evaluación**:
    -   Para cada jugador, se crea un nuevo documento en la subcolección `/matches/{matchId}/evaluations/{playerId}`.
    -   Este documento almacena los detalles de esa evaluación específica (goles, rating, etiquetas, quién evaluó y cuándo).
5.  **Actualización del Partido**: El estado del partido se cambia a `evaluated`.
6.  **Commit**: La transacción se ejecuta. Si todo tiene éxito, todos los cambios se guardan en la base de datos simultáneamente. Si algo falla, todos los cambios se revierten.
