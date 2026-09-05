import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Las voces tipográficas de la app.
///
/// **Los estilos ya no traen color.** Hasta la Fase 0 cada método tenía un
/// `Color color = AppColors.textPrimary` como parámetro por defecto, y eso
/// horneaba el tema oscuro adentro de la tipografía: no había forma de que un
/// texto cambiara de color al cambiar de tema sin tocar la llamada. Ahora el
/// color sale de `DefaultTextStyle` —o sea del [textTheme], o sea del
/// `ThemeData`— salvo que la llamada pida uno explícito con `context.c`.
///
/// Las 64 llamadas que dependían de un default distinto de `textPrimary`
/// quedaron con el color escrito, para que ese cambio no moviera nada.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
class AppTypography {
  /// Space Grotesk: títulos, botones, cualquier cosa que mande.
  static TextStyle headline({
    double size = 20,
    FontWeight weight = FontWeight.w700,
    Color? color,
    double? letterSpacing,
  }) {
    return GoogleFonts.spaceGrotesk(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  /// Outfit: el texto corriente de la interfaz.
  static TextStyle body({
    double size = 14,
    FontWeight weight = FontWeight.w400,
    Color? color,
    double? height,
  }) {
    return GoogleFonts.outfit(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );
  }

  /// Números con el tracking cerrado: marcadores, OVR, contadores.
  static TextStyle sportNumber({
    double size = 28,
    FontWeight weight = FontWeight.w800,
    Color? color,
  }) {
    return GoogleFonts.spaceGrotesk(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: -1.0,
    );
  }

  /// Monoespaciada: siglas, etiquetas cortas, datos que se alinean.
  static TextStyle code({
    double size = 12,
    FontWeight weight = FontWeight.w500,
    Color? color,
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
    Color? color,
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
    Color? color,
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
    Color? color,
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

  /// El `textTheme` de la app.
  ///
  /// Antes no existía: el `ThemeData` no declaraba ni `textTheme` ni
  /// `fontFamily`, así que los 131 `Text` sin `style:` —incluidos casi todos
  /// los mensajes de error, que son el caso más visible— se dibujaban en
  /// Roboto, que no es una fuente de esta app. Esto los arregla sin tocar
  /// ninguno de los 131.
  ///
  /// También es de acá de donde sacan el color los estilos de arriba cuando la
  /// llamada no pide uno.
  static TextTheme textTheme({
    required Color primary,
    required Color secondary,
  }) {
    return TextTheme(
      displayLarge: headline(size: 40, weight: FontWeight.w800, color: primary),
      displayMedium: headline(size: 34, weight: FontWeight.w800, color: primary),
      displaySmall: headline(size: 28, weight: FontWeight.w700, color: primary),
      headlineLarge: headline(size: 26, weight: FontWeight.w700, color: primary),
      headlineMedium: headline(size: 22, weight: FontWeight.w700, color: primary),
      headlineSmall: headline(size: 20, weight: FontWeight.w700, color: primary),
      titleLarge: headline(size: 18, weight: FontWeight.w700, color: primary),
      titleMedium: headline(size: 16, weight: FontWeight.w600, color: primary),
      titleSmall: headline(size: 14, weight: FontWeight.w600, color: primary),
      bodyLarge: body(size: 16, color: primary),
      // `bodyMedium` es el que hereda un `Text` suelto. Va en textPrimary y no
      // en textSecondary: un texto sin estilo declarado es contenido, no una
      // aclaración al pie.
      bodyMedium: body(size: 14, color: primary),
      bodySmall: body(size: 12, color: secondary),
      labelLarge: headline(size: 15, weight: FontWeight.w700, color: primary),
      labelMedium: body(size: 12, weight: FontWeight.w600, color: secondary),
      labelSmall: code(size: 11, color: secondary),
    );
  }
}
