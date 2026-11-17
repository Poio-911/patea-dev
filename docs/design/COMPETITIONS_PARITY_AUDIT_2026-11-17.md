# Copas y ligas: comparación funcional entre Flutter y PWA

Fecha: 17/11/2026. Rama: `feat/flutter-mobile-app`.

## Implementación posterior

La ampliación autorizada se documenta en [Ligas y copas nativas 1.0.31+32](COMPETITIONS_NATIVE_2026-11-17.md). Este informe conserva el diagnóstico previo; sus carencias no describen automáticamente el estado de la nueva implementación.

## Base revisada

Se analiza el árbol local, incluidas las modificaciones aún no confirmadas en el menú de Partidos, creación y listado de competiciones, detalle de liga y cuadro de copa. Son 12 archivos, contando pruebas y referencias visuales. Esos cambios no forman parte de la entrega TestFlight etiquetada `ios-testflight-1.0.30-20261116-r2`. No se modifican ni se incorporan a este commit de análisis.

La revisión es de código y referencias visuales locales. No acredita pruebas de navegación contra datos reales ni garantiza que cada recorrido presente en la PWA funcione sin errores. No se despliega ni se modifica la base de datos.

## Diagnóstico

El móvil tiene una base operativa privada: crear liga/copa con equipos del grupo, iniciar liga con partidos semanales, sortear llaves de copa, cargar resultados manuales del cuadro y eliminar el torneo como organizador. La liga muestra posiciones y fechas. La estética local ya está más integrada que la de la build publicada.

La PWA incorpora recorridos adicionales para participantes y organizadores: Mi equipo, fechas agrupadas, estadísticas, inscripciones y administración. La diferencia principal es el ciclo de vida de los datos y los partidos, no la cantidad de tarjetas.

## Comparación

| Recorrido | Flutter local | PWA revisada | Ampliación propuesta |
| --- | --- | --- | --- |
| Listado | Ligas/Copas, estado, cantidad de equipos; consulta global limitada a 50 documentos por colección | Navegación propia y navegador de competiciones públicas con postulaciones | Separar Mis competiciones, Del grupo y Públicas; búsqueda, filtros de estado y paginación |
| Creación | Nombre, equipos del grupo, ida/vuelta en liga; siempre privado | Público/privado, fecha inicial, ubicación, logo; liga con frecuencia, día y hora | Asistente compacto Identidad → Equipos → Calendario, conservando los controles y temas de la app |
| Liga | Posiciones reducidas, lista de partidos y nombres de equipos; inicio semanal | Tabla detallada, fixture agrupado y jornada actual, goleadores, Mi equipo, solicitudes y cierre | Pestañas Resumen, Fechas, Tabla, Equipos y Estadísticas; administración separada por permiso |
| Copa | Cuadro horizontal y carga manual de marcador; sorteo aleatorio en el botón actual | Cruces conectados a partidos reales, equipos, solicitudes, sorteo aleatorio/OVR, campeón | Ronda actual y próximos cruces visibles; abrir/crear partido desde cada cruce; sorteo configurable y cierre coherente |
| Mi equipo | No existe dentro de la competición | Posición, puntos, plantel y próximo partido | Identificar equipos por pertenencia y rol; permitir elegir si la persona pertenece a varios |
| Programación | Primera fecha y hora de liga; jornadas semanales; no editor específico del fixture | Fecha, hora y ubicación por encuentro | Programar/reprogramar con estado y permisos; resumen de cancha, horario y resultado en cada fila |
| Estadísticas | Posiciones calculadas desde resultados finales de liga | Goles y tarjetas desde eventos y datos legados | Goleadores, asistencias y disciplina calculados desde datos reales; evitar duplicar eventos y resúmenes legados |
| Inscripciones | Sin alta pública ni bandeja de solicitudes | Postulación, aprobación/rechazo/revocación y registro externo | Flujo para postular mi equipo y gestionar solicitudes; respetar estado, cupo y permisos |
| Equipos | Nombres del grupo activo del torneo | Información del equipo y acciones de administración | Camiseta, plantel, acceso al detalle y cambios permitidos antes del inicio |
| Finalización | Copa escribe campeón por resultado manual; liga no ofrece cierre | Cierre, campeón y presentación del resultado final | Validar partidos pendientes, resolver empate y guardar campeón/estado una sola vez |

