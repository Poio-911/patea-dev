import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import '../models/player_model.dart';

final aiServiceProvider = Provider<AiService>((ref) {
  return AiService();
});

/// Equilibra el plantel por nivel, posiciones, arqueros y cantidad de jugadores.
/// El servidor resuelve los perfiles reales y devuelve métricas del reparto.
class AiService {
  /// Devuelve { teams: [...], balanceMetrics: {...} }. Cada team ya viene
  /// con nombre "Con chaleco"/"Sin chaleco", jersey por defecto, y
  /// jugadores con uid/displayName/position/ovr/photoURL — listo para
  /// escribir directamente en el campo 'teams' del partido.
  Future<Map<String, dynamic>> generateBalancedTeams(
    List<PlayerModel> players,
  ) async {
    if (players.length < 2 ||
        players.map((p) => p.id).toSet().length != players.length) {
      throw ArgumentError('Elegí al menos dos jugadores diferentes.');
    }
    final result = await callFunction('generateBalancedTeams', {
      'players': players
          .map(
            (p) => {
              'uid': p.id,
              'displayName': p.name,
              'ovr': p.ovr,
              'position': p.position,
            },
          )
          .toList(),
      'teamCount': 2,
    });
    validateBalancedTeams(result, players.map((p) => p.id).toSet());
    return result;
  }

  static void validateBalancedTeams(
    Map<String, dynamic> result,
    Set<String> expectedIds,
  ) {
    final teams = result['teams'];
    if (teams is! List || teams.length != 2) {
      throw StateError('No se pudieron armar dos equipos. Reintentá.');
    }
    final assigned = <String>{};
    final sizes = <int>[];
    for (final team in teams) {
      final roster = team is Map ? team['players'] : null;
      if (roster is! List || roster.isEmpty) {
        throw StateError('Un equipo quedó vacío. Reintentá.');
      }
      sizes.add(roster.length);
      for (final player in roster) {
        final uid = player is Map ? player['uid'] : null;
        if (uid is! String ||
            !expectedIds.contains(uid) ||
            !assigned.add(uid)) {
          throw StateError(
            'El reparto repite o agrega jugadores. Actualizá el plantel y reintentá.',
          );
        }
      }
    }
    if (assigned.length != expectedIds.length ||
        (sizes[0] - sizes[1]).abs() > 1) {
      throw StateError(
        'El reparto no incluye a todos con cupos parejos. Reintentá.',
      );
    }
  }
}
