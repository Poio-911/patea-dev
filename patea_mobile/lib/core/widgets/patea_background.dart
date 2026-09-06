import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/fondo_claro.dart';
import '../theme/patea_colors.dart';

/// La web (`GameModeBackground`, montado UNA vez en `client-providers.tsx`)
/// elige una foto al azar (1-9) una sola vez por carga de página y la
/// mantiene fija para toda la sesión — es el mismo fondo detrás de TODAS
/// las secciones, no una foto distinta por pantalla. Este provider replica
/// eso: se computa una sola vez (no por-widget) y se comparte entre
/// cualquier pantalla que use `PateaBackground`.
final backgroundIndexProvider = Provider<int>((ref) => Random().nextInt(9) + 1);

/// Azul noche idéntico al blue-950 de Tailwind / globals.css web
const _blue950 = Color(0xFF040E24);

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
    final int index = backgroundIndex ?? ref.watch(backgroundIndexProvider);
    final int clampedIndex = index < 1 ? 1 : (index > 9 ? 9 : index);

    if (!context.c.isDarkSurface) {
      // Cual de las tres variantes candidatas se dibuja lo decide
      // `fondoClaroProvider`, y el selector vive en `/dev/gallery`. Es
      // andamio para poder comparar en el telefono: cuando este elegida,
      // aca queda una sola y `fondo_claro.dart` se borra.
      return Stack(
        children: [
          Positioned.fill(child: FondoClaroWidget(indiceFoto: clampedIndex)),
          child,
        ],
      );
    }

    final bgAsset = 'assets/backgrounds/fondo_$clampedIndex.jpg';

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

        // 3. Overlay viñeta azul noche (from-blue-950/40 via-transparent to-blue-950/60)
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  _blue950.withValues(alpha: 0.40),
                  _blue950.withValues(alpha: 0.0),
                  _blue950.withValues(alpha: 0.60),
                ],
              ),
            ),
          ),
        ),

        // 4. Overlay sutil neón en esquina y oscurecido hacia abajo
        // (from-primary/5 via-transparent to-background/80)
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  context.c.brandVolt.withValues(alpha: 0.05),
                  context.c.brandVolt.withValues(alpha: 0.0),
                  context.c.background.withValues(alpha: 0.80),
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
