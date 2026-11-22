import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import 'firestore_service.dart' show currentUidProvider;
import '../models/player_model.dart';
import '../models/match_model.dart';
import '../models/evaluation_models.dart';

final evaluationServiceProvider = Provider<EvaluationService>((ref) {
  ref.watch(currentUidProvider);
  return EvaluationService(FirebaseFirestore.instance);
});

final evaluationInboxItemsProvider = StreamProvider.autoDispose.family<List<EvaluationInboxItem>, String>((ref, uid) {
  return ref.watch(evaluationServiceProvider).watchInboxItems(uid);
});

final identityRevealRequestsProvider = FutureProvider.family<List<IdentityRevealRequest>, String>((ref, uid) {
  return ref.watch(evaluationServiceProvider).loadIdentityRequests(uid);
});

/// Port de src/lib/actions/evaluation-actions.ts + src/app/evaluations/*.
/// La escritura real de `evaluations`/`evaluationSubmissions`/`assignments`
/// está bloqueada para el cliente en firestore.rules a propósito ("las
/// evaluaciones las crea el servidor") — todo acá pasa por Cloud Functions.
/// El procesamiento de una submission en `evaluations` + `selfEvaluations` +
/// `processedSubmissions` lo hace automáticamente el trigger
/// `processEvaluationSubmission` (ya desplegado, no requiere llamada extra).
class EvaluationService {
  final FirebaseFirestore _firestore;

  EvaluationService(this._firestore);

  Future<List<EvaluationAssignmentModel>> getPendingAssignmentsForMatch(String matchId, String evaluatorId) async {
    final snap = await _firestore
        .collection('matches/$matchId/assignments')
        .where('evaluatorId', isEqualTo: evaluatorId)
        .where('status', isEqualTo: 'pending')
        .get();
    return snap.docs.map((d) => EvaluationAssignmentModel.fromMap(d.data(), d.id)).toList();
  }

  Future<bool> hasSubmittedFor(String matchId, String evaluatorId) async {
    final snap = await _firestore
        .collection('evaluationSubmissions')
        .where('matchId', isEqualTo: matchId)
        .where('evaluatorId', isEqualTo: evaluatorId)
        .limit(1)
        .get();
    return snap.docs.isNotEmpty;
  }

  Future<List<PlayerModel>> getPlayersByIds(List<String> ids) async {
    if (ids.isEmpty) return [];
    final results = <PlayerModel>[];
    for (var i = 0; i < ids.length; i += 10) {
      final chunk = ids.sublist(i, i + 10 > ids.length ? ids.length : i + 10);
      final snap = await _firestore.collection('players').where(FieldPath.documentId, whereIn: chunk).get();
      results.addAll(snap.docs.map((d) => PlayerModel.fromFirestore(d.data(), d.id)));
    }
    return results;
  }

  Future<List<MatchModel>> getMatchesByIds(List<String> ids) async {
    if (ids.isEmpty) return [];
    // Lecturas individuales: las reglas del partido se evalúan por documento y
    // una consulta por `documentId` no las puede probar.
    final snaps = await Future.wait(
      ids.toSet().map((id) async {
        try {
          return await _firestore.collection('matches').doc(id).get();
        } on FirebaseException {
          return null; // sin acceso a ese partido
        }
      }),
    );
    return [
      for (final d in snaps)
        if (d != null && d.exists) MatchModel.fromFirestore(d.data()!, d.id),
    ];
  }

  /// Listen to the evaluator's assignments, including the initial snapshot.
  /// Uses the existing evaluatorId/status collection-group index and rules.
  Stream<void> watchAssignmentChanges(String uid) {
    return _firestore.collectionGroup('assignments')
        .where('evaluatorId', isEqualTo: uid)
        .where('status', whereIn: ['pending', 'completed'])
        .snapshots().map((_) {});
  }

  /// Each committed assignment change refreshes both pending and history.
  /// Notifications and completing a match do not have to invalidate a cache.
  Stream<List<EvaluationInboxItem>> watchInboxItems(String uid) {
    return watchAssignmentChanges(uid).asyncMap((_) => loadInboxItems(uid));
  }

