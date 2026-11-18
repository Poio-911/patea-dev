import 'package:flutter/material.dart';

import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'patea_brand.dart';

/// Modal de Ayuda y Tutorial de Pateá con escenas editoriales reales.
class PateaHelpDialog extends StatefulWidget {
  const PateaHelpDialog({super.key});

  @override
  State<PateaHelpDialog> createState() => _PateaHelpDialogState();
}

class _PateaHelpDialogState extends State<PateaHelpDialog> {
  int _currentPage = 0;
  final PageController _pageController = PageController();

  static const List<_TutorialStep> _steps = [
    _TutorialStep(
      assetPath: 'assets/brand/patea_groups.webp',
      eyebrow: 'Paso 1 · Comunidad',
      title: 'Tu grupo, tu punto de encuentro',
      content:
          'Creá un grupo o unite con su código. Ahí encontrás al plantel y organizás los partidos con tu gente.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_locker_room.webp',
      eyebrow: 'Paso 2 · Identidad',
      title: 'Equipos con identidad propia',
      content:
          'Diseñá la camiseta y definí el plantel de tu equipo para armar cruces sin elegir jugador por jugador.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_matchday.webp',
      eyebrow: 'Paso 3 · Convocatoria',
      title: 'Elegí cómo se arma el partido',
      content:
          'Jugá en modo Manual, Colaborativo o Por Equipos, con horario fijo o votación entre los convocados.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_evaluations.webp',
      eyebrow: 'Paso 4 · Tercer tiempo',
      title: 'Evaluá por nota, etiquetas o reseña',
      content:
          'Después del partido valorá a tus compañeros de forma anónima para actualizar su OVR y sus atributos.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_explore.webp',
      eyebrow: 'Paso 5 · Explorar',
      title: 'Encontrá a quien falta',
      content:
          'Sumá jugadores disponibles cerca tuyo o anotate en partidos abiertos cuando quieras jugar.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_ranking.webp',
      eyebrow: 'Paso 6 · Carrera',
      title: 'Seguí tu evolución y tu historial',
      content:
          'Consultá tu ficha, tus devoluciones partido a partido y tu lugar en el ranking del plantel.',
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final scaler = MediaQuery.textScalerOf(context);

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Container(
          decoration: BoxDecoration(
            color: c.popover,
            borderRadius: AppRadii.surfaceAll,
            border: Border.all(color: c.border),
          ),
          clipBehavior: Clip.antiAlias,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(child: PateaBrand(height: 24)),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        'Cerrar',
                        style: AppTypography.action(
                          size: 13,
                          color: c.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: scaler.scale(250).clamp(240.0, 320.0),
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _steps.length,
                    onPageChanged: (idx) => setState(() => _currentPage = idx),
                    itemBuilder: (context, index) {
                      final step = _steps[index];
                      return Container(
                        decoration: BoxDecoration(
                          color: c.card,
                          borderRadius: AppRadii.cardAll,
                          border: Border.all(color: c.border),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(
                              height: 108,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  Image.asset(
                                    step.assetPath,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) =>
                                        ColoredBox(color: c.cardSurface),
                                  ),
                                  DecoratedBox(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          c.photoFallback.withValues(alpha: 0.15),
                                          c.photoFallback.withValues(alpha: 0.65),
                                        ],
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    left: 14,
                                    bottom: 10,
                                    child: Text(
                                      step.eyebrow,
                                      style: AppTypography.code(
                                        size: 12,
                                        weight: FontWeight.w700,
                                        color: c.onPhoto,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: SingleChildScrollView(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      step.title,
                                      style: AppTypography.headline(
                                        size: 16,
                                        weight: FontWeight.w700,
                                        color: c.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      step.content,
                                      style: AppTypography.body(
                                        size: 13,
                                        color: c.textSecondary,
                                        height: 1.35,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_steps.length, (index) {
                    final isCurrent = index == _currentPage;
                    return AnimatedContainer(
                      duration: reduced
                          ? Duration.zero
                          : const Duration(milliseconds: 180),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: isCurrent ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: isCurrent ? c.primary : c.overlayStrong,
                        borderRadius: AppRadii.hairAll,
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    if (_currentPage < _steps.length - 1) {
                      if (reduced) {
                        _pageController.jumpToPage(_currentPage + 1);
                      } else {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 240),
                          curve: Curves.easeOutCubic,
                        );
                      }
                    } else {
                      Navigator.of(context).pop();
                    }
                  },
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadii.cardAll,
                    ),
                  ),
                  child: Text(
                    _currentPage < _steps.length - 1
                        ? 'Siguiente'
                        : 'Empezar a jugar',
                    style: AppTypography.action(size: 15, color: c.onPrimary),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TutorialStep {
  final String assetPath;
  final String eyebrow;
  final String title;
  final String content;

  const _TutorialStep({
    required this.assetPath,
    required this.eyebrow,
    required this.title,
    required this.content,
  });
}
