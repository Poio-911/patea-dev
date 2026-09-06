# Auditoría de estilos de la app móvil, y el plan del modo claro

Barrido de los 98 archivos Dart de `patea_mobile/lib` buscando errores,
incoherencias y cosas que deberían verse igual y no se ven igual. La segunda
parte es el plan del tema claro, que sale de lo encontrado en la primera: hoy
el modo claro no se puede hacer, y este documento explica exactamente por qué
y en qué orden se destraba.

Todos los números son medidos, no estimados. La referencia de la web es
`src/app/globals.css`.

---

# Estado

> **Cerrado el 2026-09-06.** Las seis fases están hechas, el modo claro se
> elige desde el menú de usuario, y no queda ninguna casilla abierta **del
> plan**. Lo que sigue queda como registro de qué se hizo y por qué — incluidas
> las **cinco** veces que el plan estaba equivocado y hubo que corregirlo con el
> código a la vista:
>
> 1. **La "isla oscura" no existía.** El comentario de `match-theme.ts` que la
>    sostenía describe una intención, no lo que el CSS hace. Se evitó
>    construir un widget de superficie que no hacía falta.
> 2. **El contador de `flutter analyze` no funciona** para lo deprecado dentro
>    del mismo paquete. Lo reemplaza un test trinquete, que además prohíbe que
>    el número suba.
> 3. **El movimiento reducido eran 9 archivos y era 1**: el framework ya
>    acorta las animaciones, y sólo deja afuera las que se repiten.
> 4. **Los `CustomPainter` eran cuatro y eran tres.**
> 5. **"Los goldens por pantalla necesitan un arnés por pantalla" era falso**,
>    y encima fue la excusa para cerrar el plan con un punto abierto. El arnés
>    es un archivo para las doce, y encontró ocho defectos reales: cinco
>    desbordes de layout —dos visibles hoy, a escala normal— y el texto negro
>    sobre la foto de cancha en tema claro.
>
> Y una del lado de la web: **su tema claro no llega a AA** en el botón
> primario (3,48:1). No se copió el defecto.
>
> **Números al cierre:** 1.402 `AppColors` → 0 · 224 radios en 18 valores → 5
> · 219 colores absolutos → 25 deliberados · 66 SnackBar → 3 tonos · 4 barras
> de pestañas → 1 · 3 avatares → 1 · 7 formateos de fecha → 1 · APK de 39 a
> 20 MB · **88 tests en verde**, 19 avisos `info` (los mismos de antes de
> empezar).
>
> **El defecto que le faltaba al tema claro.** El banner del próximo partido y
> la portada del detalle son una foto de cancha con un velo negro: son oscuros
> en los **dos** temas, pero pintaban su texto con `textPrimary`. En claro el
> título del partido salía casi negro sobre el césped. Es el defecto simétrico
> al de `textMuted`, y no lo veía ningún test porque el de contraste mide texto
> contra `card`, no contra una fotografía. Lo arreglan tres tokens nuevos
> —`onPhoto`, `onPhotoMuted`, `onPhotoLine`— que **valen lo mismo en los dos
> esquemas**: no describen el tema, describen la foto. Ojo con no confundirlos
> con las tarjetas de la lista de partidos, que también tienen foto abajo pero
> teñida con `card` al 65-95 %: ahí la superficie sí sigue al tema.
>
> **Trabajo posterior al cierre, con cosas abiertas:** ver
> *Reabierto el 2026-09-06* más abajo — el fondo del tema claro (decisión
> pendiente, andamio en el árbol) y la carta de jugador en claro (decisión
> tomada, código sin empezar).

---

# Reabierto el 2026-09-06 — dos frentes del tema claro

El plan de las seis fases está cerrado y no se reabre: lo de acá abajo es
trabajo **posterior**, encontrado mirando la app en el emulador y no leyendo
código. Son dos frentes del tema claro, con una decisión pendiente y una
decisión tomada sin implementar.

| Frente | Diagnóstico | Decisión | Código |
| --- | --- | --- | --- |
| 1 · Fondo del tema claro | cerrado | **pendiente** — elegir entre tres | andamio en el árbol |
| 2 · Carta de jugador en claro | cerrado | tomada — oscura en los dos temas | **hecho** |

## Frente 1 · El fondo del tema claro

Commits `883e3732` (el arreglo y las tres candidatas) y `4a35c600` (el
selector en el menú de usuario).

### El bug: el 5 % era 49 %

El degradado del fondo claro mezclaba una parada **translúcida** (el tinte al
5 %) con una **opaca** (el blanco del fondo). Toda la rampa entre las dos
arrastra alfa intermedia, así que a mitad de camino había medio azul opaco.
Medido sobre el golden, a 200 px de la esquina:

    RGBA(125, 173, 247, alpha 124/255)  →  #BED6FA sobre blanco

**49 % de azul arriba a la izquierda y 38 % de ámbar abajo a la derecha, donde
el código decía 5 %.** No era una cuestión de gusto: era un defecto de
composición.

La web tiene la misma estructura de paradas, pero estira el degradado a 400 %
de la pantalla y lo desliza, así que nunca muestra más que una tajada fina de
esa rampa. Nosotros la comprimimos entera en un viewport y la dejamos quieta.

### La regla que sale de ahí

> **Un degradado no mezcla paradas translúcidas con opacas.** O todas las
> paradas son opacas (pre-mezcladas contra el fondo con `Color.alphaBlend`), o
> el degradado se apoya sobre una base opaca y se desvanece hacia **el mismo
> color con alfa 0** — nunca hacia `Colors.transparent`, que es negro
> invisible: Flutter interpola sin premultiplicar y el medio de la rampa
> arrastra gris.

Vale para toda la app, no sólo para el fondo. Ver el Frente 2, donde el mismo
bug sigue vivo en seis sitios.

### Las tres candidatas

Arreglado, el 5 % es 5 %, y la desviación máxima respecto del blanco pasa de
**60 a 6** — casi blanco liso. Por eso van tres, detrás de un selector, para
elegir mirando el teléfono en vez de a ciegas:

| Variante | Desviación | Qué es |
| --- | --- | --- |
| `degradado` | 6 | el arreglado; prácticamente blanco |
| `mancha` | 12 | 2-3 manchas radiales suaves, disposición sorteada una vez por sesión (no animada: una pantalla completa repintándose siempre es batería que en la web no se paga) |
| `foto` | 14 | la misma foto del tema `game` en luma gris bajo un velo; deja **textura y no color** — el fondo queda `#EEEEEF` contra tarjetas `#FFFFFF`, que es la separación que hoy hace sólo el borde |

### El andamio, y qué se borra

`patea_mobile/lib/core/theme/fondo_claro.dart` **es andamio y lo dice en su
cabecera.** Cuando esté elegida la variante:

1. queda una sola implementación dentro de `PateaBackground`;
2. se borra `fondo_claro.dart` entero;
3. se borra el `SegmentedButton<FondoClaro>` de `patea_user_menu_sheet.dart`
   (marcado `ANDAMIO`, sólo en `kDebugMode` y sólo con el tema claro puesto);
4. se borra el `_SelectorDeFondo` de `design_gallery_screen.dart`;
5. se regeneran los goldens de las doce pantallas en claro.

### Riesgo conocido de la variante `foto`

La foto se sortea entre nueve. **No todas se comportan igual**: en una sesión
sale grano y en otra sale una figura reconocible —el poste y el banderín de
córner quedaron claramente legibles abajo a la derecha—. Si se elige `foto`,
hay que desenfocarla fuerte (`ImageFiltered`) para que las nueve den lo mismo.

Oferta hecha y sin responder: preparar la **foto desenfocada** y la **mancha un
escalón más marcada** (10-12 % en vez de 6-7 %) para una segunda vuelta de
comparación.

## Frente 2 · La carta de jugador en el tema claro

**Diagnóstico cerrado, decisión tomada, código sin empezar.**

La carta está diseñada como un objeto oscuro, y al tema claro se la tradujo
superficie por superficie. Siete defectos, medidos sobre
`test/goldens/pantalla_plantel_claro.png`:

