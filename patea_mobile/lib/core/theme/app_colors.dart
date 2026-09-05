import 'package:flutter/material.dart';

/// Paleta del tema `.game`, en constantes. **En vías de desaparecer.**
///
/// Un `static const` no cambia en tiempo de ejecución: mientras un color se
/// lea de acá, ese widget no puede cambiar de tema. Por eso existe ahora
/// [PateaColors], que viaja en el `ThemeData` y se lee con `context.c`.
///
/// Esta clase queda sólo para que la migración se pueda hacer archivo por
/// archivo en vez de en un commit de 1185 líneas. Cada uso pendiente es un
/// aviso de `flutter analyze`, así que **el contador de avisos es la barra de
/// progreso**: arrancó en ~1185 y termina en 0.
///
/// Los valores son idénticos a `PateaColors.game` y hay un test que lo
/// verifica (`test/theme_parity_test.dart`), para que no puedan separarse
/// mientras las dos convivan.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
@Deprecated(
  'Usar context.c (PateaColors) en vez de AppColors. '
  'Un static const no puede cambiar de tema. '
  'Ver docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md',
)
class AppColors {
  // Fondos y Superficies
  @Deprecated('Usar context.c.background')
  static const Color background = Color(0xFF0B0E13);
  @Deprecated('Usar context.c.card')
  static const Color card = Color(0xFF181D25);
  @Deprecated('Usar context.c.cardSurface')
  static const Color cardSurface = Color(0xFF29303D);
  @Deprecated('Usar context.c.popover')
  static const Color popover = Color(0xFF14181F);
  @Deprecated('Usar context.c.border')
  static const Color border = Color(0xFF47536B);
  @Deprecated('Usar context.c.input')
  static const Color input = Color(0xFF394356);

  // Acentos y Marca
  @Deprecated('Usar context.c.primary (o brandVolt si es decorativo)')
  static const Color voltNeon = Color(0xFFCCFF33);
  @Deprecated('Usar context.c.accent')
  static const Color turquoise = Color(0xFF00E6D2);
  @Deprecated('Usar context.c.accent')
  static const Color electricBlue = Color(0xFF1E90FF);
  @Deprecated('Usar context.c.destructive')
  static const Color destructive = Color(0xFFF04242);
  @Deprecated('Usar context.c.success')
  static const Color success = Color(0xFF35E375);
  @Deprecated('Usar context.c.warning')
  static const Color warning = Color(0xFFF8BC54);
  @Deprecated('Usar context.c.info')
  static const Color info = Color(0xFF25C0F4);

  // Textos
  @Deprecated('Usar context.c.textPrimary')
  static const Color textPrimary = Color(0xFFF8FAFC);
  @Deprecated('Usar context.c.textSecondary')
  static const Color textSecondary = Color(0xFFB3BDCC);

  // Tiers de Cartas OVR
  @Deprecated('Usar context.c.eliteBorder')
  static const Color eliteBorder = Color(0xFFF7F7F8);
  @Deprecated('Usar context.c.goldBorder')
  static const Color goldBorder = Color(0xFFFBC337);
  @Deprecated('Usar context.c.silverBorder')
  static const Color silverBorder = Color(0xFFC4C9D4);
  @Deprecated('Usar context.c.bronzeBorder')
  static const Color bronzeBorder = Color(0xFFD18C47);

  // Posiciones
  @Deprecated('Usar context.c.posDel')
  static const Color posDel = Color(0xFFF47171);
  @Deprecated('Usar context.c.posMed')
  static const Color posMed = Color(0xFFB87BF4);
  @Deprecated('Usar context.c.posDef')
  static const Color posDef = Color(0xFF7BB8F4);
  @Deprecated('Usar context.c.posPor')
  static const Color posPor = Color(0xFFF7B26E);

  @Deprecated('Usar context.c.positionColor(...)')
  static Color getPositionColor(String position) {
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

  @Deprecated('Usar context.c.ovrBorderColor(...)')
  static Color getOvrBorderColor(int ovr) {
    if (ovr >= 86) return eliteBorder;
    if (ovr >= 76) return goldBorder;
    if (ovr >= 65) return silverBorder;
    return bronzeBorder;
  }
}