  Future<List<EvaluationInboxItem>> loadInboxItems(String uid) async {
    final pendingSnap = await _firestore
        .collectionGroup('assignments')
        .where('evaluatorId', isEqualTo: uid)
        .where('status', isEqualTo: 'pending')
        .get();
    final completedSnap = await _firestore
        .collectionGroup('assignments')
        .where('evaluatorId', isEqualTo: uid)
        .where('status', isEqualTo: 'completed')
        .get();

    final pendingByMatch = <String, List<EvaluationAssignmentModel>>{};
    for (final d in pendingSnap.docs) {
      final a = EvaluationAssignmentModel.fromMap(d.data(), d.id);
      (pendingByMatch[a.matchId] ??= []).add(a);
    }
    final completedMatchIds = completedSnap.docs.map((d) => (d.data()['matchId'] as String?) ?? '').where((s) => s.isNotEmpty).toSet();

    final allMatchIds = {...pendingByMatch.keys, ...completedMatchIds}.toList();
    if (allMatchIds.isEmpty) return [];

    final matches = {for (final m in await getMatchesByIds(allMatchIds)) m.id: m};

    final subjectIds = pendingByMatch.values.expand((l) => l.map((a) => a.subjectId)).toSet().toList();
    final players = {for (final p in await getPlayersByIds(subjectIds)) p.id: p};

    final processedByMatch = <String, Map<String, dynamic>>{};
    for (final matchId in completedMatchIds) {
      final snap = await _firestore
          .collection('matches/$matchId/processedSubmissions')
          .where('evaluatorId', isEqualTo: uid)
          .limit(1)
          .get();
      if (snap.docs.isNotEmpty) processedByMatch[matchId] = snap.docs.first.data();
    }

    final items = <EvaluationInboxItem>[];
    for (final matchId in allMatchIds) {
      final match = matches[matchId];
      if (match == null) continue;
      final processed = processedByMatch[matchId];
      final pending = pendingByMatch[matchId] ?? [];

      if (processed == null && pending.isEmpty) continue;

      final submission = processed?['submission'] as Map<String, dynamic>?;
      items.add(EvaluationInboxItem(
        matchId: matchId,
        matchTitle: match.title,
        matchDate: match.date,
        isSubmitted: processed != null,
        submittedAt: processed?['submittedAt'] as String?,
        submittedEvaluationsCount: (submission?['evaluations'] as List?)?.length,
        submittedGoals: (submission?['evaluatorGoals'] as num?)?.toInt(),
        submittedAssists: (submission?['evaluatorAssists'] as num?)?.toInt(),
        assignedPlayers: pending
            .map((a) => players[a.subjectId])
            .whereType<PlayerModel>()
            .map((p) => AssignedPlayerInfo(id: p.id, name: p.name, photoURL: p.photoUrl, position: p.position))
            .toList(),
      ));
    }

    items.sort((a, b) => b.matchDate.compareTo(a.matchDate));
    return items;
  }

  Future<List<IdentityRevealRequest>> loadIdentityRequests(String uid) async {
    final snap = await _firestore
        .collection('evaluations')
        .where('evaluatorId', isEqualTo: uid)
        .where('identityRequestStatus', isEqualTo: 'pending')
        .get();

    final requests = <IdentityRevealRequest>[];
    for (final d in snap.docs) {
      final data = d.data();
      final playerId = data['playerId'] as String? ?? '';
      final matchId = data['matchId'] as String? ?? '';
      final playerSnap = playerId.isNotEmpty ? await _firestore.collection('players').doc(playerId).get() : null;
      final matchSnap = matchId.isNotEmpty ? await _firestore.collection('matches').doc(matchId).get() : null;
      final playerData = playerSnap?.data();
      final matchData = matchSnap?.data();
      requests.add(IdentityRevealRequest(
        evaluationId: d.id,
        fromPlayerName: (playerData?['name'] as String?) ?? 'Jugador',
        fromPlayerPhotoUrl: (playerData?['photoUrl'] as String?) ?? (playerData?['photoURL'] as String?) ?? '',
        matchTitle: (matchData?['title'] as String?) ?? 'Partido',
        hasAudio: (data['audioPath'] as String?)?.trim().isNotEmpty == true,
      ));
    }
    return requests;
  }

