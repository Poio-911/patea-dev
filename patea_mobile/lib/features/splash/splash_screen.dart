import 'package:flutter/material.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/patea_brand.dart';

/// Identidad estable mientras Firebase resuelve la sesión, sin demorar el ingreso.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      backgroundColor: context.c.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Spacer(flex: 3),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: reduced ? 1 : 0, end: 1),
                duration: reduced
                    ? Duration.zero
                    : const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
                builder: (context, value, child) => Opacity(
                  opacity: value,
                  child: Transform.translate(
                    offset: Offset(0, 12 * (1 - value)),
                    child: child,
                  ),
                ),
                child: Column(
                  children: [
                    const PateaBrand(width: 190, height: 72),
                    const SizedBox(height: 24),
                    Text(
                      'El fútbol que nos junta.',
                      textAlign: TextAlign.center,
                      style: AppTypography.body(
                        size: 17,
                        color: context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(flex: 3),
              Semantics(
                label: 'Preparando tu cancha',
                liveRegion: true,
                child: SizedBox(
                  width: 112,
                  child: LinearProgressIndicator(
                    minHeight: 3,
                    value: reduced ? 0.5 : null,
                    backgroundColor: context.c.overlayLine,
                    color: context.c.primary,
                    borderRadius: AppRadii.hairAll,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Preparando tu cancha',
                style: AppTypography.body(
                  size: 12,
                  color: context.c.textSecondary,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
