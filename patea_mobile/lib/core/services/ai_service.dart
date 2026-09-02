import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import '../models/player_model.dart';

final aiServiceProvider = Provider<AiService>((ref) {
  return AiService();
});

/// Llama a la Cloud Function `generateBalancedTeams`, que envuelve el mismo
/// flow de Genkit que usa la web (src/ai/flows/generate-balanced-teams.ts)
/// para armar 2 equipos parejos por IA. Ver functions/src/callable/generate-balanced-teams.ts.
class AiService {
  /// Devuelve { teams: [...], balanceMetrics: {...} }. Cada team ya viene
  /// con nombre "Con chaleco"/"Sin chaleco", jersey por defecto, y
  /// jugadores con uid/displayName/position/ovr/photoURL — listo para
  /// escribir directamente en el campo 'teams' del partido.
  Future<Map<String, dynamic>> generateBalancedTeams(List<PlayerModel> players) {
    // Gemini en frío (sin cache) puede tardar 30s+ en responder — se vio en
    // producción un caso real de 33s que el timeout genérico de 30s cortaba
    // del lado del cliente aunque la función igual terminaba bien del lado
    // del servidor (quedaba cacheada para el próximo pedido).
    return callFunction(
      'generateBalancedTeams',
      {
        'players': players
            .map((p) => {
                  'uid': p.id,
                  'displayName': p.name,
                  'ovr': p.ovr,
                  'position': p.position,
                })
            .toList(),
        'teamCount': 2,
      },
      timeout: const Duration(seconds: 60),
    );
  }
}
