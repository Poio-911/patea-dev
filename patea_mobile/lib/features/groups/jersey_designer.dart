import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/theme/app_radii.dart';

import '../../core/theme/patea_colors.dart';
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

Color hexToColor(String hex) =>
    Color(int.parse(hex.replaceFirst('#', 'FF'), radix: 16));

class JerseyDesigner extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;

  const JerseyDesigner({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  State<JerseyDesigner> createState() => _JerseyDesignerState();
}

class _JerseyDesignerState extends State<JerseyDesigner> {
  String _activeColorSelection = 'primary';

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    final active = _activeColorSelection == 'primary'
        ? value.primaryColor
        : value.secondaryColor;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Tu camiseta', style: AppTypography.headline(size: 21)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 22),
          decoration: BoxDecoration(
            color: context.c.cardSurface,
            borderRadius: AppRadii.surfaceAll,
          ),
          child: Center(child: JerseyWidget(jersey: value, size: 116)),
        ),
        const SizedBox(height: 22),
        Text('Diseño', style: AppTypography.headline(size: 18)),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
          ),
          itemCount: jerseyTemplates.length,
          itemBuilder: (context, index) {
            final type = jerseyTemplates.keys.elementAt(index);
            final selected = type == value.pattern;
            return Semantics(
              button: true,
              selected: selected,
              label: 'Diseño de camiseta ${index + 1}',
              child: InkWell(
                onTap: () => widget.onChanged(
                  JerseyModel(
                    pattern: type,
                    primaryColor: value.primaryColor,
                    secondaryColor: value.secondaryColor,
                  ),
                ),
                borderRadius: AppRadii.cardAll,
                child: PateaCard(
                  color: selected
                      ? context.c.primary.withValues(alpha: .08)
                      : context.c.card,
                  borderColor: selected ? context.c.primary : context.c.border,
                  borderWidth: selected ? 2 : 1,
                  padding: const EdgeInsets.all(8),
                  child: Center(
                    child: JerseyWidget(
                      jersey: JerseyModel(
                        pattern: type,
                        primaryColor: value.primaryColor,
                        secondaryColor: value.secondaryColor,
                      ),
                      size: 42,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 22),
        Text('Colores', style: AppTypography.headline(size: 18)),
        const SizedBox(height: 8),
        PateaTabs(
          tabs: const [PateaTab('Principal'), PateaTab('Secundario')],
          active: _activeColorSelection == 'primary' ? 0 : 1,
          onChanged: (index) => setState(
            () => _activeColorSelection = index == 0 ? 'primary' : 'secondary',
          ),
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final color in popularTeamColors)
              Semantics(
                button: true,
                label: color['name'],
                selected: active.toUpperCase() == color['hex']!.toUpperCase(),
                child: Tooltip(
                  message: color['name']!,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => widget.onChanged(
                      _activeColorSelection == 'primary'
                          ? JerseyModel(
                              pattern: value.pattern,
                              primaryColor: color['hex']!,
                              secondaryColor: value.secondaryColor,
                            )
                          : JerseyModel(
                              pattern: value.pattern,
                              primaryColor: value.primaryColor,
                              secondaryColor: color['hex']!,
                            ),
                    ),
                    child: SizedBox(
                      width: 48,
                      height: 48,
                      child: Center(
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: hexToColor(color['hex']!),
                            border: Border.all(
                              color:
                                  active.toUpperCase() ==
                                      color['hex']!.toUpperCase()
                                  ? context.c.primary
                                  : context.c.border,
                              width:
                                  active.toUpperCase() ==
                                      color['hex']!.toUpperCase()
                                  ? 3
                                  : 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
