Aquí tienes el documento Markdown que describe la página de Next.js para la ruta `/achievements`.

---

# Ruta: /achievements

## Propósito
La página `/achievements` tiene como propósito principal mostrar al usuario sus logros dentro de la aplicación. Permite visualizar el progreso general del usuario en relación con todos los logros disponibles, el estado de cada logro (desbloqueado o no), y filtrar los logros por diferentes categorías. También ofrece una vista detallada del progreso por categoría y, para los logros desbloqueados, la fecha en que fueron obtenidos. Es una página interactiva que proporciona una visión gamificada del uso de la aplicación.

## Estructura y Componentes
La página está estructurada para presentar una visión general del progreso del usuario y luego una lista detallada y filtrable de todos los logros. Utiliza una combinación de componentes de UI predefinidos (como Shadcn/ui) y componentes personalizados.

1.  **Contenedor Principal:** Un `div` principal que organiza el contenido en una columna con espaciado (`flex flex-col gap-6`).

2.  **Encabezado de Página (`PageHeader`):**
    *   Muestra el título "Logros" y una descripción concisa sobre cómo se desbloquean.

3.  **Estado de Carga (`AchievementsSkeleton`):**
    *   Se renderiza condicionalmente cuando los datos del usuario o el progreso de los logros están cargando.
    *   Proporciona un esqueleto visual que simula la estructura de la página, incluyendo un avatar/icono grande, texto de marcador de posición y varias tarjetas de logros.

4.  **Mensaje de Usuario No Autenticado:**
    *   Si el usuario no está logueado (`!user`), se muestra un mensaje simple invitando a iniciar sesión, centrado en la pantalla con un icono de trofeo.

5.  **Tarjeta de Resumen del Progreso (`Card`):**
    *   **`CardHeader`:** Contiene el título "Tu Progreso" con un icono de trofeo.
    *   **`CardContent`:**
        *   **Círculo de Progreso Principal:** Una `motion.div` (de Framer Motion para animación) que muestra el número de logros desbloqueados sobre el total, con un diseño circular y animado.
        *   **Barra de Progreso Total:** Un componente `Progress` que visualiza el porcentaje total de logros desbloqueados.
        *   **Desglose por Categoría:** Una cuadrícula (`grid`) que muestra el progreso individual para cada categoría de logros (ej. "Rendimiento", "Hitos"). Cada elemento incluye un icono representativo de la categoría, su nombre y el recuento de logros desbloqueados sobre el total en esa categoría.

6.  **Pestañas de Logros (`Tabs`):**
    *   **`TabsList`:** Contiene los disparadores (`TabsTrigger`) para filtrar los logros.
        *   Un disparador "Todos" que muestra el total de logros desbloqueados y totales en una `Badge`.
        *   Disparadores para cada `ACHIEVEMENT_CATEGORY`, cada uno con su icono correspondiente y etiqueta.
    *   **`TabsContent`:**
        *   Contiene una `motion.div` (para animaciones de entrada de los logros individuales) que organiza los logros en una cuadrícula responsiva.
        *   **Tarjetas de Logros Individuales (`Card`):** Cada logro se representa con una `Card`.
            *   **`AchievementBadge`:** Un componente personalizado que muestra el icono del logro, su estado (desbloqueado/bloqueado), la fecha de desbloqueo (si aplica) y el progreso actual (si está bloqueado).
            *   **Texto de Progreso:** Para los logros no desbloqueados, muestra el progreso numérico (ej. "3/10").
            *   **Fecha de Desbloqueo:** Para los logros desbloqueados, muestra la fecha en que se obtuvo.
            *   La tarjeta tiene estilos condicionales (`cn`) para resaltar los logros desbloqueados.
        *   **Mensaje de "No hay logros":** Si la categoría seleccionada no tiene logros, se muestra un mensaje con un icono de trofeo atenuado.

## Funciones y Hooks
La página utiliza varios hooks de React y personalizados, así como funciones auxiliares para gestionar el estado, obtener datos y realizar cálculos.

1.  **Hooks de Estado (`useState`):**
    *   `progress`: Almacena un array de objetos `AchievementProgress`, que contiene el logro en sí, el progreso actual del usuario, si está desbloqueado y la fecha de desbloqueo. Inicialmente vacío.
    *   `loading`: Un booleano que indica si la carga inicial del progreso de los logros está en curso. Inicialmente `true`.
    *   `selectedCategory`: Almacena la categoría de logros actualmente seleccionada en las pestañas (ej. `'all'`, `'performance'`). Inicialmente `'all'`.

