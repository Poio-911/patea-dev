class JerseyModel {
  final String pattern;
  final String primaryColor;
  final String secondaryColor;
  final String crestShape; // 'none', 'classic', 'spanish', 'heater', 'circle', 'crest', 'oval', 'diamond', 'hexagon'
  final String crestPattern; // 'diagonal', 'stripes', 'halves', 'quarters', 'band', 'solid'
  final String crestSymbol; // 'initials', 'star', 'crown', 'ball', 'sun', 'wings', 'laurel', 'bolt', 'flame', 'swords', 'tower', 'trophy'
  final String crestInitials;
  final bool crestShowBanner;
  final String crestBorderColor; // '' (auto), '#D97706' (oro), '#CBD5E1' (plata), '#FFFFFF', '#171717'
  final int crestStars; // 0..3

  JerseyModel({
    this.pattern = 'plain',
    this.primaryColor = '#1E90FF',
    this.secondaryColor = '#FFFFFF',
    this.crestShape = 'none',
    this.crestPattern = 'diagonal',
    this.crestSymbol = 'initials',
    this.crestInitials = '',
    this.crestShowBanner = false,
    this.crestBorderColor = '',
    this.crestStars = 0,
  });

  bool get hasCrest => crestShape.isNotEmpty && crestShape != 'none';

  JerseyModel copyWith({
    String? pattern,
    String? primaryColor,
    String? secondaryColor,
    String? crestShape,
    String? crestPattern,
    String? crestSymbol,
    String? crestInitials,
    bool? crestShowBanner,
    String? crestBorderColor,
    int? crestStars,
  }) {
    return JerseyModel(
      pattern: pattern ?? this.pattern,
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      crestShape: crestShape ?? this.crestShape,
      crestPattern: crestPattern ?? this.crestPattern,
      crestSymbol: crestSymbol ?? this.crestSymbol,
      crestInitials: crestInitials ?? this.crestInitials,
      crestShowBanner: crestShowBanner ?? this.crestShowBanner,
      crestBorderColor: crestBorderColor ?? this.crestBorderColor,
      crestStars: crestStars ?? this.crestStars,
    );
  }

  /// Extrae hasta 2-3 iniciales deportivas a partir del nombre del equipo.
  static String initialsFromTeamName(String name) {
    final cleaned = name.trim();
    if (cleaned.isEmpty) return 'FC';
    final words = cleaned
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList(growable: false);
    if (words.length >= 2) {
      final significant = words
          .where((w) => !const {'de', 'del', 'la', 'las', 'el', 'los', 'y'}.contains(w.toLowerCase()))
          .toList(growable: false);
      final source = significant.length >= 2 ? significant : words;
      return source.take(3).map((w) => w[0]).join().toUpperCase();
    }
    final single = words.first.toUpperCase();
    return single.length <= 3 ? single : single.substring(0, 2);
  }

  factory JerseyModel.fromMap(Map<String, dynamic>? map) {
    if (map == null) return JerseyModel();
    return JerseyModel(
      // La web guarda el tipo de camiseta en 'type' (ver Jersey en src/lib/types.ts);
      // 'pattern' se acepta como fallback por si hay datos viejos.
      pattern: map['type'] ?? map['pattern'] ?? 'plain',
      primaryColor: map['primaryColor'] ?? '#1E90FF',
      secondaryColor: map['secondaryColor'] ?? '#FFFFFF',
      crestShape: (map['crestShape'] as String?) ?? 'none',
      crestPattern: (map['crestPattern'] as String?) ?? 'diagonal',
      crestSymbol: (map['crestSymbol'] as String?) ?? 'initials',
      crestInitials: (map['crestInitials'] as String?) ?? '',
      crestShowBanner: (map['crestShowBanner'] as bool?) ?? false,
      crestBorderColor: (map['crestBorderColor'] as String?) ?? '',
      crestStars: ((map['crestStars'] as num?)?.toInt() ?? 0).clamp(0, 3),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': pattern,
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
      if (hasCrest) 'crestShape': crestShape,
      if (hasCrest) 'crestPattern': crestPattern,
      if (hasCrest) 'crestSymbol': crestSymbol,
      if (hasCrest && crestInitials.trim().isNotEmpty)
        'crestInitials': crestInitials.trim().toUpperCase(),
      if (hasCrest && crestShowBanner) 'crestShowBanner': true,
      if (hasCrest && crestBorderColor.isNotEmpty)
        'crestBorderColor': crestBorderColor,
      if (hasCrest && crestStars > 0) 'crestStars': crestStars.clamp(0, 3),
    };
  }
}

/// Port de GroupTeamMember (src/lib/types.ts): {playerId, number, status}.
class TeamMemberEntry {
  final String playerId;
  final int number;
  final String status; // 'titular' | 'suplente'

  TeamMemberEntry({required this.playerId, this.number = 0, this.status = 'titular'});

  factory TeamMemberEntry.fromMap(Map<String, dynamic> map) {
    return TeamMemberEntry(
      playerId: (map['playerId'] ?? map['uid'] ?? '').toString(),
      number: (map['number'] as num?)?.toInt() ?? 0,
      status: map['status'] as String? ?? 'titular',
    );
  }

  Map<String, dynamic> toMap() => {'playerId': playerId, 'number': number, 'status': status};
}

class GroupTeamModel {
  final String id;
  final String name;
  final String groupId;
  final JerseyModel jersey;
  final List<TeamMemberEntry> members;
  final String createdBy;

  GroupTeamModel({
    required this.id,
    required this.name,
    this.groupId = '',
    required this.jersey,
    this.members = const [],
    this.createdBy = '',
  });

  List<String> get playerIds => members.map((m) => m.playerId).toList();

  factory GroupTeamModel.fromMap(Map<String, dynamic> map, String id) {
    // La web guarda 'members: {playerId, number, status}[]' (ver GroupTeam en
    // src/lib/types.ts), no una lista plana de ids.
    final rawMembers = (map['members'] ?? map['playerIds'] ?? []) as List<dynamic>;
    final members = rawMembers.map((m) {
      if (m is String) return TeamMemberEntry(playerId: m);
      if (m is Map) return TeamMemberEntry.fromMap(m.cast<String, dynamic>());
      return TeamMemberEntry(playerId: '');
    }).where((m) => m.playerId.isNotEmpty).toList();

    return GroupTeamModel(
      id: id,
      name: map['name'] ?? 'Equipo',
      groupId: map['groupId'] as String? ?? '',
      jersey: JerseyModel.fromMap(map['jersey'] as Map<String, dynamic>?),
      members: members,
      createdBy: map['createdBy'] as String? ?? '',
    );
  }
}

class GroupModel {
  final String id;
  final String name;
  final String ownerUid;
  final String inviteCode;
  final List<String> members;
  final String? logoUrl;
  GroupModel({
    required this.id,
    required this.name,
    required this.ownerUid,
    required this.inviteCode,
    this.members = const [],
    this.logoUrl,
  });

  factory GroupModel.fromFirestore(Map<String, dynamic> data, String id) {
    return GroupModel(
      id: id,
      name: data['name'] ?? 'Mi Grupo',
      ownerUid: data['ownerUid'] ?? '',
      inviteCode: data['inviteCode'] ?? '',
      members: List<String>.from(data['members'] ?? []),
      logoUrl: data['logoUrl'],
    );
  }
}
