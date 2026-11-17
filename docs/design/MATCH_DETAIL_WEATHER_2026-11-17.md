# Clima para jugar: detalle del partido

## Presentación

El acceso al clima está integrado dentro de la portada, debajo de la ubicación: icono animado pequeño, temperatura, lluvia y viento, sin tarjeta independiente. Al tocar la línea abre una hoja inferior desplazable con temperatura, condición, sensación térmica, probabilidad de lluvia, viento e índice UV para la hora de inicio. Open-Meteo y hora de actualización aparecen al pie. La consulta manual está en Actualizar clima dentro de la hoja.

La hoja utiliza una única superficie: título, actualizar, pronóstico y métricas van directamente sobre el fondo, sin una tarjeta anidada. Mantiene el gesto de arrastre para cerrar y ajusta la altura al contenido hasta el máximo desplazable.

Sol con rotación lenta, nubes con desplazamiento leve y precipitación localizada dentro del icono. La tormenta no usa destellos ni glow. El movimiento respeta reducir animaciones, TickerMode y el ciclo de vida de la app.

Un aviso importante permanece visible en la portada como título y Ver aviso. En la hoja, la advertencia de mayor prioridad se presenta completa; si coinciden varias condiciones, sus títulos se presentan en También y se pueden desplegar sus recomendaciones. La información rutinaria queda dentro de la hoja.

Sin horario confirmado, la portada muestra únicamente Clima al confirmar horario. Los demás estados pendientes o de error también se resumen en una línea; al tocarla se explica el motivo y se ofrece reintentar cuando corresponda. El clima histórico guardado se identifica como registrado.

## Consulta y estados

- Consulta por coordenadas de la cancha, día y hora de inicio. El servicio comprueba la hora devuelta; no utiliza otra hora como sustituto.
- Resultado reutilizable durante 15 minutos. Cambiar cancha o horario utiliza una consulta distinta.
- Al regresar a la vista o al primer plano se renueva un resultado vencido. La actualización manual invalida la consulta.
- Sin horario o coordenadas se indica qué falta; para fechas fuera del horizonte se pide volver más cerca del encuentro.
- Un fallo permite reintentar. Los campos no informados se muestran como Sin dato; no se interpretan como valores cero para advertencias.
- Para partidos terminados sólo se presenta el clima guardado, si existe, identificado como histórico y sin advertencias actuales.
- No se modifican documentos de partidos ni se envían notificaciones push. Son avisos dentro del detalle.

## Criterios

Las condiciones se acumulan, ordenadas por prioridad:

1. Tormenta: códigos meteorológicos 95, 96 o 99, o icono de tormenta compatible. Se recomienda revisar la realización y buscar refugio cerrado si se escuchan truenos. Una alta probabilidad de lluvia no se interpreta como tormenta.
2. UV: protección desde 3; alto desde 6, muy alto desde 8 y extremo desde 11. Se usa el índice sin redondear para clasificar.
3. Calor: temperatura desde 30 °C o sensación térmica desde 32 °C. Es un umbral orientativo de producto para sugerir agua, pausas y revisar el horario, no una alerta oficial de calor.
4. Viento: desde 30 km/h, aviso orientativo para revisar las condiciones de la cancha.
5. Lluvia: desde 60% de probabilidad, recordatorio sobre piso y confirmación de cancha.

Los avisos se identifican como riesgos previstos y no reemplazan avisos meteorológicos oficiales. Se refieren al inicio del partido; no constituyen vigilancia de rayos ni un pronóstico agregado de toda su duración.

Referencias: [Open-Meteo](https://open-meteo.com/en/docs), [OMS: índice UV](https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-%28UV%29-INDEX), [NWS: seguridad de actividades deportivas ante rayos](https://www.weather.gov/safety/lightning-sports).

## Revisión y validación

- Commit `4947215b`: incorporado en `feat/flutter-mobile-app`; mejora de contraste y legibilidad de MANUAL, sin modificar lógica de jugadores. 19 pruebas existentes de fichas aprobadas en la revisión.
- Pruebas del clima, creación e integración del detalle: riesgos combinados y prioridades, límites UV sin redondear, datos faltantes, error/reintento, caché por consulta, fechas sin alcance e historial; lectura a escala 2x y Game/Claro; animación que pausa y retoma con el ciclo de vida.
- Capturas de demostración del bloque: `patea_mobile/build/weather-review`, generadas con `--dart-define=CAPTURE_MATCH_WEATHER=true`. No representan el tiempo meteorológico real ni modifican la base de datos.
- Análisis estático de los archivos afectados sin observaciones.
- Integración compacta: pruebas en Game/Claro de altura del resumen, apertura y cierre de la hoja, acceso a actualización, aviso importante visible a escala 2x y planificación sin consulta de red. 27 pruebas del clima y del detalle aprobadas.
