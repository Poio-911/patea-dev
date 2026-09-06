import 'package:flutter/material.dart';

/// Los colores de la app, colgados del `ThemeData` en vez de sueltos en
/// constantes.
///
/// Por qué existe: `AppColors` era una clase de `static const`, y un `const` no
/// cambia en tiempo de ejecución. Con 1185 referencias repartidas en 56
/// archivos, "cambiar el tema" quería decir reescribir 1185 sitios — por eso el
/// modo claro no se podía hacer. Acá los valores viajan en el `ThemeData` y se
/// leen con `context.c`, que es lo que permite tener dos esquemas.
///
/// Los valores salen de `src/app/globals.css`: el bloque `.game` para
/// [PateaColors.game] y el bloque `:root` para [PateaColors.light]. Si hace
/// falta un color nuevo, primero se lo busca ahí. No inventar colores acá.
///
/// [game] ya está corregido contra `globals.css` (Fase 1). Diez valores
/// habían derivado del original: `cardSurface` por 9, `silverBorder` por 13 y
/// `bronzeBorder` por 21 puntos del canal más lejano, y el resto por menos.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
@immutable
class PateaColors extends ThemeExtension<PateaColors> {
  /// Si el fondo sobre el que se dibuja es oscuro.
  ///
  /// No es lo mismo que "el tema es game". En claro las tarjetas de partido
  /// siguen siendo oscuras a propósito (`src/lib/match-theme.ts`: *"Cards are
  /// always dark — independent of the app theme"*), y adentro de esa isla las
  /// veladuras tienen que seguir siendo blancas. Ese es el caso que este campo
  /// existe para resolver.
  final bool isDarkSurface;

  // Superficies
  /// Corregido contra globals.css en la Fase 1.
  final Color background;
  /// Corregido contra globals.css en la Fase 1.
  final Color card;
  /// Corregido contra globals.css en la Fase 1.
  final Color cardSurface;
  /// Corregido contra globals.css en la Fase 1.
  final Color popover;
  /// Corregido contra globals.css en la Fase 1.
  final Color border;
  /// Corregido contra globals.css en la Fase 1.
  final Color input;

  // Accion y marca
  /// Volt en game, azul en claro.
  ///
  /// El azul es dos escalones más oscuro que el `--primary` de la web
  /// (`hsl(217 91% 52%)` contra `60%`) **a propósito**: con el de la web, el
  /// texto blanco del botón primario da 3,48:1, por debajo del mínimo de 4,5
  /// que pide WCAG AA para texto normal. La etiqueta del botón es 15px en
  /// negrita, que no llega a "texto grande" (18,7px), así que no hay excusa.
  /// La web tiene ese defecto; no se copia.
  final Color primary;
  /// --primary-foreground
  final Color onPrimary;
  /// Corregido contra globals.css en la Fase 1.
  final Color accent;
  /// la identidad, no el primario
  final Color brandVolt;

  // Semanticos
  /// --destructive
  final Color destructive;
  /// --success
  final Color success;
  /// --warning
  final Color warning;
  /// --info
  final Color info;

  // Texto
  /// --foreground
  final Color textPrimary;
  /// Corregido contra globals.css en la Fase 1.
  final Color textSecondary;

  // Veladuras (nuevas, sin uso hasta la Fase 2)
  /// relleno apenas perceptible
  final Color overlaySubtle;
  /// la linea fina
  final Color overlayLine;
  /// separacion marcada
  final Color overlayStrong;

  // Tiers de OVR
  /// Corregido contra globals.css en la Fase 1.
  final Color eliteBorder;
  /// --ovr-gold
  final Color goldBorder;
  /// Corregido contra globals.css en la Fase 1.
  final Color silverBorder;
  /// Corregido contra globals.css en la Fase 1.
  final Color bronzeBorder;

  // Posiciones
  /// --pos-del
  final Color posDel;
  /// --pos-med
  final Color posMed;
  /// --pos-def
  final Color posDef;
  /// --pos-por
  final Color posPor;

