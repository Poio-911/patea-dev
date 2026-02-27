# Ruta: /players/[id]/progression
## Propósito General
Esta ruta está diseñada para mostrar la progresión y evolución de un jugador específico a lo largo del tiempo. Permite a los usuarios analizar el rendimiento y los cambios de un jugador individual, identificado por su `id` en la URL.

## Componentes y Estructura
El componente `ProgressionPage` es un componente de cliente (`'use client'`).

*   **Contenedor Principal:** Un `div` principal con `flex flex-col gap-6` organiza el contenido verticalmente con espaciado.
*   **Navegación:**
    *   Un `div` que contiene un `Button` envuelto en un componente `Link` de Next.js. Este botón permite al usuario volver al perfil del jugador (`/players/[id]`) y muestra un icono `ArrowLeft`.
*   **Encabezado de Página:**
    *   `PageHeader`: Un componente personalizado que muestra el título "Progresión del Jugador" y una descripción dinámica que incluye el nombre del jugador (`Analizá la evolución de ${player.name} a lo largo del tiempo.`).
*   **Separador:**
    *   `Separator`: Un componente de UI para añadir una línea divisoria visual.
*   **Vista de Progresión:**
    *   `PlayerProgressionView`: El componente principal encargado de renderizar los datos de progresión del jugador. Recibe `playerId` como prop.
*   **Estados de Carga y Error:**
    *   **Carga:** Durante la carga de los datos del jugador, se muestra un `Loader2` (icono de spinner) animado.
    *   **No Encontrado:** Si el jugador no se encuentra después de la carga, se muestra un mensaje "Jugador no encontrado.".

## Hooks, Server Actions y Lógica
Este componente es un componente de cliente y utiliza varios hooks para la gestión de estado, navegación y acceso a datos. No utiliza Server Actions directamente.

*   **`useParams` (de `next/navigation`):**
    *   Se utiliza para extraer el `id` del jugador de los parámetros de la URL (`params.id`). Este `id` se almacena en la variable `playerId`.
*   **`useUser` (de `@/firebase`):**
    *   Se importa para obtener el usuario autenticado (`user`). Aunque se importa, la variable `user` no se utiliza directamente en la lógica de renderizado o datos de este componente específico.
*   **`useFirestore` (de `@/firebase`):**
    *   Se utiliza para obtener una instancia de la base de datos Firestore.
*   **`doc` (de `firebase/firestore`):**
    *   Se usa para crear una referencia a un documento específico en Firestore. `playerRef` se construye apuntando a la colección `players` y al documento con el `playerId` extraído de la URL.
*   **`useDoc` (de `@/firebase`):**
    *   Este hook personalizado se encarga de escuchar y obtener los datos de un documento de Firestore en tiempo real.
    *   Recibe `playerRef` como argumento.
    *   Devuelve `data` (el objeto `Player`) y `loading` (un booleano que indica si los datos están cargando).
*   **Manejo de Datos y Lógica Condicional:**
    *   **Estado de Carga:** Si `playerLoading` es `true`, el componente renderiza un spinner (`Loader2`).
    *   **Jugador No Encontrado:** Si `player` es `null` o `undefined` después de la carga, se muestra un mensaje indicando que el jugador no fue encontrado.
    *   **Renderizado Principal:** Una vez que los datos del jugador se han cargado exitosamente, el componente renderiza la interfaz de usuario completa, pasando el `playerId` al componente `PlayerProgressionView`.