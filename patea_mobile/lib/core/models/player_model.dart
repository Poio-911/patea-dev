class PlayerStats {
  final int matchesPlayed;
  final int goals;
  final int assists;
  final double averageRating;
  final int mvpCount;

  PlayerStats({
    this.matchesPlayed = 0,
    this.goals = 0,
    this.assists = 0,
    this.averageRating = 0.0,
    this.mvpCount = 0,
  });

  factory PlayerStats.fromMap(Map<String, dynamic>? map) {
    if (map == null) return PlayerStats();
    return PlayerStats(
      matchesPlayed: (map['matchesPlayed'] as num?)?.toInt() ?? 0,
      goals: (map['goals'] as num?)?.toInt() ?? 0,
      assists: (map['assists'] as num?)?.toInt() ?? 0,
      averageRating: (map['averageRating'] as num?)?.toDouble() ?? 0.0,
      mvpCount: (map['mvpCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'matchesPlayed': matchesPlayed,
      'goals': goals,
      'assists': assists,
      'averageRating': averageRating,
      'mvpCount': mvpCount,
    };
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
  final String? ownerUid;
  final String? groupId;
  final PlayerStats stats;

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
    this.ownerUid,
    this.groupId,
    PlayerStats? stats,
  }) : stats = stats ?? PlayerStats();

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
      photoUrl: data['photoUrl'] ?? data['photoURL'],
      ownerUid: data['ownerUid'],
      groupId: data['groupId'],
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
      'ownerUid': ownerUid,
      'groupId': groupId,
      'stats': stats.toMap(),
    };
  }

  String get tier {
    if (ovr >= 86) return 'elite';
    if (ovr >= 76) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
  }
}
