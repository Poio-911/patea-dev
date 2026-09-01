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
      pattern: map['pattern'] ?? 'plain',
      primaryColor: map['primaryColor'] ?? '#1E90FF',
      secondaryColor: map['secondaryColor'] ?? '#FFFFFF',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'pattern': pattern,
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
    };
  }
}

class GroupTeamModel {
  final String id;
  final String name;
  final JerseyModel jersey;
  final List<String> playerIds;

  GroupTeamModel({
    required this.id,
    required this.name,
    required this.jersey,
    this.playerIds = const [],
  });

  factory GroupTeamModel.fromMap(Map<String, dynamic> map, String id) {
    return GroupTeamModel(
      id: id,
      name: map['name'] ?? 'Equipo',
      jersey: JerseyModel.fromMap(map['jersey'] as Map<String, dynamic>?),
      playerIds: List<String>.from(map['playerIds'] ?? []),
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
