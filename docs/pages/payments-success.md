# Ruta: /payments/success
## Propósito General
Esta ruta está diseñada para mostrar el resultado de una transacción de pago, típicamente después de que un usuario ha completado un proceso de pago externo (como con Mercado Pago) y es redirigido de vuelta a la aplicación. Su función principal es verificar el estado final del pago utilizando un ID de transacción proporcionado en la URL, y luego presentar una interfaz de usuario adecuada que refleje si el pago fue aprobado, rechazado, está pendiente o si ocurrió un error durante la verificación. En caso de éxito, muestra los detalles de la compra (créditos y monto) y ofrece opciones de navegación.

## Componentes y Estructura
La página se compone de dos componentes principales:

*   **`PaymentSuccessPage` (Componente de Página Principal):**
    *   Es el componente de nivel superior que se exporta por defecto.
    *   Envuelve el componente `PaymentSuccessContent` dentro de un `Suspense` boundary.
    *   El `Suspense` proporciona un `fallback` que muestra un simple icono `Loader2` girando mientras el componente hijo (que utiliza `useSearchParams`) se hidrata en el cliente.

*   **`PaymentSuccessContent` (Componente de Contenido Principal):**
    *   Es un componente de cliente (`'use client'`).
    *   Contiene toda la lógica y la renderización condicional de la interfaz de usuario.
    *   Renderiza diferentes estados de la UI basándose en la variable de estado `status`:
        *   **`checking` / `pending`:** Muestra un `Loader2` animado, mensajes informativos sobre la verificación o procesamiento del pago, y un icono `Clock`.
        *   **`approved`:** Presenta un icono `CheckCircle2` grande, un mensaje de "¡Pago Exitoso!", los detalles de la compra (créditos y monto con icono `Sparkles`), y botones para navegar al "Dashboard" o "Generar Fotos con IA". También activa una animación de confeti.
        *   **`rejected`:** Muestra un icono `XCircle`, un mensaje de "Pago Rechazado", una explicación sobre posibles causas, y botones para "Volver al Dashboard" o "Intentar Nuevamente" (usando `router.back()`).
        *   **`error`:** Muestra un icono `XCircle` (con un color de advertencia), un mensaje de "Error al Verificar", una explicación detallada (si falta el `transactionId` o un error general), y un botón para "Volver al Dashboard".
    *   Utiliza el componente `Button` de Shadcn UI (`@/components/ui/button`) para las acciones de navegación.
    *   Incorpora iconos de `lucide-react` (`Loader2`, `CheckCircle2`, `XCircle`, `Clock`, `Sparkles`) para mejorar la retroalimentación visual.
    *   Integra la librería `canvas-confetti` para un efecto visual de celebración en caso de pago exitoso.

## Hooks, Server Actions y Lógica

*   **Hooks de React:**
    *   `useState`:
        *   `status`: Gestiona el estado actual del proceso de verificación del pago (`'checking' | 'approved' | 'rejected' | 'pending' | 'error'`). Inicialmente es `'checking'`.
        *   `credits`: Almacena la cantidad de créditos comprados si el pago es aprobado. Inicialmente `0`.
        *   `amount`: Almacena el monto monetario pagado si el pago es aprobado. Inicialmente `0`.
        *   `retryCount`: Cuenta el número de intentos fallidos al verificar el estado del pago. Inicialmente `0`.
    *   `useEffect`:
        *   Se ejecuta al montar el componente y cuando `transactionId` o `retryCount` cambian.
        *   **Obtención del `transactionId`:** Extrae el `transaction_id` de los parámetros de búsqueda de la URL (`useSearchParams`). Si no se encuentra, establece el `status` a `'error'`.
        *   **Mecanismo de Polling:** Implementa una función `checkStatus` que se ejecuta inmediatamente y luego en un `setInterval` cada 2 segundos.
            *   La función `checkStatus` llama a la `Server Action` `checkPaymentStatusAction`.
            *   Actualiza el estado `status`, `credits` y `amount` basándose en la respuesta de la acción.
            *   Si el pago es `'approved'`, activa la animación de confeti (`confetti()`) y detiene el polling.
            *   Si el pago es `'rejected'` o `'cancelled'`, detiene el polling.
            *   Si el pago es `'pending'`, continúa el polling.
            *   Maneja errores en la llamada a la `Server Action`, incrementando `retryCount`. Si `retryCount` alcanza 10, establece el `status` a `'error'` y detiene el polling.
        *   **Limpieza:** El `useEffect` devuelve una función de limpieza que detiene el `setInterval` cuando el componente se desmonta, evitando fugas de memoria.

*   **Hooks de Next.js:**
    *   `useSearchParams` (de `next/navigation`): Utilizado para acceder a los parámetros de consulta de la URL y obtener el `transaction_id`.
    *   `useRouter` (de `next/navigation`): Proporciona acceso al objeto `router` para la navegación programática (`router.push('/dashboard')`, `router.back()`).

*   **Server Actions:**
    *   `checkPaymentStatusAction` (importada de `@/lib/actions/payment-actions`):
        *   Es una función asíncrona que se ejecuta en el servidor.
        *   Recibe el `transactionId` como argumento.
        *   Su propósito es interactuar con el proveedor de pagos (ej. Mercado Pago API) para consultar el estado real de la transacción.
        *   Se espera que devuelva un objeto con propiedades como `success` (booleano), `status` (string: 'approved', 'rejected', 'pending', 'cancelled'), `credits` (número) y `amount` (número).

*   **Lógica Adicional:**
    *   **Renderizado Condicional:** La interfaz de usuario se adapta dinámicamente al estado del pago (`status`) para mostrar la información y las acciones pertinentes.
    *   **Manejo de Errores:** Se implementa un mecanismo de reintentos para la verificación del pago y se muestra un mensaje de error genérico si el `transactionId` no está presente o si se excede el límite de reintentos.
    *   **Experiencia de Usuario:** La animación de confeti y los mensajes claros mejoran la experiencia del usuario, proporcionando retroalimentación visual y textual sobre el resultado de su pago.