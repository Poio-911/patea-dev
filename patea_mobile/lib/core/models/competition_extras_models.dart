import 'package:flutter/foundation.dart';

/// Un patrocinador de la competición (nombre y, si quiere, su enlace).
@immutable
class CompetitionSponsor {
  final String id;
  final String name;
  final String? websiteUrl;

  const CompetitionSponsor({
    required this.id,
    required this.name,
    this.websiteUrl,
  });

  static CompetitionSponsor? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final name = raw['name'];
    if (name is! String || name.trim().isEmpty) return null;
    final url = raw['websiteUrl'];
    return CompetitionSponsor(
      id: raw['id'] is String ? raw['id'] as String : '',
      name: name.trim(),
      websiteUrl: url is String && url.isNotEmpty ? url : null,
    );
  }

  static List<CompetitionSponsor> listFrom(dynamic raw) => [
    for (final s in (raw as List? ?? const [])) ?CompetitionSponsor.fromMap(s),
  ];
}

/// Una cancha o sede donde se juega la competición.
@immutable
class CompetitionVenue {
  final String id;
  final String name;
  final String? address;
  final int? capacity;
  final double? costPerMatch;
  final String? notes;

  const CompetitionVenue({
    required this.id,
    required this.name,
    this.address,
    this.capacity,
    this.costPerMatch,
    this.notes,
  });

  factory CompetitionVenue.fromMap(Map<String, dynamic> map, String id) =>
      CompetitionVenue(
        id: id,
        name: (map['name'] as String?)?.trim().isNotEmpty == true
            ? map['name'] as String
            : 'Sede',
        address: _nonEmpty(map['address']),
        capacity: (map['capacity'] as num?)?.toInt(),
        costPerMatch: (map['costPerMatch'] as num?)?.toDouble(),
        notes: _nonEmpty(map['notes']),
      );

  static String? _nonEmpty(dynamic v) =>
      v is String && v.trim().isNotEmpty ? v.trim() : null;
}

/// Un aviso que mandó el organizador (lo ve solo él, como historial).
@immutable
class CompetitionMessage {
  final String id;
  final String subject;
  final String body;
  final String audience; // all, captains
  final int recipientCount;
  final DateTime? createdAt;

  const CompetitionMessage({
    required this.id,
    required this.subject,
    required this.body,
    required this.audience,
    required this.recipientCount,
    required this.createdAt,
  });

  factory CompetitionMessage.fromMap(Map<String, dynamic> map, String id) =>
      CompetitionMessage(
        id: id,
        subject: map['subject'] as String? ?? '',
        body: map['body'] as String? ?? '',
        audience: map['audience'] as String? ?? 'all',
        recipientCount: (map['recipientCount'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.tryParse(map['createdAt'] as String? ?? ''),
      );
}
