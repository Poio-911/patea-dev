import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../models/group_model.dart';
import '../theme/jersey_templates.dart';

/// Port de JerseyPreview (src/components/team-builder/jersey-preview.tsx):
/// usa los mismos SVG y el mismo reemplazo de colores que la web, en vez de
/// dibujar una forma aproximada con CustomPainter.
class JerseyWidget extends StatefulWidget {
  final JerseyModel jersey;
  final double size;

  const JerseyWidget({
    super.key,
    required this.jersey,
    this.size = 48,
  });

  @override
  State<JerseyWidget> createState() => _JerseyWidgetState();
}

class _JerseyWidgetState extends State<JerseyWidget> {
  late Future<String> _svgFuture;

  @override
  void initState() {
    super.initState();
    _svgFuture = _loadColoredSvg();
  }

  @override
  void didUpdateWidget(covariant JerseyWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.jersey.pattern != widget.jersey.pattern ||
        oldWidget.jersey.primaryColor != widget.jersey.primaryColor ||
        oldWidget.jersey.secondaryColor != widget.jersey.secondaryColor) {
      _svgFuture = _loadColoredSvg();
    }
  }

  Future<String> _loadColoredSvg() async {
    final template = getJerseyTemplate(widget.jersey.pattern);
    final raw = await rootBundle.loadString(template.assetPath);
    return applyColorsToSvg(
      raw,
      template,
      widget.jersey.primaryColor,
      widget.jersey.secondaryColor,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: FutureBuilder<String>(
        future: _svgFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const SizedBox.shrink();
          return SvgPicture.string(
            snapshot.data!,
            width: widget.size,
            height: widget.size,
            fit: BoxFit.contain,
          );
        },
      ),
    );
  }
}
