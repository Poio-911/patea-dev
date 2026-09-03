import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
    final int index = backgroundIndex ?? ref.watch(backgroundIndexProvider);
    final int clampedIndex = index < 1 ? 1 : (index > 9 ? 9 : index);
    final bgAsset = 'assets/images/backgrounds/fondo_$clampedIndex.jpg';

    return Stack(
      children: [
        // 1. Color base muy oscuro
        Positioned.fill(
          child: Container(color: const Color(0xFF070B11)),
        ),

        // 2. Fotografía real de estadio / césped desenfocada
        Positioned.fill(
          child: Opacity(
            opacity: 0.40,
            child: Image.asset(
              bgAsset,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return const SizedBox();
              },
            ),
          ),
        ),

        // 3. Overlay viñeta azul noche (from-blue-950/40 to-blue-950/60)
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
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

        // 4. Overlay sutil neón en esquina y oscurecido hacia abajo (from-primary/5 to-background/90)
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0x1FCCFF00), // Volt tint
                  Colors.transparent,
                  Color(0xF00B0E14), // Dark carbon
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