  const PateaColors({
    required this.isDarkSurface,
    required this.background,
    required this.card,
    required this.cardSurface,
    required this.popover,
    required this.border,
    required this.input,
    required this.primary,
    required this.onPrimary,
    required this.accent,
    required this.brandVolt,
    required this.destructive,
    required this.success,
    required this.warning,
    required this.info,
    required this.textPrimary,
    required this.textSecondary,
    required this.overlaySubtle,
    required this.overlayLine,
    required this.overlayStrong,
    required this.eliteBorder,
    required this.goldBorder,
    required this.silverBorder,
    required this.bronzeBorder,
    required this.posDel,
    required this.posMed,
    required this.posDef,
    required this.posPor,
  });

  /// El tema `game`: volt, carbón y foto de cancha.
  static const game = PateaColors(
    isDarkSurface: true,
  // Superficies
    background: Color(0xFF0B0E13),
    card: Color(0xFF181D25),
    cardSurface: Color(0xFF29303D),
    popover: Color(0xFF14181F),
    border: Color(0xFF47536B),
    input: Color(0xFF394356),

  // Accion y marca
    primary: Color(0xFFCCFF33),
    onPrimary: Color(0xFF141926),
    accent: Color(0xFF00E6D2),
    brandVolt: Color(0xFFCCFF33),

  // Semanticos
    destructive: Color(0xFFF04242),
    success: Color(0xFF35E375),
    warning: Color(0xFFF8BC54),
    info: Color(0xFF25C0F4),

  // Texto
    textPrimary: Color(0xFFF8FAFC),
    textSecondary: Color(0xFFB3BDCC),

  // Veladuras (nuevas, sin uso hasta la Fase 2)
    overlaySubtle: Color(0x0FFFFFFF),
    overlayLine: Color(0x1FFFFFFF),
    overlayStrong: Color(0x33FFFFFF),

  // Tiers de OVR
    eliteBorder: Color(0xFFF7F7F8),
    goldBorder: Color(0xFFFBC337),
    silverBorder: Color(0xFFC4C9D4),
    bronzeBorder: Color(0xFFD18C47),

  // Posiciones
    posDel: Color(0xFFF47171),
    posMed: Color(0xFFB87BF4),
    posDef: Color(0xFF7BB8F4),
    posPor: Color(0xFFF7B26E),
  );

  /// El tema claro, que en la web es el que viene por defecto.
  static const light = PateaColors(
    isDarkSurface: false,
  // Superficies
    background: Color(0xFFFCFCFD),
    card: Color(0xFFFFFFFF),
    cardSurface: Color(0xFFF2F5F8),
    popover: Color(0xFFFFFFFF),
    border: Color(0xFFD9DFE8),
    input: Color(0xFFD9DFE8),

  // Accion y marca
    primary: Color(0xFF156BF4),
    onPrimary: Color(0xFFF8FAFC),
    accent: Color(0xFFFBBD23),
    brandVolt: Color(0xFFCCFF33),

  // Semanticos
    destructive: Color(0xFFEF4444),
    success: Color(0xFF16A249),
    warning: Color(0xFFF59F0A),
    info: Color(0xFF156BF4),

  // Texto
    textPrimary: Color(0xFF020817),
    textSecondary: Color(0xFF5E6D82),

  // Veladuras (nuevas, sin uso hasta la Fase 2)
    overlaySubtle: Color(0x0A000000),
    overlayLine: Color(0x14000000),
    overlayStrong: Color(0x24000000),

  // Tiers de OVR
    eliteBorder: Color(0xFF2D5286),
    goldBorder: Color(0xFFE6A605),
    silverBorder: Color(0xFF737B8C),
    bronzeBorder: Color(0xFFA36629),

  // Posiciones
    posDel: Color(0xFFF04242),
    posMed: Color(0xFF9942F0),
    posDef: Color(0xFF4299F0),
    posPor: Color(0xFFF5993D),
  );

  Color positionColor(String position) {
    switch (position.toUpperCase()) {
      case 'DEL':
        return posDel;
      case 'MED':
        return posMed;
      case 'DEF':
        return posDef;
      case 'POR':
        return posPor;
      default:
        return textSecondary;
    }
  }

