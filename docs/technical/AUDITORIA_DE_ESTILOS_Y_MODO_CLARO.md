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
- [ ] 0.7 Escalado de texto — **se difiere**: depende de los goldens, que todavía no existen
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
- [x] `PateaSnack` — 37 de 45 `SnackBar`; 8 con contenido armado quedan a mano
- [x] `Colors.transparent` en las 10 pantallas opacas
- [x] Movimiento reducido — **1 caso real, no 9** (ver abajo)
- [ ] `PateaCard` — 231 `BoxDecoration`, 18 radios → los 3 de `AppRadii`
- [ ] `PateaSheet` — los 5 fondos de bottom sheet
- [ ] `PlayerPositionBadge` en todas las pantallas
- [ ] `AppSpacing`
- [ ] `core/constants/sections.dart` (con `navLabel` y `title` separados a propósito)

> **Movimiento reducido: el hallazgo era más chico de lo que decía la
> auditoría.** `AnimationController` ya acorta las animaciones cuando
> `disableAnimations` está activo, así que 7 de los 9 archivos no necesitaban
> nada. Lo que el framework deja afuera **a propósito** son las que se repiten
> (`AnimationBehavior.preserve` es el default de `repeat`, para que no
> titilen), y de esas hay una sola en la app: el latido de un partido en vivo.

### Fase 4 · El tema claro

- [ ] `PateaColors.light` con los valores convertidos
- [ ] Variantes más oscuras para los colores bajo 4,5:1 que terminen siendo texto
- [ ] La isla oscura: tarjetas de partido
- [ ] Repartir los 321 `voltNeon` en `primary` / `brandVolt`
- [ ] Sombras y degradados: hundir en vez de iluminar
- [ ] Los 4 `CustomPainter`
- [ ] Duotonos claros de `PlayerAvatarFallback`
- [ ] Barra de estado del sistema
- [ ] La crónica en papel claro

### Fase 5 · Elegirlo y guardarlo

- [ ] `themeModeProvider` + `SharedPreferences`
- [ ] Control en `PateaUserMenuSheet`, dos opciones, sin seguir al sistema

### Verificación

- [ ] Goldens por pantalla, en los dos temas
- [ ] Los mismos goldens a 1,3×
- [ ] Test de contraste ≥ 4,5:1 sobre los pares de los dos esquemas
- [ ] Lint contra `Color(0x` y `Colors.white`/`black` fuera de `core/theme/`

### Aparte, sin depender de ninguna fase

- [ ] Borrar `assets/images/backgrounds/` (−18 MB)
- [ ] Borrar `eminencia.png` y `aurelio.jpg` (−1,9 MB)

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
