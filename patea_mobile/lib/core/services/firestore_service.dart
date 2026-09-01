import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/player_model.dart';
import '../models/match_model.dart';
import '../models/competition_model.dart';

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

final matchesStreamProvider = StreamProvider.family<List<MatchModel>, String?>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getMatchesStream(groupId: groupId);
});

final singleMatchStreamProvider = StreamProvider.family<MatchModel?, String>((ref, matchId) {
  return ref.watch(firestoreServiceProvider).getMatchStream(matchId);
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
