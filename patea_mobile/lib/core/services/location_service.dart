import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:http/http.dart' as http;

import 'callable_functions.dart';

/// País soportado en el selector rápido de búsqueda de canchas.
class CountryOption {
  final String? code;
  final String flag;
  final String name;

  const CountryOption({
    required this.code,
    required this.flag,
    required this.name,
  });
}

const List<CountryOption> kSupportedCountries = [
  CountryOption(code: 'UY', flag: '🇺🇾', name: 'Uruguay'),
  CountryOption(code: 'AR', flag: '🇦🇷', name: 'Argentina'),
  CountryOption(code: 'CL', flag: '🇨🇱', name: 'Chile'),
  CountryOption(code: 'BR', flag: '🇧🇷', name: 'Brasil'),
  CountryOption(code: 'PY', flag: '🇵🇾', name: 'Paraguay'),
  CountryOption(code: 'CO', flag: '🇨🇴', name: 'Colombia'),
  CountryOption(code: 'PE', flag: '🇵🇪', name: 'Perú'),
  CountryOption(code: 'MX', flag: '🇲🇽', name: 'México'),
  CountryOption(code: 'ES', flag: '🇪🇸', name: 'España'),
  CountryOption(code: 'US', flag: '🇺🇸', name: 'EE. UU.'),
  CountryOption(code: null, flag: '🌎', name: 'Todos'),
];

CountryOption findCountryOption(String? code) {
  final norm = normalizeCountryCode(code);
  if (norm == null) return kSupportedCountries.last;
  return kSupportedCountries.firstWhere(
    (c) => c.code == norm,
    orElse: () => CountryOption(code: norm, flag: '🏳️', name: norm),
  );
}

String? normalizeCountryCode(String? raw) {
  if (raw == null) return null;
  final clean = raw.trim().toUpperCase();
  if (clean.length != 2) return null;
  if (!RegExp(r'^[A-Z]{2}$').hasMatch(clean)) return null;
  return clean;
}

class LocationSuggestion {
  final String label;
  final String name;
  final String address;
  final double lat;
  final double lng;
  final String placeId;
  final String? photoUrl;

  LocationSuggestion({
    required this.label,
    String? name,
    String? address,
    required this.lat,
    required this.lng,
    required this.placeId,
    this.photoUrl,
  }) : name = name ?? _inferName(label),
       address = address ?? label;

  static String _inferName(String label) {
    final idx = label.indexOf(',');
    if (idx > 0) return label.substring(0, idx).trim();
    return label.trim();
  }

  LocationSuggestion copyWith({
    String? label,
    String? name,
    String? address,
    double? lat,
    double? lng,
    String? placeId,
    String? photoUrl,
  }) {
    return LocationSuggestion(
      label: label ?? this.label,
      name: name ?? this.name,
      address: address ?? this.address,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      placeId: placeId ?? this.placeId,
      photoUrl: photoUrl ?? this.photoUrl,
    );
  }
}

class LocationService {
  static const _userAgent = 'PateaMobile/1.0 (+https://patea.app)';
  static final _rng = math.Random.secure();

  /// Genera un session token UUIDv4-like para agrupar autocomplete + Place Details
  /// en Google Places API (New).
  static String createSessionToken() {
    String hex(int count) => List.generate(
      count,
      (_) => _rng.nextInt(16).toRadixString(16),
    ).join();
    return '${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}';
  }

  /// País por defecto según el grupo o el locale del dispositivo.
  static String? defaultCountryCode({String? groupCountryCode}) {
    final fromGroup = normalizeCountryCode(groupCountryCode);
    if (fromGroup != null) return fromGroup;

    final localeCountry = normalizeCountryCode(
      ui.PlatformDispatcher.instance.locale.countryCode,
    );
    if (localeCountry != null) return localeCountry;

    return 'UY';
  }

