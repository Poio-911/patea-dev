/// Illustrative scenery, never a claim about the match's real venue.
/// The same ID keeps its cover across panel, lists and detail, and sessions.
abstract final class MatchPhotography {
  static const assets = [
    'assets/brand/patea_indoor.webp',
    'assets/brand/patea_park.webp',
    'assets/brand/patea_urban_court.webp',
    'assets/brand/patea_matchday.webp',
    'assets/brand/patea_ready_pitch.webp',
  ];

  static String forMatch(String id) {
    var hash = 0x811c9dc5;
    for (final unit in id.codeUnits) {
      hash = ((hash ^ unit) * 0x01000193) & 0x7fffffff;
    }
    return assets[hash % assets.length];
  }
}
