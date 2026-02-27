# Ruta: /profile
## Propósito General
Esta ruta está diseñada para mostrar el perfil personal del usuario autenticado. Su propósito principal es presentar la información personal del jugador, sus estadísticas y actividad, y ofrecer una interfaz para editar dicha información. Gestiona los estados de carga de autenticación y datos, así como la ausencia de datos del perfil.

## Componentes y Estructura
La página se estructura como un componente de cliente (`'use client'`) y organiza su contenido en un diseño de columna flexible:

*   **Contenedor Principal**: Un `div` raíz con `className="flex flex-col gap-8"` que organiza los elementos verticalmente con un espaciado.
*   **Cabecera y Acciones**: Un `div` interno (`className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"`) que contiene:
    *   **`PageHeader`**: Muestra el título "Mi Perfil" y una descripción ("Tu información personal, estadísticas de jugador y actividad.").
    *   **`EditProfileDialog`**: Un componente de diálogo que permite al usuario editar su perfil. Recibe el objeto `user` de Firebase Authentication y los datos del jugador (`playerData`) obtenidos de Firestore.
*   **Vista del Perfil del Jugador**:
    *   **`PlayerProfileView`**: El componente principal que renderiza los detalles del perfil del jugador, incluyendo estadísticas y rendimiento. Se le pasan el `playerId` (que es el `uid` del usuario) y el objeto `player` con los datos del perfil.
*   **Indicador de Carga**:
    *   **`SoccerPlayerIcon`**: Se muestra con una animación de ciclo de color (`color-cycle-animation`) cuando los datos del usuario o del jugador están cargando.

## Hooks, Server Actions y Lógica
Este componente es un componente de cliente y utiliza varios hooks de React y personalizados para gestionar el estado y la interacción con Firebase:

*   **`'use client'`**: Declara el componente como un componente de cliente, lo que permite el uso de hooks de React y la interactividad del lado del cliente.
*   **`useUser()` (de `@/firebase`)**:
    *   Hook personalizado que gestiona el estado de autenticación de Firebase.
    *   Devuelve el objeto `user` (si está autenticado) y un booleano `loading` (`userLoading`) que indica si la autenticación está en curso.
*   **`useFirestore()` (de `@/firebase`)**:
    *   Hook personalizado que proporciona una instancia del cliente de Firebase Firestore.
*   **`useMemo()` (de `react`)**:
    *   Se utiliza para memoizar la referencia del documento de Firestore (`playerRef`).
    *   La referencia se construye usando `doc(firestore, 'players', user.uid)`, apuntando a la colección `players` y al documento cuyo ID coincide con el `uid` del usuario autenticado.
    *   La referencia solo se recalcula si `firestore` o `user?.uid` cambian.
*   **`useDoc<Player>(playerRef)` (de `@/firebase`)**:
    *   Hook personalizado que se suscribe a un documento específico de Firestore (`playerRef`).
    *   Devuelve los datos del documento (`data` como `player` de tipo `Player`) y un booleano `loading` (`playerLoading`) que indica si la recuperación de datos está en curso.
*   **`doc()` (de `firebase/firestore`)**: Función de la SDK de Firebase utilizada para crear una referencia a un documento específico en Firestore.
*   **Lógica de Carga**:
    *   Una variable `loading` se calcula como `userLoading || playerLoading`.
    *   Si `loading` es `true`, se renderiza el `SoccerPlayerIcon` como un indicador visual de carga.
*   **Lógica de Ausencia de Datos**:
    *   Después de que la carga ha finalizado (`!loading`), si `!user` (no hay usuario autenticado) o `!player` (no se encontraron datos del jugador en Firestore), se muestra un mensaje indicando que no se encontraron datos del perfil.
*   **Server Actions**: No se utilizan Server Actions en este componente, ya que es un componente de cliente que interactúa directamente con Firebase SDK.