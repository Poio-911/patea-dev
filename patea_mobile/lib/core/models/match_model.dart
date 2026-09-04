import 'package:cloud_firestore/cloud_firestore.dart';
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
/// El pronóstico guardado en el partido.
///
/// Los partidos creados desde la web sólo tienen descripción, ícono y
/// temperatura — su API route recorta el resto. Los creados desde el móvil
/// traen el pronóstico entero, que es lo que necesita la alerta de clima
/// para avisar de lluvia, viento o UV.
class MatchWeatherModel {
  final int temperature;
  final String? icon;
  final String? description;
  final int feelsLike;
  final int humidity;

  /// km/h.
  final int windSpeed;

  /// Probabilidad de lluvia, 0-100.
  final int precipitation;
  final int uvIndex;

  MatchWeatherModel({
    required this.temperature,
    this.icon,
    this.description,
    this.feelsLike = 0,
    this.humidity = 0,
    this.windSpeed = 0,
    this.precipitation = 0,
    this.uvIndex = 0,
  });

  factory MatchWeatherModel.fromMap(Map<String, dynamic> map) {
    int intOf(String key) => (map[key] as num?)?.toInt() ?? 0;
    return MatchWeatherModel(
      temperature: intOf('temperature'),
      icon: map['icon'] as String?,
      description: map['description'] as String?,
      feelsLike: intOf('feelsLike'),
      humidity: intOf('humidity'),
      windSpeed: intOf('windSpeed'),
      precipitation: intOf('precipitation'),
      uvIndex: intOf('uvIndex'),
    );
  }
}

/// Evento de un partido. Port de `MatchEvent` (src/lib/types.ts:216).
///
/// Antes esto era `{type, playerId, playerName, minute, detail}` y `detail`
/// hacía de todo: el color de la tarjeta, el autor de la asistencia, el motivo
/// del cambio. Como la web escribe y lee campos separados, un evento cargado
/// desde el móvil aparecía incompleto allá y viceversa. `detail` se mantiene
/// para poder leer los eventos viejos que ya están en Firestore.
class MatchEvent {
  /// goal, card, substitution, foul, corner, penalty, save...
  final String type;
  final int minute;
  final String playerId;
  final String playerName;
  final String? teamId;
  final String? description;

  // Gol
  final String? assistId;
  final String? assistName;

  /// regular, penalty, free_kick, header, own_goal, volley
  final String? goalType;

  /// left_foot, right_foot, head, chest, other
  final String? bodyPart;

  // Tarjeta
  final String? cardType; // yellow | red
  final String? cardReason;

  // Cambio
  final String? playerOutId;
  final String? playerOutName;
  final String? playerInId;
  final String? playerInName;
  final String? substitutionReason;

  final String? id;
  final String? timestamp;
  final String? recordedBy;

  /// Sólo para eventos viejos, de cuando el móvil guardaba todo acá.
  final String? detail;

  MatchEvent({
    required this.type,
    required this.playerId,
    required this.playerName,
    required this.minute,
    this.teamId,
    this.description,
    this.assistId,
    this.assistName,
    this.goalType,
    this.bodyPart,
    this.cardType,
    this.cardReason,
    this.playerOutId,
    this.playerOutName,
    this.playerInId,
    this.playerInName,
    this.substitutionReason,
    this.id,
    this.timestamp,
    this.recordedBy,
    this.detail,
  });

  static String? _s(dynamic v) => v is String && v.isNotEmpty ? v : null;

