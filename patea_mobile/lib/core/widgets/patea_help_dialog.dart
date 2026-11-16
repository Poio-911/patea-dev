import 'package:flutter/material.dart';
import '../theme/patea_colors.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import 'soccer_runner_icon.dart';

/// Modal de Ayuda y Tutorial de Pateá (port de src/components/help-dialog.tsx)
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
      icon: Icons.groups_2_rounded,
      title: 'Tu grupo, tu punto de encuentro',
      content:
          'Creá un grupo o unite con su código. Ahí encontrás al plantel y organizás los partidos con tu gente.',
    ),
    _TutorialStep(
      icon: Icons.checkroom_rounded,
      title: 'Equipos con identidad',
      content:
          'Diseñá la camiseta y elegí el plantel de tu equipo. Podés usarlo para organizar partidos por equipos sin volver a elegir a cada jugador.',
    ),
    _TutorialStep(
      icon: Icons.sports_soccer_rounded,
      title: 'Elegí cómo se arma el partido',
      content:
          'Elegí cómo jugar: Manual (invitación directa), Colaborativo (inscripción abierta para el grupo) o Por Equipos (duelos clásicos con plantillas cerradas).',
    ),
    _TutorialStep(
      icon: Icons.lock_clock_rounded,
      title: 'Jugá, evaluá y seguí tu progreso',
      content:
          'Después de jugar, puntuá a tus amigos para que su OVR y atributos evolucionen. ¡Tranquilo! Las evaluaciones son anónimas y seguras hasta que decidas revelar tu identidad.',
    ),
    _TutorialStep(
      icon: Icons.travel_explore_rounded,
      title: 'Encontrá a quien falta',
      content:
          'Encontrá jugadores libres para completar tu equipo o anotarte en partidos públicos compatibles con tu nivel. ¡Hacete ver y dejá tu huella en la cancha!',
    ),
    _TutorialStep(
      icon: Icons.emoji_events_rounded,
      title: 'Volvé a ver cómo jugaste',
      content:
          'En tu perfil tenés el historial de partidos, las evaluaciones y la evolución de tu OVR. La tabla de tu grupo te permite comparar el progreso con tus compañeros.',
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        decoration: BoxDecoration(
          color: context.c.popover,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: context.c.overlayLine, width: 1),
          boxShadow: [
            BoxShadow(
              // Una sombra es negra en los dos temas.
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Cabecera con runner icon
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SoccerRunnerIcon(size: 24, color: context.c.primary),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    '¡Bienvenid@ a Pateá!',
                    textAlign: TextAlign.center,
                    style: AppTypography.headline(
                      size: 20,
                      weight: FontWeight.w900,
                      color: context.c.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Guía rápida para sacarle todo el jugo a la app.',
              style: AppTypography.body(
                size: 13,
                color: context.c.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),

            // Carrusel de pasos
            //
            // La altura crece con la escala de texto del sistema. Era 180
            // fijos y adentro hay tres líneas de texto: a 1,3× el paso
            // desbordaba 44 px por abajo. Es el caso de manual del `height:`
            // fijo con texto adentro.
            SizedBox(
              height: MediaQuery.textScalerOf(context).scale(180),
              child: PageView.builder(
                controller: _pageController,
                itemCount: _steps.length,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemBuilder: (context, index) {
                  final step = _steps[index];
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: context.c.card,
                      borderRadius: AppRadii.cardAll,
                      border: Border.all(
                        color: context.c.brandVolt.withValues(alpha: 0.25),
                        width: 1,
                      ),
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(step.icon, color: context.c.primary, size: 30),
                          const SizedBox(height: 8),
                          Text(
                            step.title,
                            style: AppTypography.headline(
                              size: 15,
                              weight: FontWeight.w800,
                              color: context.c.textPrimary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            step.content,
                            style: AppTypography.body(
                              size: 14,
                              color: context.c.textSecondary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // Indicadores de puntos
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_steps.length, (index) {
                final isCurrent = index == _currentPage;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: isCurrent ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: isCurrent
                        ? context.c.primary
                        : context.c.overlayStrong,
                    borderRadius: AppRadii.hairAll,
                  ),
                );
              }),
            ),
            const SizedBox(height: 20),

            // Botón de acción principal
            SizedBox(
              width: double.infinity,
              height: MediaQuery.textScalerOf(context).scale(46),
              child: ElevatedButton(
                onPressed: () {
                  if (_currentPage < _steps.length - 1) {
                    _pageController.nextPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  } else {
                    Navigator.of(context).pop();
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.c.primary,
                  foregroundColor: context.c.onPrimary,
                  shape: RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
                  elevation: 0,
                ),
                child: Text(
                  _currentPage < _steps.length - 1
                      ? 'Siguiente'
                      : '¡Entendido!',
                  style: AppTypography.action(
                    size: 15,
                    weight: FontWeight.w600,
                    color: context.c.onPrimary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TutorialStep {
  final IconData icon;
  final String title;
  final String content;

  const _TutorialStep({
    required this.icon,
    required this.title,
    required this.content,
  });
}
