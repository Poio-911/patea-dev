import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/player_model.dart';
import '../models/match_model.dart';
import '../models/competition_model.dart';
import '../models/group_model.dart';
import '../models/evaluation_models.dart';

final firestoreServiceProvider = Provider<FirestoreService>((ref) {
  return FirestoreService(FirebaseFirestore.instance);
});

// Streams
final playersStreamProvider = StreamProvider.family<List<PlayerModel>, String?>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getPlayersStream(groupId: groupId);
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
  Stream<List<PlayerModel>> getPlayersStream({String? groupId}) {
    Query query = _firestore.collection('players');
    if (groupId != null && groupId.isNotEmpty) {
      query = query.where('groupId', isEqualTo: groupId);
    }
    return query.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return PlayerModel.fromFirestore(doc.data()! as Map<String, dynamic>, doc.id);
      }).toList();
    });
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

  // Partidos
  Stream<List<MatchModel>> getMatchesStream({String? groupId}) {
    Query query = _firestore.collection('matches');
    if (groupId != null && groupId.isNotEmpty) {
      query = query.where('groupId', isEqualTo: groupId);
    }
    return query.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return MatchModel.fromFirestore(doc.data()! as Map<String, dynamic>, doc.id);
      }).toList();
    });
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

  // Competiciones (Ligas y Copas)
  Stream<List<CompetitionModel>> getCompetitionsStream({required String type}) {
    return _firestore.collection(type).snapshots().map((snapshot) {
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
