import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_radii.dart';
import 'app_typography.dart';
import 'patea_colors.dart';

/// El `ThemeData` de la app, armado a partir de una [PateaColors].
///
/// Antes había un solo tema escrito a mano contra constantes, y encima estaba
/// de adorno: `Theme.of(context)` no se usaba ni una vez en los 98 archivos.
/// Ahora los dos esquemas salen de la misma función, así que agregar o corregir
/// un sub-tema no puede quedar hecho en uno y olvidado en el otro.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
class AppTheme {
  /// El tema `game`: volt, carbón y foto de cancha.
  static ThemeData get darkTheme => _build(PateaColors.game, Brightness.dark);

  /// El tema claro, que en la web es el que viene por defecto.
  static ThemeData get lightTheme => _build(PateaColors.light, Brightness.light);

  static ThemeData _build(PateaColors c, Brightness brightness) {
    final textTheme = AppTypography.textTheme(
      primary: c.textPrimary,
      secondary: c.textSecondary,
    );
    final isDark = brightness == Brightness.dark;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: c.background,
      primaryColor: c.primary,
      canvasColor: c.background,
      dividerColor: c.border,
      textTheme: textTheme,

      // Es lo que hace que la paleta viaje en el tema y se pueda leer con
      // `context.c`. Sin esto, `PateaColors` sería otra clase de constantes.
      extensions: <ThemeExtension<dynamic>>[c],

      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.primary,
        onPrimary: c.onPrimary,
        secondary: c.accent,
        onSecondary: c.onPrimary,
        surface: c.card,
        onSurface: c.textPrimary,
        surfaceContainerHighest: c.cardSurface,
        error: c.destructive,
        onError: Colors.white,
        outline: c.border,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: c.background,
        // Los estilos de `AppTypography` ya no traen color, así que el color
        // del título del AppBar tiene que salir de acá.
        foregroundColor: c.textPrimary,
        elevation: 0,
        // Material 3 por defecto tiñe el AppBar con un overlay del color
        // primario cuando el contenido de abajo scrollea debajo de él
        // (`scrolledUnderElevation`) — eso es el "fondo raro" que aparecía
        // detrás de títulos como PLANTEL/PARTIDOS al deslizar. La web no
        // tiene ese efecto, así que se apaga acá a nivel de tema (no por
        // pantalla) para que quede igual en todas las secciones.
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: AppTypography.headline(
          size: 20,
          weight: FontWeight.w700,
          color: c.textPrimary,
        ),
        iconTheme: IconThemeData(color: c.textPrimary),
        // El velo del status bar sigue al tema. Antes se fijaba una sola vez
        // en `main()` con los iconos en claro, que sobre un fondo claro son
        // invisibles.
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),

      iconTheme: IconThemeData(color: c.textPrimary),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.input.withValues(alpha: 0.35),
        hintStyle: AppTypography.body(color: c.textSecondary),
        labelStyle: AppTypography.body(color: c.textSecondary),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: AppRadii.cardAll,
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.cardAll,
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.cardAll,
          borderSide: BorderSide(color: c.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.cardAll,
          borderSide: BorderSide(color: c.destructive),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          textStyle: AppTypography.headline(size: 15, weight: FontWeight.w700),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
          elevation: 0,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.textPrimary,
          side: BorderSide(color: c.border),
          textStyle: AppTypography.headline(size: 14, weight: FontWeight.w600),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
      ),

      // ── Los que faltaban ────────────────────────────────────────────────
      // Todo lo de abajo se estaba dibujando con los valores por defecto de
      // Material, que están pensados para otro producto. `cardTheme` y
      // `bottomNavigationBarTheme` sí existían, y se borraron: en toda la app
      // hay 0 widgets `Card` y la barra inferior es un `Row` propio en el
      // shell, así que no pintaban nada.

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.primary,
          textStyle: AppTypography.headline(size: 14, weight: FontWeight.w600),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.chipAll),
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          textStyle: AppTypography.headline(size: 15, weight: FontWeight.w700),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        ),
      ),

      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: c.textPrimary),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: c.popover,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceAll),
        titleTextStyle: AppTypography.headline(size: 18, color: c.textPrimary),
        contentTextStyle: AppTypography.body(color: c.textSecondary),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.popover,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalBackgroundColor: c.popover,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceTop),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.cardSurface,
        contentTextStyle: AppTypography.body(color: c.textPrimary),
        actionTextColor: c.primary,
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        elevation: 0,
      ),

      dividerTheme: DividerThemeData(
        color: c.border.withValues(alpha: 0.3),
        thickness: 1,
        space: 1,
      ),

      chipTheme: ChipThemeData(
        backgroundColor: c.cardSurface,
        selectedColor: c.primary.withValues(alpha: 0.2),
        side: BorderSide(color: c.border),
        labelStyle: AppTypography.body(size: 13, color: c.textPrimary),
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.chipAll),
      ),

      listTileTheme: ListTileThemeData(
        iconColor: c.textSecondary,
        textColor: c.textPrimary,
        titleTextStyle: AppTypography.body(size: 15, color: c.textPrimary),
        subtitleTextStyle: AppTypography.body(size: 13, color: c.textSecondary),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: c.primary,
        linearTrackColor: c.cardSurface,
        circularTrackColor: Colors.transparent,
      ),

      tabBarTheme: TabBarThemeData(
        labelColor: c.primary,
        unselectedLabelColor: c.textSecondary,
        indicatorColor: c.primary,
        labelStyle: AppTypography.body(size: 14, weight: FontWeight.w700),
        unselectedLabelStyle:
            AppTypography.body(size: 14, weight: FontWeight.w700),
        dividerColor: c.border.withValues(alpha: 0.3),
      ),

      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.primary : c.textSecondary,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? c.primary.withValues(alpha: 0.35)
              : c.cardSurface,
        ),
      ),

      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.primary : Colors.transparent,
        ),
        checkColor: WidgetStateProperty.all(c.onPrimary),
        side: BorderSide(color: c.border, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),

      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.primary : c.border,
        ),
      ),

      sliderTheme: SliderThemeData(
        activeTrackColor: c.primary,
        inactiveTrackColor: c.cardSurface,
        thumbColor: c.primary,
        overlayColor: c.primary.withValues(alpha: 0.15),
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: c.popover,
          borderRadius: AppRadii.chipAll,
          border: Border.all(color: c.border),
        ),
        textStyle: AppTypography.body(size: 12, color: c.textPrimary),
      ),

      popupMenuTheme: PopupMenuThemeData(
        color: c.popover,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
        textStyle: AppTypography.body(size: 14, color: c.textPrimary),
      ),

      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.popover,
        surfaceTintColor: Colors.transparent,
        headerBackgroundColor: c.cardSurface,
        headerForegroundColor: c.textPrimary,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceAll),
      ),

      timePickerTheme: TimePickerThemeData(
        backgroundColor: c.popover,
        dialBackgroundColor: c.cardSurface,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.surfaceAll),
      ),

    );
  }
}
