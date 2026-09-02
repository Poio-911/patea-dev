import 'group_model.dart' show JerseyModel;

/// Port de MatchLocation (src/lib/types.ts) — el string plano en
/// `MatchModel.location` (solo el nombre) se mantiene para no romper las
/// pantallas que ya lo usan; esto guarda el resto (address/lat/lng/placeId)
/// para "Cómo llegar" y los diálogos de reprogramar/cambiar cancha.
class MatchLocationModel {
  final String name;
  final String address;
  final double lat;
  final double lng;
  final String placeId;

  MatchLocationModel({
    required this.name,
    this.address = '',
    this.lat = 0,
    this.lng = 0,
    this.placeId = '',
  });

  factory MatchLocationModel.fromMap(Map<String, dynamic> map) {
    return MatchLocationModel(
      name: map['name'] as String? ?? '',
      address: map['address'] as String? ?? '',
      lat: (map['lat'] as num?)?.toDouble() ?? 0,
      lng: (map['lng'] as num?)?.toDouble() ?? 0,
      placeId: map['placeId'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {'name': name, 'address': address, 'lat': lat, 'lng': lng, 'placeId': placeId};
  }
}

/// Un jugador embebido en `matches/{id}.players[]` — {uid, displayName, ovr,
/// position, photoURL}, la misma forma que arma joinMatchAction/createMatch
/// en la web (distinto de `playerUids`, que es solo la lista de uids).
class MatchPlayerEntry {
  final String uid;
  final String displayName;
  final int ovr;
  final String position;
  final String? photoURL;

  MatchPlayerEntry({
    required this.uid,
    required this.displayName,
    this.ovr = 0,
    this.position = '',
    this.photoURL,
  });

  factory MatchPlayerEntry.fromMap(Map<String, dynamic> map) {
    return MatchPlayerEntry(
      uid: (map['uid'] ?? map['id'] ?? '').toString(),
      displayName: map['displayName'] as String? ?? map['name'] as String? ?? 'Jugador',
      ovr: (map['ovr'] as num?)?.toInt() ?? 0,
      position: map['position'] as String? ?? '',
      photoURL: map['photoURL'] as String? ?? map['photoUrl'] as String?,
    );
  }
}

/// Port de Match['weather'] — igual forma que genera weather_service.dart al
/// crear el partido (temperatura + icono simbólico, no el forecast completo).
class MatchWeatherModel {
  final int temperature;
  final String? icon;
  final String? description;

  MatchWeatherModel({required this.temperature, this.icon, this.description});

  factory MatchWeatherModel.fromMap(Map<String, dynamic> map) {
    return MatchWeatherModel(
      temperature: (map['temperature'] as num?)?.toInt() ?? 0,
      icon: map['icon'] as String?,
      description: map['description'] as String?,
    );
  }
}

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
  final List<MatchPlayerEntry> players;
  final int score;
  final String? color;
  final JerseyModel? jersey;

  MatchTeam({
    required this.name,
    this.playerIds = const [],
    this.players = const [],
    this.score = 0,
    this.color,
    this.jersey,
  });

  factory MatchTeam.fromMap(Map<String, dynamic> map) {
    final rawPlayers = (map['playerIds'] ?? map['players'] ?? []) as List<dynamic>;
    final playerIds = rawPlayers
        .map((p) {
          if (p is String) return p;
          if (p is Map) return (p['uid'] ?? p['id'] ?? '').toString();
          return '';
        })
        .where((id) => id.isNotEmpty)
        .toList();
    // Los equipos generados por IA guardan el perfil completo embebido
    // (uid/displayName/ovr/position) en 'players', no solo el uid.
    final players = rawPlayers.whereType<Map>().map((p) => MatchPlayerEntry.fromMap(p.cast<String, dynamic>())).toList();

    return MatchTeam(
      name: map['name'] ?? 'Equipo',
      playerIds: playerIds,
      players: players,
      score: (map['score'] as num?)?.toInt() ?? 0,
      color: map['color'] is String ? map['color'] as String : null,
      jersey: map['jersey'] is Map
          ? JerseyModel.fromMap(map['jersey'] as Map<String, dynamic>)
          : null,
    );
  }

  MatchTeam copyWith({int? score}) {
    return MatchTeam(
      name: name,
      playerIds: playerIds,
      players: players,
      score: score ?? this.score,
      color: color,
      jersey: jersey,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'playerIds': playerIds,
      'score': score,
      if (color != null) 'color': color,
      if (jersey != null) 'jersey': jersey!.toMap(),
    };
  }
}

class MatchModel {
  final String id;
  final String title;
  final String date;
  final String? time; // la web guarda hora aparte de la fecha (ej. "21:00")
  final String status; // upcoming, active, completed, evaluated
  final String type;   // manual, collaborative, by_teams, league, cup, etc.
  final String? location;
  final MatchLocationModel? locationDetail;
  final String? ownerUid;
  final String? groupId;
  final int matchSize;
  final MatchTeam? teamA;
  final MatchTeam? teamB;
  final List<String> playerUids;
  final List<MatchPlayerEntry> players;
  final List<MatchEvent> events;
  final int? currentMinute;
  final String? liveStatus; // first_half, half_time, second_half, extra_time
  final MatchWeatherModel? weather;

