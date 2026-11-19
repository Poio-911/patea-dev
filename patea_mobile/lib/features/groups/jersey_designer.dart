import 'package:flutter/material.dart';
import '../../core/widgets/patea_card.dart';
import '../../core/widgets/patea_tabs.dart';
import '../../core/theme/app_radii.dart';

import '../../core/theme/patea_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/jersey_templates.dart';
import '../../core/models/group_model.dart';
import '../../core/widgets/jersey_painter.dart';

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
  {'name': 'Marino', 'hex': '#1E3A8A'},
  {'name': 'Dorado', 'hex': '#D97706'},
  {'name': 'Esmeralda', 'hex': '#065F46'},
  {'name': 'Turquesa', 'hex': '#0D9488'},
  {'name': 'Lima', 'hex': '#84CC16'},
  {'name': 'Crema', 'hex': '#F5F0E6'},
];

const classicColorCombos = [
  {'name': 'Aurinegro', 'primary': '#EAB308', 'secondary': '#171717'},
  {'name': 'Albiceleste', 'primary': '#0EA5E9', 'secondary': '#FFFFFF'},
  {'name': 'Tricolor', 'primary': '#FFFFFF', 'secondary': '#2563EB'},
  {'name': 'Blaugrana', 'primary': '#1E3A8A', 'secondary': '#991B1B'},
  {'name': 'Rossonero', 'primary': '#DC2626', 'secondary': '#171717'},
  {'name': 'Albiverde', 'primary': '#065F46', 'secondary': '#FFFFFF'},
  {'name': 'Galáctico', 'primary': '#FFFFFF', 'secondary': '#D97706'},
];

Color hexToColor(String hex) => parseJerseyHexColor(hex);

/// Taller de identidad del equipo:
/// - Cabecera fija con vista previa en vivo de Camiseta + Escudo (hace foco en
///   el escudo automáticamente cuando estás en la pestaña `3. Escudo`).
/// - Flujo ordenado en 3 pestañas: `1. Diseño` -> `2. Colores` -> `3. Escudo`.
/// - Si `expandPanel` es `true`, la cabecera y las pestañas quedan fijas arriba
///   y sólo scrollea el panel inferior activo.
class JerseyDesigner extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;
  final String? teamName;
  final Widget? topHeader;
  final bool expandPanel;

  const JerseyDesigner({
    super.key,
    required this.value,
    required this.onChanged,
    this.teamName,
    this.topHeader,
    this.expandPanel = false,
  });

  @override
  State<JerseyDesigner> createState() => _JerseyDesignerState();
}

class _JerseyDesignerState extends State<JerseyDesigner> {
  int _studioTab = 0; // 0: Diseño, 1: Colores, 2: Escudo
  String _activeColorSelection = 'primary';
  late TextEditingController _initialsController;

  @override
  void initState() {
    super.initState();
    _initialsController = TextEditingController(
      text: widget.value.crestInitials,
    );
  }

