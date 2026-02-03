# 🛠️ REGISTRO DE CORRECCIONES: MÓDULO DE EVALUACIONES

**Fecha**: 23 de Octubre 2025
**Autor**: La IA que está tratando de arreglar sus cagadas.

Este documento es un acto de humildad y un registro de las correcciones aplicadas al sistema de evaluaciones, basándome en el excelente análisis del `INFORME_EVALUACIONES.md`.

---

## 🐞 Error #1: Carga Infinita en Evaluación por Puntos (CRÍTICO)

### Problema
- El usuario seleccionaba "Evaluar por Puntos".
- Si no movía el `Slider`, el valor del `rating` quedaba como `undefined`.
- El formulario se podía enviar así, pero la lógica de validación fallaba silenciosamente, y el botón se quedaba en un estado de "Enviando..." para siempre, bloqueando al usuario.

### Solución Aplicada
1.  **Validación Robusta con `zod`**:
    -   **Archivo modificado**: `src/components/perform-evaluation-view.tsx`.
    -   **Cambio**: Implementé un `discriminatedUnion` en el schema de Zod. Ahora, si `evaluationType` es `'points'`, el campo `rating` es **obligatorio**. Si es `'tags'`, `performanceTags` es obligatorio. Esto hace que la validación sea estricta y correcta desde la base.

2.  **Componente `Slider` Controlado**:
    -   **Archivo modificado**: `src/components/perform-evaluation-view.tsx`.
    -   **Cambio**: Cambié el `Slider` para que use la prop `value` en lugar de `defaultValue`. Esto lo convierte en un componente controlado, asegurando que su estado siempre refleje el del formulario de React Hook Form, con `5` como valor inicial explícito.

### Resultado
El bug de carga infinita ha sido **eliminado**. El formulario ahora no se puede enviar sin un rating válido, y el valor por defecto se maneja correctamente.

---

## 🐞 Error #2: Evaluaciones por Etiquetas no se Procesaban (CRÍTICO)

### Problema
- La lógica en el panel del organizador (`matches/[id]/evaluate/page.tsx`) era excluyente: o procesaba las evaluaciones por puntos o las de por etiquetas, pero no ambas.
- Si un jugador recibía una mezcla de ambos tipos de evaluación, los efectos de las etiquetas se ignoraban por completo, rompiendo la lógica de progresión de atributos.

### Solución Aplicada
1.  **Lógica de Procesamiento Independiente**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: Reescribí por completo la sección dentro de `handleFinalizeEvaluation`. Eliminé el `if/else` defectuoso y lo reemplacé por dos bloques de código separados:
        1.  Un bloque que **siempre** procesa las `tagBasedEvals` (si existen) y calcula los cambios en los atributos (`pac`, `sho`, etc.).
        2.  Un bloque que **siempre** procesa las `pointBasedEvals` (si existen) y calcula el cambio en el `OVR` general.
    -   Ambos resultados ahora se combinan para actualizar el perfil del jugador de forma correcta y acumulativa.

### Resultado
El sistema ahora procesa **todos los tipos de evaluación** correctamente. Los jugadores evolucionarán tanto en sus atributos específicos (gracias a las etiquetas) como en su OVR general (gracias a los puntos), haciendo el sistema de progresión justo y funcional.

---

## 🐞 Errores #3 y #5: Race Conditions y Falta de Atomicidad (ALTO)

### Problema
- **Concurrencia (Race Condition)**: Si dos organizadores abrían la página de supervisión al mismo tiempo, ambos podían leer los mismos "envíos de evaluación" (`evaluationSubmissions`) y procesarlos, creando `evaluations` duplicadas en la base de datos.
- **Falta de Atomicidad**: La función `processPendingSubmissions` usaba un `writeBatch`, que es atómico en sí mismo, pero no impedía que otra operación (como la finalización del partido) se ejecutara al mismo tiempo, llevando a inconsistencias de datos (ej: calcular OVRs sin incluir las últimas evaluaciones procesadas).

### Solución Aplicada
1.  **Implementación de Transacción Atómica**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: La función `processPendingSubmissions` fue refactorizada para usar `runTransaction` en lugar de `writeBatch`. Esto asegura que toda la operación (leer los envíos, crear las evaluaciones, actualizar el estado de las asignaciones y borrar los envíos) ocurra como una unidad indivisible. Firestore maneja automáticamente los conflictos de concurrencia: si dos transacciones intentan modificar los mismos datos, una fallará y se reintentará, garantizando que los datos nunca se dupliquen.
    -   **Verificación Adicional**: En la función `handleFinalizeEvaluation`, se añadió una comprobación dentro de la transacción para asegurar que no queden `evaluationSubmissions` pendientes antes de calcular los OVRs finales. Si las hay, la finalización se detiene con un error claro para el usuario.

### Resultado
El sistema ahora es **resistente a condiciones de carrera**. Múltiples usuarios pueden interactuar con la página de evaluación sin riesgo de duplicar datos o generar inconsistencias. La integridad de los datos de evaluación está garantizada.

---

## 🐞 Errores #4 y #7: Validación Inconsistente y Borrado Inseguro (MEDIO)

### Problema
- **Error #4**: En `perform-evaluation-view.tsx`, la validación de Zod era inconsistente, permitiendo que un formulario de 'tags' se envíe sin etiquetas.
- **Error #7**: En `matches/[id]/evaluate/page.tsx`, los documentos `evaluationSubmissions` se borraban directamente (`hard-delete`). Si la operación fallaba por cualquier motivo, los datos de esa evaluación se perdían para siempre.

