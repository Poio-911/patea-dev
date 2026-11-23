import 'competition_extras_models.dart';

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
      played: ((map['played'] ?? map['matchesPlayed']) as num?)?.toInt() ?? 0,
      won: ((map['won'] ?? map['wins']) as num?)?.toInt() ?? 0,
      drawn: ((map['drawn'] ?? map['draws']) as num?)?.toInt() ?? 0,
      lost: ((map['lost'] ?? map['losses']) as num?)?.toInt() ?? 0,
      goalsFor: (map['goalsFor'] as num?)?.toInt() ?? 0,
      goalsAgainst: (map['goalsAgainst'] as num?)?.toInt() ?? 0,
      goalDiff:
          ((map['goalDiff'] ?? map['goalDifference']) as num?)?.toInt() ?? 0,
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
  final String? matchId;
  final String? penaltyWinnerId;
  final bool requiresTiebreaker;
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
    this.matchId,
    this.penaltyWinnerId,
    this.requiresTiebreaker = false,
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
      matchId: map['matchId'],
      penaltyWinnerId: map['penaltyWinnerId'],
      requiresTiebreaker: map['requiresTiebreaker'] == true,
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
  final String format;
  final bool isPublic;
  final bool isArchived;
  final String? logoUrl;
  final String? startDate;
  final String matchTime;
  final String matchFrequency;
  final Map<String, dynamic> defaultLocation;
  final Map<String, dynamic> rules;
  final Map<String, dynamic> teamSnapshots;
  final String? championTeamId;
  final String? championTeamName;
  final String? currentRound;
  final int maxTeams;
  final Map<String, dynamic>? resultConflict;
  final String? groupId;
  final List<String> teamIds;
  final List<BracketMatchModel> bracket;
  final List<StandingRow> standings;

  /// Quiénes apoyan la competición (los carga el organizador).
  final List<CompetitionSponsor> sponsors;

  CompetitionModel({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.ownerUid,
    this.description,
    this.format = 'round_robin',
    this.isPublic = false,
    this.isArchived = false,
    this.logoUrl,
    this.startDate,
    this.matchTime = '21:00',
    this.matchFrequency = 'weekly',
    this.defaultLocation = const {},
    this.rules = const {'pointsForWin': 3, 'pointsForDraw': 1},
    this.teamSnapshots = const {},
    this.championTeamId,
    this.championTeamName,
    this.currentRound,
    this.maxTeams = 16,
    this.resultConflict,
    this.groupId,
    this.teamIds = const [],
    this.bracket = const [],
    this.standings = const [],
    this.sponsors = const [],
  });

  factory CompetitionModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
    String type,
  ) {
    final rawBracket = data['bracket'] as List<dynamic>? ?? [];
    final rawStandings = data['standings'] as List<dynamic>? ?? [];

    return CompetitionModel(
      id: id,
      name: data['name'] ?? 'Torneo',
      type: type,
      status: data['status'] ?? 'draft',
      ownerUid: data['ownerUid'] ?? '',
      description: data['description'],
      format:
          data['format'] as String? ??
          (type == 'cup' ? 'single_elimination' : 'round_robin'),
      isPublic: data['isPublic'] == true,
      isArchived: data['isArchived'] == true,
      logoUrl: data['logoUrl'] as String?,
      startDate: data['startDate'] as String?,
      matchTime: data['matchTime'] as String? ?? '21:00',
      matchFrequency: data['matchFrequency'] as String? ?? 'weekly',
      defaultLocation: Map<String, dynamic>.from(
        data['defaultLocation'] as Map? ?? {},
      ),
      rules: Map<String, dynamic>.from(
        data['rules'] as Map? ?? {'pointsForWin': 3, 'pointsForDraw': 1},
      ),
      teamSnapshots: Map<String, dynamic>.from(
        data['teamSnapshots'] as Map? ?? {},
      ),
      championTeamId: data['championTeamId'] as String?,
      championTeamName: data['championTeamName'] as String?,
      currentRound: data['currentRound'] as String?,
      maxTeams:
          (data['maxTeams'] as num?)?.toInt() ?? (type == 'cup' ? 32 : 16),
      resultConflict: data['resultConflict'] is Map
          ? Map<String, dynamic>.from(data['resultConflict'])
          : null,
      groupId: data['groupId'] as String?,
      teamIds: ((data['teams'] as List?) ?? [])
          .map((t) => t is String ? t : (t as Map)['id'].toString())
          .toList(),
      bracket: rawBracket
          .map((b) => BracketMatchModel.fromMap(b as Map<String, dynamic>))
          .toList(),
      standings: rawStandings
          .map((s) => StandingRow.fromMap(s as Map<String, dynamic>))
          .toList(),
      sponsors: CompetitionSponsor.listFrom(data['sponsors']),
    );
  }
}
