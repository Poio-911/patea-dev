# Explorar: encontrar jugadores y partidos

Rama: `feat/flutter-mobile-app`. Android local: `1.0.24+25`.

## Recorrido de jugadores

- Pestañas con nombres directos: Jugadores y Partidos. Conservan su estado al alternar.
- Buscar jugadores funciona sin tener un partido propio. Usa la zona guardada; si no existe, muestra explícitamente Montevideo como zona inicial.
- La búsqueda permite cambiar dirección/ciudad, distancia (5, 15, 30 o 50 km) y posición. Cambiar la zona de búsqueda no modifica el domicilio ni la disponibilidad publicada.
- Elegir un partido aplica su ubicación, fecha, horario y exclusión de convocados. Solo aparecen partidos futuros propios con cupo; ser participante no habilita invitaciones. Se priorizan horarios compatibles y luego cercanía.
- Filas con avatar, nombre, posición, distancia, días publicados y OVR. El detalle conserva atributos y horarios.
- Publicar disponibilidad queda separado en una acción breve, conservando el editor existente.
- Invitar permite elegir un partido propio si no se seleccionó uno, revisar el destino y confirmar. Consulta invitaciones pendientes para evitar repetir una ya enviada. Si no hay partidos elegibles ofrece armar uno.
- Carga, error y lista vacía se distinguen. Reintentar y actualizar están disponibles. Las respuestas de búsquedas anteriores no reemplazan resultados recientes.

## Recorrido de partidos

- Filtros de zona/distancia, cualquier fecha/hoy/próximos siete días e ingreso directo/con aprobación.
- Fecha e ingreso se despliegan para no desplazar los resultados con controles extensos.
- Se excluyen partidos propios, vencidos y completos para nuevos participantes; los completos siguen visibles si el usuario ya participa o tiene una solicitud pendiente.
- Se muestran cupos, fecha, hora, cancha, distancia y condiciones de ingreso. Orden cronológico.
- Antes de solicitar o unirse hay una revisión con confirmación explícita. Cancelar no escribe datos.
- La tarjeta mantiene el estado pendiente o confirmado después de la acción y permite entrar al detalle.
- La consulta pública excluye fechas anteriores antes del límite de 50 documentos. La selección de partidos propios usa una consulta independiente de la de partidos donde solo se juega.

## Datos de prueba

Proyecto Firebase: `mil-disculpis`. Se agregaron 8 identidades sintéticas y 28 documentos nuevos: 8 perfiles, 8 usuarios, 8 disponibilidades y 4 partidos. Nombres identificados con `Prueba ·`, campos `isTestData` y `testScenario: explore-demo-2026-11-16`.

- Un partido privado de Briseida para buscar refuerzos.
- Tres públicos de Doroteo: amistoso con aprobación, colaborativo con ingreso directo y amistoso con un lugar libre.
- Los partidos usan ubicaciones ilustrativas de Montevideo y fechas del 17 al 19 de noviembre. No representan reservas reales.
- No se editaron partidos existentes. El partido privado solo convoca a su organizadora; los públicos solo al organizador y, en el de último lugar, perfiles sintéticos. No se enviaron invitaciones ni solicitudes durante la revisión manual.
- Las identidades sintéticas tienen direcciones `patea.invalid`, sin contraseña ni envío de correo.

Script: `scripts/seed-explore-demo.cjs`. Sin argumentos solo imprime el plan. `--apply` crea datos etiquetados y omite los ya existentes del mismo escenario; rechaza sobrescribir documentos ajenos. El token de gcloud se usa en memoria. El manifiesto `EXPLORE_DEMO_MANIFEST_2026-11-16.json` registra las rutas exactas creadas.

## Verificación

- Suite completa: 214 pruebas aprobadas. Diez específicas cubren fecha/hora, propiedad, cupos, distancia, búsquedas desordenadas, errores/reintentos, confirmaciones, cancelación, estados posteriores y texto al 130 % en ambos temas.
- Goldens de Explorar actualizados en Game y Claro; comprobación de escala 130 % aprobada.
- Análisis: sin errores ni advertencias; permanecen 28 observaciones informativas previas.
- APK release x64 compilado e instalado con reemplazo, conservando la sesión. Revisión manual con Briseida: 19 jugadores cercanos, selección del partido propio y tres partidos públicos de prueba; revisión de solicitud cancelada sin enviarla y entrada al detalle como visitante con la acción Pedir lugar y el chat restringido a participantes. Capturas en `patea_mobile/build/typography-review/explore-*`.

La capacidad final y los permisos siguen siendo responsabilidad de las funciones existentes. La comprobación móvil de invitaciones pendientes evita repeticiones habituales, pero no reemplaza una garantía transaccional entre dispositivos. Esta tarea no despliega funciones ni distribuye versiones.
