import 'player_model.dart';

/// Port de AvailablePlayer (src/lib/types.ts) — un doc en `availablePlayers/{uid}`,
/// escrito por enableAvailability/updateAvailabilityPreferences.
class AvailablePlayerModel {
  final String uid;
  final String displayName;
  final String? photoUrl;
  final String position;
  final int ovr;
  final int pac;
  final int sho;
  final int pas;
  final int dri;
  final int def;
  final int phy;
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
    this.pac = 0,
    this.sho = 0,
    this.pas = 0,
    this.dri = 0,
    this.def = 0,
    this.phy = 0,
    this.lat,
    this.lng,
    this.availability = const {},
    this.matchScore = 1,
    this.isCurrentUser = false,
    this.distanceKm,
  });

  Player toPlayer() {
    final effectiveOvr = ovr > 0 ? ovr : 50;
    return Player(
      id: uid,
      name: displayName,
      position: position.isNotEmpty ? position : 'MED',
      ovr: effectiveOvr,
      pac: pac > 0 ? pac : effectiveOvr,
      sho: sho > 0 ? sho : effectiveOvr,
      pas: pas > 0 ? pas : effectiveOvr,
      dri: dri > 0 ? dri : effectiveOvr,
      def: def > 0 ? def : effectiveOvr,
      phy: phy > 0 ? phy : effectiveOvr,
      photoUrl: photoUrl,
    );
  }

  factory AvailablePlayerModel.fromMap(Map<String, dynamic> map) {
    final rawAvailability = map['availability'] as Map<String, dynamic>? ?? {};
    final availability = rawAvailability.map((k, v) => MapEntry(k, (v as List<dynamic>? ?? []).map((e) => e.toString()).toList()));
    final location = map['location'] as Map<String, dynamic>?;

    final ovr = (map['ovr'] as num?)?.toInt() ?? 0;

    return AvailablePlayerModel(
      uid: (map['uid'] ?? '').toString(),
      displayName: map['displayName'] as String? ?? 'Jugador',
      photoUrl: (map['photoURL'] as String?)?.isNotEmpty == true ? map['photoURL'] as String : map['photoUrl'] as String?,
      position: map['position'] as String? ?? '',
      ovr: ovr,
      pac: (map['pac'] as num?)?.toInt() ?? ovr,
      sho: (map['sho'] as num?)?.toInt() ?? ovr,
      pas: (map['pas'] as num?)?.toInt() ?? ovr,
      dri: (map['dri'] as num?)?.toInt() ?? ovr,
      def: (map['def'] as num?)?.toInt() ?? ovr,
      phy: (map['phy'] as num?)?.toInt() ?? ovr,
      lat: (location?['lat'] as num?)?.toDouble(),
      lng: (location?['lng'] as num?)?.toDouble(),
      availability: availability,
      matchScore: (map['matchScore'] as num?)?.toInt() ?? 1,
      isCurrentUser: map['isCurrentUser'] as bool? ?? false,
      distanceKm: (map['distanceKm'] as num?)?.toDouble(),
    );
  }
}