  factory MatchEvent.fromMap(Map<String, dynamic> map) {
    final legacy = _s(map['detail']);
    return MatchEvent(
      type: _s(map['type']) ?? 'goal',
      minute: (map['minute'] as num?)?.toInt() ?? 0,
      playerId: _s(map['playerId']) ?? '',
      playerName: _s(map['playerName']) ?? '',
      teamId: _s(map['teamId']),
      description: _s(map['description']),
      assistId: _s(map['assistId']),
      assistName: _s(map['assistName']),
      goalType: _s(map['goalType']),
      bodyPart: _s(map['bodyPart']),
      // Los eventos viejos de tarjeta guardaban "yellow"/"red" en `detail`.
      cardType: _s(map['cardType']) ??
          (legacy == 'yellow' || legacy == 'red' ? legacy : null),
      cardReason: _s(map['cardReason']),
      playerOutId: _s(map['playerOutId']),
      playerOutName: _s(map['playerOutName']),
      playerInId: _s(map['playerInId']),
      playerInName: _s(map['playerInName']),
      substitutionReason: _s(map['substitutionReason']),
      id: _s(map['id']),
      timestamp: _s(map['timestamp']),
      recordedBy: _s(map['recordedBy']),
      detail: legacy,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'type': type,
      'minute': minute,
      'playerId': playerId,
      'playerName': playerName,
      if (teamId != null) 'teamId': teamId,
      if (description != null) 'description': description,
      if (assistId != null) 'assistId': assistId,
      if (assistName != null) 'assistName': assistName,
      if (goalType != null) 'goalType': goalType,
      if (bodyPart != null) 'bodyPart': bodyPart,
      if (cardType != null) 'cardType': cardType,
      if (cardReason != null) 'cardReason': cardReason,
      if (playerOutId != null) 'playerOutId': playerOutId,
      if (playerOutName != null) 'playerOutName': playerOutName,
      if (playerInId != null) 'playerInId': playerInId,
      if (playerInName != null) 'playerInName': playerInName,
      if (substitutionReason != null) 'substitutionReason': substitutionReason,
      if (timestamp != null) 'timestamp': timestamp,
      if (recordedBy != null) 'recordedBy': recordedBy,
    };
  }
}

/// Crónica del partido escrita por la IA, tal como la guarda la Cloud Function
/// `generateMatchChronicle` en el documento del partido.
class MatchChronicle {
  final String headline;
  final String story;
  final List<({String playerName, String quote})> playerVoices;

  const MatchChronicle({
    required this.headline,
    required this.story,
    this.playerVoices = const [],
  });

  static MatchChronicle? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final headline = map['headline'];
    final story = map['story'];
    if (headline is! String || story is! String) return null;

    final voices = <({String playerName, String quote})>[];
    for (final v in (map['playerVoices'] as List<dynamic>? ?? const [])) {
      if (v is! Map) continue;
      final name = v['playerName'];
      final quote = v['quote'];
      if (name is String && quote is String && quote.trim().isNotEmpty) {
        voices.add((playerName: name, quote: quote));
      }
    }

    return MatchChronicle(headline: headline, story: story, playerVoices: voices);
  }
}

/// Una fecha propuesta para un partido que todavía no tiene ninguna.
///
/// Port de MatchDateProposal (src/lib/types.ts:1195). Los votos son toggles
/// independientes: se puede marcar más de un día ("puedo martes o jueves").
class MatchDateProposal {
  final String id;
  final String proposedBy;

  /// ISO 8601. Sólo importa el día; la hora va aparte en [time].
  final String date;

  /// HH:mm.
  final String time;
  final List<String> votes;
  final String createdAt;

  const MatchDateProposal({
    required this.id,
    required this.proposedBy,
    required this.date,
    required this.time,
    required this.votes,
    required this.createdAt,
  });

  static MatchDateProposal? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final id = map['id'];
    if (id is! String || id.isEmpty) return null;
    return MatchDateProposal(
      id: id,
      proposedBy: map['proposedBy'] as String? ?? '',
      date: map['date'] as String? ?? '',
      time: map['time'] as String? ?? '',
      votes: ((map['votes'] as List<dynamic>?) ?? const []).whereType<String>().toList(),
      createdAt: map['createdAt'] as String? ?? '',
    );
  }

  DateTime? get dateTime => DateTime.tryParse(date)?.toLocal();
}

/// Una cancha propuesta. A diferencia de la fecha, acá el voto es único:
/// se juega en un solo lado.
class MatchLocationProposal {
  final String id;
  final String proposedBy;
  final MatchLocationModel location;
  final List<String> votes;
  final String createdAt;

  const MatchLocationProposal({
    required this.id,
    required this.proposedBy,
    required this.location,
    required this.votes,
    required this.createdAt,
  });