2.  **Hooks de Firebase (`@/firebase`):**
    *   `useUser()`: Obtiene el objeto `user` del contexto de autenticación de Firebase, que incluye el `uid` del usuario y su `activeGroupId`. Es fundamental para identificar al usuario y su grupo activo.
    *   `useFirestore()`: Proporciona una instancia del objeto `firestore` de Firebase, necesaria para construir consultas a la base de datos.
    *   `useCollection<Player>(playersQuery)`: Un hook personalizado que escucha en tiempo real los cambios en una colección de Firestore. Aquí se usa para obtener el documento `Player` del usuario actual en su grupo activo. Devuelve `data` (los jugadores encontrados) y `loading` (estado de carga de la colección).

3.  **Memoización (`useMemo`):**
    *   `playersQuery`: Crea una consulta de Firestore para buscar el documento `Player` del usuario actual en su `activeGroupId`. Se memoiza para que la consulta solo se reconstruya si `firestore`, `user.uid` o `user.activeGroupId` cambian.
    *   `currentPlayer`: Se deriva de `userPlayers?.[0]`. Aunque no es un `useMemo` directo, su valor depende de `userPlayers`.
    *   `stats`: Calcula estadísticas clave como el total de logros, logros desbloqueados, porcentaje de progreso total y el desglose de progreso por categoría. Se recalcula solo cuando el array `progress` cambia.
    *   `filteredProgress`: Filtra el array `progress` basándose en la `selectedCategory`. Se recalcula solo cuando `progress` o `selectedCategory` cambian.
    *   `sortedProgress`: Ordena `filteredProgress`. La lógica de ordenación prioriza los logros desbloqueados primero, y luego ordena los logros no desbloqueados por su porcentaje de progreso de forma descendente. Se recalcula solo cuando `filteredProgress` cambia.

4.  **Efectos Secundarios (`useEffect`):**
    *   Un `useEffect` se encarga de cargar el progreso de los logros del usuario.
        *   Se ejecuta cuando `user?.uid` o `currentPlayer?.id` cambian.
        *   Define una función asíncrona `loadProgress` que:
            *   Establece `setLoading(true)`.
            *   Llama a la *Server Action* `getAchievementProgressAction(currentPlayer.id, user.uid)` para obtener el progreso actual de los logros del usuario. Esta es la forma principal de obtener los datos de progreso dinámicos.
            *   Actualiza el estado `progress` con los resultados.
            *   Maneja errores y finalmente establece `setLoading(false)`.

5.  **Acciones del Servidor (`getAchievementProgressAction`):**
    *   Importada de `@/lib/actions/achievement-actions`. Esta es una función que se ejecuta en el servidor de Next.js, lo que permite realizar operaciones de base de datos o lógica compleja sin exponer credenciales o lógica sensible al cliente. Es la encargada de calcular y devolver el progreso de los logros para un `playerId` y `user.uid` dados.

6.  **Datos Estáticos y Utilidades:**
    *   `ACHIEVEMENTS`, `ACHIEVEMENT_CATEGORIES`, `getAchievementsByCategory`: Importados de `@/lib/achievements-config`. Estos son datos estáticos que definen todos los logros y sus categorías, no se obtienen de la base de datos en tiempo de ejecución, sino que están predefinidos en el código.
    *   `cn`: Una utilidad para combinar condicionalmente clases de Tailwind CSS.
    *   `motion` (de `framer-motion`): Utilizado para añadir animaciones fluidas a elementos de la UI, como el círculo de progreso y las tarjetas de logros individuales.

**Cómo obtiene/guarda los datos:**

*   **Obtención de datos del usuario y jugador:**
    *   El usuario autenticado se obtiene a través del hook `useUser()`.
    *   El documento `Player` asociado al usuario y su grupo activo se obtiene mediante el hook `useCollection()` de Firebase, que realiza una consulta en tiempo real a la colección `players` de Firestore.
*   **Obtención del progreso de los logros:**
    *   El progreso específico de cada logro para el `currentPlayer` se obtiene a través de la *Server Action* `getAchievementProgressAction`. Esta acción se ejecuta en el servidor, donde probablemente consulta la base de datos (Firestore u otra) para calcular el progreso actual del jugador contra los requisitos de cada logro.
*   **Datos estáticos de logros:**
    *   Las definiciones de los logros y sus categorías (`ACHIEVEMENTS`, `ACHIEVEMENT_CATEGORIES`) se cargan directamente desde archivos de configuración locales (`.ts`), no se obtienen de una base de datos en tiempo de ejecución.
*   **Guardado de datos:**
    *   Esta página es principalmente de visualización. No se muestra ninguna lógica explícita para guardar o actualizar datos de logros directamente desde esta página. Se asume que el progreso de los logros se actualiza en el backend a medida que el usuario realiza acciones en otras partes de la aplicación.

---