  @override
  void didUpdateWidget(covariant JerseyDesigner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value.crestInitials != widget.value.crestInitials &&
        _initialsController.text != widget.value.crestInitials) {
      _initialsController.text = widget.value.crestInitials;
    }
  }

  @override
  void dispose() {
    _initialsController.dispose();
    super.dispose();
  }

  String _previewSecondaryForGrid(JerseyModel value) {
    if (value.primaryColor.toUpperCase() !=
        value.secondaryColor.toUpperCase()) {
      return value.secondaryColor;
    }
    final lum = hexToColor(value.primaryColor).computeLuminance();
    return lum > 0.5 ? '#171717' : '#FFFFFF';
  }

  void _swapColors() {
    final value = widget.value;
    widget.onChanged(
      value.copyWith(
        primaryColor: value.secondaryColor,
        secondaryColor: value.primaryColor,
      ),
    );
  }

  Widget _buildPinnedStage(BuildContext context) {
    final value = widget.value;
    final activeTemplate = getJerseyTemplate(value.pattern);
    final isCrestFocus = _studioTab == 2;
    final jerseySize = isCrestFocus ? 78.0 : 100.0;
    final crestSize = isCrestFocus ? 92.0 : 58.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.topHeader != null) ...[
          widget.topHeader!,
          const SizedBox(height: 12),
        ],
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
          decoration: BoxDecoration(
            color: context.c.cardSurface,
            borderRadius: AppRadii.surfaceAll,
            border: Border.all(color: context.c.border.withValues(alpha: 0.5)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      (widget.teamName ?? '').trim().isEmpty
                          ? 'Tu camiseta · ${activeTemplate.label}'
                          : '${widget.teamName!.trim()} · ${activeTemplate.label}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w700,
                        color: context.c.textPrimary,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: _swapColors,
                    borderRadius: AppRadii.pillAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.swap_horiz, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            'Invertir',
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: context.c.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  JerseyWidget(
                    jersey: value,
                    teamName: widget.teamName,
                    size: jerseySize,
                  ),
                  const SizedBox(width: 20),
                  if (value.hasCrest)
                    GestureDetector(
                      onTap: () => setState(() => _studioTab = 2),
                      child: TeamCrestWidget(
                        jersey: value,
                        teamName: widget.teamName,
                        size: crestSize,
                      ),
                    )
                  else
                    InkWell(
                      onTap: () {
                        setState(() => _studioTab = 2);
                        widget.onChanged(
                          value.copyWith(crestShape: 'classic'),
                        );
                      },
                      borderRadius: AppRadii.cardAll,
                      child: Container(
                        width: isCrestFocus ? 82 : 56,
                        height: isCrestFocus ? 82 : 56,
                        decoration: BoxDecoration(
                          borderRadius: AppRadii.cardAll,
                          border: Border.all(
                            color: context.c.border,
                            style: BorderStyle.solid,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.add_moderator_outlined,
                              size: 20,
                              color: context.c.textSecondary,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Escudo',
                              style: AppTypography.body(
                                size: 10,
                                color: context.c.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        PateaTabs(
          tabs: const [
            PateaTab('1. Diseño'),
            PateaTab('2. Colores'),
            PateaTab('3. Escudo'),
          ],
          active: _studioTab,
          onChanged: (index) => setState(() => _studioTab = index),
        ),
      ],
    );
  }

  Widget _buildDesignTab(BuildContext context) {
    final value = widget.value;
    final patterns = jerseyTemplates.keys
        .where((k) => k != 'solid')
        .toList(growable: false);
    final gridSecondary = _previewSecondaryForGrid(value);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 0.88,
      ),
      itemCount: patterns.length,
      itemBuilder: (context, index) {
        final type = patterns[index];
        final template = getJerseyTemplate(type);
        final selected = type == value.pattern;
        return Semantics(
          button: true,
          selected: selected,
          label: 'Diseño de camiseta ${index + 1}',
          child: Tooltip(
            message: template.label,
            child: InkWell(
              onTap: () => widget.onChanged(value.copyWith(pattern: type)),
              borderRadius: AppRadii.cardAll,
              child: PateaCard(
                color: selected
                    ? context.c.primary.withValues(alpha: .08)
                    : context.c.card,
                borderColor: selected ? context.c.primary : context.c.border,
                borderWidth: selected ? 2 : 1,
                padding: const EdgeInsets.symmetric(
                  horizontal: 4,
                  vertical: 6,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Center(
                        child: JerseyWidget(
                          showCrest: false,
                          jersey: JerseyModel(
                            pattern: type,
                            primaryColor: value.primaryColor,
                            secondaryColor: gridSecondary,
                          ),
                          size: 38,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      template.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: AppTypography.body(
                        size: 10,
                        weight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected
                            ? context.c.textPrimary
                            : context.c.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildColorsTab(BuildContext context) {
    final value = widget.value;
    final activeTemplate = getJerseyTemplate(value.pattern);
    final active = _activeColorSelection == 'primary'
        ? value.primaryColor
        : value.secondaryColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Combinaciones clásicas',
          style: AppTypography.body(
            size: 13,
            weight: FontWeight.w600,
            color: context.c.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final combo in classicColorCombos)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    borderRadius: AppRadii.pillAll,
                    onTap: () => widget.onChanged(
                      value.copyWith(
                        primaryColor: combo['primary']!,
                        secondaryColor: combo['secondary']!,
                      ),
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: context.c.card,
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(color: context.c.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: hexToColor(combo['primary']!),
                              border: Border.all(
                                color: context.c.border,
                                width: 0.8,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: hexToColor(combo['secondary']!),
                              border: Border.all(
                                color: context.c.border,
                                width: 0.8,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            combo['name']!,
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        PateaTabs(
          tabs: const [PateaTab('Principal'), PateaTab('Secundario')],
          active: _activeColorSelection == 'primary' ? 0 : 1,
          onChanged: (index) => setState(
            () => _activeColorSelection = index == 0 ? 'primary' : 'secondary',
          ),
        ),
        if (_activeColorSelection == 'secondary' &&
            !activeTemplate.usesSecondaryColor &&
            !value.hasCrest) ...[
          const SizedBox(height: 8),
          Text(
            'La camiseta lisa usa un solo color. Elegí un diseño con franjas o un escudo para ver el secundario.',
            style: AppTypography.body(
              size: 12,
              color: context.c.textSecondary,
            ),
          ),
        ],
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
                    borderRadius: AppRadii.pillAll,
                    onTap: () => widget.onChanged(
                      _activeColorSelection == 'primary'
                          ? value.copyWith(primaryColor: color['hex']!)
                          : value.copyWith(secondaryColor: color['hex']!),
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

  Widget _buildCrestTab(BuildContext context) {
    final value = widget.value;
    final defaultInitials = JerseyModel.initialsFromTeamName(
      widget.teamName ?? '',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Forma del escudo',
          style: AppTypography.body(
            size: 13,
            weight: FontWeight.w700,
            color: context.c.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final opt in crestShapeOptions)
              _CrestShapeTile(
                id: opt['id']!,
                label: opt['label']!,
                selected: value.crestShape == opt['id'],
                jersey: value,
                teamName: widget.teamName,
                onTap: () => widget.onChanged(
                  value.copyWith(crestShape: opt['id']!),
                ),
              ),
          ],
        ),
        if (value.hasCrest) ...[
          const SizedBox(height: 18),
          Text(
            'Trama interior',
            style: AppTypography.body(
              size: 13,
              weight: FontWeight.w700,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final pat in crestPatternOptions)
                _CrestPatternChip(
                  id: pat['id']!,
                  label: pat['label']!,
                  selected: value.crestPattern == pat['id'],
                  jersey: value,
                  teamName: widget.teamName,
                  onTap: () => widget.onChanged(
                    value.copyWith(crestPattern: pat['id']!),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Emblema central',
            style: AppTypography.body(
              size: 13,
              weight: FontWeight.w700,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final sym in crestSymbolOptions)
                _CrestSymbolChip(
                  id: sym['id']!,
                  label: sym['label']!,
                  selected: value.crestSymbol == sym['id'],
                  jersey: value,
                  teamName: widget.teamName,
                  onTap: () => widget.onChanged(
                    value.copyWith(crestSymbol: sym['id']!),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Siglas y cinta',
            style: AppTypography.body(
              size: 13,
              weight: FontWeight.w700,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _initialsController,
                  maxLength: 4,
                  textCapitalization: TextCapitalization.characters,
                  onChanged: (txt) => widget.onChanged(
                    value.copyWith(crestInitials: txt.trim().toUpperCase()),
                  ),
                  decoration: InputDecoration(
                    labelText: 'Siglas o año (ej. $defaultInitials, 1998)',
                    counterText: '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              FilterChip(
                selected: value.crestShowBanner,
                label: const Text('Cinta'),
                onSelected: (enabled) => widget.onChanged(
                  value.copyWith(crestShowBanner: enabled),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Marco y estrellas',
            style: AppTypography.body(
              size: 13,
              weight: FontWeight.w700,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final borderOpt in crestBorderColorOptions)
                ChoiceChip(
                  selected: value.crestBorderColor == borderOpt['id'],
                  label: Text(borderOpt['label']!),
                  onSelected: (_) => widget.onChanged(
                    value.copyWith(crestBorderColor: borderOpt['id']!),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final stars in [0, 1, 2, 3])
                ChoiceChip(
                  selected: value.crestStars == stars,
                  label: Text(
                    stars == 0 ? 'Sin ★' : '${'★' * stars} $stars',
                  ),
                  onSelected: (_) => widget.onChanged(
                    value.copyWith(crestStars: stars),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildActiveTabContent(BuildContext context) {
    return switch (_studioTab) {
      0 => _buildDesignTab(context),
      1 => _buildColorsTab(context),
      _ => _buildCrestTab(context),
    };
  }

  @override
  Widget build(BuildContext context) {
    if (widget.expandPanel) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: _buildPinnedStage(context),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: _buildActiveTabContent(context),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildPinnedStage(context),
        const SizedBox(height: 14),
        _buildActiveTabContent(context),
      ],
    );
  }
}

class _CrestShapeTile extends StatelessWidget {
  final String id;
  final String label;
  final bool selected;
  final JerseyModel jersey;
  final String? teamName;
  final VoidCallback onTap;

  const _CrestShapeTile({
    required this.id,
    required this.label,
    required this.selected,
    required this.jersey,
    required this.teamName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isNone = id == 'none';
    return Semantics(
      button: true,
      selected: selected,
      label: 'Escudo $label',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: PateaCard(
          color: selected
              ? context.c.primary.withValues(alpha: .08)
              : context.c.card,
          borderColor: selected ? context.c.primary : context.c.border,
          borderWidth: selected ? 2 : 1,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 38,
                height: 38,
                child: isNone
                    ? Center(
                        child: Icon(
                          Icons.block_outlined,
                          size: 20,
                          color: context.c.textSecondary,
                        ),
                      )
                    : TeamCrestWidget(
                        jersey: jersey,
                        teamName: teamName,
                        overrideShape: id,
                        showStars: false,
                        size: 38,
                      ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTypography.body(
                  size: 11,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? context.c.textPrimary
                      : context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CrestPatternChip extends StatelessWidget {
  final String id;
  final String label;
  final bool selected;
  final JerseyModel jersey;
  final String? teamName;
  final VoidCallback onTap;

  const _CrestPatternChip({
    required this.id,
    required this.label,
    required this.selected,
    required this.jersey,
    required this.teamName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: 'Trama $label',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillAll,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? context.c.primary.withValues(alpha: .12)
                : context.c.card,
            borderRadius: AppRadii.pillAll,
            border: Border.all(
              color: selected ? context.c.primary : context.c.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TeamCrestWidget(
                jersey: jersey,
                teamName: teamName,
                overridePattern: id,
                showStars: false,
                size: 22,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTypography.body(
                  size: 12,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? context.c.textPrimary
                      : context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CrestSymbolChip extends StatelessWidget {
  final String id;
  final String label;
  final bool selected;
  final JerseyModel jersey;
  final String? teamName;
  final VoidCallback onTap;

  const _CrestSymbolChip({
    required this.id,
    required this.label,
    required this.selected,
    required this.jersey,
    required this.teamName,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: 'Emblema $label',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillAll,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? context.c.primary.withValues(alpha: .12)
                : context.c.card,
            borderRadius: AppRadii.pillAll,
            border: Border.all(
              color: selected ? context.c.primary : context.c.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TeamCrestWidget(
                jersey: jersey,
                teamName: teamName,
                overrideSymbol: id,
                showStars: false,
                size: 22,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTypography.body(
                  size: 12,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? context.c.textPrimary
                      : context.c.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
