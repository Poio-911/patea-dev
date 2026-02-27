# Ruta: /forgot-password
## Propósito General
Esta ruta permite a los usuarios solicitar un restablecimiento de contraseña para su cuenta. Los usuarios ingresan su dirección de correo electrónico y, si está registrada, reciben un enlace por correo electrónico para establecer una nueva contraseña. La página proporciona retroalimentación visual sobre el estado del envío del correo electrónico, incluyendo mensajes de éxito y manejo de errores.

## Componentes y Estructura
La página `/forgot-password` es un componente de cliente (`'use client'`) que organiza su contenido dentro de un diseño centrado en la pantalla.

- **Contenedor Principal:** Un `div` con clases de Tailwind CSS (`flex min-h-screen flex-col items-center justify-center bg-background p-4`) que centra vertical y horizontalmente el contenido principal de la página.
- **`Card`:** El contenido principal está encapsulado dentro de un componente `Card` (de `@/components/ui/card`), que proporciona una estructura visual clara para el formulario o el mensaje de éxito.
    - **`CardHeader`:** Contiene el encabezado de la tarjeta, que incluye:
        - `SoccerPlayerIcon`: Un icono decorativo.
        - `CardTitle`: El título principal de la página ("¿Olvidaste tu Contraseña?").
        - `CardDescription`: Una breve descripción que instruye al usuario sobre el propósito de la página.
    - **`CardContent`:** Contiene el cuerpo principal de la tarjeta, que renderiza condicionalmente:
        - **`Alert`:** Si `emailSent` es `true`, se muestra un componente `Alert` (de `@/components/ui/alert`) con un mensaje de éxito, informando al usuario que el correo ha sido enviado y recordándole revisar la carpeta de spam.
        - **`Form`:** Si `emailSent` es `false`, se renderiza un formulario utilizando `react-hook-form` y componentes de UI de Shadcn/ui:
            - Un `FormField` para la entrada de correo electrónico (`Input`).
            - Un `Button` para enviar el formulario, que muestra un spinner (`Loader2`) y cambia su texto mientras se está enviando.
- **Enlace de Navegación:** Debajo del formulario o mensaje de éxito, hay un párrafo con un `Link` (de `next/link`) que permite al usuario volver a la página de inicio de sesión (`/login`).

## Hooks, Server Actions y Lógica
Este componente utiliza varios hooks de React y librerías externas para manejar el estado, la lógica del formulario y la interacción con Firebase.

- **Hooks de React:**
    - `useState`:
        - `isSubmitting`: Un booleano que controla el estado de envío del formulario (para deshabilitar el botón y mostrar un spinner).
        - `emailSent`: Un booleano que controla la renderización condicional del formulario o el mensaje de éxito después de enviar el correo.
- **Hooks Personalizados y Librerías:**
    - `useAuth` (de `@/firebase`): Un hook personalizado que proporciona la instancia de autenticación de Firebase (`auth`).
    - `useToast` (de `@/hooks/use-toast`): Un hook personalizado para mostrar notificaciones "toast" al usuario, utilizado para mensajes de error.
    - `useForm` (de `react-hook-form`): Gestiona el estado del formulario, la validación y el envío.
        - Se integra con `zodResolver` (de `@hookform/resolvers/zod`) para la validación de esquemas.
        - `forgotPasswordSchema`: Un esquema Zod que define las reglas de validación para el campo `email` (debe ser una cadena y un formato de correo electrónico válido).
- **Server Actions:** No se utilizan Server Actions en este componente. La interacción con Firebase se realiza directamente desde el lado del cliente.
- **Lógica de Negocio:**
    - **Validación del Formulario:** El formulario se valida utilizando `forgotPasswordSchema` de Zod, asegurando que el correo electrónico ingresado tenga un formato válido antes de intentar enviarlo.
    - **Función `onSubmit`:**
        - Es una función asíncrona que se ejecuta cuando el formulario es válido y se envía.
        - Establece `isSubmitting` a `true` para indicar que la operación está en curso.
        - Llama a `sendPasswordResetEmail(auth, data.email)` de Firebase Authentication para enviar el correo de restablecimiento.
        - **Manejo de Seguridad:** Por razones de seguridad (para prevenir ataques de enumeración de correos electrónicos), la aplicación muestra un mensaje de éxito (`setEmailSent(true)`) incluso si el correo electrónico no está registrado en Firebase. Firebase no lanza un error en este escenario.
        - En caso de un error técnico durante el envío (ej. problemas de red, configuración de Firebase), se muestra un `toast` destructivo con un mensaje genérico de error.
        - Finalmente, `isSubmitting` se establece en `false` en el bloque `finally`, independientemente del resultado.
    - **Renderizado Condicional:** La interfaz de usuario se adapta dinámicamente: el formulario se muestra inicialmente, y una vez que el correo se ha enviado con éxito (o se ha simulado el éxito por seguridad), se reemplaza por un mensaje de confirmación.