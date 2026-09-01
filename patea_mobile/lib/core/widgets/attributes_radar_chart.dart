import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../models/player_model.dart';

class AttributesRadarChart extends StatelessWidget {
  final PlayerModel player;

  const AttributesRadarChart({super.key, required this.player});

  @override
  Widget build(BuildContext context) {
    final borderColor = AppColors.getOvrBorderColor(player.ovr);

    return AspectRatio(
      aspectRatio: 1.3,
      child: RadarChart(
        RadarChartData(
          radarShape: RadarShape.polygon,
          dataSets: [
            RadarDataSet(
              fillColor: borderColor.withValues(alpha: 0.25),
              borderColor: borderColor,
              entryRadius: 3.5,
              borderWidth: 2.2,
              dataEntries: [
                RadarEntry(value: player.pac.toDouble()),
                RadarEntry(value: player.sho.toDouble()),
                RadarEntry(value: player.pas.toDouble()),
                RadarEntry(value: player.dri.toDouble()),
                RadarEntry(value: player.def.toDouble()),
                RadarEntry(value: player.phy.toDouble()),
              ],
            ),
          ],
          radarBackgroundColor: Colors.transparent,
          borderData: FlBorderData(show: false),
          radarBorderData: const BorderSide(color: AppColors.border, width: 1),
          titlePositionPercentageOffset: 0.18,
          titleTextStyle: AppTypography.headline(size: 11, weight: FontWeight.w700),
          getTitle: (index, angle) {
            switch (index) {
              case 0:
                return RadarChartTitle(text: 'PAC (${player.pac})', angle: angle);
              case 1:
                return RadarChartTitle(text: 'SHO (${player.sho})', angle: angle);
              case 2:
                return RadarChartTitle(text: 'PAS (${player.pas})', angle: angle);
              case 3:
                return RadarChartTitle(text: 'DRI (${player.dri})', angle: angle);
              case 4:
                return RadarChartTitle(text: 'DEF (${player.def})', angle: angle);
              case 5:
                return RadarChartTitle(text: 'PHY (${player.phy})', angle: angle);
              default:
                return const RadarChartTitle(text: '');
            }
          },
          tickCount: 3,
          ticksTextStyle: AppTypography.code(size: 8, color: AppColors.textMuted),
          tickBorderData: const BorderSide(color: AppColors.border, width: 0.5),
          gridBorderData: const BorderSide(color: AppColors.border, width: 0.8),
        ),
      ),
    );
  }
}