1. **El nombre, el OVR y la posición llevan una sombra negra** (`Colors.black`
   α 0,8-0,9, blur 4-6). Esa sombra existe para separar texto **blanco** del
   fondo de la foto. Con texto casi negro (`textPrimary` = `#020817`) sobre
   blanco no separa nada: engorda el glifo con un halo gris. Lo feo no es el
   negro, es el negro **con halo negro**.
2. **El material del tier desaparece.** `shaders/card_foil.frag` pinta plata
   como `mix(#B8C4DB, blanco, sheen)` y oro como `mix(#FAC747, #FFF5CC, sheen)`,
   con α máxima ~0,05 en reposo. Pintar casi-blanco al 5 % sobre una carta
   blanca no mueve ni un canal: **bronce, plata, oro y élite se ven idénticos
   en claro.** El shader, las auras y los tiers —la razón de ser de la carta—
   sólo existen en `game`.
3. **La grilla de atributos no tiene contraste.** `overlaySubtle` (4 % negro)
   sobre blanco da `#F5F5F5`, y el borde de la caja usa **ese mismo token**
   (defecto de los dos temas, no sólo de claro). La barra: pista `#E2E2E2`,
   relleno `#D2D2D2` → **1,17:1**. Un 70/99 y un 40/99 se ven iguales.
4. **La pastilla de OVR de plata y de élite queda mal.** En claro
   `silverBorder` = `#737B8C` y `eliteBorder` = `#2D5286`: pastillas gris
   pizarra y azul marino con texto blanco, que leen como botón deshabilitado y
   no como metal. La de oro (`#E6A605`) es la única que funciona.
5. **La marca de agua de posición se vuelve más agresiva, no menos.** En claro
   `posDel` = `#F04242` (rojo puro) al 10 % sobre blanco: se ve el contorno del
   monigote cruzando la columna TIR/REG/FIS. En `game` es un pastel `#F47171`
   sobre carbón y desaparece bien.
6. **`PlayerAvatarFallback` usa su paleta clara** (`#B9DCD4` → `#7FBCAF`), así
   que la mitad superior es un pastel lavado y la inferior es blanco: la carta
   no tiene un solo punto de anclaje visual.
7. **Sigue vivo el bug de alfa del Frente 1**, en seis degradados de la carta:
   las cuatro auras por tier (`player_card_widget.dart:141,150,159,168`), la
   capa extra de élite (`:269`) y el brillo especular (`:369,375`) terminan en
   `Colors.transparent`. Sobre oscuro se disimula; sobre blanco ensucia.
   *(El otro `Colors.transparent`, el de `:308`, es legítimo: es la máscara de
   opacidad de un `ShaderMask`, no un color.)*

### La causa raíz

La carta no es una superficie de la app: **es un objeto.** Y la app ya tomó
esa decisión dos veces:

