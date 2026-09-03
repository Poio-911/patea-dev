import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/player_model.dart';
import '../models/match_model.dart';
import '../models/competition_model.dart';
import '../models/group_model.dart';
import '../models/evaluation_models.dart';
import 'auth_service.dart';

final firestoreServiceProvider = Provider<FirestoreService>((ref) {
  return FirestoreService(FirebaseFirestore.instance);
});

/// Límites por defecto de las consultas.
///
/// Hasta 2026-09-03 los streams de `players` y `matches` no tenían ni filtro
/// obligatorio ni `limit`: cuatro pantallas los pedían con `groupId = null` y
/// eso abría un `onSnapshot` sobre la colección ENTERA de la plataforma —
/// incluidos los jugadores y partidos de grupos ajenos, que además nunca se
/// mostraban. El costo por usuario crecía con el total de usuarios de la app.
class QueryLimits {
  static const int players = 200;
  static const int matches = 100;
  static const int competitions = 50;
  static const int publicMatches = 50;
}

/// UID del usuario actual, o null. Sincrónico respecto al stream de auth.
final currentUidProvider = Provider<String?>((ref) {
  return ref.watch(authStateProvider).value?.uid;
});

/// Grupo activo del usuario actual.
///
/// Es el equivalente de `user.activeGroupId` en la web: `players/page.tsx:44`
/// directamente no arma la query si no hay grupo activo, y muestra un estado
/// vacío. Acá se replica lo mismo — sin grupo activo no se lee nada.
final activeGroupIdProvider = Provider<AsyncValue<String?>>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return const AsyncValue.data(null);
  return ref.watch(activeGroupIdStreamProvider(uid));
});

// Streams
final playersStreamProvider = StreamProvider.family<List<PlayerModel>, String?>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getPlayersStream(groupId: groupId);
});

/// Jugadores del grupo activo — la forma que deberían usar las pantallas.
/// Resuelve el grupo por sí solo en vez de recibir `null` y leer todo.
final activeGroupPlayersProvider = StreamProvider<List<PlayerModel>>((ref) {
  final groupId = ref.watch(activeGroupIdProvider).value;
  return ref.watch(firestoreServiceProvider).getPlayersStream(groupId: groupId);
});

/// Partidos del grupo activo.
final activeGroupMatchesProvider = StreamProvider<List<MatchModel>>((ref) {
  final groupId = ref.watch(activeGroupIdProvider).value;
  return ref.watch(firestoreServiceProvider).getMatchesStream(groupId: groupId);
});

final singlePlayerStreamProvider = StreamProvider.family<PlayerModel?, String>((ref, playerId) {
  return ref.watch(firestoreServiceProvider).getPlayerStream(playerId);
});

final ovrHistoryStreamProvider = StreamProvider.family<List<OvrHistoryEntry>, String>((ref, playerId) {
  return ref.watch(firestoreServiceProvider).getOvrHistoryStream(playerId);
});

final singleGroupStreamProvider = StreamProvider.family<GroupModel?, String>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getGroupStream(groupId);
});

/// `users/{uid}.activeGroupId` — la web lo trae embebido en el objeto `user`
/// (custom claims/perfil fusionado), acá se lee directo del doc de Firestore.
final activeGroupIdStreamProvider = StreamProvider.family<String?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getActiveGroupIdStream(uid);
});

/// `groups` donde `members` contiene al uid — para elegir grupo activo.
final userGroupsStreamProvider = StreamProvider.family<List<GroupModel>, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getUserGroupsStream(uid);
});

final groupTeamsStreamProvider = StreamProvider.family<List<GroupTeamModel>, String>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getGroupTeamsStream(groupId);
});

final singleTeamStreamProvider = StreamProvider.family<GroupTeamModel?, String>((ref, teamId) {
  return ref.watch(firestoreServiceProvider).getTeamStream(teamId);
});

final matchesStreamProvider = StreamProvider.family<List<MatchModel>, String?>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getMatchesStream(groupId: groupId);
});

final singleMatchStreamProvider = StreamProvider.family<MatchModel?, String>((ref, matchId) {
  return ref.watch(firestoreServiceProvider).getMatchStream(matchId);
});

/// Port de getPublicMatchesAction — a diferencia de esa server action (Admin
/// SDK), esto es una query directa: `matches` permite `read` a cualquier
/// autenticado, solo los writes están bloqueados.
final publicMatchesStreamProvider = StreamProvider<List<MatchModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getPublicMatchesStream();
});

final myAvailabilityStreamProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getAvailablePlayerDocStream(uid);
});

final savedLocationStreamProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getSavedLocationStream(uid);
});

final userUpcomingMatchesStreamProvider = StreamProvider.family<List<MatchModel>, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getUserUpcomingMatchesStream(uid);
});

/// Todos los assignments de un partido (para la pantalla de finalizar
/// evaluación del organizador — progreso X/Y evaluadores).
final matchAssignmentsStreamProvider = StreamProvider.family<List<EvaluationAssignmentModel>, String>((ref, matchId) {
  return ref.watch(firestoreServiceProvider).getMatchAssignmentsStream(matchId);
});

final leaguesStreamProvider = StreamProvider<List<CompetitionModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getCompetitionsStream(type: 'leagues');
});

final cupsStreamProvider = StreamProvider<List<CompetitionModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getCompetitionsStream(type: 'cups');
});

class FirestoreService {
  final FirebaseFirestore _firestore;

  FirestoreService(this._firestore);

