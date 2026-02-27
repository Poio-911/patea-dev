# Ruta: /register
## Propósito General
Esta ruta permite a los nuevos usuarios registrarse en la aplicación. El proceso de registro incluye la creación de una cuenta de usuario en Firebase Authentication, la carga opcional de una foto de perfil a Firebase Storage, la creación de documentos de usuario y jugador asociados en Firestore, el establecimiento de una sesión de usuario a través de una cookie de sesión de Next.js, y la generación de una actividad social inicial. La página también maneja la validación del formulario y la navegación condicional.

## Componentes y Estructura
La página `/register` presenta una interfaz centrada para el formulario de registro, utilizando componentes de UI para una experiencia de usuario consistente.

-   **Contenedor Principal:** Un `div` que ocupa toda la altura de la pantalla (`min-h-screen`) y centra su contenido, con un fondo (`bg-background`) y padding.
-   **Tarjeta de Registro (`Card`):**
    -   Envuelve el formulario de registro, proporcionando un diseño estructurado y visualmente agradable.
    -   **`CardHeader`:** Contiene el logo de la aplicación (`SoccerPlayerIcon`), el título "Pateá" y una descripción introductoria.
    -   **`CardContent`:** Aloja el formulario de registro.
-   **Formulario (`Form` de `react-hook-form`):**
    -   Gestiona la entrada de datos del usuario y la validación.
    -   **Selector de Foto de Perfil:**
        -   `ImageCropperDialog`: Un componente que permite al usuario seleccionar, recortar y previsualizar una imagen de perfil.
        -   `Avatar`: Muestra la previsualización de la imagen seleccionada o un fallback (la primera letra del nombre o un icono de cámara).
        -   Un botón superpuesto con un icono de `Camera` indica que la imagen es editable.
    -   **Campos de Formulario (`FormField`):**
        -   `displayName`: Campo de texto para el nombre del usuario.
        -   `email`: Campo de texto para el correo electrónico.
        -   `password`: Campo de texto para la contraseña (tipo `password`).
        -   `position`: Un componente `Select` que permite al usuario elegir su posición favorita en el campo (DEL, MED, DEF, POR).
    -   **Botón de Envío (`Button`):**
        -   Muestra el texto "Registrarse" y un icono `Loader2` cuando el formulario está en proceso de envío (`isSubmitting`).
    -   **Enlace de Inicio de Sesión (`Link`):**
        -   Un enlace a la página `/login` para usuarios que ya tienen una cuenta.
-   **Estado de Carga Inicial:**
    -   Mientras se verifica el estado de autenticación del usuario (`loading`) o si un usuario ya está autenticado (`user`), se muestra un `SoccerPlayerIcon` con una animación de ciclo de color, ocupando toda la pantalla.

## Hooks, Server Actions y Lógica

**1. Importaciones y Contexto:**
-   **Firebase:**
    -   `useUser`, `useFirestore`, `useAuth`: Hooks personalizados de `@/firebase` para acceder al usuario autenticado, la instancia de Firestore y la instancia de Auth, respectivamente.
    -   `initializeFirebase`: Función para inicializar la aplicación Firebase, utilizada para obtener la instancia de Storage.
    -   `createUserWithEmailAndPassword`, `updateProfile`: Funciones de Firebase Auth para la creación y actualización de usuarios.
    -   `getStorage`, `ref`, `uploadBytes`, `getDownloadURL`: Funciones de Firebase Storage para la gestión de archivos.
    -   `writeBatch`, `collection`, `doc`: Funciones de Firebase Firestore para operaciones de escritura atómicas.
-   **Next.js:**
    -   `useRouter`: Hook para la navegación programática.
-   **React:**
    -   `useEffect`, `useState`, `useRef`: Hooks estándar de React para efectos secundarios, estado local y referencias.
-   **Server Actions:**
    -   `createSessionCookie` de `@/lib/auth-actions`: Una Server Action para crear una cookie de sesión segura en el servidor.
    -   `createActivityAction` de `@/lib/actions/server-actions`: Una Server Action importada dinámicamente para registrar actividades sociales.
-   **Validación de Formulario:**
    -   `useForm` de `react-hook-form`: Hook para gestionar el estado y la validación del formulario.
    -   `zodResolver` de `@hookform/resolvers/zod`: Integración de Zod con `react-hook-form`.
    -   `z` de `zod`: Librería para la definición de esquemas de validación.
-   **Utilidades y Tipos:**
    -   `useToast` de `@/hooks/use-toast`: Hook personalizado para mostrar notificaciones.
    -   `nanoid`: Para generar IDs únicos (aunque no se usa directamente en el código proporcionado para IDs de documentos, es una importación común).
    -   `Group`, `Player` de `@/lib/types`: Tipos de datos para la aplicación.
-   **Componentes Personalizados:**
    -   `ImageCropperDialog`: Componente para el recorte de imágenes.

**2. Esquema de Validación (Zod):**
-   `registerSchema`: Define la estructura y las reglas de validación para los campos del formulario:
    -   `displayName`: Cadena, mínimo 3 caracteres.
    -   `email`: Cadena, formato de correo electrónico válido.
    -   `password`: Cadena, mínimo 6 caracteres.
    -   `position`: Enum con valores 'DEL', 'MED', 'DEF', 'POR', y es obligatorio.

