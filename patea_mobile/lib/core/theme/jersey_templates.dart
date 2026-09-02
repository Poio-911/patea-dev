/// Port 1:1 de src/lib/jersey-templates.ts (web).
/// Los SVG y el color-mapping deben mantenerse idénticos a la fuente web
/// (D:\Pateá\public\jerseys\ + src/lib/jersey-templates.ts) para que las
/// camisetas se vean iguales en mobile y en la web.
class JerseyTemplate {
  final String assetPath;
  final List<String> primaryColors;
  final List<String> secondaryColors;

  const JerseyTemplate({
    required this.assetPath,
    required this.primaryColors,
    required this.secondaryColors,
  });
}

const Map<String, JerseyTemplate> jerseyTemplates = {
  'plain': JerseyTemplate(
    assetPath: 'assets/jerseys/plain-pink-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fbb'],
    secondaryColors: [],
  ),
  'vertical': JerseyTemplate(
    assetPath: 'assets/jerseys/vertical-blue-yellow-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fe0'],
    secondaryColors: ['#33f'],
  ),
  'band': JerseyTemplate(
    assetPath: 'assets/jerseys/band-red-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#d00'],
    secondaryColors: ['#ffffff'],
  ),
  'chevron': JerseyTemplate(
    assetPath: 'assets/jerseys/chevron-blue-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'thirds': JerseyTemplate(
    assetPath: 'assets/jerseys/thirds-red-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#d00'],
    secondaryColors: ['#ffffff'],
  ),
  'lines': JerseyTemplate(
    assetPath: 'assets/jerseys/opcion-7.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'solid': JerseyTemplate(
    assetPath: 'assets/jerseys/plain-pink-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fbb'],
    secondaryColors: [],
  ),
  'hoops': JerseyTemplate(
    assetPath: 'assets/jerseys/hoops.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'halves': JerseyTemplate(
    assetPath: 'assets/jerseys/halves.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'cross': JerseyTemplate(
    assetPath: 'assets/jerseys/cross.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'sash': JerseyTemplate(
    assetPath: 'assets/jerseys/sash.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'checkers': JerseyTemplate(
    assetPath: 'assets/jerseys/checkers.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'quarters': JerseyTemplate(
    assetPath: 'assets/jerseys/quarters.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'diagonal_half': JerseyTemplate(
    assetPath: 'assets/jerseys/diagonal_half.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'central_panel': JerseyTemplate(
    assetPath: 'assets/jerseys/central_panel.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'v_pinstripes': JerseyTemplate(
    assetPath: 'assets/jerseys/v_pinstripes.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
};

JerseyTemplate getJerseyTemplate(String type) {
  return jerseyTemplates[type] ?? jerseyTemplates['plain']!;
}

/// Port de applyColorsToSvg (jersey-templates.ts): reemplaza los fill/stroke
/// de las plantillas por los colores elegidos, igual que hace la web.
String applyColorsToSvg(
  String svgContent,
  JerseyTemplate template,
  String primaryColor,
  String secondaryColor,
) {
  var result = svgContent;

  String replace(String content, List<String> oldColors, String newColor) {
    var modified = content;
    for (final oldColor in oldColors) {
      final pattern = RegExp(
        '(fill|stroke)="${RegExp.escape(oldColor)}"',
        caseSensitive: false,
      );
      modified = modified.replaceAllMapped(pattern, (m) => '${m[1]}="$newColor"');
    }
    return modified;
  }

  result = replace(result, template.primaryColors, primaryColor);
  result = replace(result, template.secondaryColors, secondaryColor);

  return result;
}
