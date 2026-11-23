# Paridad PWA → app móvil

> **Actualización 23/11/2026:** los puntos 1 (Logros), 2 (Configuración, sin Salud) y 3 (IA; la imagen de dúo se descartó porque la PWA no la usa) ya están hechos desde cero. Detalle en [MIGRACION_PWA_A_APP_2026-11-23.md](MIGRACION_PWA_A_APP_2026-11-23.md).

Análisis del 23/11/2026. Se comparó el código de la PWA (`src/app`, `src/components`, `src/lib/actions`, `src/ai/flows`) con el de la app Flutter (`patea_mobile/lib`, `functions/src`). Es una comparación por rutas, componentes y llamadas al servidor: los ítems marcados **parcial** hay que confirmar a mano en la pantalla.

## Ya migrado (resumen)

Login, registro y recuperar contraseña; panel; jugadores (lista, detalle, historial, progresión, estudio de retrato con IA); partidos (crear, detalle, en vivo, chat, clips, evaluación, planificación de fecha y lugar, convocatoria y reclutamiento, equipos balanceados, invitados, jugadores manuales); evaluaciones (incluida audio y revelar identidad); grupos y equipos (rivales, desafíos, camisetas); explorar y disponibilidad; feed social (publicaciones, encuestas, reacciones, seguir, denunciar y bloquear); mensajes; ranking; competiciones (ligas, copas, postulaciones, gestión, estadísticas); entrenamiento; Sign in with Apple; eliminar cuenta; compras de créditos (solo tienda).

## Falta migrar

### 1. Logros
- PWA: `/achievements`, `player-achievements-panel`, `achievement-toast` y las acciones `achievement-actions`.
- App: nada. La hoja de notificaciones ya reconoce `achievement_unlocked`, pero no hay pantalla. El comentario de `patea_user_menu_sheet.dart` ya lo anota.

### 2. Configuración y salud
- PWA: `/settings` con perfil, ajustes de notificaciones y **Google Fit** (vincular, importar actividad a un partido, métricas físicas).
- App: no existe `/settings`. Google Fit no está. En móvil lo natural es Apple Salud y Health Connect, no Google Fit.

### 3. Inteligencia artificial
Los flujos de la PWA corren como acciones de Next.js, no como funciones de Firebase, así que hay que portarlos a `functions/` antes de usarlos desde la app.

| Función PWA | Estado en la app |
|---|---|
| Análisis del jugador con IA (`/players/[id]/analysis`: mejoras, patrones, progresión) | No está |
| Coach conversacional (`coach-conversation`) | No está. «Mi entrenamiento» es un plan fijo local, sin chat |
| Ayuda con chat (`get-app-help`, botón flotante) | No está (hay un diálogo de ayuda estático) |
| Resumen del grupo (`generate-group-summary`) | No está |
| Buscar el mejor jugador para un puesto (`find-best-fit`) | No está |
| Imagen de dúo (`generate-duo-image`) | **No se migra**: ninguna pantalla de la PWA la usa |
| Pronóstico del partido con IA (`get-match-day-forecast`) | **Parcial**: hay clima, no el texto de IA |
| Retrato con IA, crónica, equipos balanceados, análisis de texto y audio | Migrado |

### 4. Partidos
- **Dividir el costo** (`match-cost-split`): no está.
- **Transmisión y visualizador en vivo** (`match-stream-dialog`, `match-visualizer`): no está (la app tiene cancha y estadísticas en vivo, pero no la vista de transmisión).
- **Plantillas de partido** (`template-actions`): no está.
- **Calendario de partidos** (`matches-calendar`): no está en Partidos.
- **Aviso sin conexión** (`offline-banner`): no está.

### 5. Competiciones y portal del organizador
La app tiene hub, postulaciones, gestión, estadísticas y llaves, pero faltan estas piezas de la PWA:
- Portal del organizador: `/organizer` (login, perfil, «Mis torneos») y `/organizer/league|cup/[id]`.
- Pestañas de gestión: **patrocinadores**, **juego limpio**, **comunicación** (mensajes a equipos), **árbitros** (asignar), **sedes**, **analíticas**, **calendario de liga** y **tarjeta con QR** para compartir.
- Explorador público de competiciones (`/competitions/public`) y buscar partidos (`/competitions/search`).
- Páginas **Mis equipos**, **Historial de amistosos** y **Amistosos / postulaciones**: **parcial**, hay desafíos entre equipos pero no estas vistas.
- Inscripción de un equipo a una liga (`/league/[id]/register`): **parcial**, existe la gestión de postulaciones.

### 6. Comunidad
- `/comunidad`: multi-rankings y «ticker» de actividad. **Parcial**: hay ranking y feed, pero no el ticker ni los rankings por categoría juntos.

## No corresponde migrar
- **Pagos con Mercado Pago** (`/payments`, `payment-actions`): en iOS se reemplazan por compras integradas de Apple (ya hechas). En Android no se venden créditos.
- **Panel de administración** (`/admin`, super admin): herramienta interna, mejor dejarla en la web.

## Orden sugerido
1. Logros y Configuración (chico, ya hay notificaciones y menú preparados).
2. IA: análisis del jugador y coach con chat (lo más visible; requiere portar los flujos a funciones).
3. Dividir costo y calendario de partidos.
4. Portal del organizador, empezando por comunicación, patrocinadores y QR.
5. Comunidad (ticker) y el resto de las IA (resumen de grupo, mejor jugador, dúo).