**3. Estado Local y Hooks:**
-   `user`, `loading` (de `useUser`): Proporcionan el estado de autenticación actual del usuario.
-   `router` (de `useRouter`): Instancia para la navegación.
-   `auth` (de `useAuth`): Instancia de Firebase Authentication.
-   `firestore` (de `useFirestore`): Instancia de Firebase Firestore.
-   `toast` (de `useToast`): Función para mostrar notificaciones.
-   `isSubmitting` (`useState<boolean>`): Controla el estado de carga del botón de envío.
-   `imagePreview` (`useState<string | null>`): Almacena la URL de la imagen de perfil para previsualización en el cliente.
-   `generatedPhotoUrl` (`useState<string | null>`): Almacena la Data URL de la imagen recortada, lista para ser subida.
-   `form` (de `useForm`): Objeto de control del formulario, inicializado con `zodResolver` y valores por defecto.

**4. `useEffect` para Redirección:**
-   Se ejecuta cuando `user`, `loading` o `router` cambian.
-   Si `loading` es `false` y `user` existe (es decir, el usuario ya está autenticado), redirige al usuario a `/dashboard?new_user=true` para evitar que acceda a la página de registro.

**5. Función `onSubmit` (Lógica Principal de Registro):**
-   **Inicio:**
    -   Verifica que `auth` y `firestore` estén disponibles.
    -   Establece `isSubmitting(true)`.
-   **Paso 1: Creación de Usuario en Firebase Auth:**
    -   `createUserWithEmailAndPassword(auth, data.email, data.password)`: Crea el usuario.
    -   `newUser` obtiene el objeto `User` resultante.
-   **Paso 1b: Carga de Foto de Perfil a Firebase Storage (Opcional):**
    -   Si `generatedPhotoUrl` existe y es una Data URL:
        -   Convierte la Data URL a un `Blob`.
        -   Inicializa Firebase Storage.
        -   Define la ruta de almacenamiento (`profile-images/{uid}/profile_{timestamp}.webp`).
        -   `uploadBytes`: Sube el `Blob` a Storage.
        -   `getDownloadURL`: Obtiene la URL pública de la imagen subida (`finalPhotoURL`).
        -   Manejo de errores: Si la carga falla, se muestra un `toast` de advertencia, pero el registro continúa sin la foto.
-   **Paso 1c: Creación de Cookie de Sesión (Server Action):**
    -   `newUser.getIdToken(true)`: Obtiene el token de ID del usuario.
    -   `createSessionCookie(idToken)`: Llama a la Server Action para establecer una cookie de sesión HTTP-only en el servidor, lo que permite que las rutas API de Next.js reconozcan al usuario.
    -   Manejo de errores: Si falla, se muestra un `toast` de error.
-   **Paso 2: Actualización del Perfil de Auth:**
    -   `updateProfile(newUser, { displayName: data.displayName, photoURL: finalPhotoURL })`: Actualiza el perfil del usuario en Firebase Auth con el nombre de visualización y la URL de la foto (si se subió).
-   **Paso 3: Creación de Documentos en Firestore (Batch Write):**
    -   `writeBatch(firestore)`: Inicia una operación de escritura por lotes para asegurar la atomicidad (todas las escrituras se completan o ninguna).
    -   **Documento de Usuario (`/users/{uid}`):**
        -   Crea un documento en la colección `users` con el `uid` del nuevo usuario.
        -   Almacena `uid`, `email`, `displayName`, `photoURL`, `groups` (vacío) y `activeGroupId` (nulo).
    -   **Documento de Jugador (`/players/{uid}`):**
        -   Crea un documento en la colección `players` con el `uid` del nuevo usuario (el jugador está vinculado al usuario).
        -   Almacena `name`, `position`, estadísticas base (todas a 50), `ovr` (50), `photoUrl`, `stats` iniciales, `ownerUid`, `groupId` (nulo), `cardGenerationCredits` (3) y `lastCreditReset`.
    -   `batch.commit()`: Ejecuta todas las operaciones por lotes.
    -   **Manejo de Errores de Batch:** Si el `batch.commit()` falla, se registra el error y se intenta `newUser.delete()` para eliminar la cuenta de Firebase Auth, evitando cuentas huérfanas. Se lanza un nuevo error para el `toast`.
-   **Paso 4: Creación de Actividad Social (Server Action):**
    -   Importa dinámicamente `createActivityAction`.
    -   `createActivityAction`: Registra una actividad de tipo `player_created` en la base de datos.
    -   Manejo de errores: Si falla, se registra el error, pero no interrumpe el flujo de registro principal.
-   **Finalización:**
    -   Muestra un `toast` de éxito.
-   **Manejo General de Errores (`catch`):**
    -   Captura cualquier error durante el proceso de registro.
    -   Muestra un `toast` de error, con un mensaje específico para `auth/email-already-in-use` o el mensaje de error general.
-   **`finally`:**
    -   `setIsSubmitting(false)`: Restablece el estado del botón de envío.

**6. Renderizado Condicional:**
-   Si `loading` es `true` (cargando el estado de autenticación) o `user` ya existe (usuario autenticado), la página muestra un icono de carga (`SoccerPlayerIcon`) en el centro de la pantalla, en lugar del formulario de registro.