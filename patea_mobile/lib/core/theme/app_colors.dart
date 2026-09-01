import 'package:flutter/material.dart';

class AppColors {
  // Fondos y Superficies (Dark / Game Theme)
  static const Color background = Color(0xFF0C1017); // hsl(220 25% 6%)
  static const Color card = Color(0xFF181F2B);       // hsl(220 20% 12%)
  static const Color cardSurface = Color(0xFF20293A);
  static const Color popover = Color(0xFF131822);
  static const Color border = Color(0xFF45536D);      // hsl(220 20% 35%)
  static const Color input = Color(0xFF384357);

  // Acentos y Marca
  static const Color voltNeon = Color(0xFFCCFF00);   // hsl(75 100% 60%) - Primario Game
  static const Color turquoise = Color(0xFF00E5CC);  // hsl(175 100% 45%) - Acento secundario
  static const Color electricBlue = Color(0xFF1E90FF);
  static const Color destructive = Color(0xFFFF3B30);
  static const Color success = Color(0xFF34C759);
  static const Color warning = Color(0xFFFF9500);
  static const Color info = Color(0xFF00C7FF);

  // Textos
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Tiers de Cartas OVR
  static const Color eliteBorder = Color(0xFFF8FAFC);  // Platino brillante / Near pure white
  static const Color goldBorder = Color(0xFFFFD700);   // Oro
  static const Color silverBorder = Color(0xFFCBD5E1); // Plata
  static const Color bronzeBorder = Color(0xFFCD7F32); // Bronce

  // Posiciones
  static const Color posDel = Color(0xFFFF453A); // Delantero (Rojo)
  static const Color posMed = Color(0xFFBF5AF2); // Medio (Púrpura)
  static const Color posDef = Color(0xFF0A84FF); // Defensa (Azul)
  static const Color posPor = Color(0xFFFF9F0A); // Portero (Naranja)

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
