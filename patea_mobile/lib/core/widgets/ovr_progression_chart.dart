import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/player_model.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Gráfico de progresión de OVR más la fila de cambio/máximo/mínimo.
///
/// Estaba embebido como clase privada dentro de dashboard_screen.dart; se
/// extrajo acá para que la pantalla de progresión del perfil use exactamente
/// el mismo gráfico en vez de una copia.
///
/// A propósito no incluye tarjeta ni título: cada pantalla lo envuelve como le
/// corresponde (el dashboard en su `_SectionCard`, el perfil en su contenedor).
class OvrProgressionChart extends StatelessWidget {
  final PlayerModel player;
  final List<OvrHistoryEntry> history;
  final double height;

  const OvrProgressionChart({
    super.key,
    required this.player,
    required this.history,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Text(
            'Aún no tenés partidos evaluados. ¡Jugá y evaluá tus partidos para ver tu progresión!',
            style: AppTypography.body(size: 12, color: AppColors.textMuted),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final ovrs = history.map((e) => e.newOVR).toList();
    final change = ovrs.last - ovrs.first;
    final highest = [...ovrs, player.ovr].reduce((a, b) => a > b ? a : b);
    final lowest = [...ovrs, player.ovr].reduce((a, b) => a < b ? a : b);

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _MiniStat(label: 'Cambio', value: change > 0 ? '+$change' : '$change'),
            _MiniStat(label: 'Máximo', value: '$highest'),
            _MiniStat(label: 'Mínimo', value: '$lowest'),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: height,
          child: LineChart(
            LineChartData(
              gridData: const FlGridData(show: true, drawVerticalLine: false),
              titlesData: const FlTitlesData(
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 32)),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: [
                    for (var i = 0; i < ovrs.length; i++) FlSpot(i.toDouble(), ovrs[i].toDouble()),
                  ],
                  isCurved: true,
                  color: AppColors.voltNeon,
                  barWidth: 3,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show: true,
                    color: AppColors.voltNeon.withValues(alpha: 0.15),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: AppTypography.body(size: 11, color: AppColors.textMuted)),
        Text(value, style: AppTypography.headline(size: 20, weight: FontWeight.w800)),
      ],
    );
  }
}
