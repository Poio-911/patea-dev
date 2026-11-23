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

## 4. Partidos: costo, transmisión, calendario y sin conexión

Se rehizo desde cero. Dos hallazgos al revisar la PWA: su «dividir costo» es un esqueleto (los pagos están marcados «próximamente» y nunca se guardan) y las «plantillas» son **de competición**, no de partido: pasan al punto 5 (portal del organizador).

**Costo del partido y quién pagó** (`functions/src/callable/match-extras.ts`, `lib/match-extras.ts`)
- `setMatchCost`: el organizador (o capitán, co-organizador, admin o moderador del grupo) carga el total y la moneda (UYU, ARS o USD). Un monto cero lo saca. Tope de 1.000.000.
- `markMatchPayment`: marca o desmarca que alguien del plantel (invitados incluidos) ya pagó.
- Se guarda en el propio partido: `cost {total, currency}` y `costPaidUids[]`; lo ve quien ve el partido, sin reglas nuevas.
- La app **no mueve plata**: es la planilla de quien junta. La parte de cada uno es el total dividido en partes iguales y redondeado hacia arriba al centavo (`lib/core/utils/cost_split.dart`), así lo que se junta nunca queda por debajo del costo.
- App: tarjeta «Costo del partido» en el detalle (`match_cost_card.dart`): por persona, total, progreso, «faltan $X» y la lista con un interruptor por persona para el organizador; los demás ven «Pagó» o «Falta» y a ellos mismos marcados.

**Transmisión** (`setMatchStream`)
- El organizador pega un enlace de YouTube, Twitch o Kick; el servidor lo reduce a `{provider, id, url}` (mismo contrato que la web) y rechaza cualquier otro sitio, `http` y trampas de dirección (por ejemplo `youtube.com.malo.com`). Se aceptan solo esos tres porque un enlace libre dentro de una app con contenido de usuarios sería una puerta a sitios engañosos.
- App: fila en el detalle (`match_stream_row.dart`): botón «Ver» que abre el enlace afuera; el organizador lo agrega, cambia o saca. La transmisión en sí no pasa por Pateá, así que no se incrusta ningún reproductor.
- El «visualizador» de la PWA no hace falta: la app ya tiene cancha, estadísticas y línea de tiempo en vivo.

**Calendario**
- Tercer modo en Partidos, junto a lista y cuadrícula (`matches_calendar_view.dart`, lógica en `lib/core/utils/match_calendar.dart`): mes de lunes a domingo, puntos por día (color si falta jugarse, apagado si ya se jugó), «Hoy», y al tocar un día aparecen sus partidos con la misma tarjeta de la lista.
- Respeta los filtros de tipo, estado y «mis partidos», pero no el de tiempo; en este modo se esconden las pestañas Próximos/Semana/Historial.

**Aviso de sin conexión**
- `connectivity_service.dart` revisa cada 15 s (cada 4 s si está caída) si resuelve el servidor de la base de datos, sin plugin nativo, y recién da por caída la conexión al segundo fallo seguido. `offline_banner.dart` muestra «Sin conexión: mostrando lo último guardado» y, al volver, «Conexión restaurada» tres segundos. Va por encima de todas las pantallas (`main.dart`).

**Estado de este punto:** las tres funciones (`setMatchCost`, `markMatchPayment`, `setMatchStream`) están desplegadas. Probado en el emulador con datos reales: el calendario y el aviso de sin conexión (se cortó el wifi y apareció la franja roja; al volver se ocultó, pero no llegué a ver el texto «Conexión restaurada»). **Sin probar en el teléfono**: cargar el costo, marcar pagos y cargar la transmisión, porque la cuenta del emulador no administra ningún partido; se vieron en las vistas previas (`tool/match_extras_preview_test.dart`) y la lógica está probada con tests. Nota de diseño: la franja de sin conexión se dibuja encima del encabezado de la app y lo tapa mientras dura.

## 5. Competiciones y portal del organizador (primera parte)

**Qué ya tenía la app** y no se tocó: lista con alcance grupo/público y búsqueda, resumen, fechas y cruces, tabla, equipos, datos (goles, asistencias, disciplina), postulaciones, gestión (configurar, iniciar, cerrar, archivar). Por eso el «explorador público» y la «búsqueda» del informe ya estaban cubiertos.

