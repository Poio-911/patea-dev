/// Port de AvailablePlayer (src/lib/types.ts) — un doc en `availablePlayers/{uid}`,
/// escrito por enableAvailability/updateAvailabilityPreferences.
class AvailablePlayerModel {
  final String uid;
  final String displayName;
  final String? photoUrl;
  final String position;
  final int ovr;
  final double? lat;
  final double? lng;
  final Map<String, List<String>> availability; // día -> [mañana, tarde, noche]
  final int matchScore;
  final bool isCurrentUser;
  final double? distanceKm;

  AvailablePlayerModel({
    required this.uid,
    required this.displayName,
    this.photoUrl,
    this.position = '',
    this.ovr = 0,
    this.lat,
    this.lng,
    this.availability = const {},
    this.matchScore = 1,
    this.isCurrentUser = false,
    this.distanceKm,
  });

  factory AvailablePlayerModel.fromMap(Map<String, dynamic> map) {
    final rawAvailability = map['availability'] as Map<String, dynamic>? ?? {};
    final availability = rawAvailability.map((k, v) => MapEntry(k, (v as List<dynamic>? ?? []).map((e) => e.toString()).toList()));
    final location = map['location'] as Map<String, dynamic>?;

    return AvailablePlayerModel(
      uid: (map['uid'] ?? '').toString(),
      displayName: map['displayName'] as String? ?? 'Jugador',
      photoUrl: (map['photoURL'] as String?)?.isNotEmpty == true ? map['photoURL'] as String : map['photoUrl'] as String?,
      position: map['position'] as String? ?? '',
      ovr: (map['ovr'] as num?)?.toInt() ?? 0,
      lat: (location?['lat'] as num?)?.toDouble(),
      lng: (location?['lng'] as num?)?.toDouble(),
      availability: availability,
      matchScore: (map['matchScore'] as num?)?.toInt() ?? 1,
      isCurrentUser: map['isCurrentUser'] as bool? ?? false,
      distanceKm: (map['distanceKm'] as num?)?.toDouble(),
    );
  }
}
