# Ruta: /settings
## Propósito General
Esta ruta permite a los usuarios gestionar su perfil y preferencias dentro de la aplicación. Ofrece funcionalidades para visualizar la información básica del usuario, editar el perfil, integrar servicios de salud y fitness (como Google Fit), configurar notificaciones y, para usuarios autorizados, acceder a un panel de administración.

## Componentes y Estructura
La página está estructurada con un diseño centrado y espaciado, utilizando componentes de UI para una presentación consistente.

- **Contenedor Principal:** Un `div` con `max-w-4xl mx-auto space-y-6` que centra el contenido y aplica espaciado vertical.
- **Encabezado de Página:**
    - Muestra un título "Configuración" con el icono `SettingsIcon` y una descripción general.
- **Sección de Perfil de Usuario:**
    - Contenida en un componente `Card`.
    - Muestra el `Avatar` del usuario, su nombre (`displayName`), correo electrónico (`email`) y, si está disponible, su `player.position`.
    - Incluye el componente `EditProfileDialog` para la edición del perfil, que se renderiza condicionalmente una vez que los datos del jugador han sido cargados.
- **Sección de Salud y Fitness:**
    - Presenta un título y descripción para la integración de servicios de salud.
    - Contiene el componente `LinkGoogleFitButton` para vincular con Google Fit.
- **Sección de Notificaciones:**
    - Ofrece un título y descripción para la gestión de notificaciones.
    - Incluye el componente `NotificationSettings` para configurar los permisos de notificación.
- **Sección de Administración (Super Admin):**
    - Se renderiza condicionalmente solo para usuarios cuyos correos electrónicos coinciden con los definidos en `ADMIN_EMAILS`.
    - Muestra un `Card` con un título "Panel Super Admin", una descripción y un botón (`Button`) que enlaza a la ruta `/admin`. Incluye el icono `ShieldAlert`.
- **Marcador de Posición para Futuras Secciones:**
    - Un `Card` con un borde punteado que indica que más opciones de configuración estarán disponibles próximamente.
- **Componentes de UI (de `@/components/ui`):**
    - `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`: Para agrupar y estilizar secciones de contenido.
    - `Avatar`, `AvatarFallback`, `AvatarImage`: Para mostrar la imagen de perfil del usuario.
    - `Separator`: Para dividir visualmente las secciones.
    - `Skeleton`: Utilizado para mostrar estados de carga mientras se recuperan los datos iniciales.
    - `Button`: Para acciones interactivas, como el acceso al panel de administración.
- **Componentes Personalizados (de `@/components`):**
    - `LinkGoogleFitButton`: Botón específico para la integración con Google Fit.
    - `NotificationSettings`: Componente para la gestión de permisos de notificación.
    - `EditProfileDialog`: Diálogo para la edición de la información del perfil del usuario.
- **Iconos (de `lucide-react`):**
    - `Settings` (aliado como `SettingsIcon`), `User`, `ShieldAlert`.

## Hooks, Server Actions y Lógica
Este componente es un "Client Component" (`'use client'`) y gestiona su estado y lógica de datos en el lado del cliente.

- **`useUser()` (de `@/firebase`):**
    - Hook personalizado que proporciona el objeto `user` (el usuario autenticado de Firebase) y un estado `loading` que indica si la autenticación del usuario está en curso.
- **`useFirestore()` (de `@/firebase`):**
    - Hook personalizado que proporciona la instancia de `firestore` para interactuar con la base de datos Firestore.
- **`useState` hooks:**
    - `player`: Almacena los datos del perfil del jugador (`Player`) obtenidos de Firestore. Inicializado a `null`.
    - `userProfile`: Almacena los datos del perfil de usuario (`UserProfile`) obtenidos de Firestore. Inicializado a `null`.
    - `playerLoading`: Un booleano que gestiona el estado de carga de los datos `player` y `userProfile`. Inicializado a `true`.
- **`useEffect` hook:**
    - **Dependencias:** `[user, firestore]`. Se ejecuta cuando el objeto `user` o la instancia `firestore` cambian.
    - **Lógica de Carga de Datos:**
        1. Define una función asíncrona `fetchPlayer` para obtener los datos.
        2. Si `user` o `firestore` no están disponibles, establece `playerLoading` a `false` y sale.
        3. Utiliza `Promise.all` para realizar dos consultas simultáneas a Firestore:
            - `getDoc(doc(firestore, 'players', user.uid))`: Para obtener los datos específicos del jugador.
            - `getDoc(doc(firestore, 'users', user.uid))`: Para obtener el perfil de usuario adicional.
        4. Si los documentos existen (`.exists()`), actualiza los estados `player` y `userProfile` con los datos correspondientes.
        5. Incluye un bloque `try...catch` para manejar errores durante la recuperación de datos.
        6. En el bloque `finally`, establece `playerLoading` a `false` para indicar que la carga ha finalizado.
- **Manejo de Estados de Carga y Autenticación:**
    - Si `loading` (del `useUser` hook) es `true`, se renderiza una interfaz de carga con `Skeleton` componentes.
    - Si `user` es `null` (usuario no autenticado), se muestra un mensaje pidiendo al usuario que inicie sesión.
- **Lógica de Acceso de Administrador:**
    - Se define una constante `ADMIN_EMAILS` con una lista de correos electrónicos autorizados.
    - La sección "Super Admin" se renderiza solo si el correo electrónico del usuario actual (obtenido de `user.email` o `getAuth().currentUser?.email`) está incluido en la lista `ADMIN_EMAILS` (comparación sin distinción entre mayúsculas y minúsculas).
- **Interacción con Firebase:**
    - Se utiliza `getDoc` y `doc` de `firebase/firestore` para leer documentos específicos de las colecciones `players` y `users` basándose en el `uid` del usuario autenticado.
    - Se utiliza `getAuth()` de `firebase/auth` como una forma alternativa de obtener el usuario autenticado para la verificación de administrador.
- **Tipos de Datos:**
    - Se importan los tipos `Player` y `UserProfile` de `@/lib/types` para asegurar la tipificación correcta de los datos obtenidos de Firestore.
- **Server Actions:** No se utilizan Server Actions de Next.js en este componente; toda la lógica de datos y estado se maneja en el cliente.