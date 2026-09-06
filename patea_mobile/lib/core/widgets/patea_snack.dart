/// Los avisos de una línea. Tres, y no diez.
///
/// Había **66 `SnackBar`** con diez fondos distintos: `voltNeon`,
/// `destructive`, `card`, `cardSurface`, `success`, `background`, `warning`,
/// `popover`, negro y blanco translúcido. El mismo "guardado" no se veía igual
/// en dos pantallas, y el color no significaba nada — a veces era el estado, a
/// veces la sección, a veces lo que había a mano.
///
/// Acá el color **sí** significa: verde salió bien, rojo salió mal, neutro es
/// información. Nada más.
///
/// Uso:
/// ```dart
/// PateaSnack.ok(context, 'Partido creado');
/// PateaSnack.error(context, 'No se pudo guardar');
/// ```
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:flutter/material.dart';

import '../theme/patea_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';

enum _Tono { ok, error, info }

abstract final class PateaSnack {
  /// Salió bien.
  static void ok(BuildContext context, String mensaje) =>
      _mostrar(context, mensaje, _Tono.ok);

  /// Salió mal, y el usuario puede hacer algo al respecto.
  static void error(BuildContext context, String mensaje) =>
      _mostrar(context, mensaje, _Tono.error);

  /// Ni bien ni mal: pasó algo que conviene saber.
  static void info(BuildContext context, String mensaje) =>
      _mostrar(context, mensaje, _Tono.info);

  static void _mostrar(BuildContext context, String mensaje, _Tono tono) {
    final (icono, color) = switch (tono) {
      _Tono.ok => (Icons.check_circle_rounded, context.c.success),
      _Tono.error => (Icons.error_rounded, context.c.destructive),
      _Tono.info => (Icons.info_rounded, context.c.textSecondary),
    };

    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger
      // Sin esto, tocar tres veces un botón que falla apila tres avisos y el
      // último tarda seis segundos en aparecer.
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: context.c.popover,
          elevation: 0,
          margin: const EdgeInsets.all(14),
          duration: Duration(seconds: tono == _Tono.error ? 4 : 2),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.cardAll,
            side: BorderSide(color: color.withValues(alpha: 0.45)),
          ),
          content: Row(
            children: [
              Icon(icono, size: 17, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  mensaje,
                  style: AppTypography.body(
                    size: 13.5,
                    color: context.c.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
  }
}
