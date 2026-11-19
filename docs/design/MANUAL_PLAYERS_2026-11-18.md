# Jugadores sin cuenta: plantel, evaluación y recuperación

18 de noviembre de 2026 · Rama `feat/flutter-mobile-app` · Android 1.0.38+39.

## Experiencia

- Se elimina el chip oscuro «Manual» que tapaba la fotografía. «Sin cuenta» pasa a texto secundario bajo la posición, dentro del espacio que ya comparte con el OVR. No agrega altura a la carta.
- «Sumar al plantel» prioriza nombre y posición. Contacto y seis atributos se despliegan por separado. Sin cápsula de OVR, glow ni seis cajas de sliders siempre visibles. Cancha y Claro usan sus tokens existentes.
- En el detalle, sólo el creador de un perfil sin cuenta y no archivado ve «Editar jugador» y «Quitar del plantel».
- Nombre, posición y contacto se pueden editar. Cuando ya existe progresión, el servidor conserva atributos, OVR y estadísticas ganados; no se reinician al editar la identidad.
- Quitar del plantel archiva el documento y elimina su contacto de recuperación y sus membresías en equipos. Conserva partidos, evaluaciones y estadísticas. Requiere retirarlo primero de convocatorias pendientes/en vivo.

## Registro y recuperación

1. El creador puede guardar un correo y/o teléfono. Correo normalizado en minúsculas; teléfono internacional E.164, por ejemplo `+59899123456`.
2. El contacto se guarda exclusivamente en `manualPlayerContacts/{playerId}`. Todas las lecturas/escrituras cliente están denegadas. Sólo la callable del creador devuelve el contacto, y la búsqueda de candidatos no lo revela.
3. Al ingresar o volver de verificar el correo, la app busca coincidencias con el usuario **obtenido por Firebase Admin Auth**. Nunca acepta como prueba un contacto enviado en el cuerpo de la solicitud ni un correo no verificado.
4. La cuenta ve «Tu lugar en el equipo» y confirma «Sí, soy yo» sobre un perfil concreto. Puede posponerlo. También puede reintentar desde su perfil → «Recuperar historial sin cuenta», enviar verificación de correo y actualizar la búsqueda.
5. La transacción traslada el jugador al ID de la cuenta, manteniendo estadísticas, nivel y foto. Actualiza referencias en partidos y eventos, asignaciones, submissions procesadas, evaluaciones y equipos; copia `ovrHistory`; agrega la cuenta al grupo como miembro sin elevar permisos. Conserva el documento original como redirección de enlaces existentes.
6. Tras confirmar, el creador pierde la edición. Dos reclamos concurrentes no generan dos propietarios. Reintentar un reclamo ya confirmado es idempotente.

### Límites deliberados

- No se unen automáticamente dos carreras: una cuenta con partidos, evaluaciones, progresión o una recuperación anterior debe resolver su caso de forma asistida.
- Se bloquea la recuperación durante un partido en vivo o mientras se procesan evaluaciones. Se puede reintentar después.
- Migración atómica acotada: máximo 150 partidos consultados y 400 escrituras presupuestadas. Un historial mayor se rechaza sin escrituras parciales; requiere migración asistida.
- El teléfono sólo sirve como prueba cuando está verificado y vinculado a **Firebase Auth**. El acceso móvil actual sigue siendo por correo/Google; guardar un teléfono no implementa por sí solo un nuevo registro por SMS.
- Perfiles previos sin contacto no se adjudican por nombre: el creador debe editar y guardar un contacto correcto.
- Los partidos y reseñas históricas muestran los snapshots que ya guardaban; editar el nombre actual no reescribe textos de crónicas ni nombres históricos.

## Evaluaciones

Los participantes sin cuenta reciben evaluaciones de cuentas registradas, con la misma progresión y registro de OVR. Nunca se les asigna enviar evaluaciones ni se les manda una notificación imposible de atender. Se mantienen las dos primeras asignaciones por evaluador y se distribuyen sujetos aún sin cubrir entre cuentas disponibles, evitando autoevaluaciones adicionales. Si no hay ninguna cuenta participante, no se inventan evaluadores humanos.

La pestaña de progresión también aparece para jugadores sin cuenta con partidos registrados. Recuperar el perfil conserva los IDs de las evaluaciones y la privacidad de sus autores.

## Comprobación

- Tests de normalización, validación, propiedad, contacto verificado, sustitución de referencias y cobertura de evaluaciones.
- Firestore local: creación/edición/borrado con permisos; preservación del nivel ganado; recuperación completa e idempotente; exclusión de historiales incompatibles; bloqueo en vivo/submissions; dos reclamos simultáneos.
- Reglas reales cargadas en emulador: ningún cliente puede leer, listar ni escribir contactos, incluido el creador; gestión únicamente mediante callable autenticada.
- Flutter: validación de correo y desplazamiento del formulario con texto 1,2× en Cancha/Claro; goldens revisados. Regresión de player cards, atributos máximos y efectos OVR.

## Archivos principales

- `patea_mobile/lib/features/players/create_player_dialog.dart`
- `patea_mobile/lib/features/players/manual_player_recovery.dart`
- `patea_mobile/lib/features/players/player_detail_screen.dart`
- `functions/src/callable/manual-player-management.ts`
- `functions/src/lib/manual-players.ts`
- `functions/src/callable/match-lifecycle.ts`
- `firestore.rules`
