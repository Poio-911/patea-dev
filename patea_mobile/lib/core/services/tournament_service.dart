import 'callable_functions.dart';
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
      throw StateError('Solo el organizador puede modificar el torneo.');
    }
  }

  Stream<List<Map<String, dynamic>>> leagueMatches(String id) => _firestore
      .collection('matches')
      .where('leagueInfo.leagueId', isEqualTo: id)
      .limit(500)
      .snapshots()
      .map(
        (snapshot) => [
          for (final doc in snapshot.docs) {...doc.data(), 'id': doc.id},
        ],
      );

  static List<StandingRow> calculateStandings(
    List<String> ids,
    Map<String, String> names,
    List<Map<String, dynamic>> matches,
  ) {
    final values = {
      for (final id in ids) id: <int>[0, 0, 0, 0, 0, 0, 0],
    };
    for (final match in matches) {
      if (!['completed', 'evaluated'].contains(match['status'])) continue;
      final teams = (match['participantTeamIds'] as List?) ?? [];
      final score = match['finalScore'] as Map?;
      if (teams.length != 2 ||
          teams[0] == teams[1] ||
          score == null ||
          score['team1'] is! num ||
          score['team2'] is! num)
        continue;
      final a = values[teams[0]], b = values[teams[1]];
      if (a == null || b == null) continue;
      final x = (score['team1'] as num).toInt(),
          y = (score['team2'] as num).toInt();
      if (x < 0 || y < 0) continue;
      a[0]++;
      b[0]++;
      a[4] += x;
      a[5] += y;
      b[4] += y;
      b[5] += x;
      if (x == y) {
        a[2]++;
        b[2]++;
        a[6]++;
        b[6]++;
      } else if (x > y) {
        a[1]++;
        b[3]++;
        a[6] += 3;
      } else {
        b[1]++;
        a[3]++;
        b[6] += 3;
      }
    }
    final rows = [
      for (final e in values.entries)
        StandingRow(
          teamId: e.key,
          teamName: names[e.key] ?? 'Equipo no disponible',
          played: e.value[0],
          won: e.value[1],
          drawn: e.value[2],
          lost: e.value[3],
          goalsFor: e.value[4],
          goalsAgainst: e.value[5],
          goalDiff: e.value[4] - e.value[5],
          points: e.value[6],
        ),
    ];
    rows.sort((a, b) {
      final points = b.points.compareTo(a.points);
      if (points != 0) return points;
      final diff = b.goalDiff.compareTo(a.goalDiff);
      if (diff != 0) return diff;
      final goals = b.goalsFor.compareTo(a.goalsFor);
      return goals != 0 ? goals : a.teamName.compareTo(b.teamName);
    });
    return rows;
  }

  Future<void> startLeague({
    required String id,
    required String startDate,
    required String time,
  }) async {
    await callFunction('startLeagueTournament', {
      'leagueId': id,
      'startDate': startDate,
      'time': time,
    }, timeout: const Duration(seconds: 120));
  }

  Future<String> createCompetition({
    required bool isCup,
    required String name,
    required String groupId,
    required List<String> teamIds,
    bool homeAndAway = false,
  }) async {
    final uid = currentUid;
    if (uid == null) throw StateError('Iniciá sesión para crear un torneo.');
    if (name.trim().length < 3 || name.trim().length > 80) {
      throw ArgumentError('El nombre debe tener entre 3 y 80 caracteres.');
    }
    if (groupId.isEmpty ||
        teamIds.toSet().length != teamIds.length ||
        teamIds.length < 2 ||
        teamIds.length > (isCup ? 32 : 16) ||
        (isCup && ![2, 4, 8, 16, 32].contains(teamIds.length))) {
      throw ArgumentError(
        isCup
            ? 'Elegí 2, 4, 8, 16 o 32 equipos.'
            : 'Elegí entre 2 y 16 equipos distintos.',
      );
    }
    // Revalidar selección contra los documentos actuales, no sólo el formulario.
    for (final id in teamIds) {
      final team = (await _firestore.collection('teams').doc(id).get()).data();
      if (team == null || team['groupId'] != groupId) {
        throw StateError(
          'Un equipo ya no pertenece al grupo. Actualizá la selección.',
        );
      }
    }
    final doc = await _firestore.collection(isCup ? 'cups' : 'leagues').add({
      'name': name.trim(),
      'groupId': groupId,
      'ownerUid': uid,
      'teams': teamIds,
      'isPublic': false,
      'status': 'draft',
      'format': isCup
          ? 'single_elimination'
          : (homeAndAway ? 'double_round_robin' : 'round_robin'),
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    return doc.id;
  }

  Future<void> deleteCompetition({
    required String id,
    required bool isCup,
  }) async {
    final doc = _firestore.collection(isCup ? 'cups' : 'leagues').doc(id);
    final data = (await doc.get()).data();
    if (data == null) throw StateError('El torneo ya no existe.');
    _requireOwner(data);
    // Las reglas de las subcolecciones dependen del padre: borrar todo en un
    // único batch antes de retirarlo. Los partidos reales conservan su historial.
    final children = <DocumentReference<Map<String, dynamic>>>[];
    for (final collection in [
      'fixtures',
      'teams',
      'applications',
      'venues',
      'referees',
    ]) {
      final snap = await doc.collection(collection).limit(450).get();
      children.addAll(snap.docs.map((d) => d.reference));
    }
    if (children.length > 449)
      throw StateError(
        'Este torneo requiere eliminación desde administración.',
      );
    final batch = _firestore.batch();
    for (final child in children) {
      batch.delete(child);
    }
    batch.delete(doc);
    await batch.commit();
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
      if (!['draft', 'open_for_applications'].contains(cup['status'])) {
        throw StateError('La copa ya fue iniciada.');
      }
      final registered = ((cup['teams'] as List?) ?? [])
          .map((t) => t is String ? t : (t as Map)['id'].toString())
          .toSet();
      final selected = teams.map((t) => t['id']).toSet();
      if (selected.length != teams.length ||
          registered.length != selected.length ||
          !registered.containsAll(selected)) {
        throw StateError('Los equipos cambiaron. Volvé a abrir la copa.');
      }
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
