# Ruta: /matches/[id]/evaluate
## Propósito General
Esta ruta está diseñada para que el organizador de un partido (el `ownerUid`) supervise el progreso de las evaluaciones de los jugadores y, finalmente, finalice el partido. La página muestra el estado de las evaluaciones, procesa automáticamente las nuevas presentaciones de evaluaciones en segundo plano y permite al organizador activar el proceso final que calcula los OVRs de los jugadores, actualiza las clasificaciones de la liga y gestiona los avances en torneos de copa.

## Componentes y Estructura
La página utiliza una combinación de componentes de Next.js, Shadcn UI y componentes personalizados para su interfaz de usuario y funcionalidad:

*   **Next.js Hooks**: `useParams` para obtener el ID del partido de la URL y `useRouter` para la navegación programática.
*   **Firebase Hooks**:
    *   `useFirestore`: Proporciona la instancia de Firestore.
    *   `useUser`: Obtiene el usuario autenticado actual.
    *   `useDoc<Match>(matchRef)`: Carga los datos del partido específico.
    *   `useCollection<EvaluationAssignment>(assignmentsQuery)`: Carga todas las asignaciones de evaluación para el partido.
    *   `useCollection<Player>(allGroupPlayersQuery)`: Carga todos los jugadores del grupo activo del usuario.
