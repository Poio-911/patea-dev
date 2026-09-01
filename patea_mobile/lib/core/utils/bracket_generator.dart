import 'dart:math';
import '../models/competition_model.dart';

class BracketGenerator {
  static String? getInitialRound(int numTeams) {
    if (numTeams == 32) return 'round_of_32';
    if (numTeams == 16) return 'round_of_16';
    if (numTeams == 8) return 'round_of_8';
    if (numTeams == 4) return 'semifinals';
    if (numTeams == 2) return 'final';
    return null;
  }

  static String? getNextRound(String currentRound) {
    const roundOrder = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
    final idx = roundOrder.indexOf(currentRound);
    if (idx == -1 || idx == roundOrder.length - 1) return null;
    return roundOrder[idx + 1];
  }

  /// Genera todas las rondas y estructura de llaves
  static List<BracketMatchModel> generateBracket({
    required List<Map<String, dynamic>> teams,
    String seedingType = 'random',
  }) {
    final numTeams = teams.length;
    final initialRound = getInitialRound(numTeams);
    if (initialRound == null) {
      throw Exception('Número inválido de equipos: $numTeams. Debe ser 2, 4, 8, 16 o 32.');
    }

    final shuffledTeams = List<Map<String, dynamic>>.from(teams);
    if (seedingType == 'random') {
      shuffledTeams.shuffle(Random());
    } else {
      shuffledTeams.sort((a, b) => ((b['ovr'] as num?)?.toInt() ?? 0).compareTo((a['ovr'] as num?)?.toInt() ?? 0));
    }

    final bracket = <BracketMatchModel>[];

    String? currentRound = initialRound;
    int teamsInRound = numTeams;
    final rounds = <String>[];

    while (currentRound != null) {
      rounds.add(currentRound);
      teamsInRound = teamsInRound ~/ 2;
      currentRound = getNextRound(currentRound);
    }

    final roundMatchCounts = <String, int>{};
    for (int i = 0; i < rounds.length; i++) {
      final round = rounds[i];
      final matchesInRound = (numTeams ~/ pow(2, i + 1));
      roundMatchCounts[round] = matchesInRound;
    }

    for (int rIndex = 0; rIndex < rounds.length; rIndex++) {
      final round = rounds[rIndex];
      final matchesInThisRound = roundMatchCounts[round]!;
      final isInitialRound = rIndex == 0;

      for (int m = 1; m <= matchesInThisRound; m++) {
        String? t1Id, t2Id, t1Name, t2Name;

        if (isInitialRound) {
          final t1Idx = (m - 1) * 2;
          final t2Idx = t1Idx + 1;
          if (t1Idx < shuffledTeams.length) {
            t1Id = shuffledTeams[t1Idx]['id'];
            t1Name = shuffledTeams[t1Idx]['name'];
          }
          if (t2Idx < shuffledTeams.length) {
            t2Id = shuffledTeams[t2Idx]['id'];
            t2Name = shuffledTeams[t2Idx]['name'];
          }
        }

        int? nextMatchNum;
        if (rIndex < rounds.length - 1) {
          nextMatchNum = (m + 1) ~/ 2;
        }

        bracket.add(
          BracketMatchModel(
            id: 'match_${round}_$m',
            round: round,
            matchNumber: m,
            team1Id: t1Id,
            team2Id: t2Id,
            team1Name: t1Name,
            team2Name: t2Name,
            nextMatchNumber: nextMatchNum,
          ),
        );
      }
    }

    return bracket;
  }

  /// Hace avanzar al ganador al partido de la siguiente ronda
  static List<BracketMatchModel> advanceWinner({
    required List<BracketMatchModel> bracket,
    required String matchId,
    required String winnerId,
    required String winnerName,
    required int scoreTeam1,
    required int scoreTeam2,
  }) {
    final updated = List<BracketMatchModel>.from(bracket);
    final matchIndex = updated.indexWhere((m) => m.id == matchId);
    if (matchIndex == -1) return updated;

    final currentMatch = updated[matchIndex];
    final nextRound = getNextRound(currentMatch.round);

    // Actualizar partido actual
    updated[matchIndex] = BracketMatchModel(
      id: currentMatch.id,
      round: currentMatch.round,
      matchNumber: currentMatch.matchNumber,
      team1Id: currentMatch.team1Id,
      team2Id: currentMatch.team2Id,
      team1Name: currentMatch.team1Name,
      team2Name: currentMatch.team2Name,
      winnerId: winnerId,
      scoreTeam1: scoreTeam1,
      scoreTeam2: scoreTeam2,
      nextMatchNumber: currentMatch.nextMatchNumber,
    );

    // Si hay siguiente ronda y nextMatchNumber, asignar al ganador
    if (nextRound != null && currentMatch.nextMatchNumber != null) {
      final nextMatchIndex = updated.indexWhere(
        (m) => m.round == nextRound && m.matchNumber == currentMatch.nextMatchNumber,
      );

      if (nextMatchIndex != -1) {
        final nextMatch = updated[nextMatchIndex];
        final bool isTeam1Slot = currentMatch.matchNumber % 2 != 0;

        updated[nextMatchIndex] = BracketMatchModel(
          id: nextMatch.id,
          round: nextMatch.round,
          matchNumber: nextMatch.matchNumber,
          team1Id: isTeam1Slot ? winnerId : nextMatch.team1Id,
          team1Name: isTeam1Slot ? winnerName : nextMatch.team1Name,
          team2Id: !isTeam1Slot ? winnerId : nextMatch.team2Id,
          team2Name: !isTeam1Slot ? winnerName : nextMatch.team2Name,
          winnerId: nextMatch.winnerId,
          scoreTeam1: nextMatch.scoreTeam1,
          scoreTeam2: nextMatch.scoreTeam2,
          nextMatchNumber: nextMatch.nextMatchNumber,
        );
      }
    }

    return updated;
  }
}
