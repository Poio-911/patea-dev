import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/player_model.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'ovr_accent.dart';

/// Gráfico de progresión de OVR más la banda de OVR actual/cambio/máximo/mínimo.
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
    final c = context.c;
    if (history.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Text(
            'Todavía no hay partidos evaluados para trazar la curva de evolución.',
            style: AppTypography.body(size: 13, color: c.textSecondary),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final ovrs = history.map((e) => e.newOVR).toList();
    final baseline = history.first.oldOVR > 0 ? history.first.oldOVR : ovrs.first;
    final change = ovrs.last - baseline;
    final highest = [...ovrs, player.ovr].reduce((a, b) => a > b ? a : b);
    final lowest = [...ovrs, player.ovr].reduce((a, b) => a < b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: c.border)),
          ),
          child: Row(
            children: [
              _MiniStat(
                label: 'Actual',
                value: '${player.ovr}',
                accent: ovrAccentColor(c, player.ovr),
              ),
              _Divider(color: c.border),
              _MiniStat(
                label: 'Cambio',
                value: change > 0 ? '+$change' : '$change',
                accent: change > 0
                    ? c.success
                    : change < 0
                        ? c.destructive
                        : c.textPrimary,
              ),
              _Divider(color: c.border),
              _MiniStat(label: 'Máximo', value: '$highest'),
              _Divider(color: c.border),
              _MiniStat(label: 'Mínimo', value: '$lowest'),
            ],
          ),
        ),
        const SizedBox(height: 18),
        SizedBox(
          height: height,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: c.overlayLine,
                  strokeWidth: 1,
                ),
              ),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                rightTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                bottomTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 34,
                    getTitlesWidget: (val, _) => Text(
                      '${val.round()}',
                      style: AppTypography.code(
                        size: 12,
                        color: c.textSecondary,
                      ),
                    ),
                  ),
                ),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: [
                    for (var i = 0; i < ovrs.length; i++)
                      FlSpot(i.toDouble(), ovrs[i].toDouble()),
                  ],
                  isCurved: true,
                  color: c.primary,
                  barWidth: 3,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (_, _, _, _) => FlDotCirclePainter(
                      radius: 3.5,
                      color: c.primary,
                      strokeWidth: 1.5,
                      strokeColor: c.card,
                    ),
                  ),
                  belowBarData: BarAreaData(
                    show: true,
                    color: c.primary.withValues(alpha: 0.14),
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
  final Color? accent;

  const _MiniStat({required this.label, required this.value, this.accent});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: AppTypography.sportNumber(
              size: 20,
              color: accent ?? c.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.body(size: 12, color: c.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  final Color color;
  const _Divider({required this.color});

  @override
  Widget build(BuildContext context) => Container(width: 1, height: 24, color: color);
}
