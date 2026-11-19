import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_svg/flutter_svg.dart';

import '../models/group_model.dart';
import '../theme/app_typography.dart';
import '../theme/jersey_templates.dart';

Color parseJerseyHexColor(
  String hex, [
  Color fallback = const Color(0xFF2563EB),
]) {
  final clean = hex.trim().replaceFirst('#', '');
  final normalized = clean.length == 3
      ? '${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}'
      : clean;
  final parsed = int.tryParse('FF$normalized', radix: 16);
  return parsed != null ? Color(parsed) : fallback;
}

/// Camiseta SVG coloreada con los colores del equipo y su escudo estampado en
/// el pecho izquierdo cuando [size] >= 40.
///
/// Acepta opcionalmente [localCrestFile] para previsualizar en vivo un PNG
/// elegido de galería antes de subirlo a Storage.
class JerseyWidget extends StatefulWidget {
  final JerseyModel jersey;
  final double size;
  final bool showCrest;
  final String? teamName;
  final File? localCrestFile;

  const JerseyWidget({
    super.key,
    required this.jersey,
    this.size = 48,
    this.showCrest = true,
    this.teamName,
    this.localCrestFile,
  });

  @override
  State<JerseyWidget> createState() => _JerseyWidgetState();
}

class _JerseyWidgetState extends State<JerseyWidget> {
  static final Map<String, String> _rawSvgCache = {};

  Future<String>? _pendingLoad;

  @override
  void initState() {
    super.initState();
    _ensureLoaded();
  }

  @override
  void didUpdateWidget(covariant JerseyWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.jersey.pattern != widget.jersey.pattern) {
      _ensureLoaded();
    }
  }

  void _ensureLoaded() {
    final template = getJerseyTemplate(widget.jersey.pattern);
    if (_rawSvgCache.containsKey(template.assetPath)) {
      _pendingLoad = null;
      return;
    }
    _pendingLoad = rootBundle.loadString(template.assetPath).then((raw) {
      _rawSvgCache[template.assetPath] = raw;
      return raw;
    });
  }

  String _colorize(String rawSvg) {
    final template = getJerseyTemplate(widget.jersey.pattern);
    return applyColorsToSvg(
      rawSvg,
      template,
      widget.jersey.primaryColor,
      widget.jersey.secondaryColor,
    );
  }

  Widget _buildLayeredJersey(String coloredSvg) {
    final hasAnyCrest =
        widget.jersey.hasCrest ||
        (widget.jersey.crestMode == 'uploaded' && widget.localCrestFile != null);
    final showBadge = widget.showCrest && hasAnyCrest && widget.size >= 40;
    final svgPicture = SvgPicture.string(
      coloredSvg,
      width: widget.size,
      height: widget.size,
      fit: BoxFit.contain,
    );

    if (!showBadge) return svgPicture;

    final crestSize = (widget.size * 0.23).clamp(11.0, 36.0);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(child: svgPicture),
        Positioned(
          left: widget.size * 0.54,
          top: widget.size * 0.255,
          child: TeamCrestWidget(
            jersey: widget.jersey,
            teamName: widget.teamName,
            localCrestFile: widget.localCrestFile,
            size: crestSize,
            showStars: false,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final template = getJerseyTemplate(widget.jersey.pattern);
    final cachedRaw = _rawSvgCache[template.assetPath];

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: cachedRaw != null
          ? _buildLayeredJersey(_colorize(cachedRaw))
          : FutureBuilder<String>(
              future: _pendingLoad,
              builder: (context, snapshot) {
                final raw = snapshot.data;
                if (raw == null) return const SizedBox.shrink();
                return _buildLayeredJersey(_colorize(raw));
              },
            ),
    );
  }
}

/// 6 siluetas curadas de escudo con proporciones deportivas reales.
const List<Map<String, String>> crestShapeOptions = [
  {'id': 'classic', 'label': 'Clásico'},
  {'id': 'circle', 'label': 'Circular'},
  {'id': 'oval', 'label': 'Óvalo'},
  {'id': 'heater', 'label': 'Inglés'},
  {'id': 'crest', 'label': 'Blasón'},
  {'id': 'diamond', 'label': 'Diamante'},
];

/// Tramas y divisiones interiores disponibles según la silueta elegida.
List<Map<String, String>> crestLayoutsForShape(String shape) {
  return switch (shape) {
    'circle' || 'oval' => const [
      {'id': 'ring', 'label': 'Anillo y texto'},
      {'id': 'double_ring', 'label': 'Doble aro'},
      {'id': 'sunburst', 'label': 'Rayos'},
      {'id': 'stripes_band', 'label': 'Banda central'},
    ],
    'diamond' || 'hexagon' => const [
      {'id': 'bevel', 'label': 'Bisel interior'},
      {'id': 'diagonal', 'label': 'Diagonal'},
      {'id': 'quarters', 'label': 'Cuatro puntas'},
      {'id': 'chevron', 'label': 'Galón'},
    ],
    _ => const [
      {'id': 'chief', 'label': 'Franja arriba'},
      {'id': 'stripes', 'label': 'Bastones'},
      {'id': 'diagonal', 'label': 'Diagonal'},
      {'id': 'cross', 'label': 'Cruz'},
      {'id': 'quarters', 'label': 'Cuartos'},
      {'id': 'framed', 'label': 'Marco fino'},
    ],
  };
}

/// Emblemas centrales para el escudo (`none` deja protagonismo al texto/siglas).
const List<Map<String, String>> crestSymbolOptions = [
  {'id': 'none', 'label': 'Solo texto'},
  {'id': 'crown', 'label': 'Corona'},
  {'id': 'star', 'label': 'Estrella'},
  {'id': 'ball', 'label': 'Pelota'},
  {'id': 'trophy', 'label': 'Copa'},
  {'id': 'sun', 'label': 'Sol'},
  {'id': 'wings', 'label': 'Alas'},
  {'id': 'laurel', 'label': 'Laurel'},
  {'id': 'bolt', 'label': 'Rayo'},
  {'id': 'flame', 'label': 'Fuego'},
  {'id': 'swords', 'label': 'Espadas'},
  {'id': 'tower', 'label': 'Torre'},
];

const List<Map<String, String>> crestTextLayoutOptions = [
  {'id': 'auto', 'label': 'Auto'},
  {'id': 'center', 'label': 'Centro'},
  {'id': 'banner', 'label': 'Cinta'},
  {'id': 'none', 'label': 'Oculto'},
];

const List<Map<String, String>> crestFontOptions = [
  {'id': 'bold', 'label': 'Moderna'},
  {'id': 'classic', 'label': 'Clásica'},
  {'id': 'condensed', 'label': 'Club'},
];

const List<Map<String, String>> crestBorderColorOptions = [
  {'id': '', 'label': 'Auto'},
  {'id': '#D97706', 'label': 'Dorado'},
  {'id': '#CBD5E1', 'label': 'Plateado'},
  {'id': '#FFFFFF', 'label': 'Blanco'},
  {'id': '#171717', 'label': 'Negro'},
];

