import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
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
      title: 'Paso 1: El Corazón del Club',
      content:
          'Todo empieza en tu Grupo. Es el punto de encuentro donde podés chatear, ver la actividad reciente y organizar la próxima juntada. Creá tu propio grupo o unite a uno con un código.',
    ),
    _TutorialStep(
      icon: Icons.checkroom_rounded,
      title: 'Paso 2: Locker Room',
      content:
          'Diseñá la camiseta de tu equipo y armá planteles fijos. Los equipos tienen memoria: seguí su historial de victorias y la evolución de cada jugador a lo largo del tiempo.',
    ),
    _TutorialStep(
      icon: Icons.sports_soccer_rounded,
      title: 'Paso 3: Modos de Juego',
      content:
          'Elegí cómo jugar: Manual (invitación directa), Colaborativo (inscripción abierta para el grupo) o Por Equipos (duelos clásicos con plantillas cerradas).',
    ),
    _TutorialStep(
      icon: Icons.lock_clock_rounded,
      title: 'Paso 4: Subí de Nivel',
      content:
          'Después de jugar, puntuá a tus amigos para que su OVR y atributos evolucionen. ¡Tranquilo! Las evaluaciones son anónimas y seguras hasta que decidas revelar tu identidad.',
    ),
    _TutorialStep(
      icon: Icons.travel_explore_rounded,
      title: 'Paso 5: Mercado de Fichajes',
      content:
          'Encontrá jugadores libres para completar tu equipo o anotarte en partidos públicos compatibles con tu nivel. ¡Hacete ver y dejá tu huella en la cancha!',
    ),
    _TutorialStep(
      icon: Icons.emoji_events_rounded,
      title: 'Paso 6: Alcanzá la Cima',
      content:
          'Desbloqueá logros por tu constancia y talento. Compará tu nivel con la comunidad en los Rankings globales y convertite en una leyenda de Pateá.',
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
          color: AppColors.popover,
          borderRadius: AppRadii.surfaceAll,
          border: Border.all(color: Colors.white.withValues(alpha: 0.15), width: 1),
          boxShadow: [
            BoxShadow(
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
                const SoccerRunnerIcon(size: 24, color: AppColors.voltNeon),
                const SizedBox(width: 8),
                Text(
                  '¡Bienvenid@ a Pateá!',
                  style: AppTypography.headline(
                    size: 20,
                    weight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Guía rápida para sacarle todo el jugo a la app.',
              style: AppTypography.body(
                size: 13,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),

            // Carrusel de pasos
            SizedBox(
              height: 180,
              child: PageView.builder(
                controller: _pageController,
                itemCount: _steps.length,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemBuilder: (context, index) {
                  final step = _steps[index];
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: AppRadii.cardAll,
                      border: Border.all(
                        color: AppColors.voltNeon.withValues(alpha: 0.25),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(step.icon, color: AppColors.voltNeon, size: 30),
                        const SizedBox(height: 8),
                        Text(
                          step.title,
                          style: AppTypography.headline(
                            size: 15,
                            weight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          step.content,
                          style: AppTypography.body(
                            size: 12,
                            color: AppColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
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
                    color: isCurrent ? AppColors.voltNeon : Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
            const SizedBox(height: 20),

            // Botón de acción principal
            SizedBox(
              width: double.infinity,
              height: 46,
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
                  backgroundColor: AppColors.voltNeon,
                  foregroundColor: AppColors.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadii.cardAll,
                  ),
                  elevation: 0,
                ),
                child: Text(
                  _currentPage < _steps.length - 1 ? 'Siguiente' : '¡Entendido!',
                  style: AppTypography.headline(
                    size: 14,
                    weight: FontWeight.w900,
                    color: AppColors.background,
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
