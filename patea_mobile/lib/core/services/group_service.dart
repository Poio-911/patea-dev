import 'dart:async';

import '../models/group_permissions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import 'firestore_service.dart';

final groupServiceProvider = Provider<GroupService>((ref) {
  return GroupService();
});

/// Port de src/lib/actions/{group-actions,team-actions}.ts. `groups` y
/// `teams` tienen `allow create/update/delete: if false` en firestore.rules
/// a propósito — toda escritura pasa por estas Cloud Functions
/// (functions/src/callable/group-management.ts).
class GroupService {
  Future<String> createGroup(String name) async {
    final result = await callFunction('createGroup', {'name': name});
    return result['groupId'] as String;
  }

  Future<String> joinGroupByInviteCode(String inviteCode) async {
    final result = await callFunction('joinGroupByInviteCode', {
      'inviteCode': inviteCode,
    });
    return result['groupId'] as String;
  }

  Future<void> setActiveGroup(String groupId) async {
    await callFunction('setActiveGroup', {'groupId': groupId});
  }

  Future<String> createTeam({
    required String groupId,
    required String name,
    required Map<String, dynamic> jersey,
    required List<Map<String, dynamic>> members,
  }) async {
    final result = await callFunction('createTeam', {
      'groupId': groupId,
      'name': name,
      'jersey': jersey,
      'members': members,
    });
    return result['id'] as String;
  }

  Future<void> updateTeam({
    required String teamId,
    required String name,
    required Map<String, dynamic> jersey,
  }) async {
    await callFunction('updateTeam', {
      'teamId': teamId,
      'name': name,
      'jersey': jersey,
    });
  }

  Future<void> updateTeamMembers({
    required String teamId,
    required List<Map<String, dynamic>> members,
  }) async {
    await callFunction('updateTeamMembers', {
      'teamId': teamId,
      'members': members,
    });
  }

  Future<void> deleteTeam(String teamId) async {
    await callFunction('deleteTeam', {'teamId': teamId});
  }
}

/// Rol del usuario actual dentro de un grupo.
///
/// Lee el documento crudo porque `GroupModel` no mapea `memberRoles`, y el rol
/// sale de ahí. Sirve para decidir qué botones mostrar; el permiso real lo
/// valida la Cloud Function antes de escribir.
final myGroupRoleProvider = StreamProvider.family<GroupRole?, String>((
  ref,
  groupId,
) {
  // Sin sesión no se abre nada: un listener que sale sin token queda
  // muerto para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  final uid = FirebaseAuth.instance.currentUser?.uid;
  if (uid == null || groupId.isEmpty) return Stream.value(null);
  return FirebaseFirestore.instance
      .collection('groups')
      .doc(groupId)
      .snapshots()
      .map((doc) => resolveGroupRole(doc.data(), uid));
});

/// Trofeos del equipo: copas y ligas ganadas.
///
/// Mismas dos consultas que hace la web en `groups/teams/[id]/page.tsx`
/// (`championTeamId == teamId` + `status == 'completed'`), unificadas en un
/// solo stream porque acá se muestran juntas.
class TeamTrophy {
  final String name;
  final bool isCup;
  const TeamTrophy({required this.name, required this.isCup});
}

final teamTrophiesProvider = StreamProvider.family<List<TeamTrophy>, String>((
  ref,
  teamId,
) {
  // Sin sesión no se abre nada: un listener que sale sin token queda
  // muerto para siempre. Ver firestoreServiceProvider.
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();

  if (teamId.isEmpty) return Stream.value(const []);
  final db = FirebaseFirestore.instance;

  Stream<List<TeamTrophy>> champions(String collection, bool isCup) => db
      .collection(collection)
      .where('championTeamId', isEqualTo: teamId)
      .where('status', isEqualTo: 'completed')
      .snapshots()
      .map(
        (s) => s.docs
            .map(
              (d) => TeamTrophy(
                name: (d.data()['name'] ?? '').toString(),
                isCup: isCup,
              ),
            )
            .toList(),
      );

  return combineTeamTrophies(
    champions('cups', true),
    champions('leagues', false),
  );
});

/// Conserva el último valor de ambas consultas y escucha cambios de cualquiera.
Stream<List<TeamTrophy>> combineTeamTrophies(
  Stream<List<TeamTrophy>> cupsStream,
  Stream<List<TeamTrophy>> leaguesStream,
) {
  late StreamController<List<TeamTrophy>> controller;
  StreamSubscription<List<TeamTrophy>>? cupsSub;
  StreamSubscription<List<TeamTrophy>>? leaguesSub;
  List<TeamTrophy>? cups;
  List<TeamTrophy>? leagues;
  var completed = 0;
  void emit() {
    if (cups != null && leagues != null) {
      controller.add([...cups!, ...leagues!]);
    }
  }

  void done() {
    if (++completed == 2) controller.close();
  }

  controller = StreamController<List<TeamTrophy>>(
    onListen: () {
      cupsSub = cupsStream.listen(
        (value) {
          cups = value;
          emit();
        },
        onError: controller.addError,
        onDone: done,
      );
      leaguesSub = leaguesStream.listen(
        (value) {
          leagues = value;
          emit();
        },
        onError: controller.addError,
        onDone: done,
      );
    },
    onPause: () {
      cupsSub?.pause();
      leaguesSub?.pause();
    },
    onResume: () {
      cupsSub?.resume();
      leaguesSub?.resume();
    },
    onCancel: () async {
      await cupsSub?.cancel();
      await leaguesSub?.cancel();
    },
  );
  return controller.stream;
}
