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

  /// Condensada pesada: la voz del marcador y de la camiseta.
  ///
  /// Anton tiene un solo peso y es angosta y maciza, que es exactamente la
  /// letra de un tanteador o del nombre en la espalda de una camiseta. Va sólo
  /// en piezas grandes —el resultado, los nombres de los equipos, la marca de
  /// agua— porque en tamaño chico se empasta.
  ///
  /// Anton no trae itálica y Flutter no la sintetiza: si se la quiere
  /// inclinada, hay que aplicar un `Matrix4.skewX` sobre el widget.
  static TextStyle jersey({
    double size = 20,
    Color color = AppColors.textPrimary,
    double letterSpacing = 0,
    double? height,
  }) {
    return GoogleFonts.anton(
      fontSize: size,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// Condensada de texto: la chapita con el nombre del jugador.
  ///
  /// Barlow Condensed tiene toda la escala de pesos, así que sirve donde
  /// [jersey] no entra: nombres en listas, etiquetas de dos palabras, columnas
  /// angostas. Entra más texto en el mismo ancho sin achicar el cuerpo.
  ///
  /// (Oswald quedó afuera a propósito: está justo entre estas dos y sumarla
  /// sería un tercer peso que no resuelve nada que estas no resuelvan.)
  static TextStyle condensed({
    double size = 13,
    FontWeight weight = FontWeight.w600,
    Color color = AppColors.textPrimary,
    double letterSpacing = 0,
    double? height,
  }) {
    return GoogleFonts.barlowCondensed(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
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
