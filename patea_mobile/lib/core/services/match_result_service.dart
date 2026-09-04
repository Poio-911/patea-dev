import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firestore_service.dart';

/// Lo que cada jugador reportó de su propio partido.
class MatchPlayerTally {
  final String playerId;
  final int goals;
  final int assists;
  final int mvpVotes;

  const MatchPlayerTally({
    required this.playerId,
    required this.goals,
    required this.assists,
    required this.mvpVotes,
  });
}

/// Números del partido armados con las autoevaluaciones.
///
/// Port de `getMatchResultStatsAction` (src/lib/actions/match-result-actions.ts).
/// Se calcula en el cliente porque `matches/{id}/selfEvaluations` es de lectura
/// libre para cualquiera autenticado (firestore.rules:228) y no hace falta
/// gastar una Cloud Function para sumar.
class MatchResultStats {
  final List<MatchPlayerTally> tallies;

  /// El más votado. Necesita al menos un voto: sin votos no hay figura.
  final String? mvpId;
  final int mvpVotes;

  const MatchResultStats({
    required this.tallies,
    required this.mvpId,
    required this.mvpVotes,
  });

  static const empty = MatchResultStats(tallies: [], mvpId: null, mvpVotes: 0);

  List<MatchPlayerTally> get scorers =>
      (tallies.where((t) => t.goals > 0).toList()..sort((a, b) => b.goals.compareTo(a.goals)));

  List<MatchPlayerTally> get assisters =>
      (tallies.where((t) => t.assists > 0).toList()..sort((a, b) => b.assists.compareTo(a.assists)));

  int goalsOf(Iterable<String> uids) {
    final set = uids.toSet();
    return tallies
        .where((t) => set.contains(t.playerId))
        .fold(0, (acc, t) => acc + t.goals);
  }

  bool get isEmpty => tallies.isEmpty;
}

final matchResultStatsProvider =
    StreamProvider.family<MatchResultStats, String>((ref, matchId) {
  // Sin sesión no se abre nada: un listener que sale sin token queda
  // muerto para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  return FirebaseFirestore.instance
      .collection('matches')
      .doc(matchId)
      .collection('selfEvaluations')
      .snapshots()
      .map((snap) {
    final goals = <String, int>{};
    final assists = <String, int>{};
    final votes = <String, int>{};

    for (final doc in snap.docs) {
      final data = doc.data();
      // El id del documento es el del jugador en las evaluaciones viejas.
      final pid = (data['playerId'] as String?) ?? doc.id;
      goals[pid] = (goals[pid] ?? 0) + ((data['goals'] as num?)?.toInt() ?? 0);
      assists[pid] = (assists[pid] ?? 0) + ((data['assists'] as num?)?.toInt() ?? 0);

      final vote = data['mvpVote'] as String?;
      if (vote != null && vote.isNotEmpty) {
        votes[vote] = (votes[vote] ?? 0) + 1;
      }
    }

    final ids = {...goals.keys, ...assists.keys, ...votes.keys};
    final tallies = [
      for (final id in ids)
        MatchPlayerTally(
          playerId: id,
          goals: goals[id] ?? 0,
          assists: assists[id] ?? 0,
          mvpVotes: votes[id] ?? 0,
        ),
    ];

    String? mvpId;
    var mvpVotes = 0;
    votes.forEach((id, n) {
      if (n > mvpVotes) {
        mvpVotes = n;
        mvpId = id;
      }
    });

    return MatchResultStats(tallies: tallies, mvpId: mvpId, mvpVotes: mvpVotes);
  });
});