- las tarjetas de partido son oscuras en los dos temas, por decisión explícita
  de la web (`src/lib/match-theme.ts`: *"Cards are always dark — independent of
  the app theme"*);
- los tokens `onPhoto` / `onPhotoMuted` / `onPhotoLine` existen justamente
  porque hay superficies que **no describen el tema, describen el objeto**.

La carta de jugador es el tercer caso y quedó afuera.

> **Y ojo con el argumento "así lo hace la web".** En la web *todos* los
> overrides de `.player-card` están dentro de `.game` y `.nike`
> (`globals.css:151-183` y `:579-677`). En claro la web **no tiene carta
> diseñada**: tiene una `Card` de shadcn blanca con `h3 text-sm`. Copiar eso
> sería tirar el shader, las auras y los materiales.

### La decisión — 2026-09-06

**La carta se dibuja siempre con el esquema `game`, sea cual sea el tema de la
app.** No se re-abre.

Implementación prevista, mínima: un `Theme` que reemplaza la extensión
`PateaColors` por `PateaColors.game` alrededor de la carta. `context.c` adentro
resuelve al esquema oscuro y arrastra **gratis** a `CardFoil`, a
`PlayerAvatarFallback` (vuelven los diez duotonos oscuros) y a la marca de agua
de posición. Cero tokens nuevos, cero ediciones repartidas.

    Theme(
      data: Theme.of(context).copyWith(
        extensions: <ThemeExtension<dynamic>>[PateaColors.game],
      ),
      child: Builder(builder: _construirCarta),
    )

Cuidado al implementarlo: `build` hoy lee `context.c` **antes** de armar el
árbol (`posColor`, los colores por tier), así que hay que mover esas lecturas
adentro del `Builder` o no ven el esquema nuevo.

Toca las cinco pantallas que montan la carta: `players_list_screen.dart`,
`player_detail_screen.dart`, `match_detail_screen.dart`,
`edit_profile_screen.dart` y la galería.

### Lo que la decisión **no** arregla

Los defectos 3 y 7 son de la carta, no del tema: empeoran también en `game`,
sólo que ahí se disimulan. Quedan abiertos:

- los seis `Colors.transparent` de las auras y del especular;
- el borde de la caja de atributo, que usa el mismo token que su relleno;
- la barra de progreso a 1,17:1 (en `game` da 1,45:1 — tampoco alcanza).

## Lo que falta

- [ ] **Elegir la variante de fondo del tema claro** (`degradado` / `mancha` /
      `foto`), y borrar el andamio: `fondo_claro.dart`, el selector del menú de
      usuario y el de la galería. Regenerar los goldens en claro.
- [ ] Opcional, ofrecido y sin responder: preparar la **foto desenfocada** y la
      **mancha más marcada** para una segunda vuelta de comparación.
- [x] **Implementar la carta oscura en los dos temas** (decisión tomada
      arriba). Regenerar los goldens de `plantel`, `jugador_detalle` y
      `partido_detalle` en claro.
- [x] Los tres defectos de la carta que sobreviven a la decisión: los seis
      `Colors.transparent`, el borde de la caja de atributo, y el contraste de
      la barra de progreso.
- [ ] Pendiente viejo, de la pasada de diseño y no de este plan: el fondo de
      cancha debería verse desenfocado a través del `BackdropFilter` del
      `PateaTopHeader`. Hoy no se ve ese blur.

---

Se marca acá y se commitea con el nombre de la fase. Nada de tableros aparte: si
el commit no está, la fase no está.

Y hay dos medidores que no dependen de que alguien se acuerde de marcar:
`test/appcolors_ratchet_test.dart`, que cuenta los usos de `AppColors` y
**falla si el número sube**, y los **goldens**, que fallan si una pantalla
vuelve atrás.

> El plan decía que ese medidor iba a ser el contador de avisos de
> `flutter analyze`, marcando `AppColors` como `@Deprecated`. **No funciona**:
> en Dart 3.11 el analizador no reporta el uso de algo deprecado dentro del
> mismo paquete —ni con la clase anotada, ni con cada miembro, ni habilitando
> `deprecated_member_use_from_same_package`—. Se comprobó con un archivo que
> usaba `AppColors.background`: cero avisos. Por eso el contador es un test, y
> de paso hace algo que el analizador no haría: **prohíbe que suba**.

### Decisiones tomadas — 2026-09-05

Las tres estaban bloqueando fases. Dos tenían respuesta en el código y la
tercera es un criterio; quedan acá para no re-discutirlas.

**1 · Dos conceptos de volt, no tres.**

- **`primary`** — lo accionable y lo activo: relleno de botones primarios,
  pestaña activa, ítem seleccionado del menú, anillo de foco, switches,
  checkboxes, indicadores. En `game` vale `#CCFF33`; **en claro es el azul
  `#3C83F6`**, porque el volt sobre blanco da **1,17:1** y sencillamente no se
  ve.
- **`brandVolt`** — la identidad decorativa: glows, tintes, la barra del
  `PateaPageHeader`, el tinte del fondo. Siempre `#CCFF33`, y en claro casi no
  aparece.
- **Regla para repartir los 321:** si al sacar el color se pierde
  *información*, era `primary`; si sólo se pierde *carácter*, era `brandVolt`.
  Como atajo: los 63 usos con alpha son casi todos `brandVolt`, y los 42
  `backgroundColor` más los accesorios de control (`selectedColor`,
  `activeColor`, `checkmarkColor`, `indicatorColor`, `activeTrackColor`…) son
  casi todos `primary`.
- **El segundo neón no se porta.** Medido: `--game-accent-neon #aafe48` es
  `hsl(88 99% 64%)` contra `hsl(75 100% 60%)` del `--primary` — 13° de tono de
  diferencia, prácticamente el mismo contraste (13,37:1 contra 14,11:1 sobre
  carta oscura) y usado en un solo componente de la web. **No es un rol, es
  deriva**: el mismo patrón que `#FBC437` contra `#FBC337` que ya está señalado
  en la sección C. Corrige lo que decía antes este documento — son dos
  conceptos, no tres. Queda anotado como algo a limpiar del lado de la web.

**2 · "Jugadores" y "Plantel" se quedan distintos: es deliberado.**

La web hace exactamente el mismo corte, y el móvil ya coincide con ella:

```
src/components/nav/nav-config.ts:5   label: 'Jugadores'
src/app/players/page.tsx:112         title="Plantel"
```

El registro de secciones **no los unifica**: los declara juntos, en un archivo,
con un comentario que diga que la diferencia es a propósito — el menú tiene un
quinto del ancho de la pantalla y el encabezado no. Lo que se arregla no es el
nombre, es que hoy no hay ningún lugar donde se vea que la decisión existe.

**3 · La Fase 1 se hace completa, con dos recaudos.**

Es un defecto de accesibilidad, no una preferencia: 3,48:1 sobre tarjeta contra
un mínimo de 4,5. Y dejarlo tiene un costo que se paga después — el tema claro
se construiría y se revisaría contra una referencia rota. Los recaudos:

- la **pantalla de galería entra antes** que el cambio de paleta, para poder
  aprobarlo de una mirada en vez de recorrer la app;
- la eliminación de `textMuted` va en su **propio commit**, separada del resto
  de los ajustes, así se puede revertir sola si el resultado no convence.

### Fase 0 · Que el tema exista

- [x] 0.1 `PateaColors extends ThemeExtension`, 28 tokens, los dos esquemas, y `context.c`
- [x] 0.2 `AppTypography` sin color — 64 llamadas que dependían de un default quedaron explícitas
- [x] 0.3 `textTheme` completo — los 131 `Text` sueltos dejan de ser Roboto
- [x] 0.4 Borrados `cardTheme` y `bottomNavigationBarTheme` (muertos); agregados 17 sub-temas
- [x] 0.5 `main.dart`: `theme` + `darkTheme` + `themeMode`; el velo del sistema sale del tema
- [x] 0.6 **31 caras de las 7 familias empaquetadas** en `google_fonts/` (1,3 MB)
- [x] 0.7 Escalado de texto — los goldens corren a 1,3× (con el límite que dice su archivo)
- [x] `flutter analyze` con los mismos 19 `info` de antes; 31 tests en verde; APK compilado
- [x] Verificado en el emulador: Panel y Plantel idénticos

### Fase 1 · Corregir la paleta oscura

- [x] Pantalla de galería en debug, con contraste WCAG en vivo y los dos esquemas
- [x] Diez valores alineados contra `globals.css`
- [x] Borrados los 3 `_getPositionColor` duplicados
- [x] Tiers de `player_card_widget` unificados; borrado el comentario falso
- [x] **Siete** grises paralelos reemplazados (apareció un `#141923` rotulado “bg-card”), más el volt `#CCFF00` y el `#070B11`
- [x] **`textMuted` eliminado** — 316 usos → `textSecondary` = `#B3BDCC`, en su propio commit
- [x] Contraste verificado en la galería: 3,48 → **8,92** sobre tarjeta; ningún par en rojo
- [x] 19 `info` en analyze, 31 tests, APK compilado, Plantel revisado en el emulador

### Fase 2 · Los 211 colores absolutos

- [x] ~~Widget de superficie~~ — **no hace falta: la isla oscura no existe** (ver abajo)
- [x] Texto e íconos: 130 sitios → token
- [x] Veladuras: 79 `white.withValues` y 20 alphas → 3 tokens
- [x] Velos sobre foto y sombras: se quedan negros (10)
- [x] `onPrimary` único (`#141926`), en vez de `Colors.black` y `background`
- [x] 219 absolutos → **10**, todos deliberados y comentados

### Fase 3 · Unificar lo duplicado

- [x] `PateaTabs` en Panel, Partidos y Competiciones — de cuatro barras a una
- [x] `PateaAvatar` — los 15 `CircleAvatar` crudos, ahora con caché y maniquí
- [x] `core/utils/dates.dart` — siete copias, seis tablas de meses, tres de días
- [x] `PateaEmpty` / `PateaLoading` / `PateaError` — 16 `Text('Error: $e')` fuera
- [x] `PateaSnack` — **los 66**, incluidos los tres que avisan después de un `await`
- [x] `Colors.transparent` en las 10 pantallas opacas
- [x] Movimiento reducido — **1 caso real, no 9** (ver abajo)
- [x] **Radios: 224 literales en 18 valores → los 5 escalones de `AppRadii`**
- [x] Bottom sheets — sin `PateaSheet`: el `bottomSheetTheme` de la Fase 0 ya lo hacía (ver abajo)
- [x] `PlayerPositionBadge` con forma densa, en los sitios que renderizaban el puesto sin su color
- [x] `core/constants/sections.dart` — el router y las seis pantallas leen de ahí
- [x] `PateaCard` — **105 de las 226**; el resto no encajaba en la forma segura
- [x] ~~`AppSpacing`~~ — **descartado a propósito** (ver abajo)

> **El bottom sheet no necesitaba un componente.** Escribí un `PateaSheet` y
> lo borré antes de commitear: habría sido un componente sin adoptar, que es
> exactamente el error que este documento le señala a `PateaTabs`. Los cinco
> fondos distintos salían de que cada llamada pasaba su `backgroundColor`; el
> `bottomSheetTheme` que agregó la Fase 0 ya define `popover` y el radio de
> arriba. Alcanzó con **sacar los 8 overrides** y dejar que el tema haga su
> trabajo — que es para lo que se construyó.

> **`AppSpacing`: descartado, y por qué.** Son 19 valores de `SizedBox` y 18
> de `EdgeInsets`, y snapearlos a una escala de cinco cambia el layout de toda
> la app en 2 a 4 píxeles por caja. A diferencia del color, el espaciado **no
> bloquea el modo claro**, y a diferencia de los radios —donde 18 valores sí
> se leen como desprolijidad— la diferencia entre 14 y 16 no la ve nadie. Es
> la única incoherencia de la lista donde el arreglo cuesta mucho y se nota
> poco. Si alguna vez se hace, que sea con goldens ya andando.

> **Movimiento reducido: el hallazgo era más chico de lo que decía la
> auditoría.** `AnimationController` ya acorta las animaciones cuando
> `disableAnimations` está activo, así que 7 de los 9 archivos no necesitaban
> nada. Lo que el framework deja afuera **a propósito** son las que se repiten
> (`AnimationBehavior.preserve` es el default de `repeat`, para que no
> titilen), y de esas hay una sola en la app: el latido de un partido en vivo.

### Fase 4 · El tema claro

- [x] **La migración: 1.402 `AppColors` → `context.c`, y `app_colors.dart` borrado**
- [x] `PateaColors.light`, con `primary` y `textSecondary` **más oscuros que la web** (ver abajo)
- [x] Los 321 `voltNeon` repartidos: 253 `primary`, 42 `brandVolt`
- [x] ~~La isla oscura~~ — no existe (ver la corrección arriba)
- [x] El fondo: en claro no monta la foto de cancha
- [x] Duotonos claros de `PlayerAvatarFallback` — diez tonos escritos, no los oscuros aclarados
- [x] Barra de estado del sistema (venía de la Fase 0)
- [x] La crónica — ya usaba `card`, así que el papel se aclara solo
- [x] Sombras: las negras se quedan negras (hunden en los dos temas); los brillos volt siguen al tema
- [x] ~~Los 4 `CustomPainter`~~ — **son tres**, y dos no dependen del tema (ver abajo)

> **El texto del botón primario en claro no llegaba a AA, y es un defecto de
> la web.** El test de contraste lo encontró: `--primary` (`hsl(217 91% 60%)`)
> con blanco encima da **3,48:1**, contra el 4,5 que pide WCAG para texto
> normal — y la etiqueta del botón es 15px en negrita, que no llega al umbral
> de "texto grande" (18,7px). Nuestro azul va dos escalones más oscuro
> (`52%`), y `textSecondary` un punto más, porque sobre `--secondary` daba
> 4,35. No se copia el defecto.

> **Los painters eran cuatro y son tres.** `_NewsprintPainter` ya no existe
> — se fue en una reescritura anterior de la crónica, y la auditoría lo contó
> de una lectura vieja. De los tres, el del foil holográfico usa un
> `FragmentShader` y el del borde de la carta ya recibía su color; el único que
> hubo que tocar fue el de la cancha, que ahora recibe los suyos al
> construirse — el patrón para cualquier painter que venga.

### Fase 5 · Elegirlo y guardarlo

- [x] `ThemeController` (Riverpod) + `SharedPreferences`, verificado matando la app
- [x] Control en `PateaUserMenuSheet`: **Cancha / Claro**, dos opciones, sin seguir al sistema

### Verificación

- [x] Goldens del **sistema de diseño** en los dos temas, y a 1,3×
- [x] Goldens **por pantalla** — 12 pantallas × 2 temas, más la pasada de 1,3×

> **Estuvo abierto un día y estaba mal cerrado.** El párrafo que había acá
> decía que un arnés de providers por pantalla no valía la pena porque este
> trabajo tocó la capa que pinta, no las pantallas. Es cierto lo segundo y no
> se sigue lo primero: el arnés terminó siendo **un solo archivo**
> (`test/goldens/arnes.dart`) con datos falsos fijos y una lista de overrides
> que sirve para las doce, y encontró **ocho defectos reales** — cinco
> desbordes de layout, dos de ellos visibles a escala normal, y el texto negro
> sobre la foto de cancha en tema claro. La razón para no escribirlo era el
> tamaño estimado, y el tamaño estimado estaba mal.
>
> Cada pantalla se dibuja tres veces: imagen en `game`, imagen en `claro`, y
> los dos temas a 1,3× **sin** imagen. La tercera no guarda golden a propósito:
> a 1,3× no interesa cómo queda sino si entra, y un desborde llega al test como
> excepción. Son 24 imágenes en vez de 48.
>
> Tres trampas, por si hay que hacer algo parecido: `FlutterError.onError` se
> restaura **antes** del `expect` o el binding revienta con un mensaje que no
> dice eso; las fuentes y las fotos se cargan con `Future` reales que bajo el
> reloj falso del test no avanzan nunca, así que hay que precargarlas en
> `setUpAll` —sin eso, dos corridas seguidas daban imágenes con 93 % de píxeles
> distintos—; y `pumpAndSettle` no sirve con animaciones infinitas, pero un
> `pump` corto tampoco, porque retrata las tarjetas a mitad del fundido.
- [x] **Test de contraste** ≥ 4,5:1 sobre los 18 pares de los dos esquemas
- [x] **Trinquete** contra `AppColors`, `Color(0x` y `Colors.white`/`black`, en 79
- [x] **Goldens del sistema de diseño**: dos esquemas × dos escalas de texto
- [x] **Goldens por pantalla**: 12 pantallas × 2 temas + la pasada de 1,3×

### Aparte, sin depender de ninguna fase

- [x] Borrado `assets/images/backgrounds/` — de 39 MB a 20
- [x] Borrados `eminencia.png` y `aurelio.jpg`

---

# Parte 1 — Qué está mal hoy

## A. El tema no existe como sistema

Este es el hallazgo que ordena todos los demás.

```
Theme.of(context)          0 usos en 98 archivos
AppColors.<algo>        1185 usos en 56 archivos
```

**`Theme.of(context)` no aparece ni una sola vez en toda la app.** El
`ThemeData` que arma `AppTheme.darkTheme` es decorativo: los colores se leen
de una clase con constantes estáticas. Un `static const` no cambia en tiempo
de ejecución, así que hoy no hay ningún punto del código donde se pueda
"cambiar el tema" — habría que reescribir 1185 sitios.

Tres consecuencias concretas, no teóricas:

**1. Hay tema muerto.** `AppTheme` define `cardTheme` (radio 16 y borde) y
`bottomNavigationBarTheme`. En toda la app hay **0 usos de `Card(`** y la barra
inferior es un `Row` propio en el shell. Los dos bloques no pintan nada. Dan la
impresión de que existe un sistema que en realidad no se usa.

**2. Falta el `textTheme`, y se nota.** `ThemeData` no define `textTheme` ni
`fontFamily`. De 763 widgets `Text(`, **131 (17%) no llevan `style:`** y por lo
tanto renderizan en **Roboto**, no en las fuentes de la app. El caso más
visible son los errores: 20 de las 31 ramas `error:` de `AsyncValue` son un
`Text('Error: $e')` pelado, que le muestra al usuario el mensaje de excepción
crudo en una tipografía que no es la de la app.

**3. Faltan 25 sub-temas.** Están definidos 7 (`cardTheme`, `appBarTheme`,
`iconTheme`, `bottomNavigationBarTheme`, `inputDecorationTheme`,
`elevatedButtonTheme`, `outlinedButtonTheme`). No están `textTheme`,
`dialogTheme`, `snackBarTheme`, `bottomSheetTheme`, `chipTheme`,
`dividerTheme`, `switchTheme`, `checkboxTheme`, `radioTheme`, `sliderTheme`,
`textButtonTheme`, `filledButtonTheme`, `iconButtonTheme`, `listTileTheme`,
`progressIndicatorTheme`, `tabBarTheme`, `tooltipTheme`, `datePickerTheme`,
`timePickerTheme` ni `popupMenuTheme`. Todo eso se dibuja con los valores por
defecto de Material — que están pensados para otro producto.

Y en `main.dart`:

```dart
theme: AppTheme.darkTheme,     // no hay darkTheme:, no hay themeMode:
```

más un `SystemUiOverlayStyle` fijado una sola vez al arrancar con
`statusBarIconBrightness: Brightness.light` — iconos claros, que sobre un fondo
claro son invisibles.

## B. La paleta no coincide con la web

`AppColors` dice salir del bloque `.game` de `globals.css`. Convertí los HSL
originales y los comparé uno por uno:

| AppColors | valor | token web `.game` | valor real | delta |
| --- | --- | --- | --- | --- |
| `voltNeon` | `#CCFF33` | `--primary` | `#CCFF33` | 0 ✓ |
| `destructive` | `#F04242` | `--destructive` | `#F04242` | 0 ✓ |
| `success` | `#35E375` | `--success` | `#35E375` | 0 ✓ |
| `warning` | `#F8BC54` | `--warning` | `#F8BC54` | 0 ✓ |
| `info` | `#25C0F4` | `--info` | `#25C0F4` | 0 ✓ |
| `textPrimary` | `#F8FAFC` | `--foreground` | `#F8FAFC` | 0 ✓ |
| `goldBorder` | `#FBC337` | `--ovr-gold` | `#FBC337` | 0 ✓ |
| `posDel/Med/Def/Por` | — | `--pos-*` | — | 0 ✓ |
| `input` | `#384357` | `--input` | `#394356` | 1 |
| `border` | `#45536D` | `--border` | `#47536B` | 2 |
| `popover` | `#131822` | `--popover` | `#14181F` | 3 |
| `background` | `#0C1017` | `--background` | `#0B0E13` | 4 |
| `card` | `#181F2B` | `--card` | `#181D25` | 6 |
| `turquoise` | `#00E5CC` | `--accent` | `#00E6D2` | 6 |
| `cardSurface` | `#20293A` | `--secondary` | `#29303D` | **9** |
| `silverBorder` | `#CBD5E1` | `--ovr-silver` | `#C4C9D4` | **13** |
| `bronzeBorder` | `#CD7F32` | `--ovr-bronze` | `#D18C47` | **21** |
| `textSecondary` | `#94A3B8` | `--muted-foreground` | `#B3BDCC` | **31** |
| `textMuted` | `#64748B` | *(no existe)* | — | **79** |

### El caso `textMuted`, que es el peor

`AppColors.textMuted = #64748B` **no está en el bloque `.game`**. Está en el
bloque `:root` — es el `--muted-foreground` del **tema claro**
(`215.4 16.3% 46.9%`). Alguien tomó un gris pensado para texto sobre blanco y
lo puso como texto sobre negro.

Y no es un color de borde: es **el color de texto más usado de la app**, con
**309 apariciones**, más de cuatro veces las 73 de `textSecondary`.

```
contraste sobre el fondo (#0C1017)     4.00:1   ← AA pide 4.5
contraste sobre una tarjeta (#181F2B)  3.48:1   ← AA pide 4.5
el valor real de la web (#B3BDCC)     10.04:1
```

O sea: el texto secundario de toda la app está por debajo del mínimo de
accesibilidad, y a la vez es casi tres veces más apagado de lo que la web
muestra en ese mismo lugar. No es una diferencia de gusto, es un defecto
medible — y explica buena parte de la sensación de "gris y plano".

La escala además quedó invertida en la práctica: `textMuted`, que debería ser
el nivel más apagado y excepcional, es el default; `textSecondary`, que es el
correcto, se usa cuatro veces menos.

## C. Paletas paralelas, y una que se justifica con un comentario falso

**`player_card_widget.dart` tiene su propia paleta completa** — 22 literales de
color — con los mismos nombres conceptuales que `AppColors` pero valores que se
corrieron:

| concepto | `AppColors` | `player_card_widget` |
| --- | --- | --- |
| portero | `#F7B26E` | `#F7B3`**`6E`** |
| oro | `#FBC337` | `#FBC`**`4`**`37` |

Un dígito de diferencia en cada uno: no es una decisión, es una copia que se
desincronizó. Peor, está justificada por este comentario:

> *Colores por posición EXACTOS del tema `.game` (…) hues más pastel/claros que
> `AppColors.posDel` etc., **que son del tema claro por defecto***

Es falso. `AppColors.posDel/posMed/posDef` son **idénticos** a los del bloque
`.game` (`#F47171`, `#B87BF4`, `#7BB8F4`, verificado arriba). El comentario
inventa una diferencia que no existe para justificar una duplicación que sí
existe. Vale la pena señalarlo porque es exactamente el tipo de nota que, en el
momento de hacer el tema claro, manda a buscar el problema al lugar equivocado.

**Cuatro implementaciones de `_getPositionColor`:** en `AppColors`, en
`patea_top_header.dart`, en `patea_user_menu_sheet.dart` y en
`player_card_widget.dart`. Las dos del medio son copias literales que sólo
delegan a `AppColors`. Y los cuatro `default:` no coinciden: tres devuelven
`voltNeon`, `AppColors.getPositionColor` devuelve `textSecondary`.

**Seis grises paralelos** que no son `AppColors.card` (`#181F2B`) y hacen de
superficie igual:

```
#141A24 (9)   #141B27 (7)   #10141C (6)   #121822 (3)   #0F141D (3)   #1E2636 (2)
```

**`PateaBackground`** usa como base `#070B11` —un séptimo negro— y como tinte
de marca `#CCFF00`, que no es el volt (`#CCFF33`).

**211 colores absolutos:** 117 `Colors.white` y 94 `Colors.black`. De los
blancos, 81 son `Colors.white.withValues(alpha: …)` repartidos en **20 valores
de alpha distintos**:

```
0.035  0.045  0.06  0.07  0.08(12)  0.1(7)  0.10(3)  0.12(16)  0.13  0.14
0.15(10)  0.18  0.2  0.25  0.3  0.30  0.35  0.4  0.7  0.92
```

Eso es una escala de bordes y superficies sin declarar: la misma "línea fina"
es 0.08 en un lado, 0.12 en otro y 0.15 en un tercero. Y `0.1` convive con
`0.10`, `0.3` con `0.30`.

## D. Cosas que deberían verse iguales y no se ven iguales

### 1. Cuatro barras de pestañas distintas

| Sección | Implementación | Cómo se ve |
| --- | --- | --- |
| Explorar, Evaluaciones | `PateaTabs` | Outfit 14 w700, activa en volt, subrayado 2px, contador en píldora, divisor `border`@0.3 |
| **Partidos** | `_QuickTimeFilterTabs` | **copia literal de `PateaTabs`, en otra clase** |
| **Panel** | `_DashboardTabBar` | Space Grotesk **12 en mayúsculas**, w900/w600, activa en **blanco, no en volt**, subrayado **2.5px con glow**, ancho completo, divisor `white`@0.08, con háptica |
| **Competiciones** | `TabBar` de Material | el look por defecto de Material, sin tocar |

El propio comentario de `PateaTabs` dice que se creó para unificar esto:

> *Es el lenguaje que ya usaban Panel ("Mi Resumen / Mi Grupo") y Partidos
> ("Próximos / Semana / Historial"). Estaba escrito dos veces…*

Se escribió el componente, pero **no se migró ninguna de las dos secciones que
lo motivaron**. Quedaron las dos copias más el componente nuevo.

### 2. Tres formas de dibujar el mismo avatar

| Forma | Dónde | Qué implica |
| --- | --- | --- |
| `PlayerAvatarFallback` | 3 archivos | el diseño real: 4 maniquíes × 10 duotonos, estable por id |
| `CircleAvatar` + `NetworkImage` | **14 pantallas** | sin caché (re-descarga en cada scroll), sin fallback diseñado |
| `CachedNetworkImage` | 3 archivos | con caché |

La foto del mismo jugador se ve distinta según desde dónde se la mire, y en 14
pantallas se baja de la red otra vez.

### 3. La misma fecha, dos formatos

`_fmtDate` está escrito **cuatro veces**, y las cuatro copias no coinciden:

```
Panel, Grupos           →  "05 de sep"
Explorar, Detalle       →  "05 sep"
```

La tabla de meses en español está declarada **seis veces** (cinco
`_spanishMonths` más un `_months`). El proyecto ya depende de `intl`.

### 4. El filtro de posición, en tres órdenes y con dos nombres

| Pantalla | Orden | "todas" se llama |
| --- | --- | --- |
| Login, Explorar | `POR DEF MED DEL` | `Todos` |
| Crear partido, Crear jugador, Editar perfil | `DEL MED DEF POR` | `Todos` (de `'all'`) |
| Jugadores | `DEL MED DEF POR` | **`ALL`** |

En la lista de Jugadores el chip dice literalmente "ALL".

### 5. No hay estado de carga, vacío ni error compartido

```
CircularProgressIndicator sueltos      79
clases de estado vacío, con 6 nombres  _Empty  _EmptyState  _EmptyHint
                                       _EmptyLine  _EmptyMural  _WelcomeEmptyState
ramas error: que son Text('Error: $e') sin estilo   ~20 de 31
```

### 6. Las hojas de abajo, con cinco fondos

`showModalBottomSheet` aparece con `Colors.transparent` (el widget se pinta
solo), `AppColors.card`, `AppColors.background`, `Colors.black`, y sin
especificar (default de Material). La misma gaveta se ve distinta según de
dónde suba.

### 7. Sesenta y seis `SnackBar`, con diez fondos

`voltNeon`, `destructive`, `card`, `cardSurface`, `success`, `background`,
`warning`, `popover`, `Colors.black`, `Colors.white` translúcido. Un mismo
"guardado con éxito" no se ve igual en dos pantallas.

### 8. La tarjeta

```
BoxDecoration a mano       231
widgets Card(                0
```

`AppColors.card` aparece con radio **12, 14, 16 y sin radio**. En total hay
**207 radios literales** repartidos en **18 valores distintos** (1, 2, 3, 4, 5,
6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24 y 999). `AppRadii`, que existe y
propone tres, se usa en **15 de 98 archivos** — y ni el propio `AppTheme` lo
usa: escribe `BorderRadius.circular(16)` y `(12)` a mano.

### 9. Once pantallas tapan el fondo de cancha

El router envuelve **todas** las rutas en `PateaBackground`, pero once
pantallas montan un `Scaffold` opaco encima y lo anulan:

```
competiciones · cup bracket · formulario de evaluación · crear equipo
grupos · crear partido · evaluar partido · leaderboard · coach
feed social · login
```

Se paga el costo de decodificar una foto de 2 MB para pintarle un rectángulo
encima.

### 10. El nombre de cada sección, escrito dos veces

Las cinco secciones tienen su nombre declarado en **dos archivos**: el rótulo del
menú de abajo vive en el router, y el título de la pantalla vive en la pantalla.

| Sección | En el menú | En el encabezado |
| --- | --- | --- |
| jugadores | **`'Jugadores'`** `app_router.dart:391` | **`'Plantel'`** `players_list_screen.dart:294` |
| panel | **`'Panel'`** `app_router.dart:384` | **`'EL VESTUARIO'`** `dashboard_screen.dart:134` |
| partidos | `'Partidos'` `app_router.dart:398` | `'Partidos'` `matches_screen.dart:380` |
| explorar | `'Explorar'` `app_router.dart:405` | `'Explorar'` `explorar_screen.dart:87` |
| evaluaciones | `'Evaluaciones'` `app_router.dart:412` | `'Evaluaciones'` `evaluations_inbox_screen.dart:122` |

Las dos primeras **ya divergieron**. Las otras tres coinciden por casualidad y se
van a separar apenas alguien toque una sola: cambiar el título de Partidos no
cambia el rótulo del menú.

No hay dónde decidir si "Jugadores" y "Plantel" son dos nombres a propósito o un
descuido, porque no hay un lugar donde la sección esté definida — sólo dos
lugares donde está escrita.

Por debajo hay **307 literales de texto** sueltos en la UI, sin archivo de
strings ni i18n.

### 11. El resto

- **`PlayerPositionBadge`** existe y se usa en **2** pantallas. En las demás la
  posición es texto suelto, con `AppTypography.code` o `.body`, en tamaños
  8.5, 11 y 12.
- **Espaciado sin escala:** 19 valores distintos de `SizedBox(height:)`
  (2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 50) y 18 de
  `EdgeInsets.all()`. No hay ninguna constante declarada.
- **`bottomInset`** se usa en **5 de 32** pantallas scrolleables, y con tres
  valores de `extra` (16, 24, y un `+ 80` a mano en el detalle).
- **Dos rutas para el mismo asset:** `PateaBackground` lee
  `assets/images/backgrounds/`, las tarjetas de partido leen
  `assets/backgrounds/`.
- **El escalado de texto del sistema no se contempla:** `textScaler` y
  `textScaleFactor` tienen **0 usos**, contra **545 `height:` fijos**. Si alguien
  sube el tamaño de letra en Android, eso recorta.
- **Movimiento reducido, bien hecho dos veces:** de los 9 archivos con animación,
  sólo el Panel y el splash leen `MediaQuery.disableAnimations`. Misma forma que
  todo lo demás — alguien lo resolvió y no se propagó.

## E. Peso: 18 MB de más en el APK

```
assets/backgrounds/          18 MB
assets/images/backgrounds/   18 MB   ← los mismos 9 archivos, md5 idéntico
```

Las dos carpetas están declaradas en `pubspec.yaml`, así que **las dos viajan
en el APK**. De 39 MB de assets, 18 son una copia exacta.

Además, en `assets/icons/` hay **`eminencia.png` (1,8 MB)** y **`aurelio.jpg`
(105 KB)** sin una sola referencia en el código.

**Ninguna fuente está empaquetada.** Las siete familias
—Space Grotesk, Outfit, Source Code Pro, Anton, Barlow Condensed, Lora y
Bebas Neue— se bajan en runtime con `google_fonts`. Un primer arranque sin red
muestra la app entera en Roboto. Y Bebas Neue es la séptima: aparece dos veces
en el Panel llamada directo a `GoogleFonts.bebasNeue`, fuera de
`AppTypography`, sin estar documentada como parte del sistema.

## F. Lo que sí está bien

Para que la lista de arriba se lea en perspectiva:

- `flutter analyze`: **19 avisos, todos `info`**. Ningún warning, ningún error.
- **`withOpacity`: 0 usos**, `withValues`: 315. La migración de la API
  deprecada ya está hecha y completa.
- La tipografía **sí está centralizada**: 643 llamadas a `AppTypography` contra
  11 `TextStyle` crudos. Es el único eje del sistema que funciona.
- Los SVG (jerseys, logo, iconos de posición) se pintan con `ColorFilter`, así
  que cambian de tema sin tocar el asset.
- `AppRadii` y `app_insets` están bien pensados y bien documentados. El
  problema no es el diseño de esas piezas, es que casi nadie las usa.

---

# Parte 2 — El plan del modo claro

## Lo primero: en la web, el tema claro es el que viene por defecto

```tsx
// src/components/client-providers.tsx
<ThemeProvider themes={['light', 'game']} defaultTheme="light">
```

La web ofrece **dos** temas (`settings-sheet.tsx`), y el que ve un usuario
nuevo es el claro. La app móvil portó únicamente el otro. Esto no es agregar
una variante: es completar el port.

Y hay una decisión de diseño ya tomada del lado de la web que conviene
respetar:

```tsx
// src/components/theme-background.tsx
if (theme === 'game') return <GameModeBackground />;
return null;                       // en claro NO hay foto de fondo
```

En claro no hay foto de cancha detrás de la app: el fondo es el degradado suave
animado del `body` (azul 6% → ámbar 5% → blanco roto). Pero ojo, porque no es
parejo: las **tarjetas de partido sí conservan su foto en los dos temas**
(`MatchInfoCard.tsx`, comentario *"Background layers — all themes"*); lo que se
apaga en claro son las scanlines y el texto pasa de blanco a `foreground`.

## Fase 0 — Que el tema exista, sin mover un pixel

Es la fase que destraba todo. No cambia nada visualmente y se puede verificar
con capturas antes/después.

**0.1 — `AppColors` deja de ser constantes y pasa a ser un `ThemeExtension`.**

```dart
@immutable
class PateaColors extends ThemeExtension<PateaColors> {
  final Color background, card, cardSurface, popover, border, input;
  final Color primary, onPrimary, accent, brandVolt;
  final Color destructive, success, warning, info;
  final Color textPrimary, textSecondary;
  final Color overlaySubtle, overlayLine, overlayStrong;
  // …posiciones y tiers
  static const game = PateaColors(/* los valores de hoy */);
  static const light = PateaColors(/* Fase 4 */);
}

extension PateaTheme on BuildContext {
  PateaColors get c => Theme.of(this).extension<PateaColors>()!;
}
```

Se conserva `AppColors` como alias `@Deprecated` apuntando a `PateaColors.game`,
así el commit no rompe los 1185 sitios de una vez y la migración se hace por
archivo.

**0.2 — `AppTypography` deja de traer color adentro.** Hoy cada estilo tiene
`Color color = AppColors.textPrimary` como parámetro por defecto: eso hornea el
tema oscuro dentro de la tipografía. Los estilos salen sin color y el color lo
pone el `textTheme` / `DefaultTextStyle`. Son 199 llamadas que hoy heredan la
constante; las 444 que pasan color explícito se migran en la Fase 2.

**0.3 — `textTheme` completo en el `ThemeData`.** Con esto los 131 `Text` sin
estilo dejan de ser Roboto sin tocar ninguno de los 131.

**0.4 — Limpiar y completar los sub-temas.** Borrar `cardTheme` y
`bottomNavigationBarTheme` (no los usa nadie) o empezar a usarlos; agregar
`dialogTheme`, `snackBarTheme`, `bottomSheetTheme`, `dividerTheme`,
`tabBarTheme`, `textButtonTheme`, `filledButtonTheme`, `progressIndicatorTheme`,
`listTileTheme`, `chipTheme`.

**0.5 — `main.dart`**: `theme` + `darkTheme` + `themeMode`, y sacar el
`SystemUiOverlayStyle` de arriba de todo para que lo maneje un
`AnnotatedRegion` que siga al tema.

**0.6 — Empaquetar las fuentes.** No es limpieza de peso: es un **prerrequisito
de la verificación**. Toda la comprobación del plan son golden tests, y
`google_fonts` baja las familias por red — los dos tests que ya existen tuvieron
que poner `GoogleFonts.config.allowRuntimeFetching = false` para no colgarse, y
con eso **renderizan en Roboto**. Un golden así validaría una tipografía que no
es la de la app, justo en el plan cuyo eje es la tipografía y el color. Las
fuentes tienen que estar en el binario **antes** del primer golden.

**0.7 — Escalado de texto.** Mientras se toca cada estilo, dejar resueltos los
`height:` fijos que recortan cuando el sistema agranda la letra. No hace falta
auditar los 545: alcanza con correr los goldens a 1,3× (ver *Verificación*) y
arreglar los que fallan.

> Fase 0 vale aunque el modo claro se cancele mañana: es lo que hace que el
> `ThemeData` deje de ser decorativo.

## Fase 1 — Corregir el tema oscuro contra `globals.css`

Antes de agregar un tema, arreglar el que hay.

| Cambio | De | A |
| --- | --- | --- |
| `textSecondary` | `#94A3B8` | `#B3BDCC` (`--muted-foreground`) |
| **eliminar `textMuted`** | `#64748B` | fundirlo en `textSecondary` |
| `cardSurface` | `#20293A` | `#29303D` (`--secondary`) |
| `silverBorder` | `#CBD5E1` | `#C4C9D4` |
| `bronzeBorder` | `#CD7F32` | `#D18C47` |
| `turquoise` | `#00E5CC` | `#00E6D2` |
| `card`, `background`, `popover`, `border`, `input` | — | ajuste fino de 1 a 6 |

Eliminar `textMuted` es el cambio más visible de toda la fase: son 309 sitios
que pasan de 3,48:1 a ~10:1 de contraste. **Esto se va a ver, y hay que
mostrarlo antes de commitear** — es el arreglo de accesibilidad, pero también
cambia el carácter de la app.

En la misma fase: borrar los tres `_getPositionColor` duplicados, unificar los
tiers de `player_card_widget` con `AppColors` (y borrar el comentario falso), y
reemplazar los seis grises paralelos.

## Fase 2 — Los 211 colores absolutos

`Colors.white` y `Colors.black` no sobreviven a un cambio de tema. Se
clasifican en tres grupos:

| Uso | Cuántos | A qué pasa |
| --- | --- | --- |
| Texto o ícono sobre superficie | ~50 | token (`textPrimary`, `onPrimary`) |
| Overlay / línea fina (`white.withValues`) | 81 | `overlaySubtle` .06 · `overlayLine` .12 · `overlayStrong` .20 — **en claro invierten a negro** |
| Velo sobre foto (`black.withValues`) | 21 | se queda negro: es correcto en los dos temas |

Los 20 alphas se colapsan a tres. Acá también se resuelve el `onPrimary`: hoy
el texto sobre volt es `Colors.black` en 27 sitios y `AppColors.background` en
9 — dos valores para lo mismo, y ninguno es el `--primary-foreground` de la web.

## Fase 3 — Unificar lo que ya está duplicado

Esta fase es la que hace que la Fase 4 sea un archivo y no cincuenta y seis.
Cada punto sale directo de la Parte 1:

| Unificar | Reemplaza |
| --- | --- |
| `PateaTabs` en Panel, Partidos y Competiciones | 3 barras de pestañas |
| `PateaAvatar` (sobre `CachedNetworkImage` + `PlayerAvatarFallback`) | 14 pantallas con `CircleAvatar` crudo |
| `core/utils/dates.dart` | 4 `_fmtDate` + 6 tablas de meses |
| `PateaEmpty` / `PateaLoading` / `PateaError` | 79 spinners + 6 estados vacíos + 20 `Text('Error: $e')` |
| `PateaCard` | 231 `BoxDecoration`, 18 radios → los 3 de `AppRadii` |
| `PateaSheet` | 5 fondos de bottom sheet |
| `PateaSnack.ok/err/info` | 66 SnackBars con 10 fondos |
| `PlayerPositionBadge` en todos lados | posición como texto suelto |
| `AppSpacing` (4/8/12/16/24) | 19 gaps y 18 paddings |
| `Colors.transparent` en las 11 pantallas opacas | fondo de cancha tapado |
| Un orden y un rótulo de posiciones | 3 órdenes, `ALL` vs `Todos` |
| **`core/constants/sections.dart`** | el nombre de cada sección escrito en 2 archivos |
| `MediaQuery.disableAnimations` en los 9 archivos con animación | resuelto sólo en Panel y splash |

### El registro de secciones

Va en esta fase porque es el mismo problema que el resto —una cosa declarada N
veces— pero conviene decirlo explícito: es el eje de **contenido**, no el de
estilo, y las fases 0 a 2 no lo resuelven. Un `ThemeExtension` unifica colores;
no unifica textos.

Un solo archivo declara la identidad de cada sección, y el router, el
`PateaPageHeader` y el diálogo de ayuda la leen de ahí en vez de repetirla:

```dart
enum Section { panel, players, matches, explore, evaluations }

class SectionSpec {
  final String route;
  final String navLabel;     // hoy vive en app_router.dart
  final String title;        // hoy vive en la pantalla
  final String? description;
  final IconData icon, activeIcon;
  final String? action;      // el rótulo del botón del header
  const SectionSpec(…);
}

const sections = <Section, SectionSpec>{
  Section.players: SectionSpec(
    route: '/players',
    navLabel: 'Jugadores',
    title: 'Plantel',
    description: 'Gestioná la plantilla de tu equipo…',
    icon: Icons.person_outline,
    activeIcon: Icons.person,
    action: 'Agregar Jugador',
  ),
  …
};
```

Dos detalles que importan:

- **`navLabel` y `title` siguen siendo dos campos.** El menú de abajo tiene un
  quinto del ancho de la pantalla y el encabezado no, así que puede haber una
  razón real para que digan cosas distintas. Lo que cambia es que esa diferencia
  pasa a ser una decisión visible en una línea, en vez del resultado de que nadie
  miró los dos archivos a la vez.
- **No hace falta i18n para esto.** La versión grande —`flutter_localizations`
  más archivos ARB— además permite traducir, y es la que hay que hacer si alguna
  vez la app sale del español. Pero para que un título viva en un solo lugar
  alcanza con este archivo.

La misma lógica cubre lo que ya está listado arriba: la tabla de meses (6
copias), las etiquetas largas de posición (`Delantero`, `Medio`, `Defensa`,
`Portero`, declaradas en `PlayerPositionBadge` y repetidas sueltas) y los rótulos
`ALL` contra `Todos`.

## Fase 4 — El tema claro

Valores listos, convertidos del bloque `:root` de `globals.css`:

| Token | Hex | Contraste sobre `#FFFFFF` |
| --- | --- | --- |
| `background` | `0xFFFCFCFD` | — |
| `card`, `popover` | `0xFFFFFFFF` | — |
| `foreground` | `0xFF020817` | 20,0:1 |
| `muted-foreground` | `0xFF64748B` | 4,76:1 |
| `primary` | `0xFF3C83F6` | 3,64:1 |
| `primary-foreground` | `0xFFF8FAFC` | — |
| `accent` | `0xFFFBBD23` | — |
| `secondary` | `0xFFF2F5F8` | — |
| `border`, `input` | `0xFFD9DFE8` | — |
| `destructive` | `0xFFEF4444` | 3,76:1 |
| `success` | `0xFF16A249` | 3,33:1 |
| `warning` | `0xFFF59F0A` | 2,13:1 |
| `pos-del / med / def / por` | `#F04242` `#9942F0` `#4299F0` `#F5993D` | 3,77 · 4,78 · 2,98 · 2,21 |
| `ovr-elite / gold / silver / bronze` | `#2D5286` `#E6A605` `#737B8C` `#A36629` | 7,89 · 2,14 · 4,25 · 4,68 |

> Nota de accesibilidad: varios de esos colores están **por debajo de 4,5:1**
> sobre blanco (`warning` 2,13, `ovr-gold` 2,14, `pos-por` 2,21, `pos-def`
> 2,98). En la web se usan casi siempre como relleno o borde, no como texto. Al
> portarlos hay que respetar eso: si en el móvil alguno termina siendo texto
> chico, necesita una variante más oscura. Es la trampa más probable de esta
> fase.

Lo que **no** se traduce solo al cambiar los tokens:

1. **El fondo.** En claro `PateaBackground` no monta foto: devuelve el
   degradado suave (azul 6% → ámbar 5% → blanco roto). Las tarjetas de partido
   sí conservan la suya, pero **atenuada**: `MatchInfoCard` la baja de
   `opacity-50` a `opacity-20`, apaga las scanlines y pasa el texto de blanco a
   `text-foreground`.

   > **Corrección.** Este documento afirmaba que en claro las tarjetas se
   > quedaban oscuras enteras, citando `src/lib/match-theme.ts:6` (*"Cards are
   > always dark — independent of the app theme"*), y sobre eso proponía un
   > widget de superficie para una "isla oscura". **Es falso.** El comentario
   > describe la intención del lenguaje visual (cartas estilo FUT), no lo que el
   > CSS hace: `MatchInfoCard` en claro usa `text-foreground`, `bg-muted` y
   > `border-border`; las `.fifa-*-card` en claro son un tinte translúcido sobre
   > el fondo de página; y `:root .player-card` lleva sombra suave justamente
   > porque *"float over white background"*. No hay isla oscura, y el widget de
   > superficie no se construyó.
   >
   > Lo que sí existe es texto sobre foto, que es blanco en los dos temas. Eso
   > lo resuelve la regla de los velos, no un tema anidado.

2. **El volt no es el primario en claro — y hay dos volts.** En claro el
   primario es azul y el acento es ámbar, así que los **321
   `AppColors.voltNeon`** no son todos "el color primario". Y la web declara
   **dos** neones, no uno:

   | token | valor | dónde |
   | --- | --- | --- |
   | `--primary` | `#CCFF33` | `globals.css:266`, bloque `.game` |
   | `--game-accent-neon` | `#aafe48` | `globals.css:102`, 8 usos en `MatchInfoCard` |

   **Resuelto: son dos conceptos, y el segundo neón no se porta.** Ver
   *Decisiones tomadas* arriba — `#aafe48` está a 13° de tono del `--primary`,
   tiene el mismo contraste y vive en un solo componente: es deriva, no un rol.
   Los 321 usos se reparten entre `primary` (lo accionable y lo activo, azul en
   claro) y `brandVolt` (lo decorativo, volt siempre).

   > La web tampoco está limpia acá: si el móvil se alinea a `globals.css` pero
   > los componentes web siguen escribiendo el color a mano, van a seguir
   > divergiendo — sólo que ahora con el móvil teniendo razón.
3. **Sombras y degradados.** Los 15 `BoxShadow` y los 18 gradientes están
   pensados para iluminar sobre negro. En claro tienen que hundir: sombra
   negra a baja opacidad, no glow.
4. **Los cuatro `CustomPainter`** pintan a mano y hay que pasarles colores:
   `_FoilPainter`, `_CardBorderPainter`, `_PitchPainter` (la cancha del modo en
   vivo) y `_NewsprintPainter` (el papel de la crónica).
5. **`PlayerAvatarFallback`** tiene diez duotonos elegidos para fondo oscuro.
   Necesita su juego claro, o un fondo neutro que funcione en los dos.
6. **La barra de estado del sistema**, hoy fijada una vez en `main()`.
7. **La crónica del partido** es deliberadamente "papel oscuro". En claro
   pasa a ser papel de verdad — es el bloque que mejor va a quedar y el único
   donde el tema claro es una mejora obvia.

## Fase 5 — Elegirlo, guardarlo y respetarlo

- `themeModeProvider` en Riverpod + `SharedPreferences` (ya está en el
  proyecto: el Panel guarda ahí la pestaña activa).
- El control va en `PateaUserMenuSheet`, que es el equivalente del
  `settings-sheet` de la web.
- **Dos opciones, no tres, y sin "seguir al sistema".** La web ofrece
  `light` y `game`. `game` no es "el modo oscuro": es una identidad de marca
  con volt neón, foto de cancha y scanlines. Atarla al ajuste de oscuro del
  teléfono le pondría a un usuario cualquiera una estética de videojuego sin
  haberla pedido.

## Verificación

- **Golden tests** de cada pantalla en los dos temas. Es la única forma
  realista de cubrir 56 archivos.
- **Un test que falle** si aparece un `Color(0x` nuevo fuera de
  `core/theme/`, o un `Colors.white`/`Colors.black` fuera de una lista blanca
  corta. Sin esto la deriva vuelve sola.
- **Un test de contraste** que recorra los pares (texto sobre superficie) de
  los dos esquemas y exija 4,5:1. Es el que hoy fallaría con `textMuted`.
- **Los mismos goldens a 1,3× de escala de texto.** Es un parámetro más en el
  test que ya existe, y es lo único que va a encontrar cuáles de los 545
  `height:` fijos recortan.

> Los goldens no sirven hasta que las fuentes estén en el binario (Fase 0.6):
> con `google_fonts` bajando por red, renderizan en Roboto.

### Cómo se revisa la Fase 1, que es la que se ve

309 sitios no se miran a ojo. Hace falta una **pantalla de galería** en debug:
todos los tokens y todos los componentes, en los dos temas, en una sola vista
scrolleable. Es media hora de trabajo y es lo único que permite aprobar un
cambio de paleta sin recorrer la app entera.

Y un medidor gratis: si `AppColors` queda como `@Deprecated` (Fase 0.1), **el
contador de avisos de `flutter analyze` es la barra de progreso** de la
migración. Arranca en 1.185 y termina en 0, sin llevar ninguna lista a mano.

## Orden, costo y riesgo

| Fase | Qué toca | Riesgo visual | ¿Sirve sin modo claro? |
| --- | --- | --- | --- |
| 0 · Que el tema exista | `core/theme/`, `main.dart` | ninguno | **sí, es lo que destraba todo** |
| 1 · Corregir la paleta oscura | `app_colors`, `player_card_widget` | **alto y buscado** (309 sitios) | **sí, arregla accesibilidad** |
| 2 · Los absolutos | 56 archivos, mecánico | bajo | sí |
| 3 · Unificar componentes | ~30 archivos | medio | **sí, es la deuda más visible** |
| 4 · El tema claro | `core/theme/` + los 7 casos especiales | n/a (tema nuevo) | — |
| 5 · Elegirlo y guardarlo | menú de usuario, `main.dart` | ninguno | — |

Las fases 0 a 3 son **el 80% del trabajo y valen por sí solas**: arreglan
contraste, borran 18 MB del APK, unifican cuatro barras de pestañas y tres
avatares, y le sacan el Roboto a 131 textos. La Fase 4 recién es posible
después, y una vez que están hechas es un archivo de valores más siete casos
puntuales.

### Una advertencia de coordinación

Las fases 2 y 3 tocan 56 y ~30 archivos de forma mecánica. Si alguien más está
editando `patea_mobile` en paralelo —como pasó en la pasada de diseño de
septiembre, conducida con otra herramienta sobre el mismo código—, eso es un
merge imposible. O se hacen en una ventana en la que nadie más toca, o se parten
por sección y se van integrando de a una.

### Y aparte, ahora mismo, sin depender de nada

- Borrar `assets/images/backgrounds/` y dejar una sola ruta: **−18 MB**.
- Borrar `eminencia.png` y `aurelio.jpg`, sin referencias: **−1,9 MB**.

(El empaquetado de las fuentes salió de esta lista: no es una mejora opcional de
peso, es la Fase 0.6 y bloquea toda la verificación.)
