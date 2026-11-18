import '../utils/photo_url.dart';

class PlayerStats {
  final int matchesPlayed;
  final int goals;
  final int assists;
  final double averageRating;
  final int mvpCount;
  final int cleanSheets;
  final int saves;
  final int goalsConceded;

  PlayerStats({
    this.matchesPlayed = 0,
    this.goals = 0,
    this.assists = 0,
    this.averageRating = 0.0,
    this.mvpCount = 0,
    this.cleanSheets = 0,
    this.saves = 0,
    this.goalsConceded = 0,
  });

  factory PlayerStats.fromMap(Map<String, dynamic>? map) {
    if (map == null) return PlayerStats();
    return PlayerStats(
      matchesPlayed: (map['matchesPlayed'] as num?)?.toInt() ?? 0,
      goals: (map['goals'] as num?)?.toInt() ?? 0,
      assists: (map['assists'] as num?)?.toInt() ?? 0,
      averageRating: (map['averageRating'] as num?)?.toDouble() ?? 0.0,
      mvpCount: (map['mvpCount'] as num?)?.toInt() ?? 0,
      cleanSheets: (map['cleanSheets'] as num?)?.toInt() ?? 0,
      saves: (map['saves'] as num?)?.toInt() ?? 0,
      goalsConceded: (map['goalsConceded'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'matchesPlayed': matchesPlayed,
      'goals': goals,
      'assists': assists,
      'averageRating': averageRating,
      'mvpCount': mvpCount,
      'cleanSheets': cleanSheets,
      'saves': saves,
      'goalsConceded': goalsConceded,
    };
  }
}

/// Port de OvrHistory (src/lib/types.ts) — un asiento en la subcolección
/// `players/{id}/ovrHistory`, escrito cada vez que se evalúa un partido.
class OvrHistoryEntry {
  final DateTime date;
  final int oldOVR;
  final int newOVR;
  final String? matchId;

  OvrHistoryEntry({
    required this.date,
    required this.oldOVR,
    required this.newOVR,
    this.matchId,
  });

  factory OvrHistoryEntry.fromMap(Map<String, dynamic> map) {
    final rawDate = map['date'];
    DateTime parsed;
    if (rawDate is String) {
      parsed = DateTime.tryParse(rawDate) ?? DateTime.now();
    } else if (rawDate != null &&
        rawDate.runtimeType.toString() == 'Timestamp') {
      parsed = (rawDate as dynamic).toDate() as DateTime;
    } else {
      parsed = DateTime.now();
    }
    return OvrHistoryEntry(
      date: parsed,
      oldOVR: (map['oldOVR'] as num?)?.toInt() ?? 0,
      newOVR: (map['newOVR'] as num?)?.toInt() ?? 0,
      matchId: map['matchId'] as String?,
    );
  }
}

class PlayerModel {
  final String id;
  final String name;
  final String position; // DEL, MED, DEF, POR
  final int ovr;
  final int pac;
  final int sho;
  final int pas;
  final int dri;
  final int def;
  final int phy;
  final String? photoUrl;
  final String? aiSourcePhotoUrl;
  final String? ownerUid;
  final String? groupId;
  final PlayerStats stats;

  // Datos del perfil que el jugador edita. Opcionales: un jugador creado a
  // mano por un organizador no los tiene.
  final String? preferredFoot; // derecho | izquierdo | ambidiestro
  final String? bio;
  final int? birthYear;
  final String? nationality;

  /// Encuadre de la foto dentro del círculo de la carta.
  /// `cropX`/`cropY` son porcentajes 0-100 (50,50 = centrada).
  final double cropX;
  final double cropY;
  final double cropZoom;
  final int? cardGenerationCredits;

  PlayerModel({
    required this.id,
    required this.name,
    required this.position,
    required this.ovr,
    required this.pac,
    required this.sho,
    required this.pas,
    required this.dri,
    required this.def,
    required this.phy,
    this.photoUrl,
    this.aiSourcePhotoUrl,
    this.ownerUid,
    this.groupId,
    this.preferredFoot,
    this.bio,
    this.birthYear,
    this.nationality,
    this.cropX = 50,
    this.cropY = 50,
    this.cropZoom = 1,
    this.cardGenerationCredits,
    PlayerStats? stats,
  }) : stats = stats ?? PlayerStats();

  /// Jugador cargado a mano por un organizador (sin cuenta propia).
  bool get isManual => ownerUid == null || ownerUid != id;

  /// Jugador vinculado a una cuenta registrada.
  bool get hasAccount => !isManual;

  /// Edad calculada a partir del año de nacimiento.
  int? get age {
    if (birthYear == null) return null;
    final years = DateTime.now().year - birthYear!;
    return years > 0 && years < 120 ? years : null;
  }

  factory PlayerModel.fromFirestore(Map<String, dynamic> data, String id) {
    return PlayerModel(
      id: id,
      name: data['name'] ?? data['displayName'] ?? 'Jugador',
      position: (data['position'] as String?)?.toUpperCase() ?? 'MED',
      ovr: (data['ovr'] as num?)?.toInt() ?? 50,
      pac: (data['pac'] as num?)?.toInt() ?? 50,
      sho: (data['sho'] as num?)?.toInt() ?? 50,
      pas: (data['pas'] as num?)?.toInt() ?? 50,
      dri: (data['dri'] as num?)?.toInt() ?? 50,
      def: (data['def'] as num?)?.toInt() ?? 50,
      phy: (data['phy'] as num?)?.toInt() ?? 50,
      photoUrl: nonEmptyPhotoUrl(
        (data['photoUrl'] ?? data['photoURL']) as String?,
      ),
      aiSourcePhotoUrl: nonEmptyPhotoUrl(data['aiSourcePhotoUrl'] as String?),
      ownerUid: data['ownerUid'],
      groupId: data['groupId'],
      preferredFoot: data['preferredFoot'] as String?,
      bio: data['bio'] as String?,
      birthYear: (data['birthYear'] as num?)?.toInt(),
      nationality: data['nationality'] as String?,
      cropX: (data['cropPosition']?['x'] as num?)?.toDouble() ?? 50,
      cropY: (data['cropPosition']?['y'] as num?)?.toDouble() ?? 50,
      cropZoom: (data['cropZoom'] as num?)?.toDouble() ?? 1,
      cardGenerationCredits: (data['cardGenerationCredits'] as num?)?.toInt(),
      stats: PlayerStats.fromMap(data['stats'] as Map<String, dynamic>?),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'position': position,
      'ovr': ovr,
      'pac': pac,
      'sho': sho,
      'pas': pas,
      'dri': dri,
      'def': def,
      'phy': phy,
      'photoUrl': photoUrl,
      'aiSourcePhotoUrl': aiSourcePhotoUrl,
      'ownerUid': ownerUid,
      'groupId': groupId,
      'preferredFoot': preferredFoot,
      'bio': bio,
      'birthYear': birthYear,
      'nationality': nationality,
      'cropPosition': {'x': cropX, 'y': cropY},
      'cropZoom': cropZoom,
      'stats': stats.toMap(),
    };
  }

  /// Returns a copy with overridden display photo URL.
  PlayerModel copyWith({
    String? photoUrl,
    double? cropX,
    double? cropY,
    double? cropZoom,
  }) => PlayerModel(
    id: id,
    name: name,
    position: position,
    ovr: ovr,
    pac: pac,
    sho: sho,
    pas: pas,
    dri: dri,
    def: def,
    phy: phy,
    photoUrl: photoUrl ?? this.photoUrl,
    aiSourcePhotoUrl: aiSourcePhotoUrl,
    ownerUid: ownerUid,
    groupId: groupId,
    preferredFoot: preferredFoot,
    bio: bio,
    birthYear: birthYear,
    nationality: nationality,
    cropX: cropX ?? this.cropX,
    cropY: cropY ?? this.cropY,
    cropZoom: cropZoom ?? this.cropZoom,
    cardGenerationCredits: cardGenerationCredits,
    stats: stats,
  );

  /// Applies [fallbackUrl] only to linked account players lacking a player photo.
  PlayerModel withFallbackPhoto(String? fallbackUrl) {
    if (!hasAccount || nonEmptyPhotoUrl(photoUrl) != null) return this;
    final resolved = nonEmptyPhotoUrl(fallbackUrl);
    return resolved == null ? this : copyWith(photoUrl: resolved);
  }

  String get tier {
    if (ovr >= 86) return 'elite';
    if (ovr >= 76) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }
}

typedef Player = PlayerModel;
