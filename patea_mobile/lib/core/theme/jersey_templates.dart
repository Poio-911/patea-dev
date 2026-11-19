/// Plantillas de camisetas de equipo (compatibles con `src/lib/jersey-templates.ts`).
///
/// Convención uniforme:
/// - `primaryColors`: color base/dominante del cuerpo de la camiseta en el SVG.
/// - `secondaryColors`: color de las franjas, banda, cruz, mangas o detalles.
class JerseyTemplate {
  final String label;
  final String assetPath;
  final List<String> primaryColors;
  final List<String> secondaryColors;

  const JerseyTemplate({
    required this.label,
    required this.assetPath,
    required this.primaryColors,
    required this.secondaryColors,
  });

  bool get usesSecondaryColor => secondaryColors.isNotEmpty;
}

const Map<String, JerseyTemplate> jerseyTemplates = {
  'plain': JerseyTemplate(
    label: 'Lisa',
    assetPath: 'assets/jerseys/plain-pink-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fbb'],
    secondaryColors: [],
  ),
  'vertical': JerseyTemplate(
    label: 'Bastones',
    assetPath: 'assets/jerseys/vertical-blue-yellow-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fe0'],
    secondaryColors: ['#33f'],
  ),
  'multi_stripes': JerseyTemplate(
    label: 'Multirayas',
    assetPath: 'assets/jerseys/multi_stripes.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'band': JerseyTemplate(
    label: 'Franja Pecho',
    assetPath: 'assets/jerseys/band-red-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#d00'],
    secondaryColors: ['#ffffff'],
  ),
  'chest_stripes': JerseyTemplate(
    label: 'Doble Franja',
    assetPath: 'assets/jerseys/chest_stripes.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'sash': JerseyTemplate(
    label: 'Banda Diagonal',
    assetPath: 'assets/jerseys/sash.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'double_sash': JerseyTemplate(
    label: 'Doble Banda',
    assetPath: 'assets/jerseys/double_sash.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'halves': JerseyTemplate(
    label: 'Mitades',
    assetPath: 'assets/jerseys/halves.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'raglan': JerseyTemplate(
    label: 'Ranglan',
    assetPath: 'assets/jerseys/raglan.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'chevron': JerseyTemplate(
    label: 'Chevron (V)',
    assetPath: 'assets/jerseys/chevron-blue-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'thirds': JerseyTemplate(
    label: 'Tercios',
    assetPath: 'assets/jerseys/thirds-red-white-football-shirt-svgrepo-com.svg',
    primaryColors: ['#d00'],
    secondaryColors: ['#ffffff'],
  ),
  'central_panel': JerseyTemplate(
    label: 'Panel Central',
    assetPath: 'assets/jerseys/central_panel.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'center_stripe': JerseyTemplate(
    label: 'Franja Central',
    assetPath: 'assets/jerseys/center_stripe.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'lines': JerseyTemplate(
    label: 'Tres Rayas',
    assetPath: 'assets/jerseys/opcion-7.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'v_pinstripes': JerseyTemplate(
    label: 'Líneas Finas',
    assetPath: 'assets/jerseys/v_pinstripes.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'hoops': JerseyTemplate(
    label: 'Aros',
    assetPath: 'assets/jerseys/hoops.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'shoulder_yoke': JerseyTemplate(
    label: 'Hombros',
    assetPath: 'assets/jerseys/shoulder_yoke.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'quarters': JerseyTemplate(
    label: 'Cuartos',
    assetPath: 'assets/jerseys/quarters.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'diagonal_half': JerseyTemplate(
    label: 'Mitad Diagonal',
    assetPath: 'assets/jerseys/diagonal_half.svg',
    primaryColors: ['#33f'],
    secondaryColors: ['#ffffff'],
  ),
  'cross': JerseyTemplate(
    label: 'Cruz',
    assetPath: 'assets/jerseys/cross.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'checkers': JerseyTemplate(
    label: 'Cuadros',
    assetPath: 'assets/jerseys/checkers.svg',
    primaryColors: ['#ffffff'],
    secondaryColors: ['#33f'],
  ),
  'solid': JerseyTemplate(
    label: 'Sólida',
    assetPath: 'assets/jerseys/plain-pink-football-shirt-svgrepo-com.svg',
    primaryColors: ['#fbb'],
    secondaryColors: [],
  ),
};

JerseyTemplate getJerseyTemplate(String type) {
  return jerseyTemplates[type] ?? jerseyTemplates['plain']!;
}

bool _isVeryDarkHex(String hex) {
  final clean = hex.trim().replaceFirst('#', '');
  final full = clean.length == 3
      ? '${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}'
      : clean;
  final value = int.tryParse(full, radix: 16);
  if (value == null) return false;
  final r = (value >> 16) & 0xFF;
  final g = (value >> 8) & 0xFF;
  final b = value & 0xFF;
  // Luminancia perceptual rápida (0..255).
  final luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma < 42;
}

/// Reemplaza los fill/stroke de las plantillas por los colores elegidos en dos
/// fases (placeholders intermedios) para que elegir Blanco (`#FFFFFF`) como
/// color primario jamás colisione con `#ffffff` del secundario.
String applyColorsToSvg(
  String svgContent,
  JerseyTemplate template,
  String primaryColor,
  String secondaryColor,
) {
  const primaryToken = '__PATEA_PRIMARY__';
  const secondaryToken = '__PATEA_SECONDARY__';

  String replaceWithToken(String content, List<String> oldColors, String token) {
    var modified = content;
    for (final oldColor in oldColors) {
      final pattern = RegExp(
        '(fill|stroke)="${RegExp.escape(oldColor)}"',
        caseSensitive: false,
      );
      modified = modified.replaceAllMapped(pattern, (m) => '${m[1]}="$token"');
    }
    return modified;
  }

  var result = replaceWithToken(svgContent, template.primaryColors, primaryToken);
  result = replaceWithToken(result, template.secondaryColors, secondaryToken);

  result = result
      .replaceAll(primaryToken, primaryColor)
      .replaceAll(secondaryToken, secondaryColor);

  // Si la camiseta es negra o muy oscura, aclaramos levemente el contorno para
  // que se lean cuello, mangas y silueta sobre fondos oscuros.
  if (_isVeryDarkHex(primaryColor)) {
    result = result.replaceAll('fill="#111827"', 'fill="#475569"');
  }

  return result;
}