**Qué se hizo, desde cero** (`functions/src/callable/competition-extras.ts`, `lib/competition-extras.ts`; app en `features/competitions/competition_extras.dart`)
- **Avisos** (`sendCompetitionMessage`): el organizador manda un asunto y un mensaje (hasta 80 y 500 caracteres) a todos los equipos o solo a los capitanes. El servidor arma los destinatarios (solo personas con cuenta, nunca el propio organizador) y les llega como notificación; queda un historial en `…/messages`, que **solo lee el organizador** (se cerró en `firestore.rules`). Tope de 5 avisos por hora por competición. Vive dentro de «Gestión» (solo organizador), junto con los patrocinadores y las postulaciones.
- **Sedes** (`manageCompetitionVenue`): agregar, editar y sacar canchas (nombre, dirección, capacidad, costo por partido, notas; hasta 30). Subcolección `…/venues`, visible para todos. Pestaña «Sedes» (al final de la barra); el organizador edita, los demás miran.
- **Patrocinadores** (`manageCompetitionSponsor`): nombre y enlace https opcional (hasta 12), en el campo `sponsors` de la competición. Se ven en «Resumen» como «Con el apoyo de» y se administran en «Gestión». **Sin logo**: subir imágenes de terceros pide un flujo de carga y moderación que no se hizo; si el patrocinador ya tiene logo cargado desde la web, se conserva al editar.
- Seguridad: solo el organizador (`ownerUid`) escribe; no se permite en competiciones archivadas o canceladas; los enlaces deben ser https sin usuario ni contraseña.

**Se decidió no migrar**
- **Analíticas y juego limpio**: lo que muestran (goles, tarjetas, puntos por tarjetas) sale de los mismos eventos que ya alimentan «Datos» y el resumen; no aportan algo que el organizador no vea hoy.
- **Código QR para compartir**: necesita una dirección pública estable de la competición y la app todavía no tiene enlaces profundos.
- **Portal aparte del organizador** (login y perfil de organizador): en la app hay una sola cuenta; no hace falta un acceso distinto.
- **Plantillas de competición**: guardan reglas y formato para reutilizar al crear un torneo. No se hicieron: dependen del asistente de creación, que es otro frente.

**Falta de este punto**
- **Árbitros** (asignar árbitros a los partidos y evaluarlos): es lo más grande que queda y requiere decidir el modelo (¿lista propia de árbitros o personas de la app?). Sin hacer.
- Probado en el emulador con una copa de prueba (`Copa_de_prueba_organizador`, borrador, solo del grupo, con una sede `Cancha_de_prueba`): crear sede, verla al instante, y ver Gestión con patrocinadores y el historial de avisos. **No se envió ningún aviso** (le llegaría a los jugadores de los equipos) ni se cargó un patrocinador.
- La copa y la sede de prueba quedaron en el proyecto real; se pueden borrar desde la app o la consola.
- Al probarlo apareció un error preexistente de `PateaTabs` (en barras que desbordan, las últimas pestañas eran inalcanzables); está corregido con test.

## Decidido no migrar

- **Imagen de dúo** (`generate-duo-image` de la PWA): no se migra. La acción `generateDuoImageAction` existe pero **ninguna pantalla de la PWA la llama** (se buscó en todo `src`), así que no hay una función de producto que trasladar. Además genera imágenes con la cara de otra persona a partir de su foto, y eso pide un consentimiento que hoy no existe. Si algún día se quiere, hay que diseñarla como función nueva, con ese permiso explícito y sus créditos (en iOS, solo se compran en la tienda).

## Pendiente

- **Sugerencias de refuerzos**: desplegada y con la lógica probada, pero sin ver andar con el modelo en un partido real: hace falta un partido propio con lugares libres y gente. Cuidado al probarla: crear un partido en el proyecto real avisa por push a todo el grupo. Las pruebas de permisos y casos vacíos están en `functions/test/ai-assist.emulator.test.cjs` (pide el emulador de Firestore, que necesita Java 21; localmente hay Java 17, así que corre en CI y todavía no se ejecutó).
- **Google Fit / Salud**: sin hacer (ver arriba).
- Del informe [PARIDAD_PWA_APP.md](PARIDAD_PWA_APP.md): el punto 5 solo en lo que falta (árbitros) y el 6 (Comunidad: ticker de actividad y rankings por categoría).
- **Rediseño**: las pantallas nuevas siguen el estilo actual, que se quiere rediseñar completo.
