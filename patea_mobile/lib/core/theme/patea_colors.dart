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
/// **[game] tiene hoy los valores que la app ya usaba, no los corregidos.** La
/// Fase 0 no mueve un pixel a propósito; los que hay que ajustar contra
/// `globals.css` están marcados `FASE 1 ->` en el comentario de cada campo, y
/// se cambian juntos en un commit propio para que se pueda revertir solo.
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
  /// FASE 1 -> 0xFF0B0E13
  final Color background;
  /// FASE 1 -> 0xFF181D25
  final Color card;
  /// --secondary. FASE 1 -> 0xFF29303D
  final Color cardSurface;
  /// FASE 1 -> 0xFF14181F
  final Color popover;
  /// FASE 1 -> 0xFF47536B
  final Color border;
  /// FASE 1 -> 0xFF394356
  final Color input;

  // Accion y marca
  /// volt en game, azul en claro
  final Color primary;
  /// FASE 2 -> 0xFF141926 (--primary-foreground)
  final Color onPrimary;
  /// turquesa / ambar. FASE 1 -> 0xFF00E6D2
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
  /// FASE 1 -> 0xFFB3BDCC
  final Color textSecondary;
  /// FASE 1: se elimina, se funde en textSecondary
  final Color textMuted;

  // Veladuras (nuevas, sin uso hasta la Fase 2)
  /// relleno apenas perceptible
  final Color overlaySubtle;
  /// la linea fina
  final Color overlayLine;
  /// separacion marcada
  final Color overlayStrong;

  // Tiers de OVR
  /// FASE 1 -> 0xFFF7F7F8
  final Color eliteBorder;
  /// --ovr-gold
  final Color goldBorder;
  /// FASE 1 -> 0xFFC4C9D4
  final Color silverBorder;
  /// FASE 1 -> 0xFFD18C47
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
    required this.textMuted,
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
    background: Color(0xFF0C1017),
    card: Color(0xFF181F2B),
    cardSurface: Color(0xFF20293A),
    popover: Color(0xFF131822),
    border: Color(0xFF45536D),
    input: Color(0xFF384357),

  // Accion y marca
    primary: Color(0xFFCCFF33),
    onPrimary: Color(0xFF000000),
    accent: Color(0xFF00E5CC),
    brandVolt: Color(0xFFCCFF33),

  // Semanticos
    destructive: Color(0xFFF04242),
    success: Color(0xFF35E375),
    warning: Color(0xFFF8BC54),
    info: Color(0xFF25C0F4),

  // Texto
    textPrimary: Color(0xFFF8FAFC),
    textSecondary: Color(0xFF94A3B8),
    textMuted: Color(0xFF64748B),

  // Veladuras (nuevas, sin uso hasta la Fase 2)
    overlaySubtle: Color(0x0FFFFFFF),
    overlayLine: Color(0x1FFFFFFF),
    overlayStrong: Color(0x33FFFFFF),

  // Tiers de OVR
    eliteBorder: Color(0xFFF8FAFC),
    goldBorder: Color(0xFFFBC337),
    silverBorder: Color(0xFFCBD5E1),
    bronzeBorder: Color(0xFFCD7F32),

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
    primary: Color(0xFF3C83F6),
    onPrimary: Color(0xFFF8FAFC),
    accent: Color(0xFFFBBD23),
    brandVolt: Color(0xFFCCFF33),

  // Semanticos
    destructive: Color(0xFFEF4444),
    success: Color(0xFF16A249),
    warning: Color(0xFFF59F0A),
    info: Color(0xFF3C83F6),

  // Texto
    textPrimary: Color(0xFF020817),
    textSecondary: Color(0xFF64748B),
    textMuted: Color(0xFF94A3B8),

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
    Color? textMuted,
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
      textMuted: textMuted ?? this.textMuted,
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
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
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
