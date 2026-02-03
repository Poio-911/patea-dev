
# 📝 Análisis del Flujo de Registro de Usuarios

**Fecha:** 3 de Febrero 2026
**Ubicación del Código:** `src/app/register/page.tsx`

---

## 🚀 Resumen del Proceso

El registro en **Pateá** es un proceso atómico que inicializa la identidad del usuario tanto en el sistema de autenticación como en la base de datos del juego. Se utilizan operaciones en lote (`batch`) para garantizar la integridad de los datos.

### Pasos Principales:
1.  **Autenticación (Firebase Auth):** Se crea la credencial segura con email/password.
2.  **Sesión (Cookies):** Se genera una cookie de sesión para el renderizado del lado del servidor (SSR).
3.  **Persistencia de Datos (Firestore):** Se crean simultáneamente documentos en las colecciones `users` y `players`.
4.  **Actividad Social:** Se publica automáticamente un evento `player_created` en el feed social.

---

## 💾 Estructura de Datos Inicial

Al registrarse, se generan dos documentos clave en Firestore con los siguientes valores iniciales:

### 1. Colección `users/{uid}`
Representa la cuenta del usuario y sus configuraciones globales.

| Campo | Tipo | Valor Inicial | Descripción |
| :--- | :--- | :--- | :--- |
| `uid` | String | `auth.uid` | Identificador único (mismo que Auth). |
| `email` | String | input | Correo electrónico. |
| `displayName` | String | input | Nombre visible del usuario. |
| `photoURL` | String | URL / null | Foto de perfil (si se subió/generó). |
| `groups` | Array | `[]` | Lista de IDs de grupos a los que pertenece. |
| `activeGroupId` | String | `null` | Grupo activo seleccionado (inicialmente ninguno). |

### 2. Colección `players/{uid}`
Representa la "carta" del jugador y sus estadísticas de juego. **Es el documento principal para la lógica de gameplay.**

| Campo | Tipo | Valor Inicial | Detalle |
| :--- | :--- | :--- | :--- |
| `name` | String | `displayName` | Se sincroniza con el nombre de usuario. |
| `position` | String | input (`DEL`, `MED`...) | Posición elegida por el usuario. |
| **OVR** | Number | **50** | Media general inicial para todos los jugadores. |
| **Atributos** | Number | **50** | `pac`, `sho`, `pas`, `dri`, `def`, `phy` inicializados en 50/99. |
| `stats` | Object | `{ matchesPlayed: 0, ... }` | Estadísticas vacías (0 partidos, 0 goles, 0 asistencias). |
| `cardGenerationCredits` | Number | **3** | Créditos gratuitos para generar cartas con IA. |
| `lastCreditReset` | String | `ISO Date` | Fecha para controlar el reinicio mensual de créditos. |
| `ownerUid` | String | `auth.uid` | Referencia al dueño del jugador. |
| `groupId` | String | `null` | Deprecado (ahora se usa `groups` en el user doc). |

---

## ⚙️ Análisis de Reglas de Negocio

### Inicialización de Estadísticas (El "Jugador Promedio")
Todos los jugadores comienzan con una base plana de **50 puntos** en todos los atributos.
- **Ventaja:** Sistema justo, "tabula rasa". Nadie empieza con ventaja.
- **Desventaja:** No refleja diferencias reales iniciales (ej: un arquero empieza con 50 de Tiro, igual que un delantero).
- **Progresión:** La diferenciación ocurre post-partido mediante el sistema de **Evaluaciones**, donde jugadores en diferentes posiciones ganan atributos de forma ponderada (ej: Defensas ganan más DEF).

### Créditos e IA
Se otorgan **3 créditos iniciales** para la herramienta de "Generación de Carta IA". Esto permite al usuario probar la feature premium de inmediato sin pagar.

### Consistencia
El uso de `writeBatch` es crítico. Si falla la creación del perfil de jugador (ej: error de red), también se revierte la creación del usuario lógico (aunque el usuario en Auth podría persistir, la aplicación maneja esto requiriendo login posterior).
