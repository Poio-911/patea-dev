import 'dart:math' as math;

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

/// Port mejorado de JerseyPreview:
/// - Cachea los SVG base en memoria para evitar parpadeos al cambiar color o patrón.
/// - Si el equipo configuró un escudo (`jersey.hasCrest`) y el tamaño lo permite,
///   dibuja la insignia en el pecho izquierdo de la camiseta.
class JerseyWidget extends StatefulWidget {
  final JerseyModel jersey;
  final double size;
  final bool showCrest;
  final String? teamName;

  const JerseyWidget({
    super.key,
    required this.jersey,
    this.size = 48,
    this.showCrest = true,
    this.teamName,
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
    final showBadge =
        widget.showCrest && widget.jersey.hasCrest && widget.size >= 40;
    final svgPicture = SvgPicture.string(
      coloredSvg,
      width: widget.size,
      height: widget.size,
      fit: BoxFit.contain,
    );

    if (!showBadge) return svgPicture;

    final crestSize = (widget.size * 0.22).clamp(11.0, 34.0);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(child: svgPicture),
        Positioned(
          left: widget.size * 0.54,
          top: widget.size * 0.26,
          child: TeamCrestWidget(
            jersey: widget.jersey,
            teamName: widget.teamName,
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

const List<Map<String, String>> crestShapeOptions = [
  {'id': 'none', 'label': 'Sin escudo'},
  {'id': 'classic', 'label': 'Clásico'},
  {'id': 'spanish', 'label': 'Español'},
  {'id': 'heater', 'label': 'Inglés'},
  {'id': 'circle', 'label': 'Redondo'},
  {'id': 'crest', 'label': 'Blasón'},
  {'id': 'oval', 'label': 'Óvalo'},
  {'id': 'diamond', 'label': 'Rombo'},
  {'id': 'hexagon', 'label': 'Hexágono'},
];

const List<Map<String, String>> crestPatternOptions = [
  {'id': 'diagonal', 'label': 'Diagonal'},
  {'id': 'stripes', 'label': 'Bastones'},
  {'id': 'halves', 'label': 'Mitades'},
  {'id': 'quarters', 'label': 'Cuartos'},
  {'id': 'band', 'label': 'Franja'},
  {'id': 'solid', 'label': 'Liso'},
];

const List<Map<String, String>> crestSymbolOptions = [
  {'id': 'initials', 'label': 'Siglas'},
  {'id': 'star', 'label': 'Estrella'},
  {'id': 'crown', 'label': 'Corona'},
  {'id': 'ball', 'label': 'Pelota'},
  {'id': 'sun', 'label': 'Sol'},
  {'id': 'wings', 'label': 'Alas'},
  {'id': 'laurel', 'label': 'Laurel'},
  {'id': 'bolt', 'label': 'Rayo'},
  {'id': 'flame', 'label': 'Fuego'},
  {'id': 'swords', 'label': 'Espadas'},
  {'id': 'tower', 'label': 'Torre'},
  {'id': 'trophy', 'label': 'Copa'},
];

const List<Map<String, String>> crestBorderColorOptions = [
  {'id': '', 'label': 'Auto'},
  {'id': '#D97706', 'label': 'Dorado'},
  {'id': '#CBD5E1', 'label': 'Plateado'},
  {'id': '#FFFFFF', 'label': 'Blanco'},
  {'id': '#171717', 'label': 'Negro'},
];

/// Escudo vectorial del equipo. Se dibuja 100% con `CustomPainter` para que se
/// vea nítido a cualquier tamaño (en el pecho de la camiseta, en el banner del
/// equipo o en los golden tests sin depender de fuentes de íconos).
class TeamCrestWidget extends StatelessWidget {
  final JerseyModel jersey;
  final String? teamName;
  final double size;
  final String? overrideShape;
  final String? overridePattern;
  final String? overrideSymbol;
  final bool? overrideShowStars;
  final bool showStars;

  const TeamCrestWidget({
    super.key,
    required this.jersey,
    this.teamName,
    this.size = 44,
    this.overrideShape,
    this.overridePattern,
    this.overrideSymbol,
    this.overrideShowStars,
    this.showStars = true,
  });

  @override
  Widget build(BuildContext context) {
    final shape = overrideShape ?? jersey.crestShape;
    if (shape.isEmpty || shape == 'none') {
      return SizedBox(width: size, height: size);
    }
    final pattern = overridePattern ?? jersey.crestPattern;
    final symbol = overrideSymbol ?? jersey.crestSymbol;
    final rawInitials = jersey.crestInitials.trim();
    final initials = rawInitials.isNotEmpty
        ? rawInitials.toUpperCase()
        : JerseyModel.initialsFromTeamName(teamName ?? '');
    final starsCount =
        (overrideShowStars ?? showStars) ? jersey.crestStars.clamp(0, 3) : 0;
    final customBorder = jersey.crestBorderColor.trim().isNotEmpty
        ? parseJerseyHexColor(jersey.crestBorderColor)
        : null;

    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _TeamCrestPainter(
          shape: shape,
          pattern: pattern,
          symbol: symbol,
          initials: initials,
          showBanner: jersey.crestShowBanner,
          starsCount: starsCount,
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
}

class _TeamCrestPainter extends CustomPainter {
  final String shape;
  final String pattern;
  final String symbol;
  final String initials;
  final bool showBanner;
  final int starsCount;
  final Color? customBorderColor;
  final Color primaryColor;
  final Color secondaryColor;

  const _TeamCrestPainter({
    required this.shape,
    required this.pattern,
    required this.symbol,
    required this.initials,
    required this.showBanner,
    required this.starsCount,
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
        ? const Color(0xFF111827).withValues(alpha: 0.45)
        : const Color(0xFFFFFFFF).withValues(alpha: 0.55);
  }

  Color get _emblemColor {
    if (customBorderColor != null &&
        customBorderColor!.toARGB32() == const Color(0xFFD97706).toARGB32()) {
      return const Color(0xFFFDE68A);
    }
    final pLum = primaryColor.computeLuminance();
    final sLum = _effectiveSecondary.computeLuminance();
    final avgLum = (pLum + sLum) / 2;
    return avgLum > 0.52 ? const Color(0xFF111827) : const Color(0xFFFFFFFF);
  }

  Path _buildShieldPath(Size size, {double topInset = 0.05}) {
    final w = size.width;
    final h = size.height;
    final top = h * topInset;
    final bottom = h * 0.96;
    final spanH = bottom - top;
    final p = Path();

    switch (shape) {
      case 'circle':
        final d = math.min(w * 0.88, spanH * 0.96);
        p.addOval(
          Rect.fromCenter(
            center: Offset(w * 0.5, top + spanH * 0.5),
            width: d,
            height: d,
          ),
        );
        return p;

      case 'oval':
        p.addOval(
          Rect.fromCenter(
            center: Offset(w * 0.5, top + spanH * 0.5),
            width: w * 0.72,
            height: spanH * 0.96,
          ),
        );
        return p;

      case 'diamond':
        p.moveTo(w * 0.5, top);
        p.lineTo(w * 0.92, top + spanH * 0.5);
        p.lineTo(w * 0.5, bottom);
        p.lineTo(w * 0.08, top + spanH * 0.5);
        p.close();
        return p;

      case 'hexagon':
        p.moveTo(w * 0.5, top);
        p.lineTo(w * 0.88, top + spanH * 0.22);
        p.lineTo(w * 0.88, top + spanH * 0.78);
        p.lineTo(w * 0.5, bottom);
        p.lineTo(w * 0.12, top + spanH * 0.78);
        p.lineTo(w * 0.12, top + spanH * 0.22);
        p.close();
        return p;

      case 'spanish':
        p.moveTo(w * 0.13, top + spanH * 0.04);
        p.lineTo(w * 0.87, top + spanH * 0.04);
        p.lineTo(w * 0.87, top + spanH * 0.58);
        p.arcToPoint(
          Offset(w * 0.13, top + spanH * 0.58),
          radius: Radius.circular(w * 0.37),
          clockwise: true,
        );
        p.close();
        return p;

      case 'crest':
        p.moveTo(w * 0.12, top + spanH * 0.12);
        p.quadraticBezierTo(
          w * 0.31,
          top + spanH * 0.18,
          w * 0.5,
          top + spanH * 0.02,
        );
        p.quadraticBezierTo(
          w * 0.69,
          top + spanH * 0.18,
          w * 0.88,
          top + spanH * 0.12,
        );
        p.lineTo(w * 0.88, top + spanH * 0.52);
        p.cubicTo(
          w * 0.88,
          top + spanH * 0.78,
          w * 0.64,
          top + spanH * 0.90,
          w * 0.5,
          bottom,
        );
        p.cubicTo(
          w * 0.36,
          top + spanH * 0.90,
          w * 0.12,
          top + spanH * 0.78,
          w * 0.12,
          top + spanH * 0.52,
        );
        p.close();
        return p;

      case 'heater':
        p.moveTo(w * 0.12, top + spanH * 0.08);
        p.quadraticBezierTo(w * 0.5, top, w * 0.88, top + spanH * 0.08);
        p.lineTo(w * 0.88, top + spanH * 0.50);
        p.quadraticBezierTo(
          w * 0.86,
          top + spanH * 0.80,
          w * 0.5,
          bottom,
        );
        p.quadraticBezierTo(
          w * 0.14,
          top + spanH * 0.80,
          w * 0.12,
          top + spanH * 0.50,
        );
        p.close();
        return p;

      case 'classic':
      default:
        p.moveTo(w * 0.12, top + spanH * 0.05);
        p.lineTo(w * 0.5, top);
        p.lineTo(w * 0.88, top + spanH * 0.05);
        p.lineTo(w * 0.88, top + spanH * 0.54);
        p.cubicTo(
          w * 0.88,
          top + spanH * 0.78,
          w * 0.65,
          top + spanH * 0.90,
          w * 0.5,
          bottom,
        );
        p.cubicTo(
          w * 0.35,
          top + spanH * 0.90,
          w * 0.12,
          top + spanH * 0.78,
          w * 0.12,
          top + spanH * 0.54,
        );
        p.close();
        return p;
    }
  }

  void _paintInteriorPattern(Canvas canvas, Size size, Color sec) {
    final w = size.width;
    final h = size.height;
    final secPaint = Paint()..color = sec;

    switch (pattern) {
      case 'stripes':
        final stripeW = w * 0.16;
        for (final x in [w * 0.18, w * 0.42, w * 0.66]) {
          canvas.drawRect(Rect.fromLTWH(x, 0, stripeW, h), secPaint);
        }
        return;

      case 'halves':
        canvas.drawRect(Rect.fromLTWH(w * 0.5, 0, w * 0.5, h), secPaint);
        return;

      case 'quarters':
        canvas.drawRect(Rect.fromLTWH(w * 0.5, 0, w * 0.5, h * 0.52), secPaint);
        canvas.drawRect(
          Rect.fromLTWH(0, h * 0.52, w * 0.5, h * 0.48),
          secPaint,
        );
        return;

      case 'band':
        canvas.drawRect(
          Rect.fromLTWH(0, h * 0.39, w, h * 0.24),
          secPaint,
        );
        return;

      case 'solid':
        return;

      case 'diagonal':
      default:
        final stripePath = Path()
          ..moveTo(w * 0.55, 0)
          ..lineTo(w, 0)
          ..lineTo(w, h)
          ..lineTo(w * 0.30, h)
          ..close();
        canvas.drawPath(stripePath, secPaint);
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

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final hasStars = starsCount > 0 && w >= 24;
    final topInset = hasStars ? 0.17 : 0.05;
    final shieldPath = _buildShieldPath(size, topInset: topInset);
    final sec = _effectiveSecondary;

    // 0. Estrellas superiores de campeonato (0..3)
    if (hasStars) {
      final starColor = customBorderColor ?? const Color(0xFFF59E0B);
      final starStroke = starColor.computeLuminance() > 0.5
          ? const Color(0xFF111827)
          : const Color(0xFFFFFFFF);
      final starR = (w * 0.078).clamp(2.2, 7.5);
      final positions = switch (starsCount) {
        1 => [Offset(w * 0.5, h * 0.085)],
        2 => [Offset(w * 0.39, h * 0.09), Offset(w * 0.61, h * 0.09)],
        _ => [
          Offset(w * 0.30, h * 0.105),
          Offset(w * 0.50, h * 0.075),
          Offset(w * 0.70, h * 0.105),
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

    // 1. Fondo interior del escudo recortado a su silueta
    canvas.save();
    canvas.clipPath(shieldPath);

    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = primaryColor,
    );

    _paintInteriorPattern(canvas, size, sec);

    // Brillo diagonal deportivo tipo esmalte
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h * 0.55),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: 0.22),
            Colors.white.withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromLTWH(0, 0, w, h * 0.55)),
    );
    canvas.restore();

    // 2. Borde doble del escudo (marco principal + filete interior)
    final borderWidth = (w * 0.068).clamp(1.2, 3.6);
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
        ..strokeWidth = (borderWidth * 0.36).clamp(0.6, 1.4)
        ..strokeJoin = StrokeJoin.round
        ..color = _innerRimColor,
    );

    // 3. Centro del escudo y cinta opcional
    final centerY = hasStars
        ? (showBanner && symbol != 'initials' ? h * 0.49 : h * 0.55)
        : (showBanner && symbol != 'initials' ? h * 0.44 : h * 0.50);
    final center = Offset(w * 0.5, centerY);
    final badgeRadius = w * (showBanner && symbol != 'initials' ? 0.23 : 0.27);
    final emblemCol = _emblemColor;
    final plateBg = emblemCol.computeLuminance() > 0.5
        ? const Color(0xFF0F172A).withValues(alpha: 0.76)
        : const Color(0xFFFFFFFF).withValues(alpha: 0.88);

    // Placa central con aro del color del marco
    canvas.drawCircle(center, badgeRadius, Paint()..color = plateBg);
    canvas.drawCircle(
      center,
      badgeRadius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (w * 0.03).clamp(0.8, 1.8)
        ..color = _rimColor,
    );

    _paintSymbol(canvas, size, center, badgeRadius, emblemCol);

    // 4. Cinta horizontal con siglas si `showBanner` está activo
    if (showBanner && w >= 22) {
      _paintRibbonBanner(canvas, size, hasStars: hasStars);
    }
  }

  void _paintRibbonBanner(Canvas canvas, Size size, {required bool hasStars}) {
    final w = size.width;
    final h = size.height;
    final bannerY = hasStars ? h * 0.77 : h * 0.74;
    final bannerW = w * 0.74;
    final bannerH = (h * 0.17).clamp(6.0, 22.0);
    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(w * 0.5, bannerY),
        width: bannerW,
        height: bannerH,
      ),
      Radius.circular(bannerH * 0.25),
    );

    final bg = _rimColor.computeLuminance() > 0.45
        ? const Color(0xFF0F172A)
        : const Color(0xFFFFFFFF);
    final fg = bg.computeLuminance() > 0.5
        ? const Color(0xFF0F172A)
        : const Color(0xFFFFFFFF);

    canvas.drawRRect(rect, Paint()..color = bg);
    canvas.drawRRect(
      rect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (w * 0.028).clamp(0.7, 1.6)
        ..color = _rimColor,
    );

    final text = initials.isEmpty
        ? 'FC'
        : (initials.length > 4 ? initials.substring(0, 4) : initials);
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: AppTypography.headline(
          size: (bannerH * 0.64).clamp(4.0, 14.0),
          weight: FontWeight.w800,
          color: fg,
        ).copyWith(height: 1.0, letterSpacing: 0.4),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(
      canvas,
      Offset(w * 0.5 - tp.width / 2, bannerY - tp.height / 2),
    );
  }

  void _paintSymbol(
    Canvas canvas,
    Size size,
    Offset center,
    double radius,
    Color color,
  ) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = (size.width * 0.032).clamp(0.8, 1.9);

    switch (symbol) {
      case 'star':
        _drawFivePointStar(canvas, center, radius * 0.72, color);
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
        canvas.drawPath(path, paint);
        return;

      case 'sun':
        final r = radius * 0.72;
        canvas.drawCircle(center, r * 0.42, paint);
        for (int i = 0; i < 12; i++) {
          final a = i * 2 * math.pi / 12;
          final p1 = Offset(
            center.dx + r * 0.52 * math.cos(a),
            center.dy + r * 0.52 * math.sin(a),
          );
          final p2 = Offset(
            center.dx + r * 0.92 * math.cos(a),
            center.dy + r * 0.92 * math.sin(a),
          );
          canvas.drawLine(p1, p2, stroke);
        }
        return;

      case 'wings':
        final r = radius * 0.74;
        final path = Path()
          // Ala izquierda
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
          // Ala derecha
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
        canvas.drawPath(path, paint);
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
        _drawFivePointStar(canvas, center, r * 0.46, color);
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
        canvas.drawPath(path, paint);
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
        canvas.drawPath(path, paint);
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
        canvas.drawPath(path, paint);
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
        canvas.drawPath(cup, paint);
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset(center.dx, center.dy + r * 0.42),
            width: r * 0.28,
            height: r * 0.42,
          ),
          paint,
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
          paint,
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
          final edge = Offset(
            center.dx + r * math.cos(a),
            center.dy + r * math.sin(a),
          );
          canvas.drawLine(pt, edge, stroke);
        }
        pent.close();
        canvas.drawPath(pent, paint);
        return;

      case 'initials':
      default:
        final text = initials.isEmpty
            ? 'FC'
            : (initials.length > 4 ? initials.substring(0, 4) : initials);
        final fontSize = text.length >= 4
            ? radius * 0.54
            : (text.length == 3
                  ? radius * 0.66
                  : (text.length == 2 ? radius * 0.82 : radius * 0.96));
        final tp = TextPainter(
          text: TextSpan(
            text: text,
            style: AppTypography.headline(
              size: fontSize.clamp(4.0, 28.0),
              weight: FontWeight.w800,
              color: color,
            ).copyWith(height: 1.0, letterSpacing: -0.3),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(
          canvas,
          Offset(center.dx - tp.width / 2, center.dy - tp.height / 2),
        );
        return;
    }
  }

  @override
  bool shouldRepaint(covariant _TeamCrestPainter oldDelegate) {
    return oldDelegate.shape != shape ||
        oldDelegate.pattern != pattern ||
        oldDelegate.symbol != symbol ||
        oldDelegate.initials != initials ||
        oldDelegate.showBanner != showBanner ||
        oldDelegate.starsCount != starsCount ||
        oldDelegate.customBorderColor != customBorderColor ||
        oldDelegate.primaryColor != primaryColor ||
        oldDelegate.secondaryColor != secondaryColor;
  }
}
