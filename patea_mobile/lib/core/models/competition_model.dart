class StandingRow {
  final String teamId;
  final String teamName;
  final int played;
  final int won;
  final int drawn;
  final int lost;
  final int goalsFor;
  final int goalsAgainst;
  final int goalDiff;
  final int points;

  StandingRow({
    required this.teamId,
    required this.teamName,
    this.played = 0,
    this.won = 0,
    this.drawn = 0,
    this.lost = 0,
    this.goalsFor = 0,
    this.goalsAgainst = 0,
    this.goalDiff = 0,
    this.points = 0,
  });

  factory StandingRow.fromMap(Map<String, dynamic> map) {
    return StandingRow(
      teamId: map['teamId'] ?? '',
      teamName: map['teamName'] ?? 'Equipo',
      played: (map['played'] as num?)?.toInt() ?? 0,
      won: (map['won'] as num?)?.toInt() ?? 0,
      drawn: (map['drawn'] as num?)?.toInt() ?? 0,
      lost: (map['lost'] as num?)?.toInt() ?? 0,
      goalsFor: (map['goalsFor'] as num?)?.toInt() ?? 0,
      goalsAgainst: (map['goalsAgainst'] as num?)?.toInt() ?? 0,
      goalDiff: (map['goalDiff'] as num?)?.toInt() ?? 0,
      points: (map['points'] as num?)?.toInt() ?? 0,
    );
  }
}

class BracketMatchModel {
  final String id;
  final String round; // round_of_32, round_of_16, round_of_8, semifinals, final
  final int matchNumber;
  final String? team1Id;
  final String? team2Id;
  final String? team1Name;
  final String? team2Name;
  final String? winnerId;
  final int? scoreTeam1;
  final int? scoreTeam2;
  final int? nextMatchNumber;

  BracketMatchModel({
    required this.id,
    required this.round,
    required this.matchNumber,
    this.team1Id,
    this.team2Id,
    this.team1Name,
    this.team2Name,
    this.winnerId,
    this.scoreTeam1,
    this.scoreTeam2,
    this.nextMatchNumber,
  });

  factory BracketMatchModel.fromMap(Map<String, dynamic> map) {
    final finalScore = map['finalScore'] as Map<String, dynamic>?;
    return BracketMatchModel(
      id: map['id'] ?? '',
      round: map['round'] ?? 'final',
      matchNumber: (map['matchNumber'] as num?)?.toInt() ?? 1,
      team1Id: map['team1Id'],
      team2Id: map['team2Id'],
      team1Name: map['team1Name'],
      team2Name: map['team2Name'],
      winnerId: map['winnerId'],
      scoreTeam1: (finalScore?['team1'] as num?)?.toInt(),
      scoreTeam2: (finalScore?['team2'] as num?)?.toInt(),
      nextMatchNumber: (map['nextMatchNumber'] as num?)?.toInt(),
    );
  }
}

class CompetitionModel {
  final String id;
  final String name;
  final String type; // league, cup
  final String status; // draft, published, in_progress, completed
  final String ownerUid;
  final String? description;
  final List<BracketMatchModel> bracket;
  final List<StandingRow> standings;

  CompetitionModel({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.ownerUid,
    this.description,
    this.bracket = const [],
    this.standings = const [],
  });

  factory CompetitionModel.fromFirestore(Map<String, dynamic> data, String id, String type) {
    final rawBracket = data['bracket'] as List<dynamic>? ?? [];
    final rawStandings = data['standings'] as List<dynamic>? ?? [];

    return CompetitionModel(
      id: id,
      name: data['name'] ?? 'Torneo',
      type: type,
      status: data['status'] ?? 'draft',
      ownerUid: data['ownerUid'] ?? '',
      description: data['description'],
      bracket: rawBracket.map((b) => BracketMatchModel.fromMap(b as Map<String, dynamic>)).toList(),
      standings: rawStandings.map((s) => StandingRow.fromMap(s as Map<String, dynamic>)).toList(),
    );
  }
}
