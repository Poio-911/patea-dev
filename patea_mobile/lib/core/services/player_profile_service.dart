import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/group_model.dart';
import '../models/player_activity_models.dart';
import 'callable_functions.dart';
import 'firestore_service.dart';

/// Historial de partidos evaluados de un jugador.
///
/// Va por Cloud Function y no por Firestore directo a propósito: el documento
/// de evaluación trae `evaluatorId`, y el anonimato depende de que ese campo se
/// oculte. La función aplica el mismo enmascarado que la web
/// (`getPlayerEvaluationsAction`) antes de devolver nada.
final playerActivityProvider =
    FutureProvider.family<List<MatchFeedback>, String>((ref, playerId) async {
  final result = await callFunction(
    'getPlayerEvaluations',
    {'playerId': playerId},
    timeout: const Duration(seconds: 45),
  );
  final raw = (result['matches'] as List?) ?? const [];
  return raw
      .whereType<Map>()
      .map((m) => MatchFeedback.fromMap(Map<String, dynamic>.from(m)))
      .toList();
});

/// Equipos del grupo a los que pertenece este jugador.
///
/// Port de `PlayerTeamsList` (src/components/player-teams-list.tsx): consulta
/// los equipos del grupo y filtra en memoria por pertenencia, igual que la web
/// — `members` es un array de objetos, así que no se puede filtrar en la query.
final playerTeamsProvider =
    StreamProvider.family<List<GroupTeamModel>, ({String playerId, String? groupId})>((ref, args) {
  // Sin sesión no se abre nada: un listener que sale sin token queda
  // muerto para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  final groupId = args.groupId;
  if (groupId == null || groupId.isEmpty) {
    return Stream.value(const <GroupTeamModel>[]);
  }
  return FirebaseFirestore.instance
      .collection('teams')
      .where('groupId', isEqualTo: groupId)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => GroupTeamModel.fromMap(d.data(), d.id))
          .where((t) => t.members.any((m) => m.playerId == args.playerId))
          .toList());
});
