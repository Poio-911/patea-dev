class MatchEvent {
  final String type; // goal, card, substitution, foul, save
  final String playerId;
  final String playerName;
  final int minute;
  final String? detail; // yellow/red for cards, assist playerId for goals

  MatchEvent({
    required this.type,
    required this.playerId,
    required this.playerName,
    required this.minute,
    this.detail,
  });

  factory MatchEvent.fromMap(Map<String, dynamic> map) {
    return MatchEvent(
      type: map['type'] ?? 'goal',
      playerId: map['playerId'] ?? '',
      playerName: map['playerName'] ?? '',
      minute: (map['minute'] as num?)?.toInt() ?? 0,
      detail: map['detail'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': type,
      'playerId': playerId,
      'playerName': playerName,
      'minute': minute,
      if (detail != null) 'detail': detail,
    };
  }
}

class MatchTeam {
  final String name;
  final List<String> playerIds;
  final int score;
  final String? color;

  MatchTeam({
    required this.name,
    this.playerIds = const [],
    this.score = 0,
    this.color,
  });

  factory MatchTeam.fromMap(Map<String, dynamic> map) {
    return MatchTeam(
      name: map['name'] ?? 'Equipo',
      playerIds: List<String>.from(map['playerIds'] ?? map['players'] ?? []),
      score: (map['score'] as num?)?.toInt() ?? 0,
      color: map['color'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'playerIds': playerIds,
      'score': score,
      if (color != null) 'color': color,
    };
  }
}

class MatchModel {
  final String id;
  final String title;
  final String date;
  final String status; // upcoming, active, completed, evaluated
  final String type;   // manual, collaborative, by_teams, league, cup, etc.
  final String? location;
  final String? ownerUid;
  final String? groupId;
  final MatchTeam? teamA;
  final MatchTeam? teamB;
  final List<String> playerUids;
  final List<MatchEvent> events;
  final int? currentMinute;
  final String? liveStatus; // first_half, half_time, second_half, extra_time

  MatchModel({
    required this.id,
    required this.title,
    required this.date,
    required this.status,
    required this.type,
    this.location,
    this.ownerUid,
    this.groupId,
    this.teamA,
    this.teamB,
    this.playerUids = const [],
    this.events = const [],
    this.currentMinute,
    this.liveStatus,
  });

  factory MatchModel.fromFirestore(Map<String, dynamic> data, String id) {
    final teams = data['teams'] as List<dynamic>?;
    MatchTeam? tA;
    MatchTeam? tB;
    if (teams != null && teams.length >= 2) {
      tA = MatchTeam.fromMap(teams[0] as Map<String, dynamic>);
      tB = MatchTeam.fromMap(teams[1] as Map<String, dynamic>);
    }

    final rawEvents = data['events'] as List<dynamic>? ?? [];

    return MatchModel(
      id: id,
      title: data['title'] ?? 'Partido',
      date: data['date'] ?? '',
      status: data['status'] ?? 'upcoming',
      type: data['type'] ?? 'manual',
      location: data['location'] is Map ? data['location']['name'] : data['location'],
      ownerUid: data['ownerUid'],
      groupId: data['groupId'],
      teamA: tA,
      teamB: tB,
      playerUids: List<String>.from(data['playerUids'] ?? []),
      events: rawEvents.map((e) => MatchEvent.fromMap(e as Map<String, dynamic>)).toList(),
      currentMinute: (data['currentMinute'] as num?)?.toInt(),
      liveStatus: data['liveStatus'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'title': title,
      'date': date,
      'status': status,
      'type': type,
      'location': location,
      'ownerUid': ownerUid,
      'groupId': groupId,
      if (teamA != null && teamB != null) 'teams': [teamA!.toMap(), teamB!.toMap()],
      'playerUids': playerUids,
      'events': events.map((e) => e.toMap()).toList(),
      if (currentMinute != null) 'currentMinute': currentMinute,
      if (liveStatus != null) 'liveStatus': liveStatus,
    };
  }
}
