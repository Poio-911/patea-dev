import 'package:flutter/material.dart';

/// Port de src/lib/match-theme.ts (web): identidad visual por tipo de partido.
/// Los colores son los mismos "brand colors" de Tailwind que usa la web
/// (blue-500, teal-500, indigo-500, amber-500, red-500, green-500).
class MatchTypeTheme {
  final Color brandColor;
  final String label;
  final IconData icon;

  const MatchTypeTheme({
    required this.brandColor,
    required this.label,
    required this.icon,
  });
}

const Map<String, MatchTypeTheme> matchTypeThemes = {
  'manual': MatchTypeTheme(
    brandColor: Color(0xFF3B82F6), // blue-500
    label: 'Amistoso',
    icon: Icons.how_to_reg,
  ),
  'collaborative': MatchTypeTheme(
    brandColor: Color(0xFF14B8A6), // teal-500
    label: 'Colaborativo',
    icon: Icons.groups,
  ),
  'by_teams': MatchTypeTheme(
    brandColor: Color(0xFF6366F1), // indigo-500
    label: 'Por Equipos',
    icon: Icons.checkroom,
  ),
  'league': MatchTypeTheme(
    brandColor: Color(0xFFF59E0B), // amber-500
    label: 'Liga',
    icon: Icons.emoji_events,
  ),
  'cup': MatchTypeTheme(
    brandColor: Color(0xFFEF4444), // red-500
    label: 'Copa',
    icon: Icons.emoji_events,
  ),
  'league_final': MatchTypeTheme(
    brandColor: Color(0xFFFBBF24), // amber-400
    label: '⚡ FINAL DECISIVA ⚡',
    icon: Icons.emoji_events,
  ),
  'intergroup_friendly': MatchTypeTheme(
    brandColor: Color(0xFF22C55E), // green-500
    label: 'Inter-grupos',
    icon: Icons.public,
  ),
};

MatchTypeTheme getMatchTypeTheme(String type) {
  return matchTypeThemes[type] ?? matchTypeThemes['manual']!;
}
