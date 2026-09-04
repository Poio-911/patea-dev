class JerseyModel {
  final String pattern; // plain, vertical, band, chevron, thirds, lines
  final String primaryColor;
  final String secondaryColor;

  JerseyModel({
    this.pattern = 'plain',
    this.primaryColor = '#1E90FF',
    this.secondaryColor = '#FFFFFF',
  });

  factory JerseyModel.fromMap(Map<String, dynamic>? map) {
    if (map == null) return JerseyModel();
    return JerseyModel(
      // La web guarda el tipo de camiseta en 'type' (ver Jersey en src/lib/types.ts);
      // 'pattern' se acepta como fallback por si hay datos viejos.
      pattern: map['type'] ?? map['pattern'] ?? 'plain',
      primaryColor: map['primaryColor'] ?? '#1E90FF',
      secondaryColor: map['secondaryColor'] ?? '#FFFFFF',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': pattern,
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
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
