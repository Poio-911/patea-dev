import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/competition_model.dart';
import '../utils/bracket_generator.dart';

final tournamentServiceProvider = Provider<TournamentService>((ref) {
  return TournamentService(FirebaseFirestore.instance);
});

class TournamentService {
  final FirebaseFirestore _firestore;

  TournamentService(this._firestore);

  /// Inicia una Copa: sortea las llaves y actualiza el estado a in_progress
  Future<void> startCupTournament({
    required String cupId,
    required List<Map<String, dynamic>> teams,
    String seedingType = 'random',
  }) async {
    final bracket = BracketGenerator.generateBracket(
      teams: teams,
      seedingType: seedingType,
    );

    await _firestore.collection('cups').doc(cupId).update({
      'status': 'in_progress',
      'bracket': bracket.map((m) => {
        'id': m.id,
        'round': m.round,
        'matchNumber': m.matchNumber,
        'team1Id': m.team1Id,
        'team2Id': m.team2Id,
        'team1Name': m.team1Name,
        'team2Name': m.team2Name,
        'nextMatchNumber': m.nextMatchNumber,
      }).toList(),
    });
  }

  /// Guarda el resultado de un partido de Copa y avanza al ganador a la siguiente ronda
  Future<void> saveBracketMatchResult({
    required String cupId,
    required String matchId,
    required String winnerId,
    required String winnerName,
    required int scoreTeam1,
    required int scoreTeam2,
  }) async {
    final cupRef = _firestore.collection('cups').doc(cupId);
    final docSnap = await cupRef.get();

    if (!docSnap.exists || docSnap.data() == null) return;

    final rawBracket = docSnap.data()!['bracket'] as List<dynamic>? ?? [];
    final currentBracket = rawBracket
        .map((b) => BracketMatchModel.fromMap(b as Map<String, dynamic>))
        .toList();

    final updatedBracket = BracketGenerator.advanceWinner(
      bracket: currentBracket,
      matchId: matchId,
      winnerId: winnerId,
      winnerName: winnerName,
      scoreTeam1: scoreTeam1,
      scoreTeam2: scoreTeam2,
    );

    // Verificar si la gran final ya se jugó para marcar como completed
    final finalMatch = updatedBracket.firstWhere((m) => m.round == 'final');
    final isTournamentCompleted = finalMatch.winnerId != null;

    await cupRef.update({
      'bracket': updatedBracket.map((m) => {
        'id': m.id,
        'round': m.round,
        'matchNumber': m.matchNumber,
        'team1Id': m.team1Id,
        'team2Id': m.team2Id,
        'team1Name': m.team1Name,
        'team2Name': m.team2Name,
        'winnerId': m.winnerId,
        'finalScore': m.scoreTeam1 != null && m.scoreTeam2 != null
            ? {'team1': m.scoreTeam1, 'team2': m.scoreTeam2}
            : null,
        'nextMatchNumber': m.nextMatchNumber,
      }).toList(),
      if (isTournamentCompleted) 'status': 'completed',
    });
  }
}
