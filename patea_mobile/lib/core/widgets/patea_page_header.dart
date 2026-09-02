import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

class PateaPageHeader extends StatelessWidget {
  final String title;
  final String? description;
  final Widget? actionButton;
  final int currentCount;
  final int totalCount;
  final VoidCallback? onHelpTap;
  final VoidCallback? onFiltersTap;

  const PateaPageHeader({
    super.key,
    required this.title,
    this.description,
    this.actionButton,
    this.currentCount = 0,
    this.totalCount = 0,
    this.onHelpTap,
    this.onFiltersTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Título con barra vertical neón
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Barra vertical neón
            Container(
              width: 3.5,
              height: description != null ? 58 : 34,
              margin: const EdgeInsets.only(top: 2, right: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.voltNeon,
                    Color(0x4DCCFF00),
                  ],
                ),
              ),
            ),
            // Título y descripción
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.headline(
                      size: 26,
                      weight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (description != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      description!,
                      style: AppTypography.body(
                        size: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // 2. Botón "+ Agregar Jugador" en Amarillo Neón
        if (actionButton != null) ...[
          actionButton!,
          const SizedBox(height: 14),
        ],

        // 3. Fila de Contador y Filtros
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Contador + Ayuda
            Row(
              children: [
                Text(
                  '$currentCount/$totalCount jugadores',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: onHelpTap,
                  child: const Icon(
                    Icons.help_outline_rounded,
                    size: 15,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),

            // Botón Filtros
            InkWell(
              onTap: onFiltersTap,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xB3141923),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.border.withValues(alpha: 0.6),
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.filter_list_rounded, size: 15, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      'Filtros',
                      style: AppTypography.headline(
                        size: 12,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Colors.white70),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
