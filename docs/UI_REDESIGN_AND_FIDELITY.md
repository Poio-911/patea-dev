# Rediseño de UI, Glassmorphism y Fidelidad Visual — Pateá Mobile

Este documento recopila todas las mejoras, decisiones de diseño, correcciones de espaciado y detalles de implementación realizados para alinear `patea_mobile` con la webapp real de Pateá.

---

## 1. Experiencia Edge-to-Edge y Shell Glassmórfico

### 1.1 Sistema Nativo Edge-to-Edge (`main.dart`)
* **Configuración**: Se activó `SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge)`.
* **Overlay Styles**: Barra de estado y barra de navegación de gestos con `statusBarColor: Colors.transparent` y `systemNavigationBarColor: Colors.transparent`.
* **Comportamiento**: La viñeta oscura y el césped deportivo de `PateaBackground` fluyen ininterrumpidamente desde el borde superior hasta la barra inferior.

### 1.2 Header Superior Canónico (`PateaTopHeader` en `lib/core/widgets/patea_top_header.dart`)
* Implementado como `ConsumerWidget implements PreferredSizeWidget` con alto fijo de 60px (+ status bar padding).
* Efecto Glassmorphism con `ClipRect` + `BackdropFilter(filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18))` y borde inferior `Border(bottom: BorderSide(color: Colors.white12, width: 1.0))`.
* Conectado a `authStateProvider` para mostrar en vivo la foto/avatar, nombre y posición del usuario autenticado.
* **Overlays interactivos integrados**:
  1. **Tutorial de Ayuda (`PateaHelpDialog`)**: Carrusel de 6 pasos idéntico a `src/components/help-dialog.tsx`.
  2. **Centro de Notificaciones (`PateaNotificationsSheet`)**: Stream en tiempo real desde `users/{uid}/notifications`, con indicador de no leídas y acción para marcar como leídas.
  3. **Menú de Usuario (`PateaUserMenuSheet`)**: Bottom sheet con insignia de OVR, avatar ampliado, y accesos rápidos a Perfil, Grupos, Mercado de Fichajes, Evaluaciones y Cerrar Sesión.

---

## 2. Cartas de Jugadores (`PlayerCardWidget` en `lib/core/widgets/player_card_widget.dart`)

Se eliminó el diseño inicial plano con marco sólido de `1.2px` y se reconstruyó basándose en `src/components/player-card.tsx` y `src/app/globals.css`:

### 2.1 Auras Radiales Dinámicas por Rareza
* **Bronze (OVR < 65)**: `RadialGradient` centrado en `Alignment.bottomLeft` con color ámbar cálido (`0x38CD7F32`).
* **Silver (OVR 65-74)**: `RadialGradient` centrado en `Alignment.topCenter` con tono plata azulado (`0x33CBD5E1`).
* **Gold (OVR 75-85)**: `RadialGradient` centrado en `Alignment.topRight` con brillo dorado (`0x40FACC15`).
* **Elite (OVR 86+)**: `RadialGradient` centrado en `Alignment.topCenter` con doble resplandor platino (`0x52BED2FF`).

### 2.2 Bordes y Efectos de Glow
* Se reemplazó el borde tosco por un borde fino de `1.0px` (`1.5px` en élite) acompañado de un `BoxShadow` de resplandor atado al tier de rareza.
* El aro circular del avatar tiene un grosor de `2.5px` con sombra difuminada a juego.

### 2.3 Tipografía y Badges
* **Badge de Posición**: Píldora redondeada con borde (`posColor.withValues(alpha: 0.45)`) y fondo al 14% de opacidad (`DEL` rojo, `MED` violeta, `DEF` azul, `POR` ámbar).
* **OVR Clasificado**: El número del OVR toma el color del tier (Platino para Élite, Dorado para Oro, Plateado para Plata, Ámbar para Bronce) en lugar de blanco genérico.
* **Grilla de Atributos**: 2 columnas × 3 filas con contenedores translúcidos individuales, etiquetas de atributos clave resaltadas con el color de la posición (`RIT`, `TIR`, `PAS`, `REG`, `DEF`, `FIS`), micro barras de progreso y valores numéricos en blanco/neón.

---

## 3. Pantalla de Partidos (`matches_screen.dart`)

### 3.1 Hero Banner de Próximo Partido (`_NextMatchBanner`)
* **Solución de Escalado**: Se solucionó el problema por el cual la imagen del banner aparecía encogida con barras negras laterales. Ahora `AnimatedSwitcher` utiliza `layoutBuilder` con `Stack(fit: StackFit.expand)` y `SizedBox.expand`, garantizando que la fotografía del estadio cubra el 100% del contenedor con `BoxFit.cover`.

### 3.2 Fondos Fotográficos de Estadio en Cards
* Siguiendo `src/components/compact-match-card.tsx`, tanto `_MatchCard` como `_CompactMatchCard` integran la fotografía determinista `assets/backgrounds/fondo_$photoIndex.jpg` con opacidad `0.22`, viñeta oscura y gradiente inferior, dándole identidad visual a cada tarjeta de partido.

---

## 4. Normalización de Espaciados y Gotcha de Layout

### 4.1 Diagnóstico del Problema de Espaciado
* Al usar un `Scaffold` externo con `extendBodyBehindAppBar: true` y `appBar: PateaTopHeader()`, cualquier intento de sumar manualmente `topPadding = MediaQuery.padding.top + 60` dentro de un `CustomScrollView` resultaba en un cálculo erróneo:
  * `CustomScrollView` ya consume de forma automática el padding de la barra de estado de Android.
  * Al sumarle de nuevo el padding superior manualmente en un `SliverPadding`, se duplicaba la distancia, dejando un hueco negro de aproximadamente ~150px entre el header y el título de la sección.

### 4.2 Solución Estandarizada
* Se unificaron todas las pantallas principales (`Plantel`, `Partidos`, `Explorar`, `Evaluaciones`) para utilizar el patrón canónico del framework:
  ```dart
  appBar: AppBar(
    title: Text('TITULO', style: AppTypography.headline(size: 20, weight: FontWeight.w800)),
  )
  ```
* Esto garantiza que todas las secciones queden a la misma altura, con la misma tipografía y la misma distancia compacta y uniforme respecto al header glassmórfico.
