# Estado Actual de la App (2026-03-10)

## Resumen Ejecutivo

La app está funcional y madura en su core (players, matches, competitions, groups, social), pero con foco actual en consolidación arquitectónica:

- Menos mutaciones directas en cliente.
- Mayor uso de Server Actions para operaciones críticas.
- Alineación de UX con features realmente operativas.

## Feature Operational Status

| Feature | Estado | Fuente técnica |
|---|---|---|
| Payments (Mercado Pago) | OFF | src/lib/actions/payment-actions.ts + src/lib/feature-availability.ts |
| AI Image Generation | OFF | src/lib/actions/image-generation.ts + src/lib/feature-availability.ts |
| Match Invitations Accept/Reject | ON | src/lib/actions/match-invitation-actions.ts |
| Notifications mark-all-read | ON | src/lib/actions/notification-actions.ts |
| Evaluation Submissions | ON | src/lib/actions/evaluation-actions.ts |
| Competitions team participation (>10 teams) | ON (batch/chunk) | src/hooks/use-competitions-data.ts |

## Delta técnico aplicado hoy

1. P2-01: invitaciones aceptar/rechazar migradas a Server Actions.
2. P2-02: mark all notifications as read migrado a Server Action.
3. P2-03: alta de evaluationSubmissions migrada a Server Action.
4. P2-04: consultas por participación de equipos en leagues/cups con chunking (sin truncar a 10).
5. P2-05 (avance): extraídas implementaciones reales de acciones de competiciones a competitions-actions.ts y server-actions.ts quedó delegando esas funciones.

## Riesgos abiertos

1. server-actions.ts sigue concentrando demasiadas responsabilidades.
2. Falta extraer gradualmente acciones por bounded context (matches, players, social).
3. Falta ampliar smoke tests automáticos para cubrir las migraciones de mutaciones.

## Próximos pasos sugeridos

1. Extraer bloques de competencias desde server-actions.ts a competitions-actions.ts (no solo facade).
2. Extraer bloque de matches a matches-actions.ts.
3. Agregar smoke tests para:
   - invitaciones aceptar/rechazar,
   - evaluaciones submit,
   - notificaciones mark-all-read,
   - competiciones con >10 equipos.
