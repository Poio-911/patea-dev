// ignore_for_file: deprecated_member_use_from_same_package

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:patea_mobile/core/theme/app_colors.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';

/// Mientras `AppColors` y `PateaColors.game` convivan, tienen que valer lo
/// mismo.
///
/// La migración de los ~1185 usos se hace archivo por archivo, así que durante
/// un tiempo las dos fuentes están vivas a la vez. Si alguien corrige un color
/// en una y se olvida de la otra, media app queda de un color y media del otro
/// — que es exactamente el defecto que este trabajo vino a arreglar. Este test
/// hace imposible ese olvido.
///
/// Cuando llegue la Fase 1 y haya que corregir los valores contra
/// `globals.css`, este test va a fallar: eso es lo correcto. Se cambian los dos
/// lados, o se borra `AppColors` si ya no queda ningún uso.
void main() {
  // Sin binding no hay bundle de assets, y `google_fonts` sale a buscar las
  // fuentes por red aunque esten empaquetadas: ensucia la salida con errores
  // que no son del test.
  TestWidgetsFlutterBinding.ensureInitialized();

  test('AppColors y PateaColors.game no pueden separarse', () {
    const g = PateaColors.game;
    final pares = <String, List<Color>>{
      'background': [AppColors.background, g.background],
      'card': [AppColors.card, g.card],
      'cardSurface': [AppColors.cardSurface, g.cardSurface],
      'popover': [AppColors.popover, g.popover],
      'border': [AppColors.border, g.border],
      'input': [AppColors.input, g.input],
      'voltNeon → primary': [AppColors.voltNeon, g.primary],
      'voltNeon → brandVolt': [AppColors.voltNeon, g.brandVolt],
      'turquoise → accent': [AppColors.turquoise, g.accent],
      'destructive': [AppColors.destructive, g.destructive],
      'success': [AppColors.success, g.success],
      'warning': [AppColors.warning, g.warning],
      'info': [AppColors.info, g.info],
      'textPrimary': [AppColors.textPrimary, g.textPrimary],
      'textSecondary': [AppColors.textSecondary, g.textSecondary],
      'eliteBorder': [AppColors.eliteBorder, g.eliteBorder],
      'goldBorder': [AppColors.goldBorder, g.goldBorder],
      'silverBorder': [AppColors.silverBorder, g.silverBorder],
      'bronzeBorder': [AppColors.bronzeBorder, g.bronzeBorder],
      'posDel': [AppColors.posDel, g.posDel],
      'posMed': [AppColors.posMed, g.posMed],
      'posDef': [AppColors.posDef, g.posDef],
      'posPor': [AppColors.posPor, g.posPor],
    };

    final distintos = <String>[];
    pares.forEach((nombre, par) {
      if (par[0] != par[1]) {
        distintos.add('$nombre: AppColors=${par[0]} PateaColors=${par[1]}');
      }
    });

    expect(distintos, isEmpty,
        reason: 'Se corrigió un color en un solo lado:\n${distintos.join('\n')}');
  });

  test('los dos temas publican su PateaColors', () {
    expect(AppTheme.darkTheme.extension<PateaColors>(), PateaColors.game);
    expect(AppTheme.lightTheme.extension<PateaColors>(), PateaColors.light);
  });

  test('el textTheme existe: un Text sin estilo ya no cae en Roboto', () {
    for (final theme in [AppTheme.darkTheme, AppTheme.lightTheme]) {
      final body = theme.textTheme.bodyMedium!;
      expect(body.fontFamily, isNot(anyOf(isNull, contains('Roboto'))));
      expect(body.color, theme.extension<PateaColors>()!.textPrimary);
    }
  });
}
