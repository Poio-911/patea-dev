import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class PateaBackground extends StatelessWidget {
  final Widget child;

  const PateaBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        gradient: RadialGradient(
          center: Alignment(-0.8, -0.9),
          radius: 1.2,
          colors: [
            Color(0x14CCFF00), // Sutil glow Neon Volt en esquina superior izquierda
            Colors.transparent,
          ],
          stops: [0.0, 0.7],
        ),
      ),
      child: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.9, 0.9),
            radius: 1.2,
            colors: [
              Color(0x0F00E5CC), // Sutil glow Turquesa en esquina inferior derecha
              Colors.transparent,
            ],
            stops: [0.0, 0.65],
          ),
        ),
        child: child,
      ),
    );
  }
}
