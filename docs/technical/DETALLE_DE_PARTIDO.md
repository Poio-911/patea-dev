# El detalle de partido en la app móvil

Qué se cambió, por qué, y qué quedó sin resolver. El archivo es
`patea_mobile/lib/features/matches/match_detail_screen.dart` más
`widgets/match_story_view.dart`.

## Cómo estaba

La pantalla era una columna de rectángulos `#181F2B` con radio 16: hero,
equipos, acciones y chat, todos iguales. Nada pesaba más que nada. Encima el
`Scaffold` no era transparente, así que tapaba el fondo de cancha que el router
sí monta, y la pantalla entera se leía gris y plana.

Pero lo peor no era estético.

## Los datos que estaban mal

**El `0 - 0` del hero era dato ausente, no un empate.** `finalScore` lo escribe
recién la finalización de evaluaciones (`functions/src/callable/evaluations.ts`,
en la transacción que pasa el partido a `evaluated`). `finishMatch` no escribe
ningún resultado. En la base hay 33 partidos terminados: **32 están en
`completed` y uno solo en `evaluated`**, así que prácticamente todos mostraban
un empate que nunca ocurrió. Los partidos viejos, creados desde la web, sí
tienen marcador (6-7, 5-1, 10-15); los terminados desde el móvil, ninguno.

El modelo ahora expone `MatchModel.hasFinalScore`, que distingue "no hay
resultado" de un 0-0 real — que existe, hay dos en la base. Sin ese campo no se
puede: el parseo copia `finalScore` a `teamA.score`/`teamB.score`, que por
defecto valen 0.

> **Pendiente de producto, no de código:** mientras `finishMatch` no cargue un
> resultado, ningún partido va a tener marcador hasta que *todos* evalúen. Eso
> pasó una vez en 33. Habría que decidir si el organizador carga el resultado al
> finalizar.

Además había cosas que sobraban o faltaban según el estado: "Cómo llegar" como
botón principal de un partido ya jugado, el clima —un pronóstico viejo— y
ningún indicador de que el partido había terminado.

## Lo que no se contaba

`MatchTimeline`, `MatchClipsView` y `LiveStatsPanel` ya existen y viven **sólo**
en la pantalla en vivo. El detalle de un partido terminado no muestra un solo
evento: hay que salir por el botón "Minuto a minuto". Sigue así.

`MatchStoryView` —figura, planilla, crónica, voces— se insertaba como `Column`
suelta entre dos tarjetas, sin contenedor, y el aviso de "cuando todos evalúen"
quedaba flotando como si fuera un error.

## Qué se hizo

### Que cada bloque se vea distinto

Se leyeron los componentes reales de la web antes de tocar nada
(`src/components/match-details/`). El hallazgo que ordenó todo: **en la web no
todo es una tarjeta**. `MatchTeams` y `MatchManagementActions` son bloques
sueltos sin caja; `PlayersConfirmed` sí es `Card`; e `IntegratedMatchStory` es
otra cosa entera. Esa diferencia es la jerarquía que en el móvil se había
perdido.

| Bloque | Tratamiento | De dónde sale |
| --- | --- | --- |
| Banner | Foto de cancha a todo el ancho, sin caja | `MatchInfoCard` |
| Relato | Revista: serif, textura de papel, capitular | `IntegratedMatchStory` |
| Equipos | Sin tarjeta, marca de agua del nombre, mosaico | `MatchTeams` |
| Acciones | Sin tarjeta, título y botones sueltos | `MatchManagementActions` |
| Jugadores / Chat | Tarjeta translúcida | `PlayersConfirmed` |

### La revista

Es el único contenido de la app que se lee como texto largo y no como interfaz,
y por eso se ve distinto a propósito: hoja propia con tramado de puntos, titular
serif entre comillas, filete ornamental raya-rombo-raya, marcador en negativo
—el único bloque claro de la pantalla—, la figura como medalla colgada del
borde, capitular en el cuerpo, planilla partida en Goles y Asistencias, y las
voces del vestuario como recortes que se pasan de costado con una comilla
gigante de fondo.

**Se reconstruyó con primitivas de Flutter, no se transliteró la web.** Donde el
original no se traduce, se resolvió distinto:

- La textura de papel y las scanlines son `CustomPainter`, no un SVG repetido.
- La marca de agua se inclina con `Matrix4.skewX`: Anton no trae itálica y
  Flutter no la sintetiza (la web usa `italic` de CSS).
- La capitular es una versal alta con `WidgetSpan`. Flutter no sabe hacer que el
  texto rodee un elemento flotado, así que en vez de fingir un
  `first-letter:float-left` se usa el recurso editorial que sí existe.
- Las voces son un `ListView` horizontal, no un componente carrusel con flechas.
- Los avatares usan el `PlayerAvatarFallback` del proyecto.

El relato **sólo se monta si el partido está `evaluated` o ya tiene crónica**.
Antes salía en cualquier partido `completed`, vacío, avisando que había que
esperar: ocupaba el mejor lugar de la pantalla para no decir nada.

### Tipografía

Tres familias condensadas evaluadas, dos adoptadas:

| Estilo | Familia | Para qué |
| --- | --- | --- |
| `AppTypography.jersey()` | Anton | Marcador, nombres de equipo, marca de agua |
| `AppTypography.condensed()` | Barlow Condensed | Nombres de jugadores, encabezados de planilla |
| `AppTypography.editorial()` | Lora | Sólo el relato |

**Oswald quedó afuera a propósito:** está justo entre Anton y Barlow Condensed y
sumarla era un tercer peso que no resolvía nada nuevo.

Anton tiene un solo peso y es angosta y maciza —la letra de la espalda de una
camiseta— así que va sólo en piezas grandes: en tamaño chico se empasta. Barlow
Condensed cubre lo demás: en dos columnas angostas entra el nombre entero donde
Space Grotesk cortaba con puntos suspensivos.

## Verificación

- `flutter analyze` limpio; los 25 tests pasan.
- El estado sin crónica, los equipos y las acciones se revisaron corriendo en el
  emulador.
- La revista completa se revisó con **datos reales**: el único partido con
  crónica de la base es `sSTA1Tgv9pj18TJhUkWO` ("Equipo 1-1 vs 19 de Abril",
  grupo *Liga de los Martes*, de `tester_1@test.com`). Además quedó cubierta por
  `test/match_story_view_test.dart`, que la arma con ese contenido —2138
  caracteres de relato y 9 voces— y falla si algo desborda. Los largos reales
  son justamente lo que rompe layouts.

## Lo que quedó sin cerrar

**El banner de arriba no convence y quedó a mitad de camino.** Se probaron tres
formas —tarjeta con foto tenue, tarjeta con scanlines, y una foto a todo el
ancho anclada abajo— y ninguna gustó. En la última pasada se sacaron, a pedido,
la barra de color del tipo de partido y los badges de estado
(TERMINADO/EVALUADO): la idea de codificar el estado con color y píldoras está
descartada. El código quedó en esa última versión, sin dar por buena la
solución; el indicador de "EN VIVO" sobrevive como texto, no como píldora,
porque es información y no decoración.

Lo demás pendiente:

- Traer el timeline de eventos al detalle en vez de mandar a otra pantalla.
- Que el roster muestre goles y asistencias por jugador en un partido terminado.
- Aplicar el arreglo del `Scaffold` transparente a las otras pantallas que
  todavía tapan el fondo: competiciones, cup bracket, formulario de evaluación,
  crear equipo, grupos, crear partido, evaluar partido, leaderboard y feed.