  Color ovrBorderColor(int ovr) {
    if (ovr >= 86) return eliteBorder;
    if (ovr >= 76) return goldBorder;
    if (ovr >= 65) return silverBorder;
    return bronzeBorder;
  }

  @override
  PateaColors copyWith({
    bool? isDarkSurface,
    Color? background,
    Color? card,
    Color? cardSurface,
    Color? popover,
    Color? border,
    Color? input,
    Color? primary,
    Color? onPrimary,
    Color? accent,
    Color? brandVolt,
    Color? destructive,
    Color? success,
    Color? warning,
    Color? info,
    Color? textPrimary,
    Color? textSecondary,
    Color? overlaySubtle,
    Color? overlayLine,
    Color? overlayStrong,
    Color? eliteBorder,
    Color? goldBorder,
    Color? silverBorder,
    Color? bronzeBorder,
    Color? posDel,
    Color? posMed,
    Color? posDef,
    Color? posPor,
  }) {
    return PateaColors(
      isDarkSurface: isDarkSurface ?? this.isDarkSurface,
      background: background ?? this.background,
      card: card ?? this.card,
      cardSurface: cardSurface ?? this.cardSurface,
      popover: popover ?? this.popover,
      border: border ?? this.border,
      input: input ?? this.input,
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      accent: accent ?? this.accent,
      brandVolt: brandVolt ?? this.brandVolt,
      destructive: destructive ?? this.destructive,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      overlaySubtle: overlaySubtle ?? this.overlaySubtle,
      overlayLine: overlayLine ?? this.overlayLine,
      overlayStrong: overlayStrong ?? this.overlayStrong,
      eliteBorder: eliteBorder ?? this.eliteBorder,
      goldBorder: goldBorder ?? this.goldBorder,
      silverBorder: silverBorder ?? this.silverBorder,
      bronzeBorder: bronzeBorder ?? this.bronzeBorder,
      posDel: posDel ?? this.posDel,
      posMed: posMed ?? this.posMed,
      posDef: posDef ?? this.posDef,
      posPor: posPor ?? this.posPor,
    );
  }

  @override
  PateaColors lerp(ThemeExtension<PateaColors>? other, double t) {
    if (other is! PateaColors) return this;
    return PateaColors(
      // Un bool no se interpola: salta a la mitad, como el resto de los
      // cambios discretos de Material.
      isDarkSurface: t < 0.5 ? isDarkSurface : other.isDarkSurface,
      background: Color.lerp(background, other.background, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardSurface: Color.lerp(cardSurface, other.cardSurface, t)!,
      popover: Color.lerp(popover, other.popover, t)!,
      border: Color.lerp(border, other.border, t)!,
      input: Color.lerp(input, other.input, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      brandVolt: Color.lerp(brandVolt, other.brandVolt, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      overlaySubtle: Color.lerp(overlaySubtle, other.overlaySubtle, t)!,
      overlayLine: Color.lerp(overlayLine, other.overlayLine, t)!,
      overlayStrong: Color.lerp(overlayStrong, other.overlayStrong, t)!,
      eliteBorder: Color.lerp(eliteBorder, other.eliteBorder, t)!,
      goldBorder: Color.lerp(goldBorder, other.goldBorder, t)!,
      silverBorder: Color.lerp(silverBorder, other.silverBorder, t)!,
      bronzeBorder: Color.lerp(bronzeBorder, other.bronzeBorder, t)!,
      posDel: Color.lerp(posDel, other.posDel, t)!,
      posMed: Color.lerp(posMed, other.posMed, t)!,
      posDef: Color.lerp(posDef, other.posDef, t)!,
      posPor: Color.lerp(posPor, other.posPor, t)!,
    );
  }
}

/// Atajo para leer la paleta: `context.c.textSecondary`.
///
/// Corto a propósito. Va a aparecer más de mil veces, y
/// `Theme.of(context).extension<PateaColors>()!.textSecondary` en cada una
/// hace ilegible el código que se supone que ordena.
extension PateaColorsX on BuildContext {
  PateaColors get c =>
      Theme.of(this).extension<PateaColors>() ?? PateaColors.game;
}
