import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/models/group_model.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_selection.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/jersey_templates.dart';
import '../../core/theme/patea_colors.dart';
import '../../core/widgets/jersey_painter.dart';
import '../../core/widgets/patea_snack.dart';
import 'crest_crop_sheet.dart';

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

/// Tono del escenario de la vista previa: fondo + tinta para lo que se dibuja
/// encima (íconos, damero).
class _StageTone {
  final Color base;
  final Color ink;

  /// Centro del degradé radial: un escalón más claro que [base].
  final Color glow;
  const _StageTone(this.base, this.ink, this.glow);
}

/// El fondo de la vista previa se elige según los colores del equipo, no sólo
/// según el tema. Una camiseta negra o marino sobre el fondo oscuro desaparece
/// (su borde también es oscuro), y una blanca sobre el claro, igual. Si los
/// dos colores del equipo son oscuros el escenario es claro; si son claros, es
/// oscuro; en cualquier otro caso se usa la superficie del tema.
_StageTone _stageToneFor(BuildContext context, JerseyModel jersey) {
  final primary = hexToColor(jersey.primaryColor).computeLuminance();
  final secondary = hexToColor(jersey.secondaryColor).computeLuminance();
  final brightest = primary > secondary ? primary : secondary;
  final darkest = primary < secondary ? primary : secondary;

  if (brightest < 0.2) {
    // Escenario claro tomado de la paleta clara, sea cual sea el tema actual.
    const light = PateaColors.light;
    return _StageTone(light.cardSurface, light.textSecondary, light.card);
  }
  if (darkest > 0.6) {
    // Escenario oscuro tomado de la paleta oscura, sea cual sea el tema.
    const dark = PateaColors.game;
    return _StageTone(dark.card, dark.textSecondary, dark.cardSurface);
  }
  final c = context.c;
  return _StageTone(
    c.cardSurface,
    c.textSecondary,
    Color.lerp(c.cardSurface, c.textPrimary, 0.06)!,
  );
}

/// Escenario redondeado sobre el que se ve la camiseta/escudo en construcción.
class _PreviewStage extends StatelessWidget {
  final JerseyModel jersey;
  final Widget Function(_StageTone tone) builder;
  final EdgeInsetsGeometry padding;

  const _PreviewStage({
    required this.jersey,
    required this.builder,
    this.padding = const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
  });

  @override
  Widget build(BuildContext context) {
    final tone = _stageToneFor(context, jersey);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: context.c.overlayLine),
        gradient: RadialGradient(
          center: const Alignment(0, -0.25),
          radius: 0.95,
          colors: [tone.glow, tone.base],
        ),
      ),
      child: builder(tone),
    );
  }
}

/// Pestañas del taller de identidad.
enum StudioTab {
  camiseta('Camiseta'),
  colores('Colores'),
  escudo('Escudo'),
  textos('Textos'),
  marco('Marco');

  final String label;
  const StudioTab(this.label);
}

