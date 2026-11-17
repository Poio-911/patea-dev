# Ligas y copas nativas — 1.0.31+32

Implementación en `feat/flutter-mobile-app`, sobre el checkout existente. La auditoría de la PWA se usó para detectar funciones ausentes; la organización del producto y las pantallas se diseñaron para móvil. Se integran los cambios locales de competiciones aportados por el usuario.

## Experiencia

- Listas por grupo activo, torneos que organizo y torneos públicos. Paginación real de 20 documentos; búsqueda explícita entre los torneos cargados, estados y archivados. No presupone que los primeros 50 torneos globales sean los del usuario.
- Creación y configuración en tres pasos: identidad, participantes y calendario. Admite inscripciones abiertas sin participantes iniciales; un torneo privado necesita dos equipos. Reglas de puntos, ida/vuelta, frecuencia semanal/quincenal, cupo y sede. Se conserva la ubicación si no fue editada.
- Detalle con Resumen, Fechas o Cruces, Tabla en ligas, Equipos y Datos. Gestión sólo para el organizador. Resumen contextual de mi equipo, posición o avance, próximo partido, progreso y campeón.
- Partidos con camisetas reales, marcador confirmado o en vivo, sede, horario y acceso al detalle existente. Se puede programar cada encuentro sin inventar fechas para las siguientes rondas.
- Planteles desplegables con foto, nombre, dorsal, condición y OVR; acceso al perfil. Los perfiles se suscriben al desplegar el plantel.
- Datos individuales de goles, asistencias y tarjetas exclusivamente en partidos finalizados con autor registrado; no duplica el resumen legado y no atribuye goles en contra al goleador.
- Se mantienen tipografía legible, componentes, fondos tonales y colores semánticos de Game/Claro. Sin glow ni badges decorativos para repetir estados. Pestañas desplazables, acciones en Wrap y pie de formulario accesible con teclado y texto ampliado.

## Operación deportiva

`manageCompetition` concentra creación, configuración, postulaciones, revisión, sorteo, programación, resultados, cierre, archivo y eliminación de borradores. La autorización y los cupos se validan en transacciones del servidor.

Las copas admiten 2, 4, 8, 16 o 32 equipos. Sorteo libre o cabezas por OVR calculado desde perfiles; separa los dos equipos mejor clasificados en mitades distintas. La primera ronda genera partidos reales. Cada cruce siguiente crea un único partido cuando ambos clasificados están definidos. El cierre avanza la llave y la final declara al campeón. Un empate requiere ganador por penales, sin sumar los penales al marcador.

Las ligas admiten hasta 16 equipos, ida o ida/vuelta y descanso si son impares. El inicio genera partidos reales con planteles actuales y sede configurada. La tabla usa puntos configurados, diferencia de gol y goles a favor. El organizador cierra cuando no quedan encuentros pendientes; si persiste igualdad en todos los criterios, debe confirmar al ganador del desempate deportivo.

`syncCompetitionResult` escucha el cierre de partidos de copa/liga, incluido Dirigir y evaluación posterior. Recalcula posiciones o avanza la llave de forma idempotente. Un conflicto de resultados no reemplaza al clasificado ya confirmado. La carga manual cierra el encuentro y crea asignaciones/notificaciones de evaluación en la misma transacción. Reintentar un resultado ya confirmado no lo modifica. El registro en vivo rechaza eventos después del cierre y evita goles perdidos o duplicados por concurrencia.

## Inscripciones y compatibilidad

El administrador de un equipo puede postularlo a un torneo público con cupo y retirar su solicitud pendiente. El organizador aprueba, rechaza o revoca antes del inicio. Los equipos externos conservan su grupo. Las reglas de Firestore limitan las solicitudes al solicitante y organizador.

Se conservan los campos y alias históricos de tabla y llave, los IDs de partidos ya enlazados y las camisetas. Los planteles globales se consultan en lotes, sin el límite previo de diez equipos. Los equipos embebidos antiguos también se leen. Las inscripciones externas de la web se muestran al organizador y su aprobación exige vincular explícitamente un equipo que administre, con jugadores reales.

Archivar conserva el historial y admite restauración. Eliminar sólo funciona para borradores sin partidos ni llave; limpia sus solicitudes y subcolecciones conocidas, sin borrar equipos globales. Los torneos en juego conservan sus resultados finales.

## Validación

- Análisis Flutter: cero errores y advertencias; 36 avisos informativos de estilo pendientes.
- Suite Flutter completa: 302 pruebas aprobadas, incluidas referencias visuales de lista, creación y detalle en ambos temas.
- Recorridos de todas las pestañas en 320 px con texto al 130 %, ambos temas y ambos tipos de torneo; permisos de organizador/espectador y error recuperable del formulario.
- Pruebas unitarias del motor: tamaños de copa, cabezas por nivel, empates, metadatos, resultados inválidos y tabla con puntos configurables.
- Firestore Emulator: copa completa hasta campeón, concurrencia, evaluaciones únicas, inmutabilidad, inscripciones y cupos, autorización, registros externos, calendario, cierre de liga empatada, limpieza de borrador y compatibilidad de planteles legados. Pruebas de privacidad y ciclo de partidos existentes también aprobadas.
- Sin creación, cierre ni eliminación de torneos reales para las pruebas automatizadas.

## Alcance y límites

No se implementaron patrocinadores, árbitros, streaming ni un editor completo de reglamentos. Las estadísticas dependen de los eventos individuales registrados; un marcador manual no inventa goleadores. No se migra automáticamente un cruce histórico sin partido ni se modifica un resultado confirmado. Las copas exigen potencias de dos; no se generan pases libres.

La búsqueda de lista filtra los documentos ya cargados; no se presenta como buscador global del servidor. Las inscripciones externas sin plantel verificable necesitan vinculación del organizador antes de disputar partidos nativos.

## Publicación del servidor

Firebase CLI confirmó en `mil-disculpis` la creación de `manageCompetition` y `syncCompetitionResult`, la actualización de `recordLiveEvent` y `startLeagueTournament`, y la publicación de reglas de Firestore. La sincronización de resultados usa reintentos del proveedor y operaciones idempotentes. Los últimos ajustes de restauración/archivo y reintentos del resultado final también fueron publicados. No se requirió iniciar sesión de nuevo en el navegador.

## Verificación en Android y datos para probar

APK release 1.0.31+32 compilado e instalado con `adb install -r` en `emulator-5554`, conservando la sesión de Briseida. Se verificaron listado, liga histórica, copa histórica y nueva copa con datos reales. Un enlace antiguo a un partido eliminado ahora conserva el resultado y comunica que el partido no está disponible, en lugar de abrir una pantalla vacía.

Por autorización expresa del usuario, se creó e inició **Copa patea del grupo** en el grupo Fútbol, con **Huracán Buceo y Mezcla Gruesa**. Se descartaron para esta copa los planteles de prueba o que compartían jugadores. Antes del inicio se quitaron únicamente dos referencias huérfanas a perfiles ya inexistentes, una por equipo, tras guardar copia local de los documentos. No se borraron equipos ni torneos. Cada lado conserva cuatro jugadores válidos. La final tiene un partido real de ocho jugadores, por programar y sin resultado inventado; queda abierta la pestaña Cruces para revisión.

Copa: `cup_qrVOXyawztZBtTg7i6md6Opbt5H2_61f2aaa3-4117-4773-9d4f-a9d68c66f1dc`. Partido: `OOrz025WgD5ga5LkaKOu`.

SHA-256 del APK instalado: `5f5d35c7ec36d396a2e07f4586af0bc3dd514ae49b5509c2e80e3dfdee588212`.
