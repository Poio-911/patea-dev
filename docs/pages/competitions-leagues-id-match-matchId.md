# Ruta: /competitions/leagues/[id]/match/[matchId]
## Propósito General
Esta ruta está diseñada para mostrar y gestionar los detalles de un partido específico dentro de una liga. Su función principal es recuperar los datos de un partido de Firestore utilizando el `matchId` proporcionado en la URL, verificar la autenticación del usuario y la disponibilidad del `leagueId`, y luego renderizar una vista detallada del partido.

## Componentes y Estructura
- **`LeagueMatchManagePage` (Componente Raíz):** Es el componente principal de la página, responsable de la lógica de carga de datos, validación y renderizado condicional.
- **`Loader2` (de `lucide-react`):** Se muestra como un indicador visual de carga (spinner) mientras se están recuperando los datos del partido de Firestore.
- **`LeagueMatchView` (de `@/components/league/LeagueMatchView`):** Es el componente hijo principal que se encarga de la presentación y posible interacción con los detalles del partido. Recibe el objeto `match`, el `leagueId` y el `userId` como propiedades (`props`).
- **Renderizado Condicional:**
    - Si `matchLoading` es `true`, se renderiza el `Loader2`.
    - Si `match` es `null` después de la carga, se muestra un mensaje de "Partido no encontrado".
    - Si `user?.uid` o `leagueId` no están presentes, se muestra un mensaje de "Acceso no autorizado".
    - En cualquier otro caso, se renderiza el componente `LeagueMatchView` con los datos y IDs necesarios.

## Hooks, Server Actions y Lógica
- **`'use client'`:** Declara el componente como un Client Component de React, lo que significa que se ejecuta en el navegador.
- **`useParams()` (de `next/navigation`):** Hook de Next.js para extraer los parámetros dinámicos de la URL: `id` (que se asigna a `leagueId`) y `matchId`.
- **`useMemo()` (de `react`):** Se utiliza para memoizar la referencia al documento de Firestore (`matchRef`). Esto asegura que la referencia solo se recalcule si `firestore` o `matchId` cambian, optimizando el rendimiento al evitar recreaciones innecesarias.
- **`useFirestore()` (de `@/firebase`):** Hook personalizado para obtener la instancia de la base de datos Firestore.
- **`useUser()` (de `@/firebase`):** Hook personalizado para obtener la información del usuario actualmente autenticado.
- **`useDoc<Match>(matchRef)` (de `@/firebase`):** Hook personalizado para la lectura de un único documento de Firestore. Toma una referencia de documento (`matchRef`) y devuelve los datos del documento (`data` como tipo `Match`) y un estado de carga (`loading`).
- **`doc()` (de `firebase/firestore`):** Función de la SDK de Firebase para construir una referencia a un documento específico dentro de una colección.
- **Lógica de Carga de Datos:**
    1. Se obtiene `firestore` y `matchId`.
    2. `useMemo` crea `matchRef` apuntando al documento `matches/[matchId]` en Firestore.
    3. `useDoc` utiliza `matchRef` para suscribirse a los datos del partido, proporcionando `match` y `matchLoading`.
- **Lógica de Validación y Autorización:**
    - Se verifica el estado de `matchLoading` para mostrar un spinner.
    - Se comprueba si `match` existe después de la carga para manejar casos de partidos no encontrados.
    - Se valida la existencia de `user?.uid` (ID del usuario autenticado) y `leagueId` para asegurar que el usuario tiene el contexto necesario para ver o gestionar el partido.
- **Interacción con la Base de Datos:** El componente realiza una operación de lectura (GET) de un documento específico de la colección `matches` en Firestore.
- **No se utilizan Server Actions:** Toda la lógica de obtención de datos y renderizado se maneja en el cliente mediante hooks de React y Firebase.