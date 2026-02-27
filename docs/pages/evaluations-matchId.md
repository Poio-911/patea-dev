# Ruta: /evaluations/[matchId]
## Propósito General
Esta ruta permite a un usuario (evaluador) realizar y enviar evaluaciones detalladas para los jugadores asignados en un partido específico (`matchId`). El proceso de evaluación incluye la asignación de puntuaciones, la selección de etiquetas de rendimiento, la redacción de descripciones de texto (con análisis de IA opcional), y el registro de estadísticas personales del evaluador (goles, asistencias) y un voto para el MVP. El objetivo es recopilar datos estructurados y cualitativos sobre el rendimiento de los jugadores en un partido.

## Componentes y Estructura
El componente es un cliente de React (Next.js) que utiliza una amplia gama de componentes de UI y utilidades para construir una interfaz de usuario interactiva y rica.

*   **Layout Principal**: La página probablemente utiliza un `PageHeader` para el título y navegación, y un `BackButton` para regresar.
*   **Formulario Principal**: Se construye con `react-hook-form` y `zod` para la validación, utilizando los componentes `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` de Shadcn UI.
*   **Evaluación de Jugadores**:
    *   Cada jugador a evaluar se presenta dentro de un `Card` con `CardHeader`, `CardTitle`, `CardDescription` y `CardContent`.
    *   `PlayerCarousel` sugiere una navegación entre los jugadores asignados.
    *   Para cada jugador, se utilizan `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) para alternar entre diferentes tipos de evaluación:
        *   **Evaluación por Puntos**: Utiliza un `Slider` para seleccionar una puntuación (1-10).
        *   **Evaluación por Etiquetas**: Utiliza `TagSelector` y `TagCheckbox` (un componente personalizado) para seleccionar `PerformanceTag`s.
        *   **Evaluación por Texto**: Utiliza un `Textarea` para la descripción y un botón para activar el análisis de IA. `AiScanOverlay` podría proporcionar retroalimentación visual durante el análisis.
    *   `Avatar` se usa para mostrar la imagen del jugador.
*   **Estadísticas del Evaluador**: `CounterDial` se utiliza para registrar goles y asistencias del evaluador.
*   **Crónica Personal y MVP**: `Textarea` para la crónica y `Select` para el voto de MVP.
*   **Botones de Acción**: `Button` para enviar el formulario, con iconos de `Save` y `Loader2` para indicar el estado de carga.
*   **Feedback al Usuario**: `useToast` para notificaciones, `Alert` para mensajes importantes (como la advertencia de envío pendiente).
*   **Animaciones**: `motion` y `AnimatePresence` de Framer Motion para transiciones y animaciones.
*   **Iconos**: Una variedad de iconos de `lucide-react` (`ShieldCheck`, `Goal`, `Plus`, `Minus`, `FileClock`, `Check`, `Award`, `MessageSquare`, `Sparkles`) para mejorar la interfaz visual.
*   **Diálogos**: `ResponsiveDialog` para modales o confirmaciones.

## Hooks, Server Actions y Lógica

### Hooks de React y Next.js
*   **`useParams`**: Obtiene `matchId` de la URL.
*   **`useRouter`**: Para la navegación programática (ej. redirigir después de enviar).
*   **`useState`**:
    *   `isSubmitting`: Booleano que indica si el formulario está en proceso de envío.
    *   `isPageLoading`: Booleano que indica si la página está cargando datos iniciales.
    *   `submissionIsPending`: Booleano que verifica si ya existe una evaluación para este partido y evaluador.
    *   `randomTags`: Objeto que almacena etiquetas de rendimiento aleatorias preseleccionadas por jugador y posición.
    *   `analyzingText`: Objeto que rastrea qué jugador está siendo analizado por la IA en tiempo real.
    *   `aiResults`: Objeto que guarda los resultados del análisis de IA para las evaluaciones de texto.
*   **`useEffect`**:
    *   **Carga y Preparación Inicial del Formulario**: Se ejecuta cuando `assignments` y `allGroupPlayers` están disponibles. Itera sobre las asignaciones del usuario para el partido, encuentra los datos de los jugadores correspondientes y `replace` el array `evaluations` del formulario con los valores iniciales. También genera `randomTags` para cada jugador.
    *   **Verificación de Envío Pendiente**: Consulta la colección `evaluationSubmissions` en Firebase para determinar si el usuario ya ha enviado una evaluación para este `matchId`. Si encuentra una, `submissionIsPending` se establece en `true` para evitar envíos duplicados.
*   **`useMemo`**:
    *   `matchRef`: Memoiza la referencia al documento del partido en Firestore.
    *   `allGroupPlayersQuery`: Memoiza la consulta para obtener todos los jugadores del grupo activo del usuario.
    *   `userAssignmentsQuery`: Memoiza la consulta para obtener las asignaciones de evaluación pendientes del usuario para el partido actual.
*   **`useCallback`**:
    *   `getRandomTagsForPosition`: Memoiza una función que selecciona aleatoriamente etiquetas de rendimiento (positivas y negativas) relevantes para una posición de jugador específica.

### Hooks y Utilidades Personalizadas
*   **`useFirestore`**: Proporciona la instancia de Firebase Firestore.
*   **`useUser`**: Proporciona los datos del usuario autenticado (UID, `activeGroupId`).
*   **`useCollection`**: Hook personalizado para escuchar colecciones de Firebase en tiempo real (utilizado para `allGroupPlayers` y `assignments`).
*   **`useDoc`**: Hook personalizado para escuchar un documento de Firebase en tiempo real (utilizado para `currentMatch`).
*   **`useToast`**: Para mostrar notificaciones al usuario.
*   **`useHaptics`**: Para proporcionar retroalimentación háptica.

### Lógica de Formulario y Validación
*   **`useForm`**: Inicializa el formulario con `evaluationSchema` de Zod como `resolver`. Define valores por defecto para `evaluatorGoals`, `evaluatorAssists`, `personalChronicle`, `mvpVote` y un array `evaluations` vacío.
*   **`useFieldArray`**: Gestiona el array dinámico de evaluaciones de jugadores (`evaluations`) dentro del formulario, permitiendo añadir o reemplazar elementos.
*   **`zod` y `zodResolver`**:
    *   Define esquemas de validación rigurosos para cada tipo de evaluación (`pointsEvaluationSchema`, `tagsEvaluationSchema`, `textEvaluationSchema`) y un esquema principal (`evaluationSchema`).
    *   `playerEvaluationSchema` es una unión discriminada (`discriminatedUnion`) basada en `evaluationType`.
    *   **Validaciones Específicas**:
        *   `rating`: Requerido y entre 1 y 10 para evaluaciones de puntos.
        *   `performanceTags`: Requerido y con un mínimo de 3 etiquetas para evaluaciones de etiquetas.
        *   `textDescription`: Requerido y entre 10 y 500 caracteres para evaluaciones de texto.
    *   **`superRefine`**: Lógica de validación personalizada adicional:
        *   Para evaluaciones de tipo 'tags', exige al menos una etiqueta negativa, a menos que `overrideNoNegative` sea `true`.
        *   Para evaluaciones de tipo 'text', exige que el análisis de IA (`aiAnalysisComplete`) se haya completado antes de permitir el envío.

### Server Actions y Lógica de IA
*   **`analyzeEvaluationTextAction`**:
    *   Importada de `@/lib/actions/evaluation-actions`.
    *   Es una Server Action que se invoca desde el cliente para procesar el texto de una evaluación utilizando un modelo de IA.
    *   Recibe `text`, `playerPosition` y `playerName`.
    *   Devuelve `attributeChanges`, `confidence` y `summary` si es exitoso, o un `error`.
*   **`analyzeTextForPlayer` (Función Cliente)**:
    *   Se encarga de la interacción con la Server Action `analyzeEvaluationTextAction`.
    *   Realiza una validación inicial del texto (mínimo 10 caracteres).
    *   Actualiza el estado `analyzingText` para mostrar un indicador de carga.
    *   Llama a la Server Action.
    *   Si tiene éxito, actualiza los campos del formulario (`aiAttributeChanges`, `aiConfidence`, `aiAnalysisComplete`, `aiSummary`) con los resultados de la IA y actualiza el estado `aiResults`.
    *   Muestra `toast`s de éxito o error.
    *   Maneja errores de la llamada a la Server Action.

### Interacción con Firebase (Implícita)
*   Aunque la función `onSubmit` no está completamente provista, la lógica general implicaría:
    *   Al enviar el formulario, se recopilarían los datos validados.
    *   Se utilizaría `addDoc` para guardar la evaluación completa en una colección de Firebase (probablemente `evaluationSubmissions`).
    *   Se actualizaría el estado de las `EvaluationAssignment`s correspondientes a 'completed'.
    *   Manejo de errores y redirección del usuario.

### Funciones Auxiliares
*   `shuffleArray`: Mezcla aleatoriamente los elementos de un array (utilizado para las etiquetas de rendimiento).
*   `getRatingColor`, `getRatingLabel`, `getRatingThumbClasses`: Funciones para determinar el estilo visual y el texto descriptivo de un rating numérico.