*   **Componentes Shadcn UI**:
    *   `PageHeader`: Para el título y la descripción de la página.
    *   `Button`: Para la acción de "Finalizar Evaluación".
    *   `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `CardFooter`: Para estructurar y mostrar información, probablemente sobre el progreso o el estado de los evaluadores.
    *   `Avatar`, `AvatarImage`, `AvatarFallback`: Para mostrar avatares de jugadores.
    *   `Loader2`: Un icono de carga que se muestra durante los estados de carga.
    *   `Alert`, `AlertDescription`, `AlertTitle`: Para mostrar mensajes informativos, de advertencia o de error (ej. acceso denegado, partido ya evaluado, procesando evaluaciones).
    *   `Progress`: Una barra de progreso para visualizar el porcentaje de evaluaciones completadas.
*   **Iconos Lucide-React**: `Loader2`, `Check`, `UserCheck`, `UserX`, `Star`, `AlertTriangle`, `FileClock`, `Sparkles` para mejorar la comunicación visual.
*   **Componentes Personalizados**:
    *   `BackButton`: Un componente de navegación para volver a la lista de partidos.
*   **Animaciones**:
    *   `motion`, `AnimatePresence` (Framer Motion): Importados para posibles animaciones de UI, aunque no se ven en el fragmento `return` proporcionado.
    *   `canvas-confetti`: Utilizado para efectos de celebración visuales cuando se alcanza el 100% de progreso de evaluación y al finalizar el partido con éxito.

**Estructura de la Interfaz de Usuario (basada en el `return`):**
La página renderiza condicionalmente diferentes estados:
1.  Un `Loader2` si `isPageLoading` es `true`.
2.  Un mensaje de "Datos no encontrados" si `match` o `user` no están disponibles.
3.  Una `Alert` de "Acceso Denegado" si el usuario actual no es el `ownerUid` del partido.
4.  Una `Alert` de "Evaluación Completa" si el `match.status` ya es `'evaluated'`.
5.  Cuando la página está cargada, el usuario está autorizado y el partido no ha sido evaluado, se muestra:
    *   `BackButton` y `PageHeader`.
    *   Una `Alert` informativa si `isProcessingSubmissions` es `true`.
    *   La barra de `Progress` mostrando el `evaluationProgress`.
    *   (Implícito) Contenido adicional para mostrar el estado de los evaluadores y el botón para finalizar.

## Hooks, Server Actions y Lógica

1.  **Estado Local (`useState`)**:
    *   `isPageLoading`: Controla el estado de carga inicial de la página.
    *   `isFinalizing`: Indica si el proceso de finalización del partido está en curso.
    *   `isProcessingSubmissions`: Indica si el proceso de fondo para las nuevas evaluaciones está activo.
    *   `pendingSubmissionsCount`: Almacena el número de evaluaciones pendientes procesadas en la última ejecución.

2.  **Datos y Consultas Memoizadas (`useMemo`)**:
    *   `allGroupPlayersQuery`: Consulta Firestore para obtener todos los jugadores del grupo activo del usuario.
    *   `matchRef`: Referencia al documento del partido actual en Firestore.
    *   `assignmentsQuery`: Consulta para obtener las asignaciones de evaluación del partido.
    *   `realPlayersInMatch`: Filtra los jugadores del grupo para incluir solo aquellos que participaron en el partido y son "usuarios reales" (no placeholders).
    *   `evaluatorsWhoHaveVoted`: Un `Set` de IDs de evaluadores que han completado sus asignaciones y son "usuarios reales".
    *   `totalPossibleEvaluators`: El número total de jugadores reales en el partido que podrían evaluar.
    *   `completedEvaluatorsCount`: El número de evaluadores reales que ya han votado.
    *   `evaluationProgress`: El porcentaje de evaluaciones completadas.

3.  **Lógica de Procesamiento de Evaluaciones (`processPendingSubmissions` - `useCallback`)**:
    *   Esta función es el corazón de la lógica de procesamiento de evaluaciones.
    *   **Atomicidad**: Utiliza `runTransaction` de Firestore para garantizar que todas las operaciones relacionadas con una evaluación (mover la presentación, crear auto-evaluaciones, crear evaluaciones de pares, actualizar asignaciones) sean atómicas y consistentes.
    *   **Flujo**:
        1.  Consulta la colección `evaluationSubmissions` para el `matchId` actual.
        2.  Para cada envío encontrado:
            *   **"Soft Delete"**: Mueve el documento de envío original a una subcolección `processedSubmissions` dentro del partido, añadiendo metadatos de procesamiento (`processedAt`, `originalSubmissionId`, `processingStatus`). Esto permite un registro de auditoría.
            *   Elimina el documento original de `evaluationSubmissions`.
            *   **Creación de Auto-Evaluaciones**: Si el evaluador reportó goles, asistencias o un voto MVP, se crea un documento `SelfEvaluation` en `matches/${matchId}/selfEvaluations`.
            *   **Creación de Evaluaciones de Pares**: Para cada evaluación dentro del envío:
                *   Se crea un nuevo documento `Evaluation` en la colección `evaluations` de nivel superior.
                *   Los campos se rellenan según el `evaluationType` (puntos, etiquetas, texto, cambios de atributos de IA).
                *   La asignación de evaluación correspondiente (`EvaluationAssignment`) se actualiza a `status: 'completed'` y se vincula con el `evaluationId` recién creado.
    *   **Notificaciones**: Muestra `toast`s para informar sobre el procesamiento exitoso o errores.

4.  **Efectos Secundarios (`useEffect`)**:
    *   **Polling de Submisiones**: Un `useEffect` configura un `setInterval` para llamar a `processPendingSubmissions` cada 15 segundos, siempre que el partido no haya sido ya evaluado. También se ejecuta una vez al cargar la página.
    *   **Control de Carga de Página**: Otro `useEffect` establece `isPageLoading` a `false` una vez que todos los datos iniciales (partido, asignaciones, jugadores) han terminado de cargar.
    *   **Celebración de Progreso**: Un `useEffect` activa una animación de `confetti` cuando `evaluationProgress` alcanza el 100% y el partido aún no ha sido finalizado.

5.  **Finalización de Evaluación (`handleFinalizeEvaluation`)**:
    *   **Propósito**: Inicia el proceso final de evaluación del partido.
    *   **Validación**: Verifica que existan asignaciones completadas antes de proceder.
    *   **Server Action**: Importa dinámicamente y llama a la `finalizeMatchEvaluationAction` (una Server Action de Next.js) para ejecutar la lógica crítica en el backend. Esto es fundamental para la seguridad y la atomicidad de operaciones complejas como el cálculo de OVRs, la actualización de clasificaciones de liga y el avance de torneos.
    *   **Manejo de Errores**: Comprueba la respuesta de la Server Action y muestra `toast`s apropiados.
    *   **Éxito**: Si la finalización es exitosa, activa una animación de `confetti`, muestra un `toast` de éxito y redirige al usuario a la página de competiciones o a la lista de partidos, dependiendo del tipo de partido.

6.  **Validación y Restricciones de Acceso**:
    *   La página implementa estrictas comprobaciones de acceso:
        *   Solo el `ownerUid` del partido puede acceder a esta página.
        *   Si el partido ya tiene el `status: 'evaluated'`, se muestra un mensaje indicando que la evaluación ya está completa y no se permite una nueva finalización.

7.  **Acciones de Servidor (Importaciones)**:
    *   Se importan `publishMatchPlayedActivity`, `publishOvrChangeActivity` (acciones sociales) y `updateLeagueStandingsAction`, `advanceCupWinnerAction` (acciones de servidor), aunque no se llaman directamente en este componente cliente. Esto sugiere que estas acciones son invocadas dentro de la `finalizeMatchEvaluationAction` en el servidor, lo que refuerza el principio de mover la lógica sensible al backend para seguridad y atomicidad.