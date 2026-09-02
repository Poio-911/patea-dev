import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/jersey_templates.dart';
import '../../core/models/group_model.dart';
import '../../core/widgets/jersey_painter.dart';

/// Port de src/components/team-builder/jersey-designer.tsx: vista previa +
/// grilla de 15 diseños + paleta de 12 colores populares (primario/secundario).
/// A diferencia de la web, no incluye el input de color nativo `<input
/// type="color">` — la paleta cubre el caso de uso real de forma más simple
/// en mobile.
const popularTeamColors = [
  {'name': 'Rojo', 'hex': '#DC2626'},
  {'name': 'Azul', 'hex': '#2563EB'},
  {'name': 'Verde', 'hex': '#16A34A'},
  {'name': 'Amarillo', 'hex': '#EAB308'},
  {'name': 'Negro', 'hex': '#171717'},
  {'name': 'Blanco', 'hex': '#FFFFFF'},
  {'name': 'Naranja', 'hex': '#EA580C'},
  {'name': 'Violeta', 'hex': '#7C3AED'},
  {'name': 'Celeste', 'hex': '#0EA5E9'},
  {'name': 'Rosa', 'hex': '#EC4899'},
  {'name': 'Gris', 'hex': '#6B7280'},
  {'name': 'Bordo', 'hex': '#991B1B'},
];

Color hexToColor(String hex) => Color(int.parse(hex.replaceFirst('#', 'FF'), radix: 16));

class JerseyDesigner extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;

  const JerseyDesigner({super.key, required this.value, required this.onChanged});

  @override
  State<JerseyDesigner> createState() => _JerseyDesignerState();
}

class _JerseyDesignerState extends State<JerseyDesigner> {
  String _activeColorSelection = 'primary';

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    final activeColorValue = _activeColorSelection == 'primary' ? value.primaryColor : value.secondaryColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('VISTA PREVIA', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textMuted)),
        const SizedBox(height: 10),
        Center(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.cardSurface, borderRadius: BorderRadius.circular(16)),
            child: JerseyWidget(jersey: value, size: 90),
          ),
        ),
        const SizedBox(height: 24),
        Text('DISEÑO', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textMuted)),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, mainAxisSpacing: 10, crossAxisSpacing: 10),
          itemCount: jerseyTemplates.length,
          itemBuilder: (context, index) {
            final type = jerseyTemplates.keys.elementAt(index);
            final selected = type == value.pattern;
            return InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => widget.onChanged(JerseyModel(pattern: type, primaryColor: value.primaryColor, secondaryColor: value.secondaryColor)),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: selected ? AppColors.voltNeon : AppColors.border, width: selected ? 2 : 1),
                ),
                child: JerseyWidget(jersey: JerseyModel(pattern: type, primaryColor: '#9CA3AF', secondaryColor: '#E5E7EB'), size: 40),
              ),
            );
          },
        ),
        const SizedBox(height: 24),
        Text('COLORES', style: AppTypography.headline(size: 12, weight: FontWeight.w800, color: AppColors.textMuted)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(backgroundColor: _activeColorSelection == 'primary' ? AppColors.voltNeon.withValues(alpha: 0.15) : null),
                onPressed: () => setState(() => _activeColorSelection = 'primary'),
                child: const Text('Color Primario'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(backgroundColor: _activeColorSelection == 'secondary' ? AppColors.voltNeon.withValues(alpha: 0.15) : null),
                onPressed: () => setState(() => _activeColorSelection = 'secondary'),
                child: const Text('Color Secundario'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: popularTeamColors.map((c) {
            final hex = c['hex']!;
            final isSelected = activeColorValue.toUpperCase() == hex.toUpperCase();
            return InkWell(
              onTap: () => widget.onChanged(
                _activeColorSelection == 'primary'
                    ? JerseyModel(pattern: value.pattern, primaryColor: hex, secondaryColor: value.secondaryColor)
                    : JerseyModel(pattern: value.pattern, primaryColor: value.primaryColor, secondaryColor: hex),
              ),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hexToColor(hex),
                  border: Border.all(color: isSelected ? AppColors.voltNeon : AppColors.border, width: isSelected ? 3 : 1),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