### Solución Aplicada
1.  **Validación Estricta con `discriminatedUnion` (Error #4)**:
    -   **Archivo modificado**: `src/components/perform-evaluation-view.tsx`.
    -   **Cambio**: Se refactorizó el schema de Zod para usar `discriminatedUnion`, como sugiere el informe. Ahora, el schema fuerza a que si el `evaluationType` es `'points'`, el `rating` sea un número válido, y si es `'tags'`, `performanceTags` sea un array con al menos 3 elementos. No hay lugar para la ambigüedad.

2.  **Implementación de "Soft Delete" (Error #7)**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: Se eliminó la operación `transaction.delete()`. En su lugar, cuando una `evaluationSubmission` se procesa, ahora se mueve a una nueva subcolección (`matches/{matchId}/processedSubmissions`). Esto nos da un respaldo de todos los datos procesados, haciendo la operación mucho más segura y auditable. Si algo falla, el dato original no se pierde.

### Resultado
El formulario de evaluación es más robusto y la lógica de procesamiento de datos es mucho más segura y resiliente a fallos. Se ha reducido drásticamente el riesgo de pérdida de datos.

---

## 🐞 Errores #6 y #8: Claridad del Código y Balance de Juego (BAJO)

### Problema
- **Error #6**: El cálculo del `averageRating` de un jugador era funcionalmente correcto pero conceptualmente confuso, ya que no estaba claro si era un promedio por partido o por evaluación individual.
- **Error #8**: Una de las etiquetas de rendimiento negativo ("Espectador de Lujo") era desproporcionadamente más severa que las etiquetas positivas, afectando negativamente la percepción de justicia del sistema.

### Solución Aplicada
1.  **Documentación del Cálculo (Error #6)**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: Se añadieron comentarios explicativos directamente sobre la línea de código que calcula el `newAvgRating`, clarificando que el sistema usa un **promedio de rendimiento por partido**, lo cual es más justo si el número de evaluadores varía entre partidos.

2.  **Rebalanceo de Etiqueta Negativa (Error #8)**:
    -   **Archivo modificado**: `src/lib/performance-tags.ts`.
    -   **Cambio**: Se ajustaron los efectos del tag "Espectador de Lujo". En lugar de restar `-1` a los 6 atributos (un impacto total de -6), ahora resta `-1` a `PAC` y `-2` a `PHY`, sumando un impacto total de **-3**. Esto la pone a la par con las etiquetas positivas más fuertes, manteniendo su carácter punitivo pero de una forma mucho más balanceada y justa.

### Resultado
El código es ahora más fácil de entender para futuros mantenimientos y el sistema de progresión de atributos es más justo y balanceado, mejorando la experiencia del usuario. Con esto, **todos los puntos del informe de evaluación han sido solucionados y mejorados con feedback adicional.**

---

## 🐞 Error #9: Pérdida de Puntos y Falta de Respaldo por Inactividad (MEDIO)

### Problema
- **Redondeo Agresivo**: El cálculo de OVR usaba `Math.round` prematuramente en el delta general y luego dividía por 6. Esto hacía que pequeñas ganancias (ej. un promedio que daba +0.33) se convirtieran en 0 al redondearse, causando que jugadores con buenas actuaciones no subieran nada ("El misterio de Cosme").
- **Distribución Uniforme Injusta**: Al subir de OVR, los puntos se repartían igualitariamente a todos los atributos. Un delantero recibía tanto aumento en DEFENSA como en TIRO, lo cual diluía su especialización.
- **Falta de Respaldo ("Paja")**: Si los compañeros no votaban en un partido, el jugador se quedaba con su promedio histórico, ignorando su actuación real en ese match (ej: meter 3 goles y no recibir puntos).

### Solución Aplicada
1.  **Precisión Decimal y Redondeo al Techo**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: `calculateOvrChange` ahora retorna el valor decimal exacto (float) en lugar de un entero redondeado.
    -   En la distribución de atributos, se usa `Math.ceil` (techo) para los cambios positivos. Esto garantiza que cualquier ganancia de OVR, por pequeña que sea, siempre se traduzca en al menos 1 punto de atributo.

2.  **Distribución Ponderada por Posición**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: Se implementó una tabla de pesos (`POSITION_WEIGHTS`). Ahora, el total de puntos de atributo ganados (OVR Change * 6) se distribuye según el rol:
        -   **DEL**: Prioriza SHO (35%) y PAC (25%).
        -   **MED**: Prioriza PAS (30%) y DRI (20%).
        -   **DEF**: Prioriza DEF (40%) y PHY (20%).
        -   **POR**: Prioriza DEF (50%).

3.  **Lógica de Respaldo (Fallback)**:
    -   **Archivo modificado**: `src/app/matches/[id]/evaluate/page.tsx`.
    -   **Cambio**: Si un jugador no recibe evaluaciones ("Paja"), el sistema ahora infiere un rating basado en sus estadísticas del partido:
        -   2+ Goles o Asistencias: **Rating 8**.
        -   1 Gol o Asistencia: **Rating 7**.
        -   Sin aporte estadístico: **Rating 5** (Neutro).

### Resultado
El sistema ahora "no pierde puntos" en el camino. Los jugadores progresan de forma constante y especializada según su posición. Además, nadie se queda sin puntos por la inactividad de sus compañeros si tuvo un desempeño destacable en cancha.

---
**Estado Final**: ¡Módulo de Evaluaciones 100% Corregido y Fortalecido!
