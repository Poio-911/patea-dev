import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/patea_colors.dart';

/// La web (`GameModeBackground`, montado UNA vez en `client-providers.tsx`)
/// elige una foto al azar (1-9) una sola vez por carga de página y la
/// mantiene fija para toda la sesión — es el mismo fondo detrás de TODAS
/// las secciones, no una foto distinta por pantalla. Este provider replica
/// eso: se computa una sola vez (no por-widget) y se comparte entre
/// cualquier pantalla que use `PateaBackground`.
final backgroundIndexProvider = Provider<int>((ref) => Random().nextInt(9) + 1);

/// Fondo de la aplicación idéntico a GameModeBackground de la webapp
/// Incluye imagen de césped de cancha real desenfocada + viñetas azul noche / carbon
class PateaBackground extends ConsumerWidget {
  final Widget child;
  final int? backgroundIndex;

  const PateaBackground({
    super.key,
    required this.child,
    this.backgroundIndex,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // En claro no hay foto de cancha. No es una simplificación: es lo que hace
    // la web, donde `ThemeBackground` devuelve `null` fuera del tema `game` y
    // el fondo es el degradado suave del `body`. Con la foto puesta, el texto
    // oscuro del tema claro queda ilegible sobre el césped.
    if (!context.c.isDarkSurface) {
      return Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    context.c.primary.withValues(alpha: 0.06),
                    context.c.accent.withValues(alpha: 0.05),
                    context.c.background,
                  ],
                ),
              ),
            ),
          ),
          child,
        ],
      );
    }

    final int index = backgroundIndex ?? ref.watch(backgroundIndexProvider);
    final int clampedIndex = index < 1 ? 1 : (index > 9 ? 9 : index);
    final bgAsset = 'assets/images/backgrounds/fondo_$clampedIndex.jpg';

    return Stack(
      children: [
        // 1. Color base muy oscuro
        Positioned.fill(child: ColoredBox(color: context.c.background)),

        // 2. Fotografía real de estadio / césped desenfocada
        Positioned.fill(
          child: Opacity(
            opacity: 0.40,
            child: Image.asset(
              bgAsset,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => const SizedBox(),
            ),
          ),
        ),

        // 3. Overlay viñeta azul noche (from-blue-950/40 to-blue-950/60)
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x80040E24),
                  Color(0x30040E24),
                  Color(0xB3040E24),
                ],
              ),
            ),
          ),
        ),

        // 4. Overlay sutil neón en esquina y oscurecido hacia abajo
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  context.c.brandVolt.withValues(alpha: 0.12),
                  Colors.transparent,
                  const Color(0xF00B0E14),
                ],
              ),
            ),
          ),
        ),

        // 5. Contenido de la pantalla
        child,
      ],
    );
  }
}