## Problemas concretos que deben resolverse primero

1. **Las copas móviles no conectan sus cruces con partidos reales.** `BracketMatchModel` no conserva `matchId`; tocar un cruce abre directamente el diálogo de marcador. La web crea o abre un documento en `matches` con `createCupMatchAction`. Sin ese vínculo, dirigir, chat, evaluación y eventos no forman un único recorrido del torneo.
2. **Falta sincronización de competición en la finalización móvil.** `functions/src/callable/evaluations.ts` documenta expresamente que el port no incluye `updateLeagueStandingsAction`/`advanceCupWinnerAction`. La web sí ejecuta esas operaciones. La tabla móvil de liga recalcula resultados al leerlos, pero eso no sustituye la persistencia de estado, campeón y avance de copa.
3. **El modelo descarta información necesaria.** `CompetitionModel` no conserva formato, visibilidad, logo, calendario, ubicación, reglas, ronda actual o campeón. El detalle local fija el texto Todos contra todos, incluso si el documento indica ida/vuelta. Ampliar el modelo debe preceder a los controles nuevos.
4. **La lista no representa realmente Del grupo.** `getCompetitionsStream` consulta la colección completa con un límite de 50, sin filtro de grupo ni visibilidad, sin orden ni paginación. El rótulo actual no coincide con la consulta. Hace falta definir cada ámbito y su consulta.
5. **Equipos públicos o externos pueden no resolverse.** El detalle móvil consulta `groupTeamsStreamProvider(groupId)` y busca allí los IDs participantes. Para una competición con equipos de otros grupos hay que resolver los participantes por ID, en lotes, y mantener la información histórica de equipos retirados.
6. **Programación rígida.** `startLeagueTournament` genera fechas cada siete días. Para incorporar lo que ofrece la web hay que guardar frecuencia, primera jornada, hora y sede, y permitir ajustes autorizados sin volver a generar ni duplicar todo el fixture.
7. **Eliminar no tiene el mismo significado en ambas versiones.** El servicio móvil conserva los partidos; las acciones web de eliminación buscan borrar partidos asociados. Debe decidirse y mostrarse una política coherente: conservar historial y tratar explícitamente los partidos futuros. No copiar una eliminación destructiva sólo para igualar botones.

## No copiar defectos de la PWA

- El detalle web de liga carga `league.teams.slice(0, 10)`. La app debe resolver todos los participantes admitidos, no reproducir ese recorte.
- Coexisten postulaciones a equipos existentes en `competitionApplications` y registro externo en `{leagues|cups}/{id}/applications`. Hay que distinguir ambos contratos o unificarlos con compatibilidad; una única bandeja que lea sólo uno perdería solicitudes.
- Algunas búsquedas de próximo partido en Mi equipo usan `team1Id/team2Id`, mientras que la creación actual guarda `participantTeamIds`. Definir el campo canónico y probar datos legados.
- Tener una server action en el repositorio no acredita por sí solo autorización suficiente. Las nuevas operaciones móviles deben validar identidad y permisos en servidor.

## Propuesta de experiencia manteniendo la estética móvil

### Entrada de competiciones

Conservar Ligas/Copas como navegación principal. Añadir un selector compacto de ámbito y filtros sencillos de estado. Dar prioridad a torneo, camiseta/logo, próxima fecha, posición de mi equipo y acción útil. La fotografía actual puede acompañar la sección, pero no debe desplazar la información activa por debajo del primer pantallazo.

### Detalle de liga