/// Renderiza el escudo del equipo: ya sea un PNG transparente (local pendiente
/// de subir o remoto desde Firebase Storage) o el escudo vectorial modular
/// dibujado íntegramente con `CustomPainter`.
class TeamCrestWidget extends StatelessWidget {
  final JerseyModel jersey;
  final String? teamName;
  final File? localCrestFile;
  final double size;
  final String? overrideMode;
  final String? overrideShape;
  final String? overrideLayout;
  final String? overrideSymbol;
  final bool? overrideShowStars;
  final bool showStars;

  const TeamCrestWidget({
    super.key,
    required this.jersey,
    this.teamName,
    this.localCrestFile,
    this.size = 44,
    this.overrideMode,
    this.overrideShape,
    this.overrideLayout,
    this.overrideSymbol,
    this.overrideShowStars,
    this.showStars = true,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveMode = overrideMode ?? jersey.crestMode;
    final preferVectorPreview =
        overrideMode == 'custom' ||
        overrideShape != null ||
        overrideLayout != null ||
        overrideSymbol != null;

    if (!preferVectorPreview && effectiveMode == 'uploaded') {
      if (localCrestFile != null) {
        return _buildUploadedImage(
          Image.file(
            localCrestFile!,
            width: size,
            height: size,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.medium,
          ),
        );
      }
      if (jersey.crestUrl.trim().isNotEmpty) {
        return _buildUploadedImage(
          CachedNetworkImage(
            imageUrl: jersey.crestUrl.trim(),
            width: size,
            height: size,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.medium,
            placeholder: (_, _) => SizedBox(width: size, height: size),
            errorWidget: (_, _, _) => Icon(
              Icons.shield_outlined,
              size: size * 0.6,
            ),
          ),
        );
      }
    }

    if (effectiveMode == 'none' && !preferVectorPreview) {
      return SizedBox(width: size, height: size);
    }

    final shape = overrideShape ?? jersey.crestShape;
    if (shape.isEmpty || shape == 'none') {
      return SizedBox(width: size, height: size);
    }

    final validLayouts = crestLayoutsForShape(shape);
    var layout = overrideLayout ?? jersey.crestLayout;
    if (overrideShape != null &&
        !validLayouts.any((l) => l['id'] == layout)) {
      layout = JerseyModel.defaultLayoutForShape(shape);
    }

    final symbol = overrideSymbol ?? jersey.crestSymbol;
    final rawText = jersey.crestText.trim().toUpperCase();
    final fallbackInitials = JerseyModel.initialsFromTeamName(teamName ?? '');
    final resolvedText =
        rawText.isNotEmpty ? rawText : fallbackInitials;
    final allowOrnaments = overrideShowStars ?? showStars;
    final starsCount = allowOrnaments ? jersey.crestStars.clamp(0, 3) : 0;
    final showCrownTop = allowOrnaments && jersey.crestCrownTop;
    final showLaurel = allowOrnaments && jersey.crestLaurel;
    final customBorder = jersey.crestBorderColor.trim().isNotEmpty
        ? parseJerseyHexColor(jersey.crestBorderColor)
        : null;

    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _TeamCrestPainter(
          shape: shape,
          layout: layout,
          symbol: symbol,
          crestText: resolvedText,
          crestSubtitle: jersey.crestSubtitle.trim().toUpperCase(),
          textLayout: jersey.crestTextLayout,
          crestFont: jersey.crestFont,
          starsCount: starsCount,
          showCrownTop: showCrownTop,
          showLaurel: showLaurel,
          customBorderColor: customBorder,
          primaryColor: parseJerseyHexColor(jersey.primaryColor),
          secondaryColor: parseJerseyHexColor(
            jersey.secondaryColor,
            Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildUploadedImage(Widget image) {
    final child = jersey.crestClipCircle ? ClipOval(child: image) : image;
    return SizedBox(
      width: size,
      height: size,
      child: Center(child: child),
    );
  }
}

class _TeamCrestPainter extends CustomPainter {
  final String shape;
  final String layout;
  final String symbol;
  final String crestText;
  final String crestSubtitle;
  final String textLayout;
  final String crestFont;
  final int starsCount;
  final bool showCrownTop;
  final bool showLaurel;
  final Color? customBorderColor;
  final Color primaryColor;
  final Color secondaryColor;

  const _TeamCrestPainter({
    required this.shape,
    required this.layout,
    required this.symbol,
    required this.crestText,
    required this.crestSubtitle,
    required this.textLayout,
    required this.crestFont,
    required this.starsCount,
    required this.showCrownTop,
    required this.showLaurel,
    required this.customBorderColor,
    required this.primaryColor,
    required this.secondaryColor,
  });

  Color get _effectiveSecondary {
    if (primaryColor.toARGB32() != secondaryColor.toARGB32()) {
      return secondaryColor;
    }
    return primaryColor.computeLuminance() > 0.5
        ? const Color(0xFF171717)
        : const Color(0xFFFFFFFF);
  }

  Color get _rimColor {
    if (customBorderColor != null) return customBorderColor!;
    final pLum = primaryColor.computeLuminance();
    return pLum < 0.14 ? const Color(0xFFD97706) : const Color(0xFF111827);
  }

  Color get _innerRimColor {
    final rimLum = _rimColor.computeLuminance();
    return rimLum > 0.45
        ? const Color(0xFF111827).withValues(alpha: 0.42)
        : const Color(0xFFFFFFFF).withValues(alpha: 0.58);
  }

  Color get _emblemInkColor {
    if (customBorderColor != null &&
        customBorderColor!.toARGB32() == const Color(0xFFD97706).toARGB32()) {
      return const Color(0xFFFEF3C7);
    }
    if (layout == 'ring' || layout == 'double_ring') {
      final centerLum = _centerFieldColor.computeLuminance();
      return centerLum > 0.52
          ? const Color(0xFF111827)
          : const Color(0xFFFFFFFF);
    }
    final avgLum =
        (primaryColor.computeLuminance() +
            _effectiveSecondary.computeLuminance()) /
        2;
    return avgLum > 0.52 ? const Color(0xFF111827) : const Color(0xFFFFFFFF);
  }

  Color get _emblemStrokeBacking {
    return _emblemInkColor.computeLuminance() > 0.5
        ? const Color(0xFF0F172A).withValues(alpha: 0.85)
        : const Color(0xFFFFFFFF).withValues(alpha: 0.88);
  }

  /// En los diseños circulares/ovales con anillo, el medallón central toma el
  /// color secundario (o un contraste suave) y el anillo exterior el primario.
  Color get _centerFieldColor {
    if (layout == 'ring') return _effectiveSecondary;
    return primaryColor;
  }

  bool get _hasBusyPattern => const {
    'stripes',
    'diagonal',
    'cross',
    'quarters',
    'sunburst',
    'stripes_band',
    'chevron',
    'halves',
  }.contains(layout);

  Rect _shieldRect(
    Size size, {
    required bool hasTopOrnaments,
    required bool hasLaurel,
  }) {
    final w = size.width;
    final h = size.height;
    final left = hasLaurel ? w * 0.14 : w * 0.08;
    final right = hasLaurel ? w * 0.86 : w * 0.92;
    final top = hasTopOrnaments ? h * 0.21 : h * 0.05;
    final bottom = hasLaurel ? h * 0.90 : h * 0.96;
    return Rect.fromLTRB(left, top, right, bottom);
  }

  Path _buildShieldPath(Rect box) {
    final l = box.left;
    final t = box.top;
    final w = box.width;
    final h = box.height;
    final b = box.bottom;
    final cx = box.center.dx;
    final p = Path();

    switch (shape) {
      case 'circle':
        final d = math.min(w, h);
        p.addOval(Rect.fromCenter(center: box.center, width: d, height: d));
        return p;

      case 'oval':
        p.addOval(
          Rect.fromCenter(
            center: box.center,
            width: w * 0.82,
            height: h,
          ),
        );
        return p;

      case 'diamond':
        p.moveTo(cx, t);
        p.lineTo(l + w, t + h * 0.5);
        p.lineTo(cx, b);
        p.lineTo(l, t + h * 0.5);
        p.close();
        return p;

      case 'hexagon':
        p.moveTo(cx, t);
        p.lineTo(l + w * 0.94, t + h * 0.24);
        p.lineTo(l + w * 0.94, t + h * 0.76);
        p.lineTo(cx, b);
        p.lineTo(l + w * 0.06, t + h * 0.76);
        p.lineTo(l + w * 0.06, t + h * 0.24);
        p.close();
        return p;

      case 'spanish':
        p.moveTo(l + w * 0.06, t + h * 0.04);
        p.lineTo(l + w * 0.94, t + h * 0.04);
        p.lineTo(l + w * 0.94, t + h * 0.58);
        p.arcToPoint(
          Offset(l + w * 0.06, t + h * 0.58),
          radius: Radius.circular(w * 0.44),
          clockwise: true,
        );
        p.close();
        return p;

      case 'crest':
        p.moveTo(l + w * 0.05, t + h * 0.12);
        p.quadraticBezierTo(l + w * 0.27, t + h * 0.18, cx, t + h * 0.01);
        p.quadraticBezierTo(
          l + w * 0.73,
          t + h * 0.18,
          l + w * 0.95,
          t + h * 0.12,
        );
        p.lineTo(l + w * 0.95, t + h * 0.53);
        p.cubicTo(l + w * 0.95, t + h * 0.79, l + w * 0.68, t + h * 0.91, cx, b);
        p.cubicTo(
          l + w * 0.32,
          t + h * 0.91,
          l + w * 0.05,
          t + h * 0.79,
          l + w * 0.05,
          t + h * 0.53,
        );
        p.close();
        return p;

      case 'heater':
        p.moveTo(l + w * 0.05, t + h * 0.08);
        p.quadraticBezierTo(cx, t, l + w * 0.95, t + h * 0.08);
        p.lineTo(l + w * 0.95, t + h * 0.50);
        p.quadraticBezierTo(l + w * 0.92, t + h * 0.80, cx, b);
        p.quadraticBezierTo(l + w * 0.08, t + h * 0.80, l + w * 0.05, t + h * 0.50);
        p.close();
        return p;

      case 'classic':
      default:
        p.moveTo(l + w * 0.05, t + h * 0.05);
        p.lineTo(cx, t);
        p.lineTo(l + w * 0.95, t + h * 0.05);
        p.lineTo(l + w * 0.95, t + h * 0.54);
        p.cubicTo(l + w * 0.95, t + h * 0.79, l + w * 0.69, t + h * 0.91, cx, b);
        p.cubicTo(
          l + w * 0.31,
          t + h * 0.91,
          l + w * 0.05,
          t + h * 0.79,
          l + w * 0.05,
          t + h * 0.54,
        );
        p.close();
        return p;
    }
  }

  TextStyle _fontStyle({
    required double fontSize,
    required Color color,
    double letterSpacing = 0.2,
  }) {
    final safeSize = fontSize.clamp(4.0, 28.0);
    return switch (crestFont) {
      'classic' => AppTypography.editorial(
        size: safeSize,
        weight: FontWeight.w700,
        color: color,
      ).copyWith(height: 1.0, letterSpacing: letterSpacing + 0.3),
      'condensed' => AppTypography.condensed(
        size: safeSize * 1.08,
        weight: FontWeight.w800,
        color: color,
      ).copyWith(height: 1.0, letterSpacing: letterSpacing + 0.6),
      _ => AppTypography.headline(
        size: safeSize,
        weight: FontWeight.w800,
        color: color,
      ).copyWith(height: 1.0, letterSpacing: letterSpacing),
    };
  }

  void _paintInteriorLayout(Canvas canvas, Rect box, Path shieldPath) {
    final l = box.left;
    final t = box.top;
    final w = box.width;
    final h = box.height;
    final cx = box.center.dx;
    final cy = box.center.dy;
    final sec = _effectiveSecondary;
    final secPaint = Paint()..color = sec;

    switch (layout) {
      case 'ring':
        final outerRect = shape == 'circle'
            ? Rect.fromCenter(
                center: box.center,
                width: math.min(w, h),
                height: math.min(w, h),
              )
            : Rect.fromCenter(
                center: box.center,
                width: w * 0.82,
                height: h,
              );
        final innerRect = Rect.fromCenter(
          center: box.center,
          width: outerRect.width * 0.58,
          height: outerRect.height * 0.58,
        );
        canvas.drawOval(innerRect, Paint()..color = sec);
        canvas.drawOval(
          innerRect,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = (w * 0.028).clamp(0.7, 1.8)
            ..color = _rimColor,
        );
        return;

      case 'double_ring':
        final outerRect = shape == 'circle'
            ? Rect.fromCenter(
                center: box.center,
                width: math.min(w, h),
                height: math.min(w, h),
              )
            : Rect.fromCenter(
                center: box.center,
                width: w * 0.82,
                height: h,
              );
        for (final scale in [0.80, 0.58]) {
          canvas.drawOval(
            Rect.fromCenter(
              center: box.center,
              width: outerRect.width * scale,
              height: outerRect.height * scale,
            ),
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = (w * 0.022).clamp(0.6, 1.5)
              ..color = scale == 0.80 ? _innerRimColor : _rimColor,
          );
        }
        return;

      case 'sunburst':
        final r = math.max(w, h) * 0.8;
        const rays = 16;
        for (int i = 0; i < rays; i += 2) {
          final a1 = i * 2 * math.pi / rays;
          final a2 = (i + 1) * 2 * math.pi / rays;
          final wedge = Path()
            ..moveTo(cx, cy)
            ..lineTo(cx + r * math.cos(a1), cy + r * math.sin(a1))
            ..lineTo(cx + r * math.cos(a2), cy + r * math.sin(a2))
            ..close();
          canvas.drawPath(wedge, secPaint);
        }
        return;

      case 'stripes_band':
        final barW = w * 0.14;
        for (final fx in [0.16, 0.43, 0.70]) {
          canvas.drawRect(Rect.fromLTWH(l + w * fx, t, barW, h), secPaint);
        }
        final sash = Rect.fromCenter(
          center: box.center,
          width: w,
          height: h * 0.28,
        );
        canvas.drawRect(sash, Paint()..color = primaryColor);
        canvas.drawLine(
          Offset(l, sash.top),
          Offset(l + w, sash.top),
          Paint()
            ..color = _rimColor
            ..strokeWidth = (w * 0.028).clamp(0.8, 1.8),
        );
        canvas.drawLine(
          Offset(l, sash.bottom),
          Offset(l + w, sash.bottom),
          Paint()
            ..color = _rimColor
            ..strokeWidth = (w * 0.028).clamp(0.8, 1.8),
        );
        return;

      case 'chief':
        final chiefBottom = t + h * 0.29;
        final bodyRect = Rect.fromLTRB(l, chiefBottom, l + w, t + h);
        canvas.drawRect(bodyRect, Paint()..color = primaryColor);
        final barW = w * 0.16;
        for (final fx in [0.18, 0.42, 0.66]) {
          canvas.drawRect(
            Rect.fromLTWH(l + w * fx, chiefBottom, barW, h * 0.72),
            secPaint,
          );
        }
        canvas.drawRect(
          Rect.fromLTRB(l, t, l + w, chiefBottom),
          Paint()..color = primaryColor,
        );
        canvas.drawLine(
          Offset(l, chiefBottom),
          Offset(l + w, chiefBottom),
          Paint()
            ..color = _rimColor
            ..strokeWidth = (w * 0.036).clamp(0.9, 2.2),
        );
        canvas.drawLine(
          Offset(l, chiefBottom + (w * 0.022).clamp(0.6, 1.5)),
          Offset(l + w, chiefBottom + (w * 0.022).clamp(0.6, 1.5)),
          Paint()
            ..color = _innerRimColor
            ..strokeWidth = (w * 0.015).clamp(0.4, 1.0),
        );
        return;

      case 'stripes':
        final barW = w * 0.15;
        for (final fx in [0.16, 0.425, 0.69]) {
          canvas.drawRect(Rect.fromLTWH(l + w * fx, t, barW, h), secPaint);
        }
        return;

      case 'cross':
        final armV = w * 0.22;
        final armH = h * 0.19;
        final crossY = t + h * 0.44;
        canvas.drawRect(
          Rect.fromCenter(center: Offset(cx, crossY), width: armV, height: h),
          secPaint,
        );
        canvas.drawRect(
          Rect.fromCenter(center: Offset(cx, crossY), width: w, height: armH),
          secPaint,
        );
        final trim = Paint()
          ..color = _rimColor.withValues(alpha: 0.72)
          ..style = PaintingStyle.stroke
          ..strokeWidth = (w * 0.02).clamp(0.5, 1.2);
        canvas.drawRect(
          Rect.fromCenter(center: Offset(cx, crossY), width: armV, height: h),
          trim,
        );
        canvas.drawRect(
          Rect.fromCenter(center: Offset(cx, crossY), width: w, height: armH),
          trim,
        );
        return;

      case 'quarters':
        if (shape == 'diamond' || shape == 'hexagon') {
          final rightTri = Path()
            ..moveTo(cx, cy)
            ..lineTo(l + w, cy)
            ..lineTo(cx, t)
            ..close();
          final leftTri = Path()
            ..moveTo(cx, cy)
            ..lineTo(l, cy)
            ..lineTo(cx, t + h)
            ..close();
          canvas.drawPath(rightTri, secPaint);
          canvas.drawPath(leftTri, secPaint);
        } else {
          canvas.drawRect(Rect.fromLTWH(cx, t, w * 0.5, h * 0.50), secPaint);
          canvas.drawRect(
            Rect.fromLTWH(l, t + h * 0.50, w * 0.5, h * 0.50),
            secPaint,
          );
        }
        canvas.drawLine(
          Offset(cx, t),
          Offset(cx, t + h),
          Paint()
            ..color = _innerRimColor
            ..strokeWidth = (w * 0.018).clamp(0.4, 1.1),
        );
        canvas.drawLine(
          Offset(l, t + h * 0.50),
          Offset(l + w, t + h * 0.50),
          Paint()
            ..color = _innerRimColor
            ..strokeWidth = (w * 0.018).clamp(0.4, 1.1),
        );
        return;

      case 'halves':
        canvas.drawRect(Rect.fromLTWH(cx, t, w * 0.5, h), secPaint);
        return;

      case 'framed':
        final insetRect = Rect.fromCenter(
          center: box.center,
          width: w * 0.80,
          height: h * 0.80,
        );
        final innerPath = _buildShieldPath(insetRect);
        canvas.drawPath(
          innerPath,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = (w * 0.025).clamp(0.7, 1.6)
            ..color = sec.withValues(alpha: 0.72),
        );
        return;

      case 'bevel':
        final leftBevel = Path()
          ..moveTo(cx, t)
          ..lineTo(l, cy)
          ..lineTo(cx, cy)
          ..close();
        final rightBevel = Path()
          ..moveTo(cx, t)
          ..lineTo(l + w, cy)
          ..lineTo(cx, cy)
          ..close();
        canvas.drawPath(
          leftBevel,
          Paint()..color = Colors.white.withValues(alpha: 0.14),
        );
        canvas.drawPath(
          rightBevel,
          Paint()..color = Colors.black.withValues(alpha: 0.12),
        );
        final inset = Rect.fromCenter(
          center: box.center,
          width: w * 0.74,
          height: h * 0.74,
        );
        canvas.drawPath(
          _buildShieldPath(inset),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = (w * 0.026).clamp(0.7, 1.6)
            ..color = sec.withValues(alpha: 0.85),
        );
        return;

      case 'chevron':
        final chev = Path()
          ..moveTo(l, cy + h * 0.08)
          ..lineTo(cx, t + h * 0.22)
          ..lineTo(l + w, cy + h * 0.08)
          ..lineTo(l + w, cy + h * 0.28)
          ..lineTo(cx, t + h * 0.42)
          ..lineTo(l, cy + h * 0.28)
          ..close();
        canvas.drawPath(chev, secPaint);
        return;

      case 'diagonal':
        final slash = Path()
          ..moveTo(l + w * 0.62, t)
          ..lineTo(l + w, t)
          ..lineTo(l + w, t + h * 0.36)
          ..lineTo(l + w * 0.36, t + h)
          ..lineTo(l, t + h)
          ..lineTo(l, t + h * 0.64)
          ..close();
        canvas.drawPath(slash, secPaint);
        return;

      case 'solid':
      default:
        return;
    }
  }

  void _drawFivePointStar(
    Canvas canvas,
    Offset center,
    double outerRadius,
    Color fill, {
    Color? strokeColor,
  }) {
    final path = Path();
    final inner = outerRadius * 0.42;
    for (int i = 0; i < 10; i++) {
      final r = i.isEven ? outerRadius : inner;
      final angle = (i * math.pi / 5) - (math.pi / 2);
      final pt = Offset(
        center.dx + r * math.cos(angle),
        center.dy + r * math.sin(angle),
      );
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    path.close();
    canvas.drawPath(path, Paint()..color = fill);
    if (strokeColor != null) {
      canvas.drawPath(
        path,
        Paint()
          ..color = strokeColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = (outerRadius * 0.16).clamp(0.4, 1.1),
      );
    }
  }

  void _drawTopCrown(Canvas canvas, Size size, Rect box, {required bool hasStars}) {
    final w = size.width;
    final crownW = w * (hasStars ? 0.30 : 0.36);
    final crownH = (box.top * (hasStars ? 0.50 : 0.68)).clamp(4.5, 18.0);
    final cx = box.center.dx;
    final baseY = box.top - (w * 0.014).clamp(0.5, 2.0);
    final topY = baseY - crownH;
    final fill = customBorderColor ?? const Color(0xFFF59E0B);
    final strokeColor = fill.computeLuminance() > 0.5
        ? const Color(0xFF111827)
        : const Color(0xFFFFFFFF);

    final path = Path()
      ..moveTo(cx - crownW * 0.44, baseY)
      ..lineTo(cx - crownW * 0.50, topY + crownH * 0.25)
      ..lineTo(cx - crownW * 0.20, topY + crownH * 0.52)
      ..lineTo(cx, topY)
      ..lineTo(cx + crownW * 0.20, topY + crownH * 0.52)
      ..lineTo(cx + crownW * 0.50, topY + crownH * 0.25)
      ..lineTo(cx + crownW * 0.44, baseY)
      ..close();

    canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(
      path,
      Paint()
        ..color = strokeColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = (w * 0.016).clamp(0.4, 1.1)
        ..strokeJoin = StrokeJoin.round,
    );
  }

  void _drawLaurelWreath(Canvas canvas, Rect box) {
    final w = box.width;
    final h = box.height;
    final cx = box.center.dx;
    final cy = box.center.dy + h * 0.08;
    final laurelColor = customBorderColor ?? const Color(0xFFD97706);
    final stemPaint = Paint()
      ..color = laurelColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = (w * 0.032).clamp(0.7, 1.8)
      ..strokeCap = StrokeCap.round;
    final leafPaint = Paint()..color = laurelColor;

    final rx = w * 0.58;
    final ry = h * 0.49;

    for (final side in [-1.0, 1.0]) {
      final path = Path();
      const steps = 6;
      for (int i = 0; i <= steps; i++) {
        final tFrac = i / steps;
        final angle = side < 0
            ? (math.pi * 0.62 + tFrac * math.pi * 0.58)
            : (math.pi * 0.38 - tFrac * math.pi * 0.58);
        final pt = Offset(cx + rx * math.cos(angle), cy + ry * math.sin(angle));
        if (i == 0) {
          path.moveTo(pt.dx, pt.dy);
        } else {
          path.lineTo(pt.dx, pt.dy);
        }
        if (i > 0) {
          final leafLen = w * 0.085;
          final leafAngle = angle + side * 0.55;
          final leafTip = Offset(
            pt.dx + leafLen * math.cos(leafAngle),
            pt.dy + leafLen * math.sin(leafAngle),
          );
          final mid = Offset((pt.dx + leafTip.dx) / 2, (pt.dy + leafTip.dy) / 2);
          canvas.save();
          canvas.translate(mid.dx, mid.dy);
          canvas.rotate(leafAngle);
          canvas.drawOval(
            Rect.fromCenter(
              center: Offset.zero,
              width: leafLen,
              height: leafLen * 0.44,
            ),
            leafPaint,
          );
          canvas.restore();
        }
      }
      canvas.drawPath(path, stemPaint);
    }
  }

  void _drawArcText(
    Canvas canvas, {
    required Offset center,
    required double rx,
    required double ry,
    required String text,
    required Color color,
    required double fontSize,
    required bool isBottom,
  }) {
    final clean = text.trim();
    if (clean.isEmpty) return;

    final painters = <TextPainter>[];
    var totalWidth = 0.0;
    final tracking = fontSize * 0.14;
    for (int i = 0; i < clean.length; i++) {
      final tp = TextPainter(
        text: TextSpan(
          text: clean[i],
          style: _fontStyle(fontSize: fontSize, color: color, letterSpacing: 0),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      painters.add(tp);
      totalWidth += tp.width + (i < clean.length - 1 ? tracking : 0);
    }

    final meanR = (rx + ry) / 2;
    if (meanR <= 4) return;

    final maxArc = math.pi * 1.05;
    final naturalArc = totalWidth / meanR;
    final scale = naturalArc > maxArc ? (maxArc / naturalArc) : 1.0;

    var cursorAngle = isBottom
        ? (math.pi / 2 + (naturalArc * scale) / 2)
        : (-math.pi / 2 - (naturalArc * scale) / 2);

    for (int i = 0; i < painters.length; i++) {
      final tp = painters[i];
      final charStep = ((tp.width + tracking) * scale) / meanR;
      final halfStep = (tp.width * scale / 2) / meanR;
      final theta = isBottom ? (cursorAngle - halfStep) : (cursorAngle + halfStep);
      final pt = Offset(
        center.dx + rx * math.cos(theta),
        center.dy + ry * math.sin(theta),
      );
      canvas.save();
      canvas.translate(pt.dx, pt.dy);
      canvas.rotate(isBottom ? (theta - math.pi / 2) : (theta + math.pi / 2));
      if (scale < 0.99) {
        canvas.scale(scale);
      }
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
      cursorAngle += isBottom ? -charStep : charStep;
    }
  }

  void _paintTextWithContrast(
    Canvas canvas, {
    required String text,
    required Offset center,
    required double fontSize,
    required Color color,
    bool halo = false,
  }) {
    if (halo) {
      final bg = TextPainter(
        text: TextSpan(
          text: text,
          style: _fontStyle(fontSize: fontSize, color: _emblemStrokeBacking)
              .copyWith(
                foreground: Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = (fontSize * 0.22).clamp(1.2, 3.5)
                  ..strokeJoin = StrokeJoin.round
                  ..color = _emblemStrokeBacking,
              ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      bg.paint(canvas, Offset(center.dx - bg.width / 2, center.dy - bg.height / 2));
    }

    final fg = TextPainter(
      text: TextSpan(
        text: text,
        style: _fontStyle(fontSize: fontSize, color: color),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    fg.paint(canvas, Offset(center.dx - fg.width / 2, center.dy - fg.height / 2));
  }

  void _paintRibbonBanner(Canvas canvas, Rect box, {required String text}) {
    final w = box.width;
    final h = box.height;
    final bannerY = box.top + h * 0.75;
    final bannerW = w * 0.86;
    final bannerH = (h * 0.20).clamp(5.5, 22.0);
    final bg = _rimColor.computeLuminance() > 0.45
        ? const Color(0xFF0F172A)
        : const Color(0xFFFFFFFF);
    final fg = bg.computeLuminance() > 0.5
        ? const Color(0xFF0F172A)
        : const Color(0xFFFFFFFF);
    final foldColor = Color.lerp(bg, Colors.black, 0.35)!;

    // Puntas dobladas laterales estilo cinta heráldica
    final earW = bannerW * 0.09;
    final drop = bannerH * 0.22;
    for (final side in [-1.0, 1.0]) {
      final edgeX = box.center.dx + side * (bannerW / 2);
      final ear = Path()
        ..moveTo(edgeX, bannerY - bannerH * 0.4 + drop)
        ..lineTo(edgeX + side * earW, bannerY - bannerH * 0.4 + drop)
        ..lineTo(edgeX + side * earW * 0.55, bannerY + drop)
        ..lineTo(edgeX + side * earW, bannerY + bannerH * 0.5 + drop)
        ..lineTo(edgeX, bannerY + bannerH * 0.5 + drop)
        ..close();
      canvas.drawPath(ear, Paint()..color = foldColor);
    }

    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(box.center.dx, bannerY),
        width: bannerW,
        height: bannerH,
      ),
      Radius.circular(bannerH * 0.22),
    );
    canvas.drawRRect(rect, Paint()..color = bg);
    canvas.drawRRect(
      rect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (w * 0.026).clamp(0.6, 1.5)
        ..color = _rimColor,
    );

    final label = text.length > 10 ? text.substring(0, 10) : text;
    final sizeFactor = label.length >= 8 ? 0.46 : (label.length >= 5 ? 0.54 : 0.62);
    _paintTextWithContrast(
      canvas,
      text: label,
      center: Offset(box.center.dx, bannerY),
      fontSize: bannerH * sizeFactor,
      color: fg,
    );
  }

  void _paintSymbol(
    Canvas canvas,
    Size size,
    Offset center,
    double radius,
    Color color, {
    required bool drawBacking,
  }) {
    if (symbol == 'none') return;

    void paintWithPass(Color passColor, double extraStroke) {
      final isBacking = extraStroke > 0;
      final fill = Paint()
        ..color = passColor
        ..style = isBacking ? PaintingStyle.stroke : PaintingStyle.fill
        ..strokeWidth = extraStroke
        ..strokeJoin = StrokeJoin.round;
      final stroke = Paint()
        ..color = passColor
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..strokeWidth = (size.width * 0.032).clamp(0.8, 2.0) + extraStroke;

      switch (symbol) {
        case 'star':
          _drawFivePointStar(
            canvas,
            center,
            radius * 0.72,
            passColor,
            strokeColor: isBacking ? passColor : null,
          );
          return;

        case 'crown':
          final r = radius * 0.68;
          final path = Path()
            ..moveTo(center.dx - r, center.dy + r * 0.52)
            ..lineTo(center.dx - r * 0.85, center.dy - r * 0.45)
            ..lineTo(center.dx - r * 0.35, center.dy + r * 0.05)
            ..lineTo(center.dx, center.dy - r * 0.68)
            ..lineTo(center.dx + r * 0.35, center.dy + r * 0.05)
            ..lineTo(center.dx + r * 0.85, center.dy - r * 0.45)
            ..lineTo(center.dx + r, center.dy + r * 0.52)
            ..close();
          canvas.drawPath(path, fill);
          return;

        case 'sun':
          final r = radius * 0.72;
          canvas.drawCircle(center, r * 0.42, fill);
          for (int i = 0; i < 12; i++) {
            final a = i * 2 * math.pi / 12;
            canvas.drawLine(
              Offset(
                center.dx + r * 0.52 * math.cos(a),
                center.dy + r * 0.52 * math.sin(a),
              ),
              Offset(
                center.dx + r * 0.92 * math.cos(a),
                center.dy + r * 0.92 * math.sin(a),
              ),
              stroke,
            );
          }
          return;

        case 'wings':
          final r = radius * 0.74;
          final path = Path()
            ..moveTo(center.dx - r * 0.10, center.dy + r * 0.30)
            ..quadraticBezierTo(
              center.dx - r * 0.85,
              center.dy + r * 0.15,
              center.dx - r * 0.95,
              center.dy - r * 0.55,
            )
            ..quadraticBezierTo(
              center.dx - r * 0.45,
              center.dy - r * 0.35,
              center.dx,
              center.dy - r * 0.10,
            )
            ..quadraticBezierTo(
              center.dx + r * 0.45,
              center.dy - r * 0.35,
              center.dx + r * 0.95,
              center.dy - r * 0.55,
            )
            ..quadraticBezierTo(
              center.dx + r * 0.85,
              center.dy + r * 0.15,
              center.dx + r * 0.10,
              center.dy + r * 0.30,
            )
            ..lineTo(center.dx, center.dy + r * 0.55)
            ..close();
          canvas.drawPath(path, fill);
          return;

        case 'laurel':
          final r = radius * 0.68;
          canvas.drawArc(
            Rect.fromCircle(center: center, radius: r),
            math.pi * 0.22,
            math.pi * 0.62,
            false,
            stroke,
          );
          canvas.drawArc(
            Rect.fromCircle(center: center, radius: r),
            math.pi * 1.16,
            math.pi * 0.62,
            false,
            stroke,
          );
          _drawFivePointStar(canvas, center, r * 0.46, passColor);
          return;

        case 'swords':
          final r = radius * 0.68;
          canvas.drawLine(
            Offset(center.dx - r * 0.75, center.dy + r * 0.75),
            Offset(center.dx + r * 0.75, center.dy - r * 0.75),
            stroke,
          );
          canvas.drawLine(
            Offset(center.dx + r * 0.75, center.dy + r * 0.75),
            Offset(center.dx - r * 0.75, center.dy - r * 0.75),
            stroke,
          );
          canvas.drawLine(
            Offset(center.dx - r * 0.68, center.dy + r * 0.32),
            Offset(center.dx - r * 0.32, center.dy + r * 0.68),
            stroke,
          );
          canvas.drawLine(
            Offset(center.dx + r * 0.68, center.dy + r * 0.32),
            Offset(center.dx + r * 0.32, center.dy + r * 0.68),
            stroke,
          );
          return;

        case 'tower':
          final r = radius * 0.66;
          final path = Path()
            ..moveTo(center.dx - r * 0.55, center.dy + r * 0.72)
            ..lineTo(center.dx - r * 0.45, center.dy - r * 0.25)
            ..lineTo(center.dx - r * 0.60, center.dy - r * 0.25)
            ..lineTo(center.dx - r * 0.60, center.dy - r * 0.68)
            ..lineTo(center.dx - r * 0.32, center.dy - r * 0.68)
            ..lineTo(center.dx - r * 0.32, center.dy - r * 0.42)
            ..lineTo(center.dx - r * 0.14, center.dy - r * 0.42)
            ..lineTo(center.dx - r * 0.14, center.dy - r * 0.68)
            ..lineTo(center.dx + r * 0.14, center.dy - r * 0.68)
            ..lineTo(center.dx + r * 0.14, center.dy - r * 0.42)
            ..lineTo(center.dx + r * 0.32, center.dy - r * 0.42)
            ..lineTo(center.dx + r * 0.32, center.dy - r * 0.68)
            ..lineTo(center.dx + r * 0.60, center.dy - r * 0.68)
            ..lineTo(center.dx + r * 0.60, center.dy - r * 0.25)
            ..lineTo(center.dx + r * 0.45, center.dy - r * 0.25)
            ..lineTo(center.dx + r * 0.55, center.dy + r * 0.72)
            ..close();
          canvas.drawPath(path, fill);
          return;

        case 'bolt':
          final r = radius * 0.72;
          final path = Path()
            ..moveTo(center.dx + r * 0.15, center.dy - r * 0.85)
            ..lineTo(center.dx - r * 0.55, center.dy + r * 0.08)
            ..lineTo(center.dx - r * 0.05, center.dy + r * 0.08)
            ..lineTo(center.dx - r * 0.22, center.dy + r * 0.85)
            ..lineTo(center.dx + r * 0.55, center.dy - r * 0.10)
            ..lineTo(center.dx + r * 0.05, center.dy - r * 0.10)
            ..close();
          canvas.drawPath(path, fill);
          return;

        case 'flame':
          final r = radius * 0.72;
          final path = Path()
            ..moveTo(center.dx, center.dy - r * 0.85)
            ..cubicTo(
              center.dx + r * 0.65,
              center.dy - r * 0.35,
              center.dx + r * 0.75,
              center.dy + r * 0.40,
              center.dx,
              center.dy + r * 0.82,
            )
            ..cubicTo(
              center.dx - r * 0.75,
              center.dy + r * 0.40,
              center.dx - r * 0.65,
              center.dy - r * 0.35,
              center.dx,
              center.dy - r * 0.85,
            )
            ..close();
          canvas.drawPath(path, fill);
          return;

        case 'trophy':
          final r = radius * 0.65;
          final cup = Path()
            ..moveTo(center.dx - r * 0.65, center.dy - r * 0.65)
            ..lineTo(center.dx + r * 0.65, center.dy - r * 0.65)
            ..quadraticBezierTo(
              center.dx + r * 0.55,
              center.dy + r * 0.15,
              center.dx,
              center.dy + r * 0.22,
            )
            ..quadraticBezierTo(
              center.dx - r * 0.55,
              center.dy + r * 0.15,
              center.dx - r * 0.65,
              center.dy - r * 0.65,
            )
            ..close();
          canvas.drawPath(cup, fill);
          canvas.drawRect(
            Rect.fromCenter(
              center: Offset(center.dx, center.dy + r * 0.42),
              width: r * 0.28,
              height: r * 0.42,
            ),
            fill,
          );
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromCenter(
                center: Offset(center.dx, center.dy + r * 0.68),
                width: r * 0.85,
                height: r * 0.22,
              ),
              Radius.circular(r * 0.08),
            ),
            fill,
          );
          return;

        case 'ball':
          final r = radius * 0.66;
          canvas.drawCircle(center, r, stroke);
          final pent = Path();
          for (int i = 0; i < 5; i++) {
            final a = (i * 2 * math.pi / 5) - (math.pi / 2);
            final pt = Offset(
              center.dx + r * 0.44 * math.cos(a),
              center.dy + r * 0.44 * math.sin(a),
            );
            if (i == 0) {
              pent.moveTo(pt.dx, pt.dy);
            } else {
              pent.lineTo(pt.dx, pt.dy);
            }
            canvas.drawLine(
              pt,
              Offset(center.dx + r * math.cos(a), center.dy + r * math.sin(a)),
              stroke,
            );
          }
          pent.close();
          canvas.drawPath(pent, fill);
          return;
      }
    }

    if (drawBacking) {
      paintWithPass(_emblemStrokeBacking, (radius * 0.14).clamp(1.0, 3.2));
    }
    paintWithPass(color, 0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final hasStars = starsCount > 0 && w >= 24;
    final hasCrown = showCrownTop && w >= 24;
    final hasLaurel = showLaurel && w >= 28;
    final box = _shieldRect(
      size,
      hasTopOrnaments: hasStars || hasCrown,
      hasLaurel: hasLaurel,
    );
    final shieldPath = _buildShieldPath(box);

    // 0a. Corona superior o estrellas de campeonato
    if (hasCrown) {
      _drawTopCrown(canvas, size, box, hasStars: hasStars);
    }
    if (hasStars) {
      final starColor = customBorderColor ?? const Color(0xFFF59E0B);
      final starStroke = starColor.computeLuminance() > 0.5
          ? const Color(0xFF111827)
          : const Color(0xFFFFFFFF);
      final starR = (w * (hasCrown ? 0.056 : 0.075)).clamp(2.0, 7.2);
      final starY = hasCrown ? box.top * 0.56 : box.top * 0.48;
      final positions = switch (starsCount) {
        1 => [Offset(box.center.dx, hasCrown ? box.top * 0.24 : starY)],
        2 => [
          Offset(box.center.dx - w * (hasCrown ? 0.24 : 0.11), starY),
          Offset(box.center.dx + w * (hasCrown ? 0.24 : 0.11), starY),
        ],
        _ => [
          Offset(box.center.dx - w * (hasCrown ? 0.26 : 0.19), starY + h * 0.025),
          Offset(box.center.dx, hasCrown ? box.top * 0.24 : starY - h * 0.01),
          Offset(box.center.dx + w * (hasCrown ? 0.26 : 0.19), starY + h * 0.025),
        ],
      };
      for (final pos in positions) {
        _drawFivePointStar(
          canvas,
          pos,
          starR,
          starColor,
          strokeColor: starStroke,
        );
      }
    }

    // 0b. Laureles exteriores abrazando la base
    if (hasLaurel) {
      _drawLaurelWreath(canvas, box);
    }

    // 1. Fondo + división interior recortada al contorno
    canvas.save();
    canvas.clipPath(shieldPath);

    canvas.drawRect(box, Paint()..color = primaryColor);
    _paintInteriorLayout(canvas, box, shieldPath);

    // Brillo esmaltado sutil
    canvas.drawRect(
      Rect.fromLTWH(box.left, box.top, box.width, box.height * 0.55),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: 0.18),
            Colors.white.withValues(alpha: 0.0),
          ],
        ).createShader(
          Rect.fromLTWH(box.left, box.top, box.width, box.height * 0.55),
        ),
    );
    canvas.restore();

    // 2. Marco doble del escudo
    final borderWidth = (box.width * 0.068).clamp(1.1, 3.6);
    canvas.drawPath(
      shieldPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth
        ..strokeJoin = StrokeJoin.round
        ..color = _rimColor,
    );
    canvas.drawPath(
      shieldPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (borderWidth * 0.34).clamp(0.5, 1.3)
        ..strokeJoin = StrokeJoin.round
        ..color = _innerRimColor,
    );

    // 3. Emblema y tipografía integrados según forma, layout y posición de texto
    final isRound = shape == 'circle' || shape == 'oval';
    final effectiveTextLayout = textLayout;
    final showAnyText =
        effectiveTextLayout != 'none' &&
        (crestText.isNotEmpty || crestSubtitle.isNotEmpty) &&
        box.width >= 20;

    final usesRingArc =
        showAnyText &&
        effectiveTextLayout == 'auto' &&
        isRound &&
        (layout == 'ring' || layout == 'double_ring') &&
        box.width >= 30;
    final usesChiefBar =
        showAnyText &&
        effectiveTextLayout == 'auto' &&
        !isRound &&
        layout == 'chief';
    final usesSashBand =
        showAnyText &&
        effectiveTextLayout == 'auto' &&
        layout == 'stripes_band';
    final usesBanner =
        showAnyText &&
        (effectiveTextLayout == 'banner' ||
            (effectiveTextLayout == 'auto' &&
                !usesRingArc &&
                !usesChiefBar &&
                !usesSashBand &&
                symbol != 'none' &&
                crestText.length > 4 &&
                box.width >= 26));

    final inkColor = _emblemInkColor;
    final primaryLumInk = primaryColor.computeLuminance() > 0.52
        ? const Color(0xFF111827)
        : const Color(0xFFFFFFFF);
    final haloNeeded = _hasBusyPattern && layout != 'ring';

    if (usesRingArc) {
      final rxBase = (shape == 'circle' ? math.min(box.width, box.height) : box.width * 0.82) / 2;
      final ryBase = (shape == 'circle' ? math.min(box.width, box.height) : box.height) / 2;
      final ringRx = rxBase * 0.79;
      final ringRy = ryBase * 0.79;
      final arcSize = (box.width * 0.105).clamp(4.0, 13.0);
      if (crestText.isNotEmpty) {
        _drawArcText(
          canvas,
          center: box.center,
          rx: ringRx,
          ry: ringRy,
          text: crestText,
          color: primaryLumInk,
          fontSize: arcSize,
          isBottom: false,
        );
      }
      if (crestSubtitle.isNotEmpty) {
        _drawArcText(
          canvas,
          center: box.center,
          rx: ringRx,
          ry: ringRy,
          text: crestSubtitle,
          color: primaryLumInk,
          fontSize: arcSize * 0.88,
          isBottom: true,
        );
      }
      if (symbol != 'none') {
        _paintSymbol(
          canvas,
          size,
          box.center,
          box.width * 0.25,
          inkColor,
          drawBacking: layout != 'ring',
        );
      } else if (crestText.isNotEmpty) {
        final monogram = JerseyModel.initialsFromTeamName(crestText);
        _paintTextWithContrast(
          canvas,
          text: monogram,
          center: box.center,
          fontSize: box.width * 0.22,
          color: inkColor,
        );
      }
      return;
    }

    if (usesChiefBar) {
      final headerY = box.top + box.height * 0.15;
      if (crestText.isNotEmpty) {
        final len = crestText.length;
        final headerSize = len >= 9
            ? box.width * 0.115
            : (len >= 5 ? box.width * 0.145 : box.width * 0.185);
        _paintTextWithContrast(
          canvas,
          text: crestText,
          center: Offset(box.center.dx, headerY),
          fontSize: headerSize,
          color: primaryLumInk,
        );
      }
      final bodyCenter = Offset(
        box.center.dx,
        box.top + (crestSubtitle.isNotEmpty ? box.height * 0.56 : box.height * 0.60),
      );
      if (symbol != 'none') {
        _paintSymbol(
          canvas,
          size,
          bodyCenter,
          box.width * 0.24,
          inkColor,
          drawBacking: true,
        );
      } else if (crestText.isNotEmpty) {
        _paintTextWithContrast(
          canvas,
          text: JerseyModel.initialsFromTeamName(crestText),
          center: bodyCenter,
          fontSize: box.width * 0.24,
          color: inkColor,
          halo: true,
        );
      }
      if (crestSubtitle.isNotEmpty && box.width >= 30) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.top + box.height * 0.82),
          fontSize: box.width * 0.105,
          color: inkColor,
          halo: true,
        );
      }
      return;
    }

    if (usesSashBand) {
      if (symbol != 'none') {
        _paintSymbol(
          canvas,
          size,
          Offset(box.center.dx, box.top + box.height * 0.24),
          box.width * 0.15,
          inkColor,
          drawBacking: true,
        );
      }
      if (crestText.isNotEmpty) {
        final len = crestText.length;
        final sashSize = len >= 9
            ? box.width * 0.115
            : (len >= 5 ? box.width * 0.145 : box.width * 0.19);
        _paintTextWithContrast(
          canvas,
          text: crestText,
          center: box.center,
          fontSize: sashSize,
          color: primaryLumInk,
        );
      }
      if (crestSubtitle.isNotEmpty && box.width >= 30) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.top + box.height * 0.77),
          fontSize: box.width * 0.105,
          color: inkColor,
          halo: true,
        );
      }
      return;
    }

    if (usesBanner) {
      final symCenter = Offset(box.center.dx, box.top + box.height * 0.41);
      if (symbol != 'none') {
        _paintSymbol(
          canvas,
          size,
          symCenter,
          box.width * 0.24,
          inkColor,
          drawBacking: haloNeeded,
        );
      }
      if (crestText.isNotEmpty) {
        _paintRibbonBanner(canvas, box, text: crestText);
      }
      if (crestSubtitle.isNotEmpty && box.width >= 36) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.top + box.height * 0.89),
          fontSize: box.width * 0.088,
          color: inkColor,
          halo: haloNeeded,
        );
      }
      return;
    }

    // Modo centro / sin texto / auto compacto
    final hasTextCenter = showAnyText && crestText.isNotEmpty;
    final hasSub = showAnyText && crestSubtitle.isNotEmpty && box.width >= 28;
    if (symbol != 'none' && !hasTextCenter) {
      _paintSymbol(
        canvas,
        size,
        Offset(
          box.center.dx,
          box.center.dy - (hasSub ? box.height * 0.07 : 0),
        ),
        box.width * 0.29,
        inkColor,
        drawBacking: haloNeeded,
      );
      if (hasSub) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.center.dy + box.height * 0.24),
          fontSize: box.width * 0.11,
          color: inkColor,
          halo: haloNeeded,
        );
      }
      return;
    }

    if (symbol != 'none' && hasTextCenter) {
      _paintSymbol(
        canvas,
        size,
        Offset(box.center.dx, box.top + box.height * 0.36),
        box.width * 0.19,
        inkColor,
        drawBacking: haloNeeded,
      );
      final len = crestText.length;
      final textSize = len >= 9
          ? box.width * 0.115
          : (len >= 5 ? box.width * 0.145 : box.width * 0.19);
      _paintTextWithContrast(
        canvas,
        text: crestText,
        center: Offset(box.center.dx, box.top + box.height * 0.62),
        fontSize: textSize,
        color: inkColor,
        halo: haloNeeded,
      );
      if (hasSub) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.top + box.height * 0.78),
          fontSize: box.width * 0.095,
          color: inkColor,
          halo: haloNeeded,
        );
      }
      return;
    }

    if (hasTextCenter) {
      final len = crestText.length;
      final textSize = len >= 9
          ? box.width * 0.135
          : (len >= 5 ? box.width * 0.175 : (len >= 3 ? box.width * 0.24 : box.width * 0.30));
      _paintTextWithContrast(
        canvas,
        text: crestText,
        center: Offset(
          box.center.dx,
          box.center.dy - (hasSub ? box.height * 0.06 : 0),
        ),
        fontSize: textSize,
        color: inkColor,
        halo: haloNeeded,
      );
      if (hasSub) {
        _paintTextWithContrast(
          canvas,
          text: crestSubtitle,
          center: Offset(box.center.dx, box.center.dy + box.height * 0.19),
          fontSize: box.width * 0.11,
          color: inkColor,
          halo: haloNeeded,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TeamCrestPainter oldDelegate) {
    return oldDelegate.shape != shape ||
        oldDelegate.layout != layout ||
        oldDelegate.symbol != symbol ||
        oldDelegate.crestText != crestText ||
        oldDelegate.crestSubtitle != crestSubtitle ||
        oldDelegate.textLayout != textLayout ||
        oldDelegate.crestFont != crestFont ||
        oldDelegate.starsCount != starsCount ||
        oldDelegate.showCrownTop != showCrownTop ||
        oldDelegate.showLaurel != showLaurel ||
        oldDelegate.customBorderColor != customBorderColor ||
        oldDelegate.primaryColor != primaryColor ||
        oldDelegate.secondaryColor != secondaryColor;
  }
}
