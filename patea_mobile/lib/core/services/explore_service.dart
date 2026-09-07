import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import '../models/available_player_model.dart';

final exploreServiceProvider = Provider<ExploreService>((ref) {
  return ExploreService();
});

/// Port de src/lib/actions/{recruitment-actions,availability-actions,
/// location-actions,match-invitation-actions (parcial)}.ts.
class ExploreService {
  Future<void> saveUserLocation({required double lat, required double lng, String? label}) async {
    await callFunction('saveUserLocation', {'lat': lat, 'lng': lng, if (label != null) 'label': label});
  }

  Future<void> enableAvailability({
    List<String> days = const [],
    List<String> times = const [],
    Map<String, List<String>>? availability,
    double? lat,
    double? lng,
    String? label,
  }) async {
    await callFunction('enableAvailability', {
      if (availability != null && availability.isNotEmpty)
        'availability': availability
      else ...{
        'days': days,
        'times': times,
      },
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (label != null) 'label': label,
    });
  }

  Future<void> disableAvailability() async {
    await callFunction('disableAvailability', {});
  }

  Future<void> updateAvailabilityPreferences({
    List<String> days = const [],
    List<String> times = const [],
    Map<String, List<String>>? availability,
  }) async {
    await callFunction('updateAvailabilityPreferences', {
      if (availability != null && availability.isNotEmpty)
        'availability': availability
      else ...{
        'days': days,
        'times': times,
      },
    });
  }

  Future<List<AvailablePlayerModel>> getAvailableLocalPlayers({
    required double lat,
    required double lng,
    double radiusInKm = 50,
    String? dayOfWeek,
    String? timeOfDay,
    List<String> matchPlayerUids = const [],
  }) async {
    final result = await callFunction('getAvailableLocalPlayers', {
      'lat': lat,
      'lng': lng,
      'radiusInKm': radiusInKm,
      if (dayOfWeek != null) 'dayOfWeek': dayOfWeek,
      if (timeOfDay != null) 'timeOfDay': timeOfDay,
      'matchPlayerUids': matchPlayerUids,
    });
    final players = (result['players'] as List<dynamic>? ?? []);
    return players.map((p) => AvailablePlayerModel.fromMap((p as Map).cast<String, dynamic>())).toList();
  }

  Future<int> sendMatchInvitations({required String matchId, required List<String> playerIds}) async {
    final result = await callFunction('sendMatchInvitations', {'matchId': matchId, 'playerIds': playerIds});
    return (result['sent'] as num?)?.toInt() ?? 0;
  }
}