  /// Busca sugerencias de canchas/lugares usando Cloud Function `suggestLocations`
  /// (Google Places API New con filtro de país) y cae a Nominatim si falla la llamada.
  Future<List<LocationSuggestion>> suggest(
    String query, {
    String? countryCode,
    String? sessionToken,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return [];

    final normCountry = normalizeCountryCode(countryCode);

    try {
      final result = await callFunction('suggestLocations', {
        'query': trimmed,
        if (normCountry != null) 'countryCode': normCountry,
        if (sessionToken != null && sessionToken.isNotEmpty)
          'sessionToken': sessionToken,
      });

      final rawList = result['suggestions'];
      if (rawList is List) {
        return rawList
            .whereType<Map>()
            .map((raw) {
              final map = Map<String, dynamic>.from(raw);
              final label = map['label'] as String? ?? '';
              final name = map['name'] as String? ?? '';
              final address = map['address'] as String? ?? '';
              return LocationSuggestion(
                label: label.isNotEmpty ? label : name,
                name: name.isNotEmpty ? name : null,
                address: address.isNotEmpty ? address : label,
                lat: (map['lat'] as num?)?.toDouble() ?? 0,
                lng: (map['lng'] as num?)?.toDouble() ?? 0,
                placeId: map['placeId'] as String? ?? '',
                photoUrl: map['photoUrl'] as String?,
              );
            })
            .where((s) => s.label.isNotEmpty)
            .toList();
      }
    } catch (_) {
      // Fallback silencioso a Nominatim directo si no hay conectividad al callable.
    }

    return _suggestNominatim(trimmed, countryCode: normCountry);
  }

  Future<List<LocationSuggestion>> _suggestNominatim(
    String query, {
    String? countryCode,
  }) async {
    final countryParam = countryCode != null
        ? '&countrycodes=${countryCode.toLowerCase()}'
        : '';
    final uri = Uri.parse(
      'https://nominatim.openstreetmap.org/search?format=json&limit=5$countryParam&q=${Uri.encodeQueryComponent(query)}',
    );
    final response = await http
        .get(uri, headers: {'User-Agent': _userAgent})
        .timeout(const Duration(seconds: 10));
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

  /// Resuelve coordenadas exactas y foto de referencia cacheada en Firebase Storage
  /// para un resultado de Google Places (`placeId` sin prefijo `osm:`).
  Future<LocationSuggestion> resolvePlace(
    LocationSuggestion suggestion, {
    String? sessionToken,
    String? groupId,
  }) async {
    if (suggestion.placeId.isEmpty || suggestion.placeId.startsWith('osm:')) {
      return suggestion;
    }
    if (suggestion.lat != 0 &&
        suggestion.lng != 0 &&
        suggestion.photoUrl != null &&
        suggestion.photoUrl!.isNotEmpty) {
      return suggestion;
    }

    try {
      final result = await callFunction('resolvePlaceLocation', {
        'placeId': suggestion.placeId,
        if (sessionToken != null && sessionToken.isNotEmpty)
          'sessionToken': sessionToken,
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
        'fallbackName': suggestion.name,
        'fallbackAddress': suggestion.address,
        'fallbackLat': suggestion.lat,
        'fallbackLng': suggestion.lng,
      });

      final rawPlace = result['place'];
      if (rawPlace is Map) {
        final place = Map<String, dynamic>.from(rawPlace);
        return LocationSuggestion(
          label: place['label'] as String? ?? suggestion.label,
          name: place['name'] as String? ?? suggestion.name,
          address: place['address'] as String? ?? suggestion.address,
          lat: (place['lat'] as num?)?.toDouble() ?? suggestion.lat,
          lng: (place['lng'] as num?)?.toDouble() ?? suggestion.lng,
          placeId: place['placeId'] as String? ?? suggestion.placeId,
          photoUrl: place['photoUrl'] as String? ?? suggestion.photoUrl,
        );
      }
    } catch (_) {
      // Si falla el detalle, devolvemos la sugerencia base.
    }

    return suggestion;
  }

  /// Sube una foto personalizada para una cancha del grupo a Firebase Storage
  /// (`venue-photos/{groupId}/{uid}/...`) y devuelve su URL pública.
  Future<String> uploadCustomVenuePhoto({
    required String groupId,
    required String venueId,
    required File file,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('Tenés que iniciar sesión para subir fotos.');
    }
    final ts = DateTime.now().millisecondsSinceEpoch;
    final ref = FirebaseStorage.instance
        .ref()
        .child('venue-photos/$groupId/${user.uid}/${venueId}_$ts.jpg');
    final bytes = await file.readAsBytes();
    final snap = await ref.putData(
      bytes,
      SettableMetadata(contentType: 'image/jpeg'),
    );
    return snap.ref.getDownloadURL();
  }
}
