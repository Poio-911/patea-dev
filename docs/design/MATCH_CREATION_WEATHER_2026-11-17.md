# Clima al crear un partido

El paso de lugar y horario conserva un bloque visible de clima en Game y Claro. Antes se ocultaba hasta seleccionar una dirección y los fallos quedaban como una ausencia genérica de pronóstico.

## Estados

- Sin cancha: pide elegir una dirección de las sugerencias para disponer de coordenadas.
- Sin fecha u hora: pide completar el horario.
- Consultar al grupo: explica que se requiere confirmar cancha y horario.
- Consultando: muestra carga mientras obtiene el pronóstico.
- Disponible: temperatura, descripción, probabilidad de lluvia y viento para la cancha y la hora elegidas, con atribución a Open-Meteo.
- Fecha fuera del horizonte: informa que el pronóstico se consulta más cerca del encuentro; no inventa datos.
- Error: permite Reintentar clima.

Cambiar dirección, fecha, hora o modo invalida el resultado anterior. Una respuesta atrasada no puede volver a mostrar el clima de una selección que ya cambió. El pronóstico disponible sigue incluido al crear el partido; no se bloquea la creación por un fallo meteorológico.

Referencia del horizonte de consulta: [Open-Meteo Forecast API](https://open-meteo.com/en/docs), hasta 16 días incluyendo el actual.

## Validación

- Consulta real a Open-Meteo para Montevideo y el día siguiente: respuesta con 24 horas y temperatura disponible.
- `flutter test --no-pub test/create_match_experience_test.dart`: 10 pruebas aprobadas, incluyendo Game y Claro, error/reintento y descarte de respuesta atrasada.
- Análisis de pantalla y pruebas: sin observaciones.
