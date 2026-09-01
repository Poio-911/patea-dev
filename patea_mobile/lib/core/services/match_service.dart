import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/match_model.dart';

final matchServiceProvider = Provider<MatchService>((ref) {
  return MatchService(FirebaseFirestore.instance);
});

class MatchService {
  final FirebaseFirestore _firestore;

  MatchService(this._firestore);

  /// Crea un nuevo partido en Firestore
  Future<String> createMatch({
    required String title,
    required String date,
    required String type,
    required String ownerUid,
    String? groupId,
    String? location,
    String? teamAName,
    String? teamBName,
    List<String> teamAPlayerIds = const [],
    List<String> teamBPlayerIds = const [],
  }) async {
    final docRef = _firestore.collection('matches').doc();

    final allPlayerUids = [...teamAPlayerIds, ...teamBPlayerIds];

    final matchData = {
      'title': title,
      'date': date,
      'status': 'upcoming',
      'type': type,
      'ownerUid': ownerUid,
      'groupId': groupId,
      'location': location,
      'createdAt': FieldValue.serverTimestamp(),
      'playerUids': allPlayerUids,
      'teams': [
        {
          'name': teamAName ?? 'Equipo A',
          'score': 0,
          'players': teamAPlayerIds.map((id) => {'uid': id}).toList(),
          'playerIds': teamAPlayerIds,
        },
        {
          'name': teamBName ?? 'Equipo B',
          'score': 0,
          'players': teamBPlayerIds.map((id) => {'uid': id}).toList(),
          'playerIds': teamBPlayerIds,
        },
      ],
      'events': [],
    };

    await docRef.set(matchData);
    return docRef.id;
  }

  /// Inicia el partido (estado: active)
  Future<void> startMatch(String matchId) async {
    await _firestore.collection('matches').doc(matchId).update({
      'status': 'active',
      'liveStatus': 'first_half',
      'currentMinute': 1,
      'startedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Actualiza el minuto en vivo y el tiempo
  Future<void> updateLiveMinute(String matchId, int minute, String liveStatus) async {
    await _firestore.collection('matches').doc(matchId).update({
      'currentMinute': minute,
      'liveStatus': liveStatus,
    });
  }

  /// Registra un evento en vivo (gol, tarjeta, sustitución, etc.) y actualiza el marcador
  Future<void> recordLiveEvent({
    required String matchId,
    required MatchEvent event,
    int? teamAScore,
    int? teamBScore,
  }) async {
    final matchRef = _firestore.collection('matches').doc(matchId);

    final updates = <String, dynamic>{
      'events': FieldValue.arrayUnion([event.toMap()]),
    };

    if (event.type == 'goal' && (teamAScore != null || teamBScore != null)) {
      final docSnap = await matchRef.get();
      if (docSnap.exists) {
        final data = docSnap.data();
        final teams = List<Map<String, dynamic>>.from(data?['teams'] ?? []);
        if (teams.length >= 2) {
          if (teamAScore != null) teams[0]['score'] = teamAScore;
          if (teamBScore != null) teams[1]['score'] = teamBScore;
          updates['teams'] = teams;
        }
      }
    }

    await matchRef.update(updates);
  }

  /// Finaliza el partido (estado: completed)
  Future<void> finishMatch({
    required String matchId,
    required int teamAScore,
    required int teamBScore,
  }) async {
    final matchRef = _firestore.collection('matches').doc(matchId);
    final docSnap = await matchRef.get();

    final updates = <String, dynamic>{
      'status': 'completed',
      'liveStatus': 'finished',
      'completedAt': FieldValue.serverTimestamp(),
    };

    if (docSnap.exists) {
      final data = docSnap.data();
      final teams = List<Map<String, dynamic>>.from(data?['teams'] ?? []);
      if (teams.length >= 2) {
        teams[0]['score'] = teamAScore;
        teams[1]['score'] = teamBScore;
        updates['teams'] = teams;
      }
    }

    await matchRef.update(updates);
  }

  /// Unirse a un partido colaborativo
  Future<void> joinMatch(String matchId, String playerId) async {
    await _firestore.collection('matches').doc(matchId).update({
      'playerUids': FieldValue.arrayUnion([playerId]),
    });
  }

  /// Darse de baja de un partido colaborativo
  Future<void> leaveMatch(String matchId, String playerId) async {
    await _firestore.collection('matches').doc(matchId).update({
      'playerUids': FieldValue.arrayRemove([playerId]),
    });
  }
}