/// ¿Los dos colores se confunden entre sí? Con colores parecidos las franjas,
/// el emblema y el texto del escudo desaparecen. Se mira a la vez el contraste
/// de luminancia (WCAG) y la distancia RGB: dos azules distintos pero de igual
/// brillo se distinguen; un rojo y un naranja, no.
bool jerseyColorsTooSimilar(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final ratio = (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
  final dr = (a.r - b.r) * 255;
  final dg = (a.g - b.g) * 255;
  final db = (a.b - b.b) * 255;
  final distance = math.sqrt(dr * dr + dg * dg + db * db);
  return ratio < 1.8 && distance < 140;
}

/// Secundario que SÍ se distingue del [primaryHex]: blanco sobre oscuros y
/// casi negro sobre claros.
String contrastingSecondaryHex(String primaryHex) =>
    hexToColor(primaryHex).computeLuminance() > 0.5 ? '#171717' : '#FFFFFF';

/// Cuánto se achica la silueta del escudo por los adornos (0 = nada, 0.25 = 25%).
double crestOrnamentShrink({
  required int stars,
  required bool crownTop,
  required bool laurel,
}) {
  const canvas = Size(100, 100);
  final plain = crestShieldRect(
    canvas,
    hasTopOrnaments: false,
    hasLaurel: false,
  );
  final withOrnaments = crestShieldRect(
    canvas,
    hasTopOrnaments: stars > 0 || crownTop,
    hasLaurel: laurel,
  );
  return (1 - withOrnaments.height / plain.height).clamp(0.0, 1.0);
}

/// Taller unificado de identidad: UN solo lienzo. La camiseta y el escudo
/// quedan siempre a la vista arriba y las pestañas (Camiseta · Colores ·
/// Escudo · Textos · Marco) cambian sólo el panel de abajo.
///
/// Antes eran dos pasos del asistente con selectores segmentados anidados, y
/// para ver cómo quedaba un cambio de escudo sobre la camiseta había que
/// volver de paso.
class JerseyDesigner extends StatefulWidget {
  final JerseyModel value;
  final ValueChanged<JerseyModel> onChanged;
  final String? teamName;
  final File? localCrestFile;
  final ValueChanged<File?>? onLocalCrestFileChanged;
  final Future<File?> Function()? onPickCrestFile;

  /// Encuadra el archivo elegido antes de usarlo. Por defecto abre
  /// [showCrestCropSheet]; null devuelto = el usuario canceló.
  final Future<File?> Function(BuildContext context, File source)?
  onCropCrestFile;
  final Widget? topHeader;
  final bool expandPanel;
  final StudioTab initialTab;

  const JerseyDesigner({
    super.key,
    required this.value,
    required this.onChanged,
    this.teamName,
    this.localCrestFile,
    this.onLocalCrestFileChanged,
    this.onPickCrestFile,
    this.onCropCrestFile,
    this.topHeader,
    this.expandPanel = false,
    this.initialTab = StudioTab.camiseta,
  });

  @override
  State<JerseyDesigner> createState() => _JerseyDesignerState();
}

class _JerseyDesignerState extends State<JerseyDesigner> {
  late StudioTab _tab = widget.initialTab;
  String _activeColorChannel = 'primary';
  bool _isPickingImage = false;
  late final TextEditingController _textController;
  late final TextEditingController _subtitleController;

  JerseyModel get _value => widget.value;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.value.crestText);
    _subtitleController = TextEditingController(
      text: widget.value.crestSubtitle,
    );
  }

  @override
  void didUpdateWidget(covariant JerseyDesigner oldWidget) {
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

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------

  void _swapColors() {
    widget.onChanged(
      _value.copyWith(
        primaryColor: _value.secondaryColor,
        secondaryColor: _value.primaryColor,
      ),
    );
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

      final cropper =
          widget.onCropCrestFile ??
          (BuildContext ctx, File f) =>
              showCrestCropSheet(ctx, f, circular: _value.crestClipCircle);
      final cropped = await cropper(context, picked);
      // Cancelar el encuadre deja todo como estaba.
      if (!mounted || cropped == null) return;

      widget.onLocalCrestFileChanged?.call(cropped);
      widget.onChanged(_value.copyWith(crestMode: 'uploaded'));
    } catch (e) {
      if (mounted) {
        PateaSnack.error(context, 'No pudimos abrir esa imagen.');
      }
    } finally {
      if (mounted) setState(() => _isPickingImage = false);
    }
  }

  void _selectCrestMode(String mode) {
    final value = _value;
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
    final nextLayout = validLayouts.any((l) => l['id'] == _value.crestLayout)
        ? _value.crestLayout
        : JerseyModel.defaultLayoutForShape(shape);
    widget.onChanged(
      _value.copyWith(
        crestMode: 'custom',
        crestShape: shape,
        crestLayout: nextLayout,
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Estructura
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final header = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.topHeader != null) ...[
          widget.topHeader!,
          const SizedBox(height: 14),
        ],
        _buildStage(context),
        const SizedBox(height: 8),
        _buildStageCaption(context),
        const SizedBox(height: 8),
        _StudioTabBar(
          tabs: StudioTab.values,
          selected: _tab,
          onSelected: (t) => setState(() => _tab = t),
        ),
      ],
    );
    final panel = _buildPanel(context);

    if (widget.expandPanel) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: header,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: panel,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [header, const SizedBox(height: 12), panel],
    );
  }

  bool get _hasAnyCrest =>
      _value.hasCrest ||
      (_value.crestMode == 'uploaded' && widget.localCrestFile != null);

  Widget _buildStage(BuildContext context) {
    final value = _value;
    return _PreviewStage(
      jersey: value,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
      builder: (tone) => SizedBox(
        height: 112,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Spacer(),
            JerseyWidget(
              jersey: value,
              teamName: widget.teamName,
              localCrestFile: widget.localCrestFile,
              size: 104,
            ),
            const SizedBox(width: 20),
            if (_hasAnyCrest)
              GestureDetector(
                onTap: () => setState(() => _tab = StudioTab.escudo),
                child: value.crestMode == 'uploaded'
                    ? _CrestCheckerboard(
                        size: 84,
                        child: TeamCrestWidget(
                          jersey: value,
                          teamName: widget.teamName,
                          localCrestFile: widget.localCrestFile,
                          size: 70,
                        ),
                      )
                    : TeamCrestWidget(
                        jersey: value,
                        teamName: widget.teamName,
                        localCrestFile: widget.localCrestFile,
                        size: 84,
                      ),
              )
            else
              // Sin escudo todavía: una invitación a hacerlo, no un hueco.
              GestureDetector(
                onTap: () => setState(() => _tab = StudioTab.escudo),
                child: SizedBox(
                  width: 84,
                  height: 84,
                  child: Icon(
                    Icons.shield_outlined,
                    size: 44,
                    color: tone.ink.withValues(alpha: 0.5),
                  ),
                ),
              ),
            const Spacer(),
          ],
        ),
      ),
    );
  }

  Widget _buildStageCaption(BuildContext context) {
    final template = getJerseyTemplate(_value.pattern);
    final name = (widget.teamName ?? '').trim();
    return Row(
      children: [
        Expanded(
          child: Text(
            name.isEmpty ? template.label : '$name · ${template.label}',
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
    );
  }

  Widget _buildPanel(BuildContext context) {
    return switch (_tab) {
      StudioTab.camiseta => _buildDesignGrid(context),
      StudioTab.colores => _buildColorsPanel(context),
      StudioTab.escudo => _buildCrestPanel(context),
      StudioTab.textos => _buildTextPanel(context),
      StudioTab.marco => _buildFramePanel(context),
    };
  }

  // ---------------------------------------------------------------------
  // Pestaña: Camiseta
  // ---------------------------------------------------------------------

  String _previewSecondaryForGrid(JerseyModel value) {
    if (value.primaryColor.toUpperCase() !=
        value.secondaryColor.toUpperCase()) {
      return value.secondaryColor;
    }
    return contrastingSecondaryHex(value.primaryColor);
  }

  Widget _buildDesignGrid(BuildContext context) {
    final value = _value;
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
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
                decoration: pateaSelectableDecoration(context, selected),
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

  // ---------------------------------------------------------------------
  // Pestaña: Colores
  // ---------------------------------------------------------------------

  Widget _buildColorsPanel(BuildContext context) {
    final value = _value;
    final activeTemplate = getJerseyTemplate(value.pattern);
    final activeHex = _activeColorChannel == 'primary'
        ? value.primaryColor
        : value.secondaryColor;
    final tooSimilar = jerseyColorsTooSimilar(
      hexToColor(value.primaryColor),
      hexToColor(value.secondaryColor),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (tooSimilar) ...[
          _SimilarColorsBanner(
            onFix: () => widget.onChanged(
              value.copyWith(
                secondaryColor: contrastingSecondaryHex(value.primaryColor),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
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
              label: Text(
                'Principal',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
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
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
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

  // ---------------------------------------------------------------------
  // Pestaña: Escudo
  // ---------------------------------------------------------------------

  Widget _buildCrestPanel(BuildContext context) {
    final mode = _value.crestMode;
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
          onSelectionChanged: (s) => _selectCrestMode(s.first),
        ),
        const SizedBox(height: 18),
        if (mode == 'none')
          _buildNoneBody(context)
        else if (mode == 'uploaded')
          _buildUploadedBody(context)
        else
          _buildCustomCrestBody(context),
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
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _selectCrestMode('custom'),
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
    final value = _value;
    final hasImage =
        widget.localCrestFile != null || value.crestUrl.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          hasImage
              ? 'Tu imagen se estampa manteniendo su fondo transparente.'
              : 'Elegí una imagen con fondo transparente desde tu galería y encuadrala.',
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
                      : (hasImage ? 'Cambiar imagen' : 'Elegir de galería'),
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
                          value.copyWith(crestUrl: '', crestMode: 'uploaded'),
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
            'Útil si tu imagen tiene fondo cuadrado. Se ve en el encuadre.',
            style: AppTypography.body(size: 12, color: context.c.textSecondary),
          ),
          value: value.crestClipCircle,
          onChanged: (enabled) =>
              widget.onChanged(value.copyWith(crestClipCircle: enabled)),
        ),
      ],
    );
  }

  Widget _buildCustomCrestBody(BuildContext context) {
    final value = _value;
    final shapeLayouts = crestLayoutsForShape(value.crestShape);
    final shapeLabel = crestShapeOptions.firstWhere(
      (s) => s['id'] == value.crestShape,
      orElse: () => {'label': 'Escudo'},
    )['label']!;

    Widget divider() => Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Divider(height: 1, color: context.c.overlayLine),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 0. Plantillas: el camino corto. Lo de abajo es para ajustar.
        const _FieldSectionHeader('Plantillas'),
        const SizedBox(height: 4),
        Text(
          'Elegí un punto de partida y después ajustalo.',
          style: AppTypography.body(size: 12, color: context.c.textSecondary),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: crestPresets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final preset = crestPresets[index];
              return SizedBox(
                width: 84,
                child: _BorderlessPreviewTile(
                  semanticsLabel: 'Plantilla ${preset.label}',
                  label: preset.label,
                  selected: preset.matches(value),
                  onTap: () => widget.onChanged(preset.applyTo(value)),
                  preview: TeamCrestWidget(
                    jersey: preset.applyTo(value),
                    teamName: widget.teamName,
                    overrideMode: 'custom',
                    overrideShowStars: true,
                    size: 44,
                  ),
                ),
              );
            },
          ),
        ),
        divider(),

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
        divider(),

        // 2. Interior propio de la forma + emblema
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
              return SizedBox(
                width: 84,
                child: _BorderlessPreviewTile(
                  semanticsLabel: 'Interior ${item['label']}',
                  label: item['label']!,
                  selected: value.crestLayout == item['id'],
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
              return SizedBox(
                width: 78,
                child: _BorderlessPreviewTile(
                  semanticsLabel: 'Emblema ${sym['label']}',
                  label: sym['label']!,
                  selected: value.crestSymbol == sym['id'],
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
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Pestañas: Textos y Marco (sólo tienen sentido con un escudo propio)
  // ---------------------------------------------------------------------

  Widget _needsCustomCrest(BuildContext context, String what) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _value.crestMode == 'uploaded'
                ? '$what se ajusta en los escudos diseñados acá. Tu imagen se usa tal cual.'
                : '$what se ajusta una vez que diseñás un escudo.',
            textAlign: TextAlign.center,
            style: AppTypography.body(size: 13, color: context.c.textSecondary),
          ),
          const SizedBox(height: 14),
          Center(
            child: OutlinedButton.icon(
              onPressed: () {
                _selectCrestMode('custom');
                setState(() => _tab = StudioTab.escudo);
              },
              icon: const Icon(Icons.auto_awesome_outlined, size: 18),
              label: const Text('Diseñar escudo'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextPanel(BuildContext context) {
    if (_value.crestMode != 'custom') {
      return _needsCustomCrest(context, 'El texto');
    }
    final value = _value;
    final defaultInitials = JerseyModel.initialsFromTeamName(
      widget.teamName ?? '',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
      ],
    );
  }

  Widget _buildFramePanel(BuildContext context) {
    if (_value.crestMode != 'custom') {
      return _needsCustomCrest(context, 'El marco');
    }
    final value = _value;
    final shrink = crestOrnamentShrink(
      stars: value.crestStars,
      crownTop: value.crestCrownTop,
      laurel: value.crestLaurel,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _FieldSectionHeader('Color del marco'),
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
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(height: 1, color: context.c.overlayLine),
        ),
        // Un solo lugar para todos los adornos: estrellas, corona y laureles.
        const _FieldSectionHeader('Adornos'),
        const SizedBox(height: 8),
        const _FieldSubLabel('Estrellas de campeonato'),
        const SizedBox(height: 6),
        SegmentedButton<int>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<int>(value: 0, label: Text('Sin')),
            ButtonSegment<int>(value: 1, label: Text('★')),
            ButtonSegment<int>(value: 2, label: Text('★★')),
            ButtonSegment<int>(value: 3, label: Text('★★★')),
          ],
          selected: {value.crestStars},
          onSelectionChanged: (s) => widget.onChanged(
            value.copyWith(crestMode: 'custom', crestStars: s.first),
          ),
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
        if (shrink >= 0.2)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline,
                  size: 16,
                  color: context.c.textSecondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Con estos adornos el escudo se ve un ${(shrink * 100).round()}% más chico. Si querés más protagonismo, probá quitar uno.',
                    style: AppTypography.body(
                      size: 12,
                      color: context.c.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Barra de pestañas del taller: deslizable, así entra a 320 px y con texto
/// grande sin cortar etiquetas ni desbordar.
class _StudioTabBar extends StatelessWidget {
  final List<StudioTab> tabs;
  final StudioTab selected;
  final ValueChanged<StudioTab> onSelected;

  const _StudioTabBar({
    required this.tabs,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final tab in tabs)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Semantics(
                button: true,
                selected: tab == selected,
                label: 'Pestaña ${tab.label}',
                excludeSemantics: true,
                child: InkWell(
                  borderRadius: AppRadii.chipAll,
                  onTap: () => onSelected(tab),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: tab == selected ? c.primary : Colors.transparent,
                      borderRadius: AppRadii.chipAll,
                      border: Border.all(
                        color: tab == selected ? c.primary : c.controlBorder,
                      ),
                    ),
                    child: Text(
                      tab.label,
                      maxLines: 1,
                      style: AppTypography.action(
                        size: 14,
                        color: tab == selected ? c.onPrimary : c.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Aviso cuando principal y secundario se confunden entre sí.
class _SimilarColorsBanner extends StatelessWidget {
  final VoidCallback onFix;
  const _SimilarColorsBanner({required this.onFix});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: c.cardSurface,
        borderRadius: AppRadii.cardAll,
        border: Border.all(color: c.controlBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.contrast, size: 20, color: c.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Los dos colores se parecen: las franjas y el escudo pierden detalle.',
              style: AppTypography.body(size: 12, color: c.textPrimary),
            ),
          ),
          TextButton(onPressed: onFix, child: const Text('Contrastar')),
        ],
      ),
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

/// Plantilla de escudo: un punto de partida completo (silueta, interior,
/// emblema, tipografía y adornos). Antes había que recorrer cuatro secciones
/// para llegar a un escudo decente; ahora se elige una plantilla y recién
/// después se ajusta. NO toca los colores del equipo ni los textos.
class CrestPreset {
  final String id;
  final String label;
  final String shape;
  final String layout;
  final String symbol;
  final String textLayout;
  final String font;
  final String borderColor;
  final int stars;
  final bool laurel;
  final bool crownTop;

  const CrestPreset({
    required this.id,
    required this.label,
    required this.shape,
    required this.layout,
    required this.symbol,
    this.textLayout = 'auto',
    this.font = 'bold',
    this.borderColor = '',
    this.stars = 0,
    this.laurel = false,
    this.crownTop = false,
  });

  JerseyModel applyTo(JerseyModel base) => base.copyWith(
    crestMode: 'custom',
    crestShape: shape,
    crestLayout: layout,
    crestSymbol: symbol,
    crestTextLayout: textLayout,
    crestFont: font,
    crestBorderColor: borderColor,
    crestStars: stars,
    crestLaurel: laurel,
    crestCrownTop: crownTop,
  );

  /// Es la plantilla activa si TODO lo que ella define coincide.
  bool matches(JerseyModel v) =>
      v.crestMode == 'custom' &&
      v.crestShape == shape &&
      v.crestLayout == layout &&
      v.crestSymbol == symbol &&
      v.crestTextLayout == textLayout &&
      v.crestFont == font &&
      v.crestBorderColor == borderColor &&
      v.crestStars == stars &&
      v.crestLaurel == laurel &&
      v.crestCrownTop == crownTop;
}

/// Todas combinan una silueta con un interior que ESA silueta soporta (ver
/// `crestLayoutsForShape`); un test lo verifica.
const crestPresets = <CrestPreset>[
  CrestPreset(
    id: 'barrio',
    label: 'De barrio',
    shape: 'classic',
    layout: 'chief',
    symbol: 'none',
  ),
  CrestPreset(
    id: 'campeon',
    label: 'Campeón',
    shape: 'classic',
    layout: 'stripes',
    symbol: 'star',
    font: 'classic',
    borderColor: '#D97706',
    stars: 3,
  ),
  CrestPreset(
    id: 'historico',
    label: 'Histórico',
    shape: 'crest',
    layout: 'framed',
    symbol: 'crown',
    font: 'classic',
    borderColor: '#CBD5E1',
  ),
  CrestPreset(
    id: 'medallon',
    label: 'Medallón',
    shape: 'circle',
    layout: 'ring',
    symbol: 'none',
    font: 'condensed',
  ),
  CrestPreset(
    id: 'solar',
    label: 'Solar',
    shape: 'circle',
    layout: 'sunburst',
    symbol: 'sun',
    borderColor: '#D97706',
  ),
  CrestPreset(
    id: 'rayo',
    label: 'Rayo',
    shape: 'diamond',
    layout: 'bevel',
    symbol: 'bolt',
    font: 'condensed',
  ),
  CrestPreset(
    id: 'copero',
    label: 'Copero',
    shape: 'heater',
    layout: 'quarters',
    symbol: 'trophy',
    laurel: true,
  ),
  CrestPreset(
    id: 'pelotero',
    label: 'Pelotero',
    shape: 'oval',
    layout: 'double_ring',
    symbol: 'ball',
  ),
];

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
        ? PateaColors.light.textPrimary
        : PateaColors.game.textPrimary;
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
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: pateaSelectableDecoration(context, selected),
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
