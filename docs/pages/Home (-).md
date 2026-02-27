# Ruta: /
## Propósito General
Esta ruta sirve como la página de inicio de la aplicación. Su propósito principal es:
1.  Verificar el estado de autenticación del usuario.
2.  Si el usuario ya está autenticado y no está en proceso de carga, redirigirlo automáticamente a la ruta `/dashboard`.
3.  Si el usuario no está autenticado, mostrar una página de bienvenida con opciones para "Iniciar Sesión" o "Registrarse".
4.  Proporcionar una experiencia de carga visual mientras se determina el estado de autenticación.

## Componentes y Estructura
El componente `HomePage` es un componente cliente (`'use client'`).

-   **Estructura Principal:**
    -   Un `div` principal que ocupa toda la altura de la pantalla (`min-h-screen`) y centra su contenido.
    -   Dentro, un `div` con `max-w-md` que actúa como contenedor para el contenido principal, centrándolo y añadiendo espaciado.

-   **Estado de Carga/Redirección:**
    -   Cuando `loading` es `true` o `user` existe, se renderiza un `div` que ocupa toda la pantalla, mostrando un `SoccerPlayerIcon` con una animación de ciclo de color. Esto indica que la aplicación está verificando el estado del usuario o redirigiendo.

-   **Contenido de la Página de Bienvenida (cuando no hay usuario autenticado):**
    -   **Encabezado:** Un `div` que contiene:
        -   `SoccerPlayerIcon`: Un icono de un jugador de fútbol, utilizado como parte del logo.
        -   `h1` con el texto "Pateá": El nombre de la aplicación, estilizado con `font-bold` y `font-headline`.
    -   **Descripción:** Un párrafo (`p`) que explica brevemente la funcionalidad de la aplicación.
    -   **Botones de Acción:** Un `div` que contiene dos botones, que se organizan en columna en pantallas pequeñas y en fila en pantallas más grandes:
        -   `Button` (de `@/components/ui/button`) envuelto en un `Link` (de `next/link`) que dice "Iniciar Sesión" y redirige a `/login`.
        -   `Button` (de `@/components/ui/button`) con la variante `outline` envuelto en un `Link` que dice "Registrarse" y redirige a `/register`.

-   **Componentes Importados (pero no utilizados en el renderizado actual):**
    -   `WhatsAppIcon`
    -   `Mail`

## Hooks, Server Actions y Lógica
-   **`'use client'`**: Declara el componente como un Client Component, lo que permite el uso de hooks de React y la interacción con el navegador.

-   **`useUser()` hook**:
    -   Importado de `@/firebase`.
    -   Este hook personalizado es responsable de gestionar el estado de autenticación del usuario (probablemente con Firebase Authentication).
    -   Devuelve `user` (el objeto de usuario autenticado o `null` si no hay sesión) y `loading` (un booleano que indica si el estado de autenticación aún se está cargando o verificando).

-   **`useRouter()` hook**:
    -   Importado de `next/navigation`.
    -   Proporciona acceso al objeto `router` de Next.js, que se utiliza para la navegación programática, específicamente `router.push()`.

-   **`useEffect()` hook**:
    -   **Dependencias:** `[user, loading, router]`
    -   **Lógica:** Se ejecuta cada vez que `user`, `loading` o `router` cambian.
        -   `if (!loading && user)`: Si el estado de autenticación ha terminado de cargar (`!loading`) y existe un objeto `user` (lo que significa que el usuario está autenticado), el efecto redirige al usuario a la ruta `/dashboard` utilizando `router.push('/dashboard')`.

-   **Lógica de Renderizado Condicional:**
    -   `if (loading || user)`: Si el estado de autenticación está en proceso de carga (`loading` es `true`) o si ya hay un usuario autenticado (`user` no es `null`), el componente renderiza el icono de carga animado. Esto asegura que los usuarios autenticados sean redirigidos rápidamente sin ver la página de inicio y que se muestre una indicación visual durante la verificación.
    -   Si `loading` es `false` y `user` es `null` (es decir, no hay usuario autenticado y la verificación ha terminado), se renderiza la página de bienvenida con las opciones de inicio de sesión y registro.

-   **Server Actions y Manejo de Base de Datos:**
    -   Este componente no utiliza directamente Server Actions de Next.js.
    -   El manejo de la autenticación y, por extensión, la interacción con la base de datos de usuarios (si aplica), está encapsulado dentro del hook `useUser()`. El componente `HomePage` solo consume el estado de autenticación proporcionado por este hook.