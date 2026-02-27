# Ruta: /login
## Propósito General
Esta ruta es la página de inicio de sesión de la aplicación. Su propósito principal es permitir a los usuarios autenticarse utilizando su correo electrónico y contraseña a través de Firebase Authentication. Una vez autenticado, el sistema establece una sesión tanto en el cliente como en el servidor (mediante una cookie de sesión) y redirige al usuario al panel de control (`/dashboard`). También maneja la redirección automática si el usuario ya está logueado y muestra un estado de carga mientras se verifica la sesión.

## Componentes y Estructura
La página `/login` es un componente de cliente (`'use client'`) que utiliza una combinación de componentes de UI de Shadcn y componentes personalizados para construir la interfaz de usuario:

*   **Contenedor Principal:** Un `div` con `min-h-screen flex flex-col items-center justify-center bg-background p-4` que centra el contenido vertical y horizontalmente.
*   **Contenedor de Tarjeta:** Un `div` anidado que actúa como un contenedor de ancho limitado (`max-w-sm`) para la tarjeta de inicio de sesión.
*   **`Card` (Shadcn UI):**
    *   **`CardHeader`:** Contiene el logo de la aplicación (`SoccerPlayerIcon`), el título "Pateá" y una descripción breve ("Inicia sesión para organizar los partidos con tus amigos.").
    *   **`CardContent`:**
        *   **`Form` (Shadcn UI, integrado con `react-hook-form`):** Envuelve el formulario de inicio de sesión.
            *   **`form` (HTML):** Contiene los campos de entrada y el botón de envío.
                *   **`FormField` (Shadcn UI):** Para el campo de correo electrónico (`email`).
                    *   **`FormLabel`:** "Correo Electrónico".
                    *   **`FormControl`:** Envuelve el `Input`.
                    *   **`Input` (Shadcn UI):** Campo de texto para el correo electrónico.
                    *   **`FormMessage`:** Muestra errores de validación para el correo electrónico.
                *   **`FormField` (Shadcn UI):** Para el campo de contraseña (`password`).
                    *   **`FormLabel`:** "Contraseña".
                    *   **`FormControl`:** Envuelve el `Input`.
                    *   **`Input` (Shadcn UI):** Campo de tipo `password` para la contraseña.
                    *   **`FormMessage`:** Muestra errores de validación para la contraseña.
                *   **`Button` (Shadcn UI):** Botón de envío del formulario, con texto condicional ("Iniciando sesión..." o "Iniciar Sesión") basado en el estado de envío.
        *   **Enlaces de Navegación:**
            *   **`Link` (Next.js):** Para "Olvidaste tu contraseña?" que redirige a `/forgot-password`.
            *   **`Link` (Next.js):** Para "¿No tienes una cuenta? Regístrate" que redirige a `/register`.
*   **`SoccerPlayerIcon` (Componente personalizado):** Utilizado como logo de la aplicación y como indicador de carga.
*   **`Mail` (Lucide React):** Icono para el enlace de correo electrónico en el footer.
*   **`WhatsAppIcon` (Componente personalizado):** Icono para el enlace de WhatsApp en el footer.
*   **`footer` (HTML):** Contiene información del desarrollador y enlaces de contacto (correo electrónico, WhatsApp) y derechos de autor.

## Hooks, Server Actions y Lógica
*   **`'use client'`:** Directiva que marca el componente como un Client Component de React, permitiendo el uso de hooks y manejo de interactividad en el navegador.
*   **`useUser` (de `@/firebase`):** Un hook personalizado que proporciona el estado de autenticación del usuario (`user`) y un indicador de carga (`loading`) relacionado con la inicialización de Firebase Auth.
*   **`useAuth` (de `@/firebase`):** Un hook personalizado que devuelve la instancia de `firebase/auth` para realizar operaciones de autenticación.
*   **`useRouter` (de `next/navigation`):** Hook de Next.js para la navegación programática entre rutas.
*   **`useEffect`:**
    *   Se ejecuta cuando `user`, `loading` o `router` cambian.
    *   Si `loading` es `false` (la autenticación ha terminado de cargar) y `user` existe (el usuario está autenticado), redirige al usuario a la ruta `/dashboard` usando `router.push('/dashboard')`.
*   **`useForm` (de `react-hook-form`):**
    *   Inicializa el formulario de inicio de sesión.
    *   Utiliza `zodResolver` para integrar la validación de esquemas Zod.
    *   `loginSchema`: Un esquema Zod que define las reglas de validación para `email` (debe ser un correo válido) y `password` (obligatorio).
    *   `defaultValues`: Establece los valores iniciales de los campos del formulario a cadenas vacías.
*   **`useToast` (de `@/hooks/use-toast`):** Un hook personalizado para mostrar notificaciones (toasts) al usuario, utilizado para informar sobre errores de inicio de sesión o de creación de sesión.
*   **`onSubmit` (función asíncrona):**
    *   Se invoca cuando el formulario se envía y la validación es exitosa.
    *   Verifica que la instancia de `auth` esté disponible.
    *   **Autenticación Firebase:** Intenta iniciar sesión con `signInWithEmailAndPassword(auth, data.email, data.password)`.
        *   **Éxito en Firebase Login:**
            *   Obtiene el `idToken` del usuario (`userCredential.user.getIdToken(true)`).
            *   **`createSessionCookie` (Server Action):** Llama a esta Server Action para enviar el `idToken` al servidor y crear una cookie de sesión HTTP-only. Esto asegura que las rutas API y otras partes del servidor puedan reconocer al usuario autenticado.
                *   Si `createSessionCookie` falla, muestra un toast de error, pero permite que la sesión del cliente continúe (no bloquea).
            *   La redirección final a `/dashboard` es manejada por el `useEffect` que monitorea el hook `useUser` (que a su vez reacciona a `onAuthStateChanged` de Firebase).
        *   **Fallo en Firebase Login:** Captura cualquier error (ej. credenciales incorrectas) y muestra un toast de error genérico al usuario.
*   **Renderizado Condicional:**
    *   Si `loading` es `true` o `user` ya existe, la página muestra un `SoccerPlayerIcon` animado en el centro de la pantalla, indicando un estado de carga o que el usuario ya está siendo redirigido. Esto evita que el formulario de login se muestre brevemente a un usuario ya autenticado.