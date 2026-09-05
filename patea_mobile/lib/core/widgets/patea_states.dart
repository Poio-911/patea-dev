

/// Cargando, vacío y error. Los tres estados que toda pantalla tiene y que
/// nadie había escrito una sola vez.
///
/// Había **79 `CircularProgressIndicator` sueltos** y **seis clases de estado
/// vacío con seis nombres distintos** (`_Empty`, `_EmptyState`, `_EmptyHint`,
/// `_EmptyLine`, `_EmptyMural`, `_WelcomeEmptyState`). Y lo peor: veinte de
/// las treinta y una ramas `error:` de `AsyncValue` eran un
/// `Text('Error: $e')` pelado, que le muestra al usuario el texto de la
/// excepción —y, hasta la Fase 0, en Roboto.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';

/// La ruedita, centrada y con el tamaño de siempre.
class PateaLoading extends StatelessWidget {
  /// Cuánto alto reservar. Sin esto, adentro de un `Column` la ruedita colapsa
  /// y el contenido salta cuando termina de cargar.
  final double? height;

  const PateaLoading({super.key, this.height});

  @override
  Widget build(BuildContext context) {
    const spinner = Center(
      child: SizedBox(
        width: 26,
        height: 26,
        child: CircularProgressIndicator(strokeWidth: 2.4),
      ),
    );
    if (height == null) return spinner;
    return SizedBox(height: height, child: spinner);
  }
}

/// No hay nada que mostrar, y eso está bien.
///
/// El texto va en dos niveles a propósito: el título dice *qué* falta y la
/// aclaración dice *qué hacer*. Un estado vacío que sólo dice "sin resultados"
/// deja al usuario sin próximo paso.
class PateaEmpty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? hint;

  /// Un botón, cuando hay una acción evidente ("Armar partido", "Invitar").
  final Widget? action;

  /// Para usarlo adentro de una tarjeta: sin el ícono grande ni el aire.
  final bool compact;

  const PateaEmpty({
    super.key,
    required this.icon,
    required this.title,
    this.hint,
    this.action,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: 24,
          vertical: compact ? 18 : 40,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: compact ? 26 : 38, color: AppColors.textSecondary),
            SizedBox(height: compact ? 8 : 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.headline(
                size: compact ? 14 : 16,
                weight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            if (hint != null) ...[
              const SizedBox(height: 6),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: AppTypography.body(
                  size: 13,
                  height: 1.4,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (action != null) ...[
              SizedBox(height: compact ? 12 : 20),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Algo falló.
///
/// **No muestra la excepción.** El texto de un `FirebaseException` o de un
/// `SocketException` no le dice nada a alguien que quiere ver quién juega el
/// sábado, y en cambio expone rutas y nombres de colecciones. El detalle va a
/// la consola en debug; en pantalla queda una frase y, cuando se puede, un
/// botón para reintentar.
class PateaError extends StatelessWidget {
  final Object? error;
  final String message;
  final VoidCallback? onRetry;
  final bool compact;

  const PateaError({
    super.key,
    this.error,
    this.message = 'No se pudo cargar esto.',
    this.onRetry,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    assert(() {
      if (error != null) debugPrint('PateaError: $error');
      return true;
    }());

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: 24,
          vertical: compact ? 18 : 40,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.destructive.withValues(alpha: 0.12),
                borderRadius: AppRadii.chipAll,
              ),
              child: Icon(Icons.wifi_off_rounded,
                  size: compact ? 18 : 22, color: AppColors.destructive),
            ),
            SizedBox(height: compact ? 8 : 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.body(
                size: 14,
                height: 1.4,
                color: AppColors.textSecondary,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Reintentar'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
