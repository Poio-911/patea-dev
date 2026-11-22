import '../services/location_service.dart';

/// Cancha guardada del grupo en `venues/{venueId}`.
/// Se alimenta automáticamente desde `createMatch`, `updateMatchLocation`,
/// `proposeMatchLocation`, `confirmMatchLocation` y `challengeTeam`.
class VenueModel {
  final String id;
  final String groupId;
  final String name;
  final String address;
  final double lat;
  final double lng;
  final String placeId;
  final String? photoUrl;
  final List<String> photos;
  final int usageCount;
  final String? lastUsedAt;
  final bool customPhoto;
  final bool customName;

  VenueModel({
    required this.id,
    required this.groupId,
    required this.name,
    this.address = '',
    this.lat = 0,
    this.lng = 0,
    this.placeId = '',
    this.photoUrl,
    this.photos = const [],
    this.usageCount = 1,
    this.lastUsedAt,
    this.customPhoto = false,
    this.customName = false,
  });

  factory VenueModel.fromFirestore(Map<String, dynamic> data, String id) {
    final loc = data['location'];
    double lat = 0;
    double lng = 0;
    if (loc is Map) {
      lat = (loc['lat'] as num?)?.toDouble() ?? 0;
      lng = (loc['lng'] as num?)?.toDouble() ?? 0;
    }
    final rawPhotos = data['photos'];
    final photos = rawPhotos is List
        ? rawPhotos.whereType<String>().where((s) => s.isNotEmpty).toList()
        : const <String>[];
    final rawPhotoUrl = data['photoUrl'] as String?;
    final photoUrl = (rawPhotoUrl != null && rawPhotoUrl.isNotEmpty)
        ? rawPhotoUrl
        : (photos.isNotEmpty ? photos.first : null);

    return VenueModel(
      id: id,
      groupId: data['groupId'] as String? ?? '',
      name: data['name'] as String? ?? '',
      address: data['address'] as String? ?? '',
      lat: lat,
      lng: lng,
      placeId: data['placeId'] as String? ?? '',
      photoUrl: photoUrl,
      photos: photos,
      usageCount: (data['usageCount'] as num?)?.toInt() ?? 1,
      lastUsedAt: data['lastUsedAt'] as String?,
      customPhoto: data['customPhoto'] as bool? ?? false,
      customName: data['customName'] as bool? ?? false,
    );
  }

  /// Convierte la cancha guardada en un [LocationSuggestion] reutilizable
  /// sin costo adicional de Google Places API.
  LocationSuggestion toSuggestion() {
    final label = address.isNotEmpty && address != name
        ? '$name, $address'
        : name;
    return LocationSuggestion(
      label: label,
      name: name,
      address: address,
      lat: lat,
      lng: lng,
      placeId: placeId,
      photoUrl: photoUrl,
    );
  }
}
