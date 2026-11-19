# Fase 2: cierre de implementación

Fecha: 19/11/2026. Rama: `feat/flutter-mobile-app`.

## Funcionalidad

- Tus rivales en la ficha del equipo y en Buscar rival, con pantalla completa, favoritos, olvidados paginados, restauración y deshacer.
- Revancha abre una propuesta editable: nunca envía un desafío sin confirmar. Los encuentros acordados y las invitaciones pendientes tienen estados propios.
- Historial bilateral con victorias, empates, derrotas, goles y últimos cinco resultados; cada resultado permite abrir su partido. La serie también aparece en el detalle del encuentro.
- Nombres y camisetas se consultan en vivo. Si desaparece el equipo rival, se conserva su historial y último nombre conocido.
- Los miembros del grupo pueden consultar; creador, dueño, administradores y moderadores gestionan. Ninguna colección interna es accesible directamente desde clientes.
- Guardado automático de ambos lados al aceptar; guardado manual unilateral desde una búsqueda explícita. No se muestran equipos desconocidos al entrar al buscador.
- Solo amistosos intergrupo: quedan fuera partidos internos, copas y ligas.

## Decisiones definitivas respecto del plan original

Se aceptaron las cinco recomendaciones del plan. Los siguientes ajustes prevalecen sobre sus ejemplos de código y esquema:

1. Los identificadores son hashes de pares de IDs, con dirección para el registro de cada equipo. Cada lado del partido nuevo lleva `teamId`: la identidad no depende del nombre o del plantel actual. Se mantiene el contrato histórico de arrays paralelos para datos web anteriores.
2. `teamRivalResults/{matchId}` es un registro permanente de resultados. La idempotencia no depende de recordar solo 50 IDs. Una corrección descuenta el resultado previo y aplica el nuevo dentro de la misma transacción.
3. Nunca se inventa un 0–0 ante marcadores históricos ausentes: esos partidos se omiten hasta que exista un resultado válido. Los partidos nuevos empiezan con marcador explícito cero.
4. El límite es de 100 rivales visibles. Se oculta el menos reciente que no sea favorito, sin borrar estadísticas. Si los 100 son favoritos, el rival aceptado se conserva oculto. Guardar o restaurar manualmente informa que primero hay que liberar un lugar.
5. Los documentos de coordinación `teamRivalTeams`, `teamRivalPairs` y `teamChallengeLimits` serializan escrituras concurrentes. Máximo 10 desafíos pendientes y 20 enviados en 24 horas; se impiden desafíos simultáneos inversos y duplicados con partido pendiente.
6. El backfill usa el mismo registro permanente y reconstruye contadores sin sobrescribir favoritos u ocultos. Puede repetirse y convivir con el trigger de resultados.

## Planteles vivos

La sincronización está aislada en `functions/src/lib/live-team-rosters.ts`. Antes de empezar, los cambios de integrantes actualizan el partido pendiente. No modifica encuentros activos ni con eventos. Planteles vacíos, duplicados o perfiles inexistentes mantienen el último plantel válido y generan una advertencia para los capitanes.

El inicio mediante `startMatch` vuelve a leer y congela el plantel en la misma transacción que activa el partido. El inicio directo desde la web conserva su flujo anterior; no se modificó ese cliente ni se garantiza la misma atomicidad para esa escritura directa. Los cierres desde web sí quedan cubiertos por el trigger sobre `matches`.

## Verificación

- Backend de rivales, desafíos y emulador: 28 pruebas aprobadas.
- Flutter: 6 pruebas nuevas de modelos, permisos, acciones, revancha y capturas en ambos temas; 45 pruebas existentes de desafíos, equipos y grupos aprobadas.
- Capturas verificadas en ambos temas y ancho reducido con texto ampliado. Capturas de detalle de equipo actualizadas.
- Analizador de los cuatro archivos nuevos/principales: sin incidencias.
- Suite backend completa: 139 de 140 aprobadas. El fallo restante pertenece a privacidad de evaluaciones, archivo modificado por la sesión concurrente de audio.
- Suite Flutter completa: 547 de 548 aprobadas. El fallo restante es el control de colores de la pantalla de evaluación modificada por esa misma sesión. Esos cambios no forman parte de este commit.

## Operación

Proyecto Firebase: `mil-disculpis`. Reglas publicadas e índices verificados en estado READY. Las 13 funciones seleccionadas se publicaron correctamente. Se usó selección explícita para no desplegar las evaluaciones en curso. No se eliminan índices adicionales existentes.

La simulación y ejecución del backfill en producción encontraron cero partidos intergrupo históricos: no hay resultados anteriores que reconstruir. Script: `scripts/backfill-team-rivals.ts`; simulación por defecto y escritura solo con `--apply`.

Colecciones internas nuevas: `teamRivals`, `teamRivalResults`, `teamRivalPairs`, `teamRivalTeams`, `teamChallengeLimits`. Todas cerradas al SDK cliente. Índices versionados en `firestore.indexes.json`.

Para revertir, ocultar las entradas móviles y retirar los nuevos callables/triggers; conservar el registro histórico y sus reglas cerradas. No borrar colecciones para revertir una interfaz. La nueva app no se compila ni distribuye en esta tarea.
