import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';

final playerServiceProvider = Provider<PlayerService>((ref) {
  return PlayerService();
});

/// Port de createManualPlayerAction (src/lib/actions/player-actions.ts).
/// `players` tiene `allow create: if false` en firestore.rules a
/// propósito — pasa por la Cloud Function `createManualPlayer`.
class PlayerService {
  Future<Map<String, dynamic>> getManualContact(String id) async =>
      await callFunction('getManualPlayerContact', {'playerId': id});

  Future<void> saveManualPlayer(Map<String, dynamic> data) async {
    await callFunction('createManualPlayer', data);
  }

  Future<void> updateManualPlayer(String id, Map<String, dynamic> data) async {
    await callFunction('updateManualPlayer', {...data, 'playerId': id});
  }

  Future<void> deleteManualPlayer(String id) async {
    await callFunction('deleteManualPlayer', {'playerId': id});
  }

  Future<String> createManualPlayer({
    required String groupId,
    required String name,
    required String position,
    required int ovr,
    required int pac,
    required int sho,
    required int pas,
    required int dri,
    required int def,
    required int phy,
  }) async {
    final result = await callFunction('createManualPlayer', {
      'groupId': groupId,
      'name': name,
      'position': position,
      'ovr': ovr,
      'pac': pac,
      'sho': sho,
      'pas': pas,
      'dri': dri,
      'def': def,
      'phy': phy,
    });
    return result['id'] as String;
  }
}
