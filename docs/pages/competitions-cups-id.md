# Ruta: /competitions/cups/[id]
## Propósito General
Esta ruta (`/competitions/cups/[id]`) está diseñada para mostrar los detalles de una competición de copa específica. Permite a los usuarios ver el bracket de eliminación, los equipos participantes y, si el usuario es el organizador de la copa, realizar acciones administrativas como iniciar la copa (generar el bracket) o eliminarla. También maneja la navegación a partidos individuales y celebra la finalización de la copa con confeti.

## Componentes y Estructura
La página está estructurada para presentar la información de la copa de manera organizada, utilizando componentes de UI y componentes personalizados para la lógica de la competición.

*   **`BackButton`**: Permite al usuario regresar a la lista general de competiciones.
*   **`CupHeader`**: Componente principal de cabecera que muestra el nombre de la copa, su estado, el organizador y las opciones de navegación por pestañas (`bracket`, `teams`). También incluye botones para iniciar o eliminar la copa si el usuario es el propietario.
*   **`ChampionCelebration`**: Se renderiza condicionalmente si la copa ha finalizado (`isCompleted`) y tiene un campeón. Muestra los detalles del campeón y subcampeón.
*   **`Tabs` y `TabsContent`**: Organizan el contenido principal en pestañas.
    *   **Pestaña "Bracket"**:
        *   **`CupBracket`**: Muestra el árbol de eliminación de la copa. Permite interactuar con los partidos (navegar a un partido existente o crear uno nuevo si el usuario es el organizador).
        *   **Placeholder de Bracket**: Si el bracket no ha sido generado, muestra un mensaje indicando al organizador que inicie la copa.
    *   **Pestaña "Equipos"**:
        *   **`Card`**: Contiene la lista de equipos participantes.
        *   **`JerseyPreview`**: Muestra la camiseta de cada equipo.
*   **`AlertDialog` (Responsive)**: Se utiliza para confirmar acciones críticas.
    *   **Diálogo "Iniciar Copa"**: Solicita confirmación antes de generar el bracket y permite seleccionar el tipo de sorteo (`random` o `ovr_based`).
    *   **Diálogo "Eliminar Copa"**: Solicita confirmación antes de eliminar permanentemente la copa.
*   **`Loader2`**: Se muestra durante la carga inicial de los datos de la copa o durante las acciones de inicio/eliminación.
*   **`Alert`**: Se muestra si la copa no se encuentra.
*   **Componentes UI de Shadcn/ui**: `Button`, `Label`, `RadioGroup`, `RadioGroupItem`, `AlertDescription`, `CardContent`, `CardHeader`, `CardTitle`.

## Hooks, Server Actions y Lógica
La página utiliza una combinación de hooks de React, Next.js y Firebase, junto con Server Actions para la interacción con el backend.

### Hooks de Next.js
*   **`useParams<{ id: string }>()`**: Obtiene el `id` de la copa de la URL dinámica.
*   **`useRouter()`**: Permite la navegación programática (e.g., `router.push('/competitions')`).
*   **`useSearchParams()`**: Accede a los parámetros de consulta de la URL, utilizado para el `?celebrate=true` del confeti.

### Hooks de React
*   **`useState`**:
    *   `activeTab`: Controla la pestaña activa (`'bracket'` o `'teams'`).
    *   `showStartDialog`, `showDeleteDialog`: Controlan la visibilidad de los diálogos de confirmación.
    *   `isStarting`, `isDeleting`: Indican si las acciones de iniciar o eliminar copa están en curso, para deshabilitar botones y mostrar loaders.
    *   `seedingType`: Almacena el tipo de sorteo seleccionado para el bracket (`'random'` o `'ovr_based'`).
*   **`useEffect`**:
    *   **Confeti**: Se ejecuta una vez al cargar la página si el parámetro `celebrate=true` está presente en la URL. Dispara la animación de confeti y luego elimina el parámetro de la URL para evitar repeticiones.
*   **`useMemo`**:
    *   `cupRef`: Memoiza la referencia del documento de la copa en Firestore para evitar recreaciones innecesarias.
    *   `teamsQuery`: Memoiza la consulta para obtener los equipos participantes de la copa. Limita a los primeros 10 equipos para la consulta `where('__name__', 'in', ...)`.
    *   `organizerRef`: Memoiza la referencia del documento del usuario organizador de la copa.

### Hooks de Firebase (custom hooks de `@/firebase`)
*   **`useFirestore()`**: Obtiene la instancia de Firestore.
*   **`useUser()`**: Obtiene la información del usuario autenticado, utilizada para determinar si el usuario actual es el propietario de la copa (`isOwner`).
*   **`useDoc<Cup>(cupRef)`**: Escucha en tiempo real los cambios en el documento de la copa especificada por `cupRef`. Devuelve `data` (la copa) y `loading`.
*   **`useCollection<GroupTeam>(teamsQuery)`**: Escucha en tiempo real los cambios en la colección de equipos que participan en la copa. Devuelve `data` (los equipos).
*   **`useDoc<any>(organizerRef)`**: Escucha en tiempo real los cambios en el documento del usuario organizador.

### Hooks personalizados
*   **`useToast()`**: Proporciona una función `toast` para mostrar notificaciones al usuario sobre el éxito o fracaso de las operaciones.

### Lógica y Manejo de Datos
*   **Carga Inicial**: Muestra un `Loader2` mientras se carga la información de la copa (`cupLoading`). Si la copa no se encuentra (`!cup`), muestra un mensaje de error.
*   **`isOwner`**: Determina si el usuario actual es el propietario de la copa (`user?.uid === cup?.ownerUid`), controlando la visibilidad de las acciones administrativas.
*   **`isCompleted`**: Determina si la copa ha finalizado (`cup?.status === 'completed'`), para mostrar la celebración del campeón.
*   **`handleStartCup`**:
    *   Se activa al confirmar el diálogo de inicio.
    *   Llama a la Server Action `startCupAction` con el ID de la copa y el tipo de sorteo (`seedingType`).
    *   Muestra un `toast` de éxito o error.
    *   Actualiza el estado `isStarting` para controlar el UI.
*   **`handleDeleteCup`**:
    *   Se activa al confirmar el diálogo de eliminación.
    *   Llama a la Server Action `deleteCupAction` con el ID de la copa.
    *   Muestra un `toast` de éxito o error y redirige a `/competitions` si tiene éxito.
    *   Actualiza el estado `isDeleting` para controlar el UI.
*   **`handleMatchClick`**:
    *   Gestiona la interacción con los partidos en el bracket.
    *   Si un partido ya tiene un ganador (`match.winnerId`), o si ya tiene un `matchId` asociado, navega directamente a la página de ese partido (`/matches/[matchId]`).
    *   Si el partido tiene dos equipos pero no un `matchId` (es decir, está listo para jugarse pero no se ha creado el encuentro):
        *   Si el usuario es el `isOwner`, llama a la Server Action `createCupMatchAction` para crear el partido. Muestra un `toast` de carga y luego redirige al partido recién creado.
        *   Si el usuario no es el `isOwner`, muestra un `toast` indicando que el organizador debe iniciar el partido.
*   **Manejo de Errores**: Utiliza la función `isErrorResponse` para verificar si el resultado de una Server Action es un error y muestra mensajes de error descriptivos usando `useToast`.