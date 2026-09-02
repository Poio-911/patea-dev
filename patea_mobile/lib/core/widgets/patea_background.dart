import 'package:flutter/material.dart';

/// Fondo de la aplicación idéntico a GameModeBackground de la webapp
/// Incluye imagen de césped de cancha real desenfocada + viñetas azul noche / carbon
class PateaBackground extends StatelessWidget {
  final Widget child;
  final int backgroundIndex;

  const PateaBackground({
    super.key,
    required this.child,
    this.backgroundIndex = 1,
  });

  @override
  Widget build(BuildContext context) {
    final bgAsset = 'assets/images/backgrounds/fondo_${backgroundIndex.clamp(1, 9)}.jpg';

    return Stack(
      children: [
        // 1. Color base muy oscuro
        Positioned.fill(
          child: Container(color: const Color(0xFF070B11)),
        ),

        // 2. Fotografía real de estadio / césped desenfocada
        Positioned.fill(
          child: Opacity(
            opacity: 0.38,
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