  // Jugadores
  //
  // Sin `groupId` NO se consulta nada: se devuelve una lista vacía sin abrir
  // listener. Es exactamente lo que hace la web (`players/page.tsx:44`
  // devuelve `null` como query cuando no hay `activeGroupId`). Antes, `null`
  // significaba "traé la colección entera".
  //
  // Ordena y limita en el servidor usando el índice `groupId ASC, ovr DESC`
  // que ya existe en firestore.indexes.json.
  Stream<List<PlayerModel>> getPlayersStream({
    String? groupId,
    int limit = QueryLimits.players,
  }) {
    if (groupId == null || groupId.isEmpty) {
      return Stream.value(const <PlayerModel>[]);
    }
    return _firestore
        .collection('players')
        .where('groupId', isEqualTo: groupId)
        .orderBy('ovr', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => PlayerModel.fromFirestore(doc.data(), doc.id))
            .toList());
  }

  Stream<PlayerModel?> getPlayerStream(String playerId) {
    return _firestore.collection('players').doc(playerId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return PlayerModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  Stream<List<OvrHistoryEntry>> getOvrHistoryStream(String playerId) {
    return _firestore
        .collection('players/$playerId/ovrHistory')
        .orderBy('date')
        .snapshots()
        .map((snap) => snap.docs.map((d) => OvrHistoryEntry.fromMap(d.data())).toList());
  }

  Stream<GroupModel?> getGroupStream(String groupId) {
    return _firestore.collection('groups').doc(groupId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return GroupModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  Stream<String?> getActiveGroupIdStream(String uid) {
    return _firestore.collection('users').doc(uid).snapshots().map((doc) => doc.data()?['activeGroupId'] as String?);
  }

  Stream<List<GroupModel>> getUserGroupsStream(String uid) {
    return _firestore
        .collection('groups')
        .where('members', arrayContains: uid)
        .snapshots()
        .map((snap) => snap.docs.map((d) => GroupModel.fromFirestore(d.data(), d.id)).toList());
  }

  Stream<List<GroupTeamModel>> getGroupTeamsStream(String groupId) {
    return _firestore
        .collection('teams')
        .where('groupId', isEqualTo: groupId)
        .snapshots()
        .map((snap) => snap.docs.map((d) => GroupTeamModel.fromMap(d.data(), d.id)).toList());
  }

  Stream<GroupTeamModel?> getTeamStream(String teamId) {
    return _firestore.collection('teams').doc(teamId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return GroupTeamModel.fromMap(doc.data()!, doc.id);
    });
  }

  // Partidos — mismo criterio que jugadores.
  // Usa el índice `groupId ASC, date DESC`, ya existente.
  Stream<List<MatchModel>> getMatchesStream({
    String? groupId,
    int limit = QueryLimits.matches,
  }) {
    if (groupId == null || groupId.isEmpty) {
      return Stream.value(const <MatchModel>[]);
    }
    return _firestore
        .collection('matches')
        .where('groupId', isEqualTo: groupId)
        .orderBy('date', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MatchModel.fromFirestore(doc.data(), doc.id))
            .toList());
  }

  Stream<MatchModel?> getMatchStream(String matchId) {
    return _firestore.collection('matches').doc(matchId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return MatchModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  Stream<List<MatchModel>> getPublicMatchesStream() {
    return _firestore
        .collection('matches')
        .where('status', isEqualTo: 'upcoming')
        .where('isPublic', isEqualTo: true)
        .orderBy('date')
        .limit(50)
        .snapshots()
        .map((snap) => snap.docs.map((d) => MatchModel.fromFirestore(d.data(), d.id)).toList());
  }

  Stream<Map<String, dynamic>?> getAvailablePlayerDocStream(String uid) {
    return _firestore.collection('availablePlayers').doc(uid).snapshots().map((doc) => doc.data());
  }

  Stream<Map<String, dynamic>?> getSavedLocationStream(String uid) {
    return _firestore.collection('users').doc(uid).snapshots().map((doc) => doc.data()?['savedLocation'] as Map<String, dynamic>?);
  }

  Stream<List<MatchModel>> getUserUpcomingMatchesStream(String uid) {
    return _firestore
        .collection('matches')
        .where('playerUids', arrayContains: uid)
        .where('status', isEqualTo: 'upcoming')
        .snapshots()
        .map((snap) => snap.docs.map((d) => MatchModel.fromFirestore(d.data(), d.id)).toList());
  }

  Stream<List<EvaluationAssignmentModel>> getMatchAssignmentsStream(String matchId) {
    return _firestore
        .collection('matches/$matchId/assignments')
        .snapshots()
        .map((snap) => snap.docs.map((d) => EvaluationAssignmentModel.fromMap(d.data(), d.id)).toList());
  }

  // Competiciones (Ligas y Copas) — acotadas, antes traían la colección entera.
  Stream<List<CompetitionModel>> getCompetitionsStream({
    required String type,
    int limit = QueryLimits.competitions,
  }) {
    return _firestore.collection(type).limit(limit).snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return CompetitionModel.fromFirestore(
          doc.data(),
          doc.id,
          type == 'leagues' ? 'league' : 'cup',
        );
      }).toList();
    });
  }

  Stream<CompetitionModel?> getSingleCompetitionStream({
    required String id,
    required String collection,
  }) {
    return _firestore.collection(collection).doc(id).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return CompetitionModel.fromFirestore(
        doc.data()!,
        doc.id,
        collection == 'leagues' ? 'league' : 'cup',
      );
    });
  }
}
