import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTypography {
  static TextStyle headline({
    double size = 20,
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.textPrimary,
    double? letterSpacing,
  }) {
    return GoogleFonts.spaceGrotesk(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle body({
    double size = 14,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.textSecondary,
    double? height,
  }) {
    return GoogleFonts.outfit(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );
  }

  static TextStyle sportNumber({
    double size = 28,
    FontWeight weight = FontWeight.w800,
    Color color = AppColors.textPrimary,
  }) {
    return GoogleFonts.spaceGrotesk(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: -1.0,
    );
  }

  static TextStyle code({
    double size = 12,
    FontWeight weight = FontWeight.w500,
    Color color = AppColors.textMuted,
  }) {
    return GoogleFonts.sourceCodePro(
      fontSize: size,
      fontWeight: weight,
      color: color,
    );
  }

  /// Serif, sólo para el relato del partido.
  ///
  /// La app entera es Space Grotesk y Outfit —geométricas, deportivas—, así
  /// que una serif no pega... y por eso funciona: la crónica es lo único que
  /// se lee como texto largo y no como interfaz. La web usa Georgia ahí por
  /// la misma razón (`IntegratedMatchStory`); acá va Lora, que es la
  /// equivalente disponible en Google Fonts.
  static TextStyle editorial({
    double size = 14,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.textPrimary,
    bool italic = false,
    double? height,
  }) {
    return GoogleFonts.lora(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      fontStyle: italic ? FontStyle.italic : FontStyle.normal,
    );
  }
}
