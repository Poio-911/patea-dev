import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/competition_model.dart';
import '../utils/bracket_generator.dart';
import 'firestore_service.dart';

final tournamentServiceProvider = Provider<TournamentService>((ref) {
  return TournamentService(
    FirebaseFirestore.instance,
    currentUid: ref.watch(currentUidProvider),
  );
});

class TournamentService {
  final FirebaseFirestore _firestore;
  final String? currentUid;

  TournamentService(this._firestore, {this.currentUid});

  void _requireOwner(Map<String, dynamic> cup) {
    if (currentUid == null || cup['ownerUid'] != currentUid) {
      throw StateError('Solo el organizador puede modificar la copa.');
    }
  }

  Future<void> startCupTournament({
    required String cupId,
    required List<Map<String, dynamic>> teams,
    String seedingType = 'random',
  }) async {
    final bracket = BracketGenerator.generateBracket(
      teams: teams,
      seedingType: seedingType,
    );
    final cupRef = _firestore.collection('cups').doc(cupId);
    await _firestore.runTransaction((transaction) async {
      final cup = (await transaction.get(cupRef)).data();
      if (cup == null) throw StateError('Copa no encontrada.');
      _requireOwner(cup);
      if ((cup['bracket'] as List?)?.isNotEmpty == true) {
        throw StateError('La copa ya tiene llaves generadas.');
      }
      transaction.update(cupRef, {
        'status': 'in_progress',
        'bracket': bracket.map((m) => _serialize(m)).toList(),
      });
    });
  }

  Future<void> saveBracketMatchResult({
    required String cupId,
    required String matchId,
    required String winnerId,
    required String winnerName,
    required int scoreTeam1,
    required int scoreTeam2,
  }) async {
    final cupRef = _firestore.collection('cups').doc(cupId);
    await _firestore.runTransaction((transaction) async {
      final cup = (await transaction.get(cupRef)).data();
      if (cup == null) throw StateError('Copa no encontrada.');
      _requireOwner(cup);
      final rawBracket = (cup['bracket'] as List?) ?? [];
      final currentBracket = rawBracket
          .map(
            (b) =>
                BracketMatchModel.fromMap(Map<String, dynamic>.from(b as Map)),
          )
          .toList();
      final updated = applyResult(
        bracket: currentBracket,
        matchId: matchId,
        winnerId: winnerId,
        scoreTeam1: scoreTeam1,
        scoreTeam2: scoreTeam2,
      );
      final finalMatch = updated.firstWhere((m) => m.round == 'final');
      final originals = {
        for (final b in rawBracket)
          (b as Map)['id']: Map<String, dynamic>.from(b),
      };
      transaction.update(cupRef, {
        'bracket': updated
            .map((m) => {...?originals[m.id], ..._serialize(m)})
            .toList(),
        if (finalMatch.winnerId != null) ...{
          'status': 'completed',
          'championTeamId': finalMatch.winnerId,
        },
      });
    });
  }

  /// Valida contra la llave recién leída dentro de la transacción.
  static List<BracketMatchModel> applyResult({
    required List<BracketMatchModel> bracket,
    required String matchId,
    required String winnerId,
    required int scoreTeam1,
    required int scoreTeam2,
  }) {
    final index = bracket.indexWhere((m) => m.id == matchId);
    if (index < 0 || !bracket.any((m) => m.round == 'final')) {
      throw StateError('Llave no encontrada o incompleta.');
    }
    final match = bracket[index];
    if (match.team1Id == null ||
        match.team1Id!.isEmpty ||
        match.team2Id == null ||
        match.team2Id!.isEmpty ||
        match.team1Id == match.team2Id) {
      throw StateError('El partido necesita dos equipos diferentes.');
    }
    if (scoreTeam1 < 0 || scoreTeam2 < 0 || scoreTeam1 == scoreTeam2) {
      throw ArgumentError('El resultado debe ser no negativo y sin empate.');
    }
    final expectedWinner = scoreTeam1 > scoreTeam2
        ? match.team1Id!
        : match.team2Id!;
    if (winnerId != expectedWinner) {
      throw ArgumentError('El ganador no coincide con el resultado.');
    }
    if (match.winnerId != null) {
      if (match.winnerId == winnerId &&
          match.scoreTeam1 == scoreTeam1 &&
          match.scoreTeam2 == scoreTeam2) {
        return bracket; // Reintento del mismo resultado.
      }
      throw StateError('Este partido ya tiene un resultado confirmado.');
    }
    return BracketGenerator.advanceWinner(
      bracket: bracket,
      matchId: matchId,
      winnerId: expectedWinner,
      winnerName: scoreTeam1 > scoreTeam2
          ? (match.team1Name ?? 'Equipo 1')
          : (match.team2Name ?? 'Equipo 2'),
      scoreTeam1: scoreTeam1,
      scoreTeam2: scoreTeam2,
    );
  }

  static Map<String, dynamic> _serialize(BracketMatchModel m) => {
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
  };
}