  MatchModel({
    required this.id,
    required this.title,
    required this.date,
    this.time,
    required this.status,
    required this.type,
    this.location,
    this.locationDetail,
    this.ownerUid,
    this.groupId,
    this.matchSize = 0,
    this.teamA,
    this.teamB,
    this.playerUids = const [],
    this.players = const [],
    this.events = const [],
    this.currentMinute,
    this.liveStatus,
    this.weather,
  });

  static String? _str(dynamic v) => v is String ? v : null;

  factory MatchModel.fromFirestore(Map<String, dynamic> data, String id) {
    final teams = data['teams'] as List<dynamic>?;
    MatchTeam? tA;
    MatchTeam? tB;
    if (teams != null && teams.length >= 2) {
      tA = MatchTeam.fromMap(teams[0] as Map<String, dynamic>);
      tB = MatchTeam.fromMap(teams[1] as Map<String, dynamic>);
    }

    // La web guarda el resultado final en 'finalScore: {team1, team2}' a nivel
    // del partido, no en 'teams[].score' (que solo se usa para el marcador en vivo).
    final finalScore = data['finalScore'] as Map<String, dynamic>?;
    if (finalScore != null) {
      final score1 = (finalScore['team1'] as num?)?.toInt();
      final score2 = (finalScore['team2'] as num?)?.toInt();
      if (tA != null && score1 != null) tA = tA.copyWith(score: score1);
      if (tB != null && score2 != null) tB = tB.copyWith(score: score2);
    }

    final rawEvents = data['events'] as List<dynamic>? ?? [];

    final rawLocation = data['location'];
    final location = rawLocation is Map ? _str(rawLocation['name']) : _str(rawLocation);
    final locationDetail = rawLocation is Map ? MatchLocationModel.fromMap(rawLocation.cast<String, dynamic>()) : null;

    final rawPlayers = (data['players'] as List<dynamic>?) ?? const [];
    final players = rawPlayers.whereType<Map>().map((p) => MatchPlayerEntry.fromMap(p.cast<String, dynamic>())).toList();

    final rawPlayerUids = (data['playerUids'] as List<dynamic>?) ?? const [];
    var playerUids = rawPlayerUids.whereType<String>().toList();
    if (playerUids.isEmpty && players.isNotEmpty) {
      playerUids = players.map((p) => p.uid).where((uid) => uid.isNotEmpty).toList();
    }

    final rawWeather = data['weather'];

    return MatchModel(
      id: id,
      title: _str(data['title']) ?? 'Partido',
      date: _str(data['date']) ?? '',
      time: _str(data['time']),
      status: _str(data['status']) ?? 'upcoming',
      type: _str(data['type']) ?? 'manual',
      location: location,
      locationDetail: locationDetail,
      ownerUid: _str(data['ownerUid']),
      groupId: _str(data['groupId']),
      matchSize: (data['matchSize'] as num?)?.toInt() ?? 0,
      teamA: tA,
      teamB: tB,
      playerUids: playerUids,
      players: players,
      events: rawEvents.whereType<Map<String, dynamic>>().map(MatchEvent.fromMap).toList(),
      currentMinute: (data['currentMinute'] as num?)?.toInt(),
      liveStatus: _str(data['liveStatus']),
      weather: rawWeather is Map ? MatchWeatherModel.fromMap(rawWeather.cast<String, dynamic>()) : null,
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
      'matchSize': matchSize,
      if (teamA != null && teamB != null) 'teams': [teamA!.toMap(), teamB!.toMap()],
      'playerUids': playerUids,
      'events': events.map((e) => e.toMap()).toList(),
      if (currentMinute != null) 'currentMinute': currentMinute,
      if (liveStatus != null) 'liveStatus': liveStatus,
    };
  }
}
