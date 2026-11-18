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

  /// Aviso estilizado con marca/ícono propio (ej. confirmación de evaluación).
  static void custom(
    BuildContext context,
    String mensaje, {
    required Widget leading,
    Color? borderColor,
  }) =>
      of(context).custom(mensaje, leading: leading, borderColor: borderColor);

  /// Para avisar **después de un `await`**.
  ///
  /// Pasado el await el widget puede estar desmontado y el `BuildContext` ya
  /// no vale — ni para buscar el messenger ni para leer los colores. Se
  /// captura esto antes, y se usa después:
  ///
  /// ```dart
  /// final avisar = PateaSnack.of(context);
  /// try {
  ///   await guardar();
  /// } catch (e) {
  ///   avisar.error('No se pudo guardar');
  /// }
  /// ```
  static PateaSnackSender of(BuildContext context) => PateaSnackSender._(
        ScaffoldMessenger.maybeOf(context),
        context.c,
      );

  static void _mostrar(BuildContext context, String mensaje, _Tono tono) {
    PateaSnackSender._(ScaffoldMessenger.maybeOf(context), context.c)
        ._enviar(mensaje, tono);
  }
}

/// Un avisador que ya no necesita el `BuildContext`. Ver [PateaSnack.of].
class PateaSnackSender {
  final ScaffoldMessengerState? _messenger;
  final PateaColors _c;

  const PateaSnackSender._(this._messenger, this._c);

  void ok(String mensaje) => _enviar(mensaje, _Tono.ok);
  void error(String mensaje) => _enviar(mensaje, _Tono.error);
  void info(String mensaje) => _enviar(mensaje, _Tono.info);

  void custom(
    String mensaje, {
    required Widget leading,
    Color? borderColor,
  }) =>
      _enviarCustom(mensaje, leading: leading, borderColor: borderColor);

  void _enviar(String mensaje, _Tono tono) {
    final (icono, color) = switch (tono) {
      _Tono.ok => (Icons.check_circle_rounded, _c.success),
      _Tono.error => (Icons.error_rounded, _c.destructive),
      _Tono.info => (Icons.info_rounded, _c.textSecondary),
    };
    _enviarCustom(
      mensaje,
      leading: Icon(icono, size: 17, color: color),
      borderColor: color,
      duration: Duration(seconds: tono == _Tono.error ? 4 : 2),
      gap: 10,
      fontSize: 13.5,
    );
  }

  void _enviarCustom(
    String mensaje, {
    required Widget leading,
    Color? borderColor,
    Duration duration = const Duration(seconds: 3),
    double gap = 12,
    double fontSize = 14,
  }) {
    final messenger = _messenger;
    if (messenger == null) return;
    final sideColor = borderColor ?? _c.border;

    messenger
      // Sin esto, tocar tres veces un botón que falla apila tres avisos y el
      // último tarda seis segundos en aparecer.
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: _c.popover,
          elevation: 0,
          margin: const EdgeInsets.all(14),
          duration: duration,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.cardAll,
            side: BorderSide(color: sideColor.withValues(alpha: 0.45)),
          ),
          content: Row(
            children: [
              leading,
              SizedBox(width: gap),
              Expanded(
                child: Text(
                  mensaje,
                  style: AppTypography.body(
                    size: fontSize,
                    color: _c.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
  }
}
