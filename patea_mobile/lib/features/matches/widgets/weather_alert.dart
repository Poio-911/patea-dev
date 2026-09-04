import 'package:flutter/material.dart';

import '../../../core/models/match_model.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_typography.dart';

/// Avisa cuando el clima del partido va a molestar.
///
/// Port de `MatchWeatherAlert`. Sólo aparece si hay algo que decir: sin
/// advertencias no ocupa lugar. (La web, en el caso sin datos, muestra un
/// cartel de "No hay datos climáticos disponibles" que su propio código marca
/// como "para development" — eso no se portó: un partido sin pronóstico no
/// necesita un cartel avisándolo.)
///
/// Los umbrales son los mismos que los de la web.
class MatchWeatherAlert extends StatelessWidget {
  final MatchModel match;

  const MatchWeatherAlert({super.key, required this.match});

  @override
  Widget build(BuildContext context) {
    final w = match.weather;
    if (w == null) return const SizedBox.shrink();

    // Sólo tiene sentido antes de jugar; después ya te mojaste.
    if (match.status != 'upcoming' && match.status != 'planning') {
      return const SizedBox.shrink();
    }

    final ({IconData icon, Color color, String text})? warning = switch (w) {
      _ when w.precipitation > 40 => (
          icon: Icons.water_drop_outlined,
          color: AppColors.info,
          text: 'Lluvia probable (${w.precipitation}%). Llevá algo para taparte.',
        ),
      _ when w.temperature > 28 => (
          icon: Icons.wb_sunny_outlined,
          color: AppColors.warning,
          text: 'Calor fuerte (${w.temperature}°). Hidratate bien.',
        ),
      _ when w.uvIndex > 6 => (
          icon: Icons.wb_sunny_outlined,
          color: AppColors.warning,
          text: 'UV muy alto (${w.uvIndex}). Usá protector.',
        ),
      _ when w.windSpeed > 20 => (
          icon: Icons.air_rounded,
          color: AppColors.textSecondary,
          text: 'Viento fuerte (${w.windSpeed} km/h). Ojo con las pelotas altas.',
        ),
      _ => null,
    };

    if (warning == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: AppRadii.cardAll,
        border: Border(
          left: BorderSide(color: warning.color, width: 3),
          top: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
          right: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      child: Row(
        children: [
          Icon(warning.icon, size: 18, color: warning.color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              warning.text,
              style: AppTypography.body(size: 12.5, color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
