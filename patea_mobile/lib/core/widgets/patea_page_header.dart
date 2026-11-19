import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../constants/sections.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/patea_colors.dart';
import 'patea_card.dart';
import 'section_icon.dart';

/// Botón compacto tonal para acciones principales de cabecera ("Armar partido",
/// "Agregar jugador", "Crear liga"). Deja el énfasis Volt/Blue sólido reservado
/// al partido o tarjeta protagonista debajo, respetando `AppTypography.action`.
class PateaHeaderActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  const PateaHeaderActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon = Icons.add_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Align(
      alignment: Alignment.centerLeft,
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: c.cardSurface,
          foregroundColor: c.textPrimary,
          side: BorderSide(color: c.primary.withValues(alpha: 0.45), width: 1),
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.cardAll),
          textStyle: AppTypography.action(size: 15, weight: FontWeight.w600),
        ),
        icon: Icon(icon, size: 19, color: c.primary),
        label: Text(label),
      ),
    );
  }
}

/// Encabezado unificado de sección: ícono editorial Tabler (o propio) en color
/// primario + título directo sobre el lienzo + bajada breve + acción opcional.
class PateaPageHeader extends StatelessWidget {
  final Section? section;
  final String? iconAsset;
  final IconData? icon;
  final String title;
  final String? description;
  final Widget? actionButton;
  final int currentCount;
  final int totalCount;
  final String countLabel;
  final VoidCallback? onHelpTap;
  final String? helpTooltip;
  final VoidCallback? onFiltersTap;

  /// Cuántos filtros hay aplicados. Si los filtros están escondidos detrás del
  /// botón, sin este número el usuario no tiene forma de saber que la lista
  /// está recortada.
  final int activeFilterCount;

  /// Algunas secciones (ej. Partidos) arman su propia fila de filtros abajo;
  /// para esas, esta fila del header se apaga en vez de duplicarla.
  final bool showCountRow;

  const PateaPageHeader({
    super.key,
    this.section,
    this.iconAsset,
    this.icon,
    required this.title,
    this.description,
    this.actionButton,
    this.currentCount = 0,
    this.totalCount = 0,
    this.countLabel = 'jugadores',
    this.onHelpTap,
    this.helpTooltip,
    this.onFiltersTap,
    this.activeFilterCount = 0,
    this.showCountRow = true,
  });

  Widget? _buildLeadingIcon(BuildContext context) {
    final primary = context.c.primary;
    if (iconAsset != null) {
      return SvgPicture.asset(
        iconAsset!,
        width: 26,
        height: 26,
        fit: BoxFit.contain,
        colorFilter: ColorFilter.mode(primary, BlendMode.srcIn),
        excludeFromSemantics: true,
      );
    }
    if (section != null) {
      return SectionIcon(
        section: section!,
        active: true,
        size: 26,
        color: primary,
      );
    }
    if (icon != null) {
      return Icon(icon, size: 26, color: primary);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final leading = _buildLeadingIcon(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Ícono de sección en color primario + título limpio sobre el lienzo
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (leading != null) ...[
              leading,
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(
                title,
                style: AppTypography.headline(
                  size: 28,
                  weight: FontWeight.w800,
                  letterSpacing: -0.7,
                  color: c.textPrimary,
                ),
              ),
            ),
            if (onHelpTap != null)
              Tooltip(
                message: helpTooltip ?? 'Ayuda sobre $title',
                child: Semantics(
                  button: true,
                  label: helpTooltip ?? 'Ayuda sobre $title',
                  child: InkWell(
                    onTap: onHelpTap,
                    borderRadius: AppRadii.pillAll,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 44,
                        minHeight: 44,
                      ),
                      child: Center(
                        child: Icon(
                          Icons.help_outline_rounded,
                          size: 20,
                          color: c.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (description != null) ...[
          const SizedBox(height: 4),
          Text(
            description!,
            style: AppTypography.body(size: 13, color: c.textSecondary),
          ),
        ],

        // 2. Acción principal de sección (si aplica)
        if (actionButton != null) ...[
          const SizedBox(height: 12),
          actionButton!,
        ],

        // 3. Fila de Contador y Filtros (opcional)
        if (showCountRow) ...[
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                Text(
                  '$currentCount/$totalCount $countLabel',
                  style: AppTypography.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: c.textSecondary,
                  ),
                ),
              InkWell(
                onTap: onFiltersTap,
                borderRadius: AppRadii.cardAll,
                child: PateaCard(
                  color: c.card.withValues(alpha: 0.70),
                  radius: AppRadii.cardAll,
                  borderColor: activeFilterCount > 0
                      ? c.primary.withValues(alpha: 0.7)
                      : c.border.withValues(alpha: 0.6),
                  borderWidth: 1,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.filter_list_rounded,
                        size: 15,
                        color: activeFilterCount > 0 ? c.primary : c.textPrimary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Filtros',
                        style: AppTypography.action(
                          size: 14,
                          weight: FontWeight.w600,
                          color: activeFilterCount > 0
                              ? c.primary
                              : c.textPrimary,
                        ),
                      ),
                      if (activeFilterCount > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          constraints: const BoxConstraints(
                            minWidth: 20,
                            minHeight: 20,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1,
                          ),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: c.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '$activeFilterCount',
                            style: AppTypography.code(
                              size: 12,
                              color: c.onPrimary,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(width: 2),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 16,
                        color: c.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          ),
        ],
      ],
    );
  }
}
