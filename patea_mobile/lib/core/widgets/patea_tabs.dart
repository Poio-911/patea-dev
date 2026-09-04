import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Las pestañas de una sección.
///
/// Es el lenguaje que ya usaban Panel ("Mi Resumen / Mi Grupo") y Partidos
/// ("Próximos / Semana / Historial"): fila de etiquetas con una barra neón
/// abajo de la activa y un contador opcional al costado. Estaba escrito dos
/// veces y Explorar tenía inventado un tercer estilo —cajitas con ícono,
/// tipo control segmentado de iOS—, así que la misma app cambiaba de idioma
/// al pasar de una sección a otra.
///
/// El contador aparece sólo si hay algo que contar: un "0" al lado de una
/// pestaña no informa, decora.
class PateaTab {
  final String label;
  final int count;

  const PateaTab(this.label, {this.count = 0});
}

class PateaTabs extends StatelessWidget {
  final List<PateaTab> tabs;
  final int active;
  final ValueChanged<int> onChanged;

  const PateaTabs({
    super.key,
    required this.tabs,
    required this.active,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < tabs.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: _Tab(
                  tab: tabs[i],
                  active: i == active,
                  onTap: () => onChanged(i),
                ),
              ),
          ],
        ),
        Container(height: 1, color: AppColors.border.withValues(alpha: 0.3)),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  final PateaTab tab;
  final bool active;
  final VoidCallback onTap;

  const _Tab({required this.tab, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: active ? AppColors.voltNeon : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tab.label,
              style: AppTypography.body(
                size: 14,
                weight: FontWeight.w700,
                color: active ? AppColors.voltNeon : AppColors.textMuted,
              ),
            ),
            if (tab.count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: active ? AppColors.voltNeon : AppColors.cardSurface,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${tab.count}',
                  style: AppTypography.body(
                    size: 10,
                    weight: FontWeight.w700,
                    color: active ? Colors.black : AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
