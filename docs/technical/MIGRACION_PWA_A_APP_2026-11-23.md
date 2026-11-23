# Migración PWA → app: Logros, Configuración e IA (23/11/2026)

Resumen de lo que se hizo, cómo está hecho, qué quedó sin hacer y qué hay que saber para tocarlo. El criterio de la migración: **no se copia código de la PWA, se hace desde cero para la app**. Las funciones del servidor son nuevas (`functions/`), no dependen de Next.js ni de Genkit.

Rama: `feat/flutter-mobile-app`. Commits: `ca7434b8`, `aa87aaae`, `09f99774`, `f35bc527`, `8314ad70`.

## 1. Logros

**Servidor** (`functions/src/lib/achievements.ts`, `functions/src/callable/achievements.ts`)
- Función `syncAchievements`: calcula el progreso de quien llama (goles, goles en un partido, partidos, victorias, OVR, seguidores, partidos organizados, campeonatos), desbloquea cada logro **una sola vez** y devuelve la lista completa con su avance.
- Mismos ids que la web, así que los logros ya desbloqueados (`playerAchievements/{uid}_{id}`) siguen valiendo. Los logros viejos no se borran aunque hoy el progreso sea menor.
- Se calcula con conteos y una sola lectura de los partidos de la persona; no recorre colecciones enteras como hacía la PWA.
- Un solo aviso por tanda de desbloqueos (notificación `achievement_unlocked`, enlace `/achievements`), aunque se junten varios.

**App**
- Pantalla `/achievements` (`lib/features/achievements/`): resumen «N de 16», secciones por categoría, barra de avance, fecha, etiqueta «NUEVO».
- Modelo `lib/core/models/achievement_model.dart`, servicio `lib/core/services/achievements_service.dart`.
- El enlace de la notificación ahora se acepta en `NotificationsService` (antes se descartaba).

## 2. Configuración

Pantalla `/settings` (`lib/features/settings/settings_screen.dart`): cuenta (con acceso a editar perfil), apariencia, notificaciones (estado real del permiso y botón para activarlo), usuarios bloqueados (lista y desbloquear), política de privacidad, términos, créditos de IA (**solo en la versión de la tienda**), cerrar sesión y eliminar cuenta. Accesos «Logros» y «Configuración» en el menú de usuario.

**Salud (Google Fit) no se migró, a propósito.** En iPhone requiere Apple Salud: agrega un permiso a la app, obliga a regenerar el perfil de firma de Codemagic y suma etiquetas de privacidad. Falta decidir si se quiere ese costo.

## 3. IA

Todas las funciones de IA comparten `functions/src/lib/ai-runtime.ts` (cliente de Vertex con `gemini-3.1-flash-lite`, tope diario y caché en `ai_cache`). La lógica pura (contexto, prompts, validación de lo que contesta el modelo) está en `lib/coach.ts` y `lib/ai-assist.ts`, probada sin red.

| Función | Qué hace | Quién puede | Caché |
|---|---|---|---|
| `getPlayerAnalysis` | Análisis del jugador: titular, resumen, fortalezas, a trabajar, patrones, plan | Solo sobre la ficha de quien llama | 24 h, por situación del jugador |
| `coachChat` | Chat con el DT | Ídem | No |
| `askAppHelp` | Asistente de la app, contesta solo con una guía propia (`APP_HELP_DOC`) | Cualquiera con sesión | No |
| `getGroupSummary` | Párrafo sobre el grupo | Solo integrantes | 7 días |
| `recommendRecruits` | Refuerzos para un partido, entre candidatos que la app ya mostró | Solo quien administra el partido | 1 h |

**Decisiones de diseño**
- El contexto se arma **en el servidor** con los datos de quien llama, nunca con lo que mande el teléfono. En `recommendRecruits` los datos de cada candidato se leen de `players/{uid}` (se descartan los jugadores manuales) y los ids que devuelve el modelo se validan contra la lista.
- **Las evaluaciones son anónimas**: a la IA solo le llegan notas y etiquetas, nunca texto libre, audios ni quién evaluó. Hay un test que lo comprueba.
- Sin datos no se llama al modelo (análisis sin partidos evaluados devuelve `not_enough_data`).
- **Topes diarios por persona** en `aiUsage/{uid}_{fecha}`: chat 25, análisis 6, ayuda 30, resumen 10, sugerencias 10 (`DAILY_LIMITS` en `lib/coach.ts`; se pueden cambiar). Se consumen en una transacción y solo cuando se genera algo nuevo.
- Cambiar un prompt invalida lo guardado: `ANALYSIS_PROMPT_VERSION` y `SUMMARY_PROMPT_VERSION` entran en la clave de caché. **Si se toca un prompt, hay que subir la versión.**
- La guía de ayuda (`APP_HELP_DOC`) es la única fuente del asistente. Si cambia la navegación o una función de la app, se actualiza ahí.

**App**
- `/coach/analysis` («Tu análisis») y `/coach/chat` («El DT») desde «Tu entrenamiento».
- `/help`: el mismo chat (`AiChatScreen`, con constructores `.coach()` y `.help()`), desde el botón «Preguntale al asistente» de la guía de cada sección.
- Tarjeta con el resumen en Grupos; botón «Que el DT sugiera» en «Falta gente».
- Servicios `coach_service.dart` y `ai_assist_service.dart`; modelos en `coach_models.dart`.

## Cosas que aprendí y conviene saber

- **Después de desplegar una función nueva, esperar unos minutos antes de probar.** El permiso público tarda en propagarse y mientras tanto la función contesta 401 con HTML (la app lo muestra como «FormatException»). Con funciones ya existentes no pasa.
- **En Riverpod 3, `AsyncValue.value` lanza si el estado es error.** Para datos opcionales (como el resumen del grupo o el estado de notificaciones) usar `.asData?.value`.
- Mi comando de deploy compuesto con otras acciones fue bloqueado por el clasificador de permisos; se despliega con un comando solo y con autorización explícita.
- El resumen del grupo cuenta como la pantalla: todo el plantel como «jugadores» y los partidos del grupo más los de grupos participantes.

## Estado de las pruebas

- `functions`: 220 pruebas, 0 fallos (47 se saltean porque piden el emulador de Firestore).
- App: 29 fallos, todos preexistentes (goldens, fechas, el trinquete de colores por `social_feed_screen.dart`, pruebas del menú de usuario y de «Explorar»). Ninguno es de lo hecho acá. El trinquete de colores sí tenía un fallo mío (botón de Apple): se agregó su presupuesto con la razón.
- Probado en el emulador Android con el servidor real: Logros, Configuración, Tu análisis, El DT, la ayuda y el resumen del grupo.

## Pendiente

- **Sugerencias de refuerzos**: desplegada y con la lógica probada, pero sin ver andar en un partido real (hace falta un partido propio con lugares libres y gente).
- **Imagen de dúo** (`generate-duo-image` de la PWA): sin hacer. Gasta créditos de IA y en iOS los créditos solo se compran en la tienda; falta definir cuánto cuesta y quién la puede generar.
- **Google Fit / Salud**: sin hacer (ver arriba).
- Del informe [PARIDAD_PWA_APP.md](PARIDAD_PWA_APP.md): puntos 4 (partidos: dividir costo, transmisión, plantillas, calendario, aviso sin conexión), 5 (competiciones y portal del organizador) y 6 (Comunidad).
- **Rediseño**: las pantallas nuevas siguen el estilo actual, que se quiere rediseñar completo.