  static MatchLocationProposal? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final id = map['id'];
    final loc = map['location'];
    if (id is! String || id.isEmpty || loc is! Map) return null;
    return MatchLocationProposal(
      id: id,
      proposedBy: map['proposedBy'] as String? ?? '',
      location: MatchLocationModel.fromMap(loc.cast<String, dynamic>()),
      votes: ((map['votes'] as List<dynamic>?) ?? const []).whereType<String>().toList(),
      createdAt: map['createdAt'] as String? ?? '',
    );
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

  /// Quienes pidieron entrar y todavía esperan respuesta del organizador.
  /// Sólo se llena en partidos 'manual': ver requestJoinMatch.
  final List<String> pendingPlayerUids;
  final List<MatchPlayerEntry> players;
  final List<MatchEvent> events;
  /// Minuto BASE del tramo en curso, no el que se muestra. Ver [periodStartTs].
  final int? currentMinute;
  final String? liveStatus; // first_half, half_time, second_half, extra_time

  /// Cuándo arrancó a correr el tramo actual. El minuto que se muestra es
  /// `currentMinute + (ahora - periodStartTs)`; así el reloj sigue avanzando
  /// aunque nadie tenga la pantalla abierta. Mismo contrato que la web.
  final DateTime? periodStartTs;

  /// Con el cronómetro pausado, [currentMinute] ya es el minuto congelado.
  final bool timerPaused;

  final MatchWeatherModel? weather;
  /// MVP del partido. Lo escribe la finalización de evaluaciones.
  final String? bestPlayerId;

  /// Si para entrar hay que pedir permiso en vez de anotarse derecho.
  ///
  /// Un partido 'manual' lo armó alguien eligiendo a dedo, así que se pide y
  /// el organizador decide; uno colaborativo es abierto. Misma regla que la
  /// web (use-match-actions.ts:88). Vive acá y no en cada pantalla porque la
  /// usan la tarjeta de Partidos Abiertos y el detalle del partido, y si se
  /// separan terminan diciendo cosas distintas del mismo partido.
  bool needsApprovalFrom(String? uid) => type == 'manual' && ownerUid != uid;

  /// Fechas y canchas propuestas mientras el partido está en 'planning'.
  final List<MatchDateProposal> dateProposals;
  final List<MatchLocationProposal> locationProposals;

  /// Si la votación sigue abierta. Se apaga al confirmar fecha o cancha.
  final bool isVotingOpen;

  /// Relato del partido. Existe recién cuando alguien lo pidió.
  final MatchChronicle? chronicle;

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
    this.pendingPlayerUids = const [],
    this.players = const [],
    this.events = const [],
    this.currentMinute,
    this.liveStatus,
    this.periodStartTs,
    this.timerPaused = false,
    this.weather,
    this.bestPlayerId,
    this.chronicle,
    this.dateProposals = const [],
    this.locationProposals = const [],
    this.isVotingOpen = false,
  });

  static String? _str(dynamic v) => v is String ? v : null;

  /// Firestore devuelve `Timestamp`, pero un partido creado desde la web puede
  /// traer la fecha como ISO.
  static DateTime? _toDate(dynamic v) {
    if (v == null) return null;
    if (v is Timestamp) return v.toDate();
    if (v is DateTime) return v;
    if (v is String) return DateTime.tryParse(v);
    return null;
  }

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
      pendingPlayerUids: ((data['pendingPlayerUids'] as List<dynamic>?) ?? const [])
          .whereType<String>()
          .toList(),
      players: players,
      events: rawEvents.whereType<Map<String, dynamic>>().map(MatchEvent.fromMap).toList(),
      currentMinute: (data['currentMinute'] as num?)?.toInt(),
      liveStatus: _str(data['liveStatus']),
      periodStartTs: _toDate(data['periodStartTs']),
      timerPaused: data['timerPaused'] == true,
      bestPlayerId: _str(data['bestPlayerId']),
      chronicle: MatchChronicle.fromMap(data['chronicle']),
      dateProposals: ((data['dateProposals'] as List<dynamic>?) ?? const [])
          .map(MatchDateProposal.fromMap)
          .whereType<MatchDateProposal>()
          .toList(),
      locationProposals: ((data['locationProposals'] as List<dynamic>?) ?? const [])
          .map(MatchLocationProposal.fromMap)
          .whereType<MatchLocationProposal>()
          .toList(),
      isVotingOpen: data['isVotingOpen'] == true,
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
