import 'package:flutter/material.dart';

/// Paleta del tema `.game` de la webapp.
///
/// Todos los valores salen de `src/app/globals.css`, bloque `.game` (línea 266
/// en adelante), convertidos de HSL a RGB. El HSL original queda al lado de
/// cada uno para poder verificarlos.
///
/// Ojo si hay que agregar un color: los semánticos y los de posición estuvieron
/// mucho tiempo tomados de la paleta de sistema de iOS (systemRed, systemBlue,
/// etc.) mientras las superficies sí estaban bien portadas. Se notaba: la web
/// pinta las posiciones al 70-72% de luminosidad — pasteles que conviven con el
/// volt — y los de iOS están al 50-55%, saturados, y le pelean el
/// protagonismo. No inventar colores acá: si no está en globals.css, no va.
class AppColors {
  // Fondos y Superficies (Dark / Game Theme)
  static const Color background = Color(0xFF0C1017); // hsl(220 25% 6%)
  static const Color card = Color(0xFF181F2B);       // hsl(220 20% 12%)
  static const Color cardSurface = Color(0xFF20293A);
  static const Color popover = Color(0xFF131822);
  static const Color border = Color(0xFF45536D);      // hsl(220 20% 35%)
  static const Color input = Color(0xFF384357);

  // Acentos y Marca
  static const Color voltNeon = Color(0xFFCCFF33);   // hsl(75 100% 60%) - Primario Game
  static const Color turquoise = Color(0xFF00E5CC);  // hsl(175 100% 45%) - Acento secundario
  static const Color electricBlue = Color(0xFF1E90FF);
  static const Color destructive = Color(0xFFF04242); // hsl(0 85% 60%)
  static const Color success = Color(0xFF35E375);     // hsl(142 76% 55%)
  static const Color warning = Color(0xFFF8BC54);     // hsl(38 92% 65%)
  static const Color info = Color(0xFF25C0F4);        // hsl(195 90% 55%)

  // Textos
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Tiers de Cartas OVR
  static const Color eliteBorder = Color(0xFFF8FAFC);  // Platino brillante / Near pure white
  static const Color goldBorder = Color(0xFFFBC337);   // Oro  hsl(43 96% 60%)
  static const Color silverBorder = Color(0xFFCBD5E1); // Plata
  static const Color bronzeBorder = Color(0xFFCD7F32); // Bronce

  // Posiciones
  static const Color posDel = Color(0xFFF47171); // Delantero  hsl(0 85% 70%)
  static const Color posMed = Color(0xFFB87BF4); // Medio      hsl(270 85% 72%)
  static const Color posDef = Color(0xFF7BB8F4); // Defensa    hsl(210 85% 72%)
  static const Color posPor = Color(0xFFF7B26E); // Portero    hsl(30 90% 70%)

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

  static Color getOvrBorderColor(int ovr) {
    if (ovr >= 86) return eliteBorder;
    if (ovr >= 76) return goldBorder;
    if (ovr >= 65) return silverBorder;
    return bronzeBorder;
  }
}
