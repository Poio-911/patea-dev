import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/models/group_model.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/jersey_templates.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_snack.dart';

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

/// Taller unificado de identidad (camiseta + escudo). Reutiliza los dos pasos
/// abiertos (`JerseyIdentityStep` y `CrestDesignerStep`) con selector superior.
class JerseyDesigner extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;
  final String? teamName;
  final File? localCrestFile;
  final ValueChanged<File?>? onLocalCrestFileChanged;
  final Future<File?> Function()? onPickCrestFile;
  final Widget? topHeader;
  final bool expandPanel;

  const JerseyDesigner({
    super.key,
    required this.value,
    required this.onChanged,
    this.teamName,
    this.localCrestFile,
    this.onLocalCrestFileChanged,
    this.onPickCrestFile,
    this.topHeader,
    this.expandPanel = false,
  });

  @override
  State<JerseyDesigner> createState() => _JerseyDesignerState();
}

class _JerseyDesignerState extends State<JerseyDesigner> {
  int _section = 0; // 0: Camiseta, 1: Escudo

  @override
  Widget build(BuildContext context) {
    final selector = Padding(
      padding: EdgeInsets.fromLTRB(
        widget.expandPanel ? 20 : 0,
        widget.expandPanel ? 8 : 0,
        widget.expandPanel ? 20 : 0,
        8,
      ),
      child: SegmentedButton<int>(
        showSelectedIcon: false,
        segments: const [
          ButtonSegment<int>(
            value: 0,
            label: Text('Camiseta', maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          ButtonSegment<int>(
            value: 1,
            label: Text('Escudo', maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ],
        selected: {_section},
        onSelectionChanged: (s) => setState(() => _section = s.first),
      ),
    );

    final content = _section == 0
        ? JerseyIdentityStep(
            value: widget.value,
            onChanged: widget.onChanged,
            teamName: widget.teamName,
            localCrestFile: widget.localCrestFile,
            topHeader: widget.topHeader,
            expandPanel: widget.expandPanel,
            onTapCrestPreview: () => setState(() => _section = 1),
          )
        : CrestDesignerStep(
            value: widget.value,
            onChanged: widget.onChanged,
            teamName: widget.teamName,
            localCrestFile: widget.localCrestFile,
            onLocalCrestFileChanged: widget.onLocalCrestFileChanged,
            onPickCrestFile: widget.onPickCrestFile,
            expandPanel: widget.expandPanel,
          );

    if (widget.expandPanel) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          selector,
          Expanded(child: content),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        selector,
        const SizedBox(height: 8),
        content,
      ],
    );
  }
}

/// Paso 1 del taller: Nombre del equipo, vista previa abierta fija arriba y
/// controles sin cajas para `Diseño` y `Colores`.
class JerseyIdentityStep extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;
  final String? teamName;
  final File? localCrestFile;
  final Widget? topHeader;
  final bool expandPanel;
  final VoidCallback? onTapCrestPreview;

  const JerseyIdentityStep({
    super.key,
    required this.value,
    required this.onChanged,
    this.teamName,
    this.localCrestFile,
    this.topHeader,
    this.expandPanel = false,
    this.onTapCrestPreview,
  });

  @override
  State<JerseyIdentityStep> createState() => _JerseyIdentityStepState();
}

class _JerseyIdentityStepState extends State<JerseyIdentityStep> {
  int _mode = 0; // 0: Diseño, 1: Colores
  String _activeColorChannel = 'primary';

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
    final template = getJerseyTemplate(value.pattern);
    final hasAnyCrest =
        value.hasCrest ||
        (value.crestMode == 'uploaded' && widget.localCrestFile != null);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.topHeader != null) ...[
          widget.topHeader!,
          const SizedBox(height: 14),
        ],
        // Escenario abierto sin cajas anidadas ni bordes pesados
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Spacer(),
            JerseyWidget(
              jersey: value,
              teamName: widget.teamName,
              localCrestFile: widget.localCrestFile,
              size: 92,
            ),
            if (hasAnyCrest) ...[
              const SizedBox(width: 18),
              GestureDetector(
                onTap: widget.onTapCrestPreview,
                child: TeamCrestWidget(
                  jersey: value,
                  teamName: widget.teamName,
                  localCrestFile: widget.localCrestFile,
                  size: 52,
                ),
              ),
            ],
            const Spacer(),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: Text(
                (widget.teamName ?? '').trim().isEmpty
                    ? template.label
                    : '${widget.teamName!.trim()} · ${template.label}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: context.c.textSecondary,
                ),
              ),
            ),
            TextButton.icon(
              onPressed: _swapColors,
              icon: const Icon(Icons.swap_horiz, size: 17),
              label: const Text('Invertir'),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Divider(height: 1, color: context.c.overlayLine),
        const SizedBox(height: 12),
        SegmentedButton<int>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<int>(
              value: 0,
              label: Text('Diseño', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            ButtonSegment<int>(
              value: 1,
              label: Text('Colores', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
          selected: {_mode},
          onSelectionChanged: (s) => setState(() => _mode = s.first),
        ),
      ],
    );
  }

  Widget _buildDesignGrid(BuildContext context) {
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
        childAspectRatio: 0.86,
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
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                decoration: BoxDecoration(
                  color: selected
                      ? context.c.primary.withValues(alpha: 0.14)
                      : Colors.transparent,
                  borderRadius: AppRadii.cardAll,
                  border: selected
                      ? Border.all(
                          color: context.c.primary.withValues(alpha: 0.7),
                          width: 1.5,
                        )
                      : null,
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
                          size: 40,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      template.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: AppTypography.condensed(
                        size: 12,
                        weight: selected ? FontWeight.w700 : FontWeight.w600,
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

  Widget _buildColorsPanel(BuildContext context) {
    final value = widget.value;
    final activeTemplate = getJerseyTemplate(value.pattern);
    final activeHex = _activeColorChannel == 'primary'
        ? value.primaryColor
        : value.secondaryColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _FieldSectionHeader('Combinaciones clásicas'),
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
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: context.c.cardSurface.withValues(alpha: 0.55),
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(color: context.c.overlayLine),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _MiniDot(color: hexToColor(combo['primary']!)),
                          const SizedBox(width: 3),
                          _MiniDot(color: hexToColor(combo['secondary']!)),
                          const SizedBox(width: 7),
                          Text(
                            combo['name']!,
                            style: AppTypography.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: context.c.textPrimary,
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
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<String>(
              value: 'primary',
              label: Text('Principal', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            ButtonSegment<String>(
              value: 'secondary',
              label: Text(
                'Secundario',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          selected: {_activeColorChannel},
          onSelectionChanged: (s) =>
              setState(() => _activeColorChannel = s.first),
        ),
        if (_activeColorChannel == 'secondary' &&
            !activeTemplate.usesSecondaryColor &&
            !value.hasCrest) ...[
          const SizedBox(height: 8),
          Text(
            'Esta camiseta lisa usa un solo color. Elegí un diseño con franjas o sumá un escudo para ver el secundario.',
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
              _PortraitStyleSwatch(
                label: color['name']!,
                color: hexToColor(color['hex']!),
                selected:
                    activeHex.toUpperCase() == color['hex']!.toUpperCase(),
                onTap: () => widget.onChanged(
                  _activeColorChannel == 'primary'
                      ? value.copyWith(primaryColor: color['hex']!)
                      : value.copyWith(secondaryColor: color['hex']!),
                ),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final activePanel = _mode == 0
        ? _buildDesignGrid(context)
        : _buildColorsPanel(context);

    if (widget.expandPanel) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: _buildPinnedStage(context),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: activePanel,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildPinnedStage(context),
        const SizedBox(height: 12),
        activePanel,
      ],
    );
  }
}

/// Paso 2 del taller: Escudo modular guiado por silueta + carga de PNG propio
/// con fondo transparente.
class CrestDesignerStep extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;
  final String? teamName;
  final File? localCrestFile;
  final ValueChanged<File?>? onLocalCrestFileChanged;
  final Future<File?> Function()? onPickCrestFile;
  final bool expandPanel;

  const CrestDesignerStep({
    super.key,
    required this.value,
    required this.onChanged,
    this.teamName,
    this.localCrestFile,
    this.onLocalCrestFileChanged,
    this.onPickCrestFile,
    this.expandPanel = false,
  });

  @override
  State<CrestDesignerStep> createState() => _CrestDesignerStepState();
}

class _CrestDesignerStepState extends State<CrestDesignerStep> {
  bool _previewOnJersey = false;
  bool _isPickingImage = false;
  late TextEditingController _textController;
  late TextEditingController _subtitleController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.value.crestText);
    _subtitleController = TextEditingController(
      text: widget.value.crestSubtitle,
    );
  }

  @override
  void didUpdateWidget(covariant CrestDesignerStep oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value.crestText != widget.value.crestText &&
        _textController.text != widget.value.crestText) {
      _textController.text = widget.value.crestText;
    }
    if (oldWidget.value.crestSubtitle != widget.value.crestSubtitle &&
        _subtitleController.text != widget.value.crestSubtitle) {
      _subtitleController.text = widget.value.crestSubtitle;
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _subtitleController.dispose();
    super.dispose();
  }

  Future<void> _pickPng() async {
    if (_isPickingImage) return;
    setState(() => _isPickingImage = true);
    try {
      final File? picked;
      if (widget.onPickCrestFile != null) {
        picked = await widget.onPickCrestFile!();
      } else {
        // Sin maxWidth/maxHeight/imageQuality para conservar la transparencia
        // alfa del PNG original al elegirlo de galería.
        final xFile = await ImagePicker().pickImage(
          source: ImageSource.gallery,
        );
        picked = xFile != null ? File(xFile.path) : null;
      }
      if (!mounted || picked == null) return;
      widget.onLocalCrestFileChanged?.call(picked);
      widget.onChanged(widget.value.copyWith(crestMode: 'uploaded'));
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No pudimos abrir esa imagen.');
      }
    } finally {
      if (mounted) setState(() => _isPickingImage = false);
    }
  }

  void _selectMode(String mode) {
    final value = widget.value;
    if (mode == 'none') {
      widget.onLocalCrestFileChanged?.call(null);
      widget.onChanged(value.copyWith(crestMode: 'none'));
      return;
    }
    if (mode == 'custom') {
      final shape = value.crestShape == 'none' || value.crestShape.isEmpty
          ? 'classic'
          : value.crestShape;
      final layouts = crestLayoutsForShape(shape);
      final layout = layouts.any((l) => l['id'] == value.crestLayout)
          ? value.crestLayout
          : JerseyModel.defaultLayoutForShape(shape);
      widget.onChanged(
        value.copyWith(
          crestMode: 'custom',
          crestShape: shape,
          crestLayout: layout,
        ),
      );
      return;
    }
    widget.onChanged(value.copyWith(crestMode: 'uploaded'));
  }

  void _selectShape(String shape) {
    final validLayouts = crestLayoutsForShape(shape);
    final nextLayout = validLayouts.any((l) => l['id'] == widget.value.crestLayout)
        ? widget.value.crestLayout
        : JerseyModel.defaultLayoutForShape(shape);
    widget.onChanged(
      widget.value.copyWith(
        crestMode: 'custom',
        crestShape: shape,
        crestLayout: nextLayout,
      ),
    );
  }

  Widget _buildPinnedStage(BuildContext context) {
    final value = widget.value;
    final hasUploadedVisual =
        value.crestMode == 'uploaded' &&
        (widget.localCrestFile != null || value.crestUrl.trim().isNotEmpty);
    final hasVisualCrest = value.crestMode == 'custom' || hasUploadedVisual;

    final preview = Center(
      child: _previewOnJersey
          ? JerseyWidget(
              jersey: value,
              teamName: widget.teamName,
              localCrestFile: widget.localCrestFile,
              size: 112,
            )
          : !hasVisualCrest
          ? SizedBox(
              width: 96,
              height: 96,
              child: Center(
                child: Icon(
                  Icons.shield_outlined,
                  size: 46,
                  color: context.c.textSecondary.withValues(alpha: 0.45),
                ),
              ),
            )
          : value.crestMode == 'uploaded'
          ? _CrestCheckerboard(
              size: 108,
              child: TeamCrestWidget(
                jersey: value,
                teamName: widget.teamName,
                localCrestFile: widget.localCrestFile,
                size: 92,
              ),
            )
          : TeamCrestWidget(
              jersey: value,
              teamName: widget.teamName,
              localCrestFile: widget.localCrestFile,
              size: 108,
            ),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: 112, child: preview),
        if (hasVisualCrest) ...[
          const SizedBox(height: 10),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 260),
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment<bool>(
                    value: false,
                    label: Text(
                      'Escudo',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  ButtonSegment<bool>(
                    value: true,
                    label: Text(
                      'En camiseta',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                selected: {_previewOnJersey},
                onSelectionChanged: (s) =>
                    setState(() => _previewOnJersey = s.first),
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Divider(height: 1, color: context.c.overlayLine),
      ],
    );
  }

  Widget _buildModeControls(BuildContext context) {
    final value = widget.value;
    final defaultInitials = JerseyModel.initialsFromTeamName(
      widget.teamName ?? '',
    );
    final mode = value.crestMode;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<String>(
              value: 'none',
              label: Text(
                'Sin escudo',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            ButtonSegment<String>(
              value: 'custom',
              label: Text(
                'Diseñar',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            ButtonSegment<String>(
              value: 'uploaded',
              label: Text(
                'Subir PNG',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          selected: {mode},
          onSelectionChanged: (s) => _selectMode(s.first),
        ),
        const SizedBox(height: 18),
        if (mode == 'none')
          _buildNoneBody(context)
        else if (mode == 'uploaded')
          _buildUploadedBody(context)
        else
          _buildCustomDesignerBody(context, defaultInitials),
      ],
    );
  }

  Widget _buildNoneBody(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Podés dejar solo la camiseta o sumar un escudo para el pecho y la ficha del equipo.',
            textAlign: TextAlign.center,
            style: AppTypography.body(
              size: 13,
              color: context.c.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _selectMode('custom'),
                icon: const Icon(Icons.auto_awesome_outlined, size: 18),
                label: const Text('Diseñar escudo'),
              ),
              OutlinedButton.icon(
                onPressed: _isPickingImage ? null : _pickPng,
                icon: const Icon(Icons.upload_file_outlined, size: 18),
                label: const Text('Subir PNG'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUploadedBody(BuildContext context) {
    final value = widget.value;
    final hasImage =
        widget.localCrestFile != null || value.crestUrl.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          hasImage
              ? 'Tu archivo PNG se estampa manteniendo su fondo transparente.'
              : 'Elegí un PNG con fondo transparente desde tu galería.',
          style: AppTypography.body(size: 13, color: context.c.textSecondary),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _isPickingImage ? null : _pickPng,
                icon: const Icon(Icons.photo_library_outlined, size: 18),
                label: Text(
                  _isPickingImage
                      ? 'Abriendo galería...'
                      : (hasImage ? 'Cambiar PNG' : 'Elegir PNG de galería'),
                ),
              ),
            ),
            if (hasImage) ...[
              const SizedBox(width: 8),
              TextButton(
                onPressed: _isPickingImage
                    ? null
                    : () {
                        widget.onLocalCrestFileChanged?.call(null);
                        widget.onChanged(
                          value.copyWith(
                            crestUrl: '',
                            crestMode: 'uploaded',
                          ),
                        );
                      },
                child: Text(
                  'Quitar',
                  style: AppTypography.body(
                    size: 13,
                    weight: FontWeight.w600,
                    color: context.c.destructive,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            'Recorte circular',
            style: AppTypography.body(
              size: 14,
              weight: FontWeight.w600,
              color: context.c.textPrimary,
            ),
          ),
          subtitle: Text(
            'Útil si tu imagen tiene fondo cuadrado.',
            style: AppTypography.body(
              size: 12,
              color: context.c.textSecondary,
            ),
          ),
          value: value.crestClipCircle,
          onChanged: (enabled) => widget.onChanged(
            value.copyWith(crestClipCircle: enabled),
          ),
        ),
      ],
    );
  }

  Widget _buildCustomDesignerBody(
    BuildContext context,
    String defaultInitials,
  ) {
    final value = widget.value;
    final shapeLayouts = crestLayoutsForShape(value.crestShape);
    final shapeLabel =
        crestShapeOptions.firstWhere(
          (s) => s['id'] == value.crestShape,
          orElse: () => {'label': 'Escudo'},
        )['label']!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Forma
        const _FieldSectionHeader('Forma del escudo'),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.32,
          children: [
            for (final opt in crestShapeOptions)
              _BorderlessPreviewTile(
                semanticsLabel: 'Escudo ${opt['label']}',
                label: opt['label']!,
                selected: value.crestShape == opt['id'],
                onTap: () => _selectShape(opt['id']!),
                preview: TeamCrestWidget(
                  jersey: value,
                  teamName: widget.teamName,
                  overrideMode: 'custom',
                  overrideShape: opt['id'],
                  overrideShowStars: false,
                  size: 36,
                ),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(height: 1, color: context.c.overlayLine),
        ),

        // 2. Interior propio de la forma + Emblema
        _FieldSectionHeader('Interior · $shapeLabel'),
        const SizedBox(height: 10),
        SizedBox(
          height: 82,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: shapeLayouts.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final item = shapeLayouts[index];
              final selected = value.crestLayout == item['id'];
              return SizedBox(
                width: 84,
                child: _BorderlessPreviewTile(
                  semanticsLabel: 'Interior ${item['label']}',
                  label: item['label']!,
                  selected: selected,
                  onTap: () => widget.onChanged(
                    value.copyWith(
                      crestMode: 'custom',
                      crestLayout: item['id']!,
                    ),
                  ),
                  preview: TeamCrestWidget(
                    jersey: value,
                    teamName: widget.teamName,
                    overrideMode: 'custom',
                    overrideLayout: item['id'],
                    overrideShowStars: false,
                    size: 34,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
        const _FieldSectionHeader('Emblema central'),
        const SizedBox(height: 8),
        SizedBox(
          height: 76,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: crestSymbolOptions.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final sym = crestSymbolOptions[index];
              final selected = value.crestSymbol == sym['id'];
              return SizedBox(
                width: 78,
                child: _BorderlessPreviewTile(
                  semanticsLabel: 'Emblema ${sym['label']}',
                  label: sym['label']!,
                  selected: selected,
                  onTap: () => widget.onChanged(
                    value.copyWith(
                      crestMode: 'custom',
                      crestSymbol: sym['id']!,
                    ),
                  ),
                  preview: TeamCrestWidget(
                    jersey: value,
                    teamName: widget.teamName,
                    overrideMode: 'custom',
                    overrideSymbol: sym['id'],
                    overrideShowStars: false,
                    size: 32,
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(height: 1, color: context.c.overlayLine),
        ),

        // 3. Textos, ubicación y tipografía
        const _FieldSectionHeader('Textos y tipografía'),
        const SizedBox(height: 10),
        TextField(
          controller: _textController,
          maxLength: 14,
          textCapitalization: TextCapitalization.characters,
          onChanged: (txt) => widget.onChanged(
            value.copyWith(
              crestMode: 'custom',
              crestText: txt.trim().toUpperCase(),
            ),
          ),
          decoration: InputDecoration(
            labelText: 'Texto principal (ej. $defaultInitials, PATAGONIA)',
            counterText: '',
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _subtitleController,
          maxLength: 10,
          textCapitalization: TextCapitalization.characters,
          onChanged: (txt) => widget.onChanged(
            value.copyWith(
              crestMode: 'custom',
              crestSubtitle: txt.trim().toUpperCase(),
            ),
          ),
          decoration: const InputDecoration(
            labelText: 'Subtítulo o año (ej. 1998, NORTE)',
            counterText: '',
          ),
        ),
        const SizedBox(height: 12),
        const _FieldSubLabel('Ubicación del texto'),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            for (final opt in crestTextLayoutOptions)
              ChoiceChip(
                selected: value.crestTextLayout == opt['id'],
                label: Text(opt['label']!),
                onSelected: (_) => widget.onChanged(
                  value.copyWith(
                    crestMode: 'custom',
                    crestTextLayout: opt['id']!,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        const _FieldSubLabel('Tipografía'),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: [
            for (final fontOpt in crestFontOptions)
              ButtonSegment<String>(
                value: fontOpt['id']!,
                label: Text(
                  fontOpt['label']!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          selected: {value.crestFont},
          onSelectionChanged: (s) => widget.onChanged(
            value.copyWith(crestMode: 'custom', crestFont: s.first),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(height: 1, color: context.c.overlayLine),
        ),

        // 4. Marco y ornamentos
        const _FieldSectionHeader('Marco y detalles'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            for (final borderOpt in crestBorderColorOptions)
              ChoiceChip(
                selected: value.crestBorderColor == borderOpt['id'],
                label: Text(borderOpt['label']!),
                onSelected: (_) => widget.onChanged(
                  value.copyWith(
                    crestMode: 'custom',
                    crestBorderColor: borderOpt['id']!,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            for (final stars in [0, 1, 2, 3])
              ChoiceChip(
                selected: value.crestStars == stars,
                label: Text(
                  stars == 0 ? 'Sin ★' : '${'★' * stars} $stars',
                ),
                onSelected: (_) => widget.onChanged(
                  value.copyWith(crestMode: 'custom', crestStars: stars),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            'Laureles',
            style: AppTypography.body(
              size: 14,
              weight: FontWeight.w600,
              color: context.c.textPrimary,
            ),
          ),
          value: value.crestLaurel,
          onChanged: (enabled) => widget.onChanged(
            value.copyWith(crestMode: 'custom', crestLaurel: enabled),
          ),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            'Corona superior',
            style: AppTypography.body(
              size: 14,
              weight: FontWeight.w600,
              color: context.c.textPrimary,
            ),
          ),
          value: value.crestCrownTop,
          onChanged: (enabled) => widget.onChanged(
            value.copyWith(crestMode: 'custom', crestCrownTop: enabled),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.expandPanel) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: _buildPinnedStage(context),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
              child: _buildModeControls(context),
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
        _buildModeControls(context),
      ],
    );
  }
}

class _FieldSectionHeader extends StatelessWidget {
  final String text;
  const _FieldSectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.headline(
        size: 15,
        weight: FontWeight.w700,
        color: context.c.textPrimary,
      ),
    );
  }
}

class _FieldSubLabel extends StatelessWidget {
  final String text;
  const _FieldSubLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.body(
        size: 12,
        weight: FontWeight.w600,
        color: context.c.textSecondary,
      ),
    );
  }
}

class _MiniDot extends StatelessWidget {
  final Color color;
  const _MiniDot({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 13,
      height: 13,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        border: Border.all(color: context.c.border, width: 0.7),
      ),
    );
  }
}

class _PortraitStyleSwatch extends StatelessWidget {
  final String label;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const _PortraitStyleSwatch({
    required this.label,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final checkColor = color.computeLuminance() > 0.55
        ? const Color(0xFF171717)
        : const Color(0xFFFFFFFF);
    return Semantics(
      button: true,
      label: label,
      selected: selected,
      child: Tooltip(
        message: label,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: 42,
            height: 42,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: selected
                    ? context.c.primary
                    : context.c.textSecondary.withValues(alpha: 0.25),
                width: selected ? 2 : 1,
              ),
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color,
                border: Border.all(
                  color: context.c.border.withValues(alpha: 0.4),
                  width: 0.5,
                ),
              ),
              child: selected
                  ? Icon(Icons.check, size: 17, color: checkColor)
                  : null,
            ),
          ),
        ),
      ),
    );
  }
}

class _BorderlessPreviewTile extends StatelessWidget {
  final String semanticsLabel;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Widget preview;

  const _BorderlessPreviewTile({
    required this.semanticsLabel,
    required this.label,
    required this.selected,
    required this.onTap,
    required this.preview,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: semanticsLabel,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? context.c.primary.withValues(alpha: 0.14)
                : Colors.transparent,
            borderRadius: AppRadii.cardAll,
            border: selected
                ? Border.all(
                    color: context.c.primary.withValues(alpha: 0.7),
                    width: 1.5,
                  )
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(child: Center(child: preview)),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTypography.condensed(
                  size: 12,
                  weight: selected ? FontWeight.w700 : FontWeight.w600,
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

/// Tablero damero sutil para verificar la transparencia de PNG subidos.
class _CrestCheckerboard extends StatelessWidget {
  final double size;
  final Widget child;

  const _CrestCheckerboard({required this.size, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: context.c.overlayLine),
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(
        painter: _CheckerboardPainter(
          light: context.c.textSecondary.withValues(alpha: 0.08),
          dark: context.c.textSecondary.withValues(alpha: 0.16),
        ),
        child: Padding(padding: const EdgeInsets.all(6), child: child),
      ),
    );
  }
}

class _CheckerboardPainter extends CustomPainter {
  final Color light;
  final Color dark;

  const _CheckerboardPainter({required this.light, required this.dark});

  @override
  void paint(Canvas canvas, Size size) {
    const cell = 10.0;
    final pLight = Paint()..color = light;
    final pDark = Paint()..color = dark;
    final cols = (size.width / cell).ceil();
    final rows = (size.height / cell).ceil();
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        canvas.drawRect(
          Rect.fromLTWH(c * cell, r * cell, cell, cell),
          (r + c).isEven ? pLight : pDark,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _CheckerboardPainter oldDelegate) =>
      oldDelegate.light != light || oldDelegate.dark != dark;
}