  Future<void> submitEvaluation({
    required String matchId,
    required int evaluatorGoals,
    required int evaluatorAssists,
    String? mvpVote,
    String? personalChronicle,
    required List<PlayerEvaluationDraft> evaluations,
  }) async {
    await callFunction('submitEvaluationSubmission', {
      'matchId': matchId,
      'submission': {
        'evaluatorGoals': evaluatorGoals,
        'evaluatorAssists': evaluatorAssists,
        if (mvpVote != null) 'mvpVote': mvpVote,
        if (personalChronicle != null && personalChronicle.isNotEmpty) 'personalChronicle': personalChronicle,
        'evaluations': evaluations.map((e) => e.toSubmissionMap()).toList(),
      },
    });
  }

  Future<void> requestIdentityReveal(String evaluationId) async {
    await callFunction('requestIdentityReveal', {'evaluationId': evaluationId});
  }

  Future<void> respondToIdentityReveal(String evaluationId, String response) async {
    await callFunction('respondToIdentityReveal', {'evaluationId': evaluationId, 'response': response});
  }

  /// Sube una nota de voz de evaluación a la ruta privada del autor en Storage.
  Future<String> uploadEvaluationAudio({
    required String matchId,
    required String assignmentId,
    required File file,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw Exception('Debés iniciar sesión para subir la nota de voz.');
    }
    final bytes = await file.readAsBytes();
    if (bytes.length > 2 * 1024 * 1024) {
      throw Exception('El audio supera el límite de 2 MB.');
    }
    final storagePath = 'evaluation-audios/$matchId/$uid/$assignmentId.m4a';
    final ref = FirebaseStorage.instance.ref(storagePath);
    await ref.putData(
      bytes,
      SettableMetadata(contentType: 'audio/mp4'),
    );
    return storagePath;
  }

  /// Analiza una reseña libre para mostrar el impacto estimado en atributos.
  /// Si se pasan `matchId` y `assignmentId`, el servidor cachea el resultado
  /// para reutilizarlo al enviar sin duplicar gasto de IA.
  Future<TextPerformancePreview> analyzeTextPerformance({
    required String text,
    required String playerPosition,
    required String playerName,
    String? matchId,
    String? assignmentId,
  }) async {
    final result = await callFunction(
      'analyzeTextPerformance',
      {
        'text': text.trim(),
        'playerPosition': playerPosition,
        'playerName': playerName,
        if (matchId != null && matchId.isNotEmpty) 'matchId': matchId,
        if (assignmentId != null && assignmentId.isNotEmpty)
          'assignmentId': assignmentId,
      },
      timeout: const Duration(seconds: 60),
    );
    return TextPerformancePreview.fromMap(result);
  }

  /// Analiza una nota de voz ya subida a Storage; devuelve sólo resumen +
  /// cambios de atributos (sin transcripción cruda) y deja el análisis cacheado
  /// en el servidor para evitar doble llamada al enviar.
  Future<TextPerformancePreview> analyzeAudioPerformance({
    required String matchId,
    required String assignmentId,
    required String audioPath,
    required int audioDurationSec,
  }) async {
    final result = await callFunction(
      'analyzeAudioPerformance',
      {
        'matchId': matchId,
        'assignmentId': assignmentId,
        'audioPath': audioPath,
        'audioDurationSec': audioDurationSec,
      },
      timeout: const Duration(seconds: 60),
    );
    return TextPerformancePreview.fromMap(result);
  }

  /// Descarga los bytes de una nota de voz únicamente si la identidad fue
  /// revelada (o si la consulta el propio evaluador).
  Future<({Uint8List bytes, String mimeType, int? durationSec})>
  loadEvaluationAudio(String evaluationId) async {
    final result = await callFunction(
      'getEvaluationAudio',
      {'evaluationId': evaluationId},
      timeout: const Duration(seconds: 30),
    );
    final raw = (result['audioBase64'] as String?) ?? '';
    if (raw.isEmpty) {
      throw Exception('Audio no disponible.');
    }
    return (
      bytes: base64Decode(raw),
      mimeType: (result['mimeType'] as String?) ?? 'audio/mp4',
      durationSec: (result['durationSec'] as num?)?.toInt(),
    );
  }

  /// Solo el organizador; agrega los assignments incompletos con el
  /// promedio del partido y actualiza OVR/atributos/stats reales.
  Future<int> finalizeMatchEvaluation(String matchId) async {
    final result = await callFunction('finalizeMatchEvaluation', {'matchId': matchId}, timeout: const Duration(seconds: 45));
    return (result['playersUpdated'] as num?)?.toInt() ?? 0;
  }
}
