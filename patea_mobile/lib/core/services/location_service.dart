import 'dart:convert';
import 'package:http/http.dart' as http;

/// Port del fallback real de LocationInput (add-match-dialog.tsx) y de
/// src/app/api/geocode/suggest/route.ts: Nominatim/OpenStreetMap, gratis y
/// sin API key. La web prioriza Google Places si hay
/// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY configurada; acá vamos directo a Nominatim
/// (mismo resultado, cero configuración nativa de Google Maps).
class LocationSuggestion {
  final String label;
  final double lat;
  final double lng;
  final String placeId;

  LocationSuggestion({required this.label, required this.lat, required this.lng, required this.placeId});
}

class LocationService {
  static const _userAgent = 'PateaMobile/1.0 (+https://patea.app)';

  Future<List<LocationSuggestion>> suggest(String query) async {
    if (query.trim().length < 3) return [];

    final uri = Uri.parse(
      'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${Uri.encodeQueryComponent(query)}',
    );
    final response = await http.get(uri, headers: {'User-Agent': _userAgent}).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) return [];

    final results = jsonDecode(response.body) as List<dynamic>;
    return results.map((r) {
      final map = r as Map<String, dynamic>;
      return LocationSuggestion(
        label: map['display_name'] as String? ?? '',
        lat: double.tryParse(map['lat'].toString()) ?? 0,
        lng: double.tryParse(map['lon'].toString()) ?? 0,
        placeId: 'osm:${map['osm_type']}:${map['osm_id']}',
      );
    }).toList();
  }
}
