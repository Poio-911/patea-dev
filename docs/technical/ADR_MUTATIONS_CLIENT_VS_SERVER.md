# ADR: Mutaciones Cliente vs Server Actions

- Fecha: 2026-03-10
- Estado: Aprobado (provisional)
- Contexto: Reducir inconsistencias y riesgos de seguridad/reglas al escribir en Firestore desde páginas de cliente.

## Decisión

1. Todas las mutaciones de negocio críticas deben ejecutarse en Server Actions.
2. El cliente solo orquesta UX (formularios, loading, toasts, navegación).
3. Escrituras directas cliente quedan limitadas a casos no críticos y temporales, con justificación explícita en PR.

## Qué se considera mutación crítica

- Cambios de estado de invitaciones, partidos o competiciones.
- Escrituras que afectan scoring, estadísticas, OVR o evaluaciones.
- Operaciones con impacto económico o de créditos.
- Acciones que dependan de permisos/ownership y validaciones de negocio.

## Patrón estándar

1. Página cliente llama Server Action.
2. Server Action valida autenticación (requireAuth/getServerSession).
3. Server Action valida ownership/estado.
4. Server Action escribe en Firestore (idealmente transacción para estado compartido).
5. Server Action devuelve resultado serializable y mensaje de error controlado.

## Excepciones permitidas

- Prototipos internos no productivos.
- Eventos locales de UI sin persistencia.
- Migraciones puntuales con deuda explicitada y ticket de seguimiento.

## Checklist de PR

- [ ] ¿La mutación vive en Server Action?
- [ ] ¿Valida auth y ownership?
- [ ] ¿Evita condiciones de carrera (transaction/batch según caso)?
- [ ] ¿Devuelve errores legibles para usuario?
- [ ] ¿Incluye cobertura de smoke test o caso manual documentado?

## Consecuencias

- Pros: consistencia, seguridad y mantenibilidad.
- Contras: algo más de boilerplate inicial en actions.
- Mitigación: módulos por dominio (competitions-actions, matches-actions, etc.) y helpers compartidos.
