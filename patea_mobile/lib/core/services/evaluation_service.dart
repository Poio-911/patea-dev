import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/player_model.dart';
import '../constants/performance_tags.dart';
import '../utils/ovr_calculator.dart';

final evaluationServiceProvider = Provider<EvaluationService>((ref) {
  return EvaluationService(FirebaseFirestore.instance);
});

class EvaluationService {
  final FirebaseFirestore _firestore;

  EvaluationService(this._firestore);

  /// Envía una evaluación peer-to-peer y recalcula los atributos y OVR del jugador en tiempo real
  Future<void> submitEvaluation({
    required String matchId,
    required String evaluatorId,
    required String targetPlayerId,
    required double rating,
    required List<String> tagIds,
    String? comment,
  }) async {
    final batch = _firestore.batch();

    // 1. Crear documento de evaluación
    final evalRef = _firestore.collection('evaluations').doc();
    final selectedTags = PerformanceTagsData.allTags.where((t) => tagIds.contains(t.id)).toList();

    batch.set(evalRef, {
      'matchId': matchId,
      'evaluatorId': evaluatorId,
      'targetPlayerId': targetPlayerId,
      'rating': rating,
      'tags': tagIds,
      'comment': comment,
      'createdAt': FieldValue.serverTimestamp(),
    });

    // 2. Obtener datos actuales del jugador
    final playerDocRef = _firestore.collection('players').doc(targetPlayerId);
    final playerSnap = await playerDocRef.get();

    if (!playerSnap.exists || playerSnap.data() == null) {
      await batch.commit();
      return;
    }

    final player = PlayerModel.fromFirestore(playerSnap.data()!, playerSnap.id);

    // 3. Calcular cambio de OVR y deltas de atributos
    final double ovrChange = OvrCalculator.calculateOvrChange(player.ovr, rating);

    // Aplicar distribución por puntos según posición
    final attrsFromPoints = OvrCalculator.calculateAttributeChangesFromPoints(
      player: player,
      ovrChange: ovrChange,
    );

    // Aplicar efectos directos de los tags de rendimiento
    final finalAttrs = OvrCalculator.calculateAttributeChangesFromTags(
      currentAttributes: attrsFromPoints,
      tags: selectedTags,
    );

    final int newOvr = OvrCalculator.computeOvr(finalAttrs);

    // 4. Actualizar estadísticas del jugador
    final newMatchesPlayed = player.stats.matchesPlayed + 1;
    final newAvgRating = player.stats.matchesPlayed > 0
        ? ((player.stats.averageRating * player.stats.matchesPlayed) + rating) / newMatchesPlayed
        : rating;

    batch.update(playerDocRef, {
      'ovr': newOvr,
      'pac': finalAttrs['pac'],
      'sho': finalAttrs['sho'],
      'pas': finalAttrs['pas'],
      'dri': finalAttrs['dri'],
      'def': finalAttrs['def'],
      'phy': finalAttrs['phy'],
      'stats.matchesPlayed': newMatchesPlayed,
      'stats.averageRating': double.parse(newAvgRating.toStringAsFixed(2)),
    });

    // 5. Registrar en subcolección ovrHistory
    final historyRef = playerDocRef.collection('ovrHistory').doc();
    batch.set(historyRef, {
      'oldOVR': player.ovr,
      'newOVR': newOvr,
      'change': newOvr - player.ovr,
      'rating': rating,
      'matchId': matchId,
      'date': DateTime.now().toIso8601String(),
      'attributeChanges': {
        'pac': (finalAttrs['pac'] ?? player.pac) - player.pac,
        'sho': (finalAttrs['sho'] ?? player.sho) - player.sho,
        'pas': (finalAttrs['pas'] ?? player.pas) - player.pas,
        'dri': (finalAttrs['dri'] ?? player.dri) - player.dri,
        'def': (finalAttrs['def'] ?? player.def) - player.def,
        'phy': (finalAttrs['phy'] ?? player.phy) - player.phy,
      },
    });

    // 6. Publicar actividad en el feed social
    final activityRef = _firestore.collection('feedActivities').doc();
    batch.set(activityRef, {
      'type': 'ovr_updated',
      'playerId': targetPlayerId,
      'playerName': player.name,
      'oldOvr': player.ovr,
      'newOvr': newOvr,
      'change': newOvr - player.ovr,
      'matchId': matchId,
      'createdAt': FieldValue.serverTimestamp(),
      'likesCount': 0,
      'commentsCount': 0,
    });

    // Ejecutar todas las mutaciones atómicamente
    await batch.commit();
  }
}