- **Resumen:** próxima fecha, mi equipo, posición/puntos y último resultado; campeón cuando corresponda.
- **Fechas:** agrupación por jornada, jornada actual y próxima por defecto; acceso a todas y programación para el organizador.
- **Tabla:** PJ, PG, PE, PP, GF, GC, DG y puntos; detalle expandible cuando no entre todo en un teléfono; destacar mi equipo sin recuadro adicional.
- **Equipos:** camiseta, nombre y plantel, con acceso al detalle existente.
- **Estadísticas:** jugadores y datos reales, con elección de goles/asistencias/disciplina.
- **Administrar:** acciones del organizador en menú o panel específico; los participantes no ven controles sin permiso.

### Detalle de copa

Priorizar el cruce de mi equipo y la ronda actual. Mantener el cuadro completo como vista secundaria ampliable, en lugar de exigir desplazar y hacer zoom para toda acción. Cada cruce debe indicar estado, fecha, sede y marcador, y abrir el partido real cuando exista. Sorteo con opciones disponibles según datos; información del campeón al terminar. Separar marcador final, desempate por penales y eventos de juego para no sumar penales al resultado del partido.

### Lenguaje visual

Usar `PateaTabs`, `PateaCard`, `PateaAvatar`, camisetas, `context.c` y la tipografía compartida. Conservar Game/Claro y el filtro de fondos. Acciones con tipografía de ancho normal; evitar badges repetidos, OVR en cajas y glow. Listas de jugadores y equipos coherentes con las secciones ya revisadas. Zonas táctiles cómodas y ninguna acción principal debajo de la navegación o del teclado. Animaciones breves sólo para comunicar selección, transición y resultado; respetar movimiento reducido.

## Orden de implementación recomendado

1. **Integridad y recorridos deportivos:** modelo completo, cruce ↔ partido, sincronización al finalizar, reintentos idempotentes y permisos. Resolver consultas y participantes externos. Mantener compatibilidad con torneos existentes de la PWA.
2. **Experiencia del participante:** resumen, Mi equipo, jornadas, tabla completa, equipos y estadísticas dentro del diseño móvil existente.
3. **Gestión del organizador:** calendario y sede, edición antes de iniciar, sorteo/configuración, cierre y campeón; acciones válidas para cada estado.
4. **Participación pública:** descubrimiento, inscripción, bandeja de solicitudes y administración de cupos. Incorporar registro externo cuando esté definido el contrato entre ambos sistemas de postulaciones.
5. **Extras de organización:** árbitros, patrocinadores, enlaces de transmisión y logística después de completar el ciclo principal.

## Criterios de aceptación

- Una copa completa puede sortearse, abrir sus partidos reales, dirigirse, finalizarse y avanzar hasta campeón sin cargar el mismo resultado en dos lugares.
- La liga conserva ida/vuelta, calendario, jornadas y clasificación al alternar web y app.
- Reintentar una solicitud o recibir dos eventos no duplica partidos, clasificaciones ni avances.
- Se prueban partidos con empate, penales, cancelaciones, equipos de varios grupos, más de diez equipos, datos legados y perfiles eliminados.
- La tabla y las estadísticas usan reglas explícitas y resultados válidos; no cuentan marcadores provisionales como finales.
- Las solicitudes pendientes no superan el cupo al aprobarse simultáneamente, y no se aceptan fuera de los estados admitidos.
- El organizador y el participante tienen acciones distintas, validadas también en servidor.
- Las vistas principales se verifican en Game/Claro, 320 px, texto al 130 %, teclado y movimiento reducido.

## Archivos consultados

Flutter: `lib/features/competitions/*`, `lib/core/models/competition_model.dart`, `lib/core/services/tournament_service.dart`, `lib/core/services/firestore_service.dart`, `lib/core/router/app_router.dart`.

Backend móvil: `functions/src/callable/league-management.ts`, `functions/src/callable/evaluations.ts` y `functions/src/lib/league-fixture.ts`.

PWA: `src/app/competitions/{leagues,cups}/[id]/page.tsx`, `src/components/leagues/*`, `src/components/cup/*`, `src/components/competitions/*`, `src/lib/actions/server-actions.ts` y `src/lib/actions/registration-actions.ts`.
