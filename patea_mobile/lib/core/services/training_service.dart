import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/coach/training_focus.dart';
import 'callable_functions.dart';
import 'firestore_service.dart';

/// El registro de entrenamiento del usuario, de lo más nuevo a lo más viejo.
final trainingLogProvider = StreamProvider.family<List<TrainingEntry>, String>((
  ref,
  uid,
) {
  if (ref.watch(currentUidProvider) == null) return const Stream.empty();
  return FirebaseFirestore.instance
      .collection('players')
      .doc(uid)
      .collection('trainingLog')
      .orderBy('createdAt', descending: true)
      .limit(60)
      .snapshots()
      .map(
        (snap) => [
          for (final doc in snap.docs)
            if (DateTime.tryParse('${doc.data()['createdAt']}') case final at?)
              TrainingEntry('${doc.data()['focusId']}', at.toLocal()),
        ],
      );
});

class TrainingService {
  /// Registra un ejercicio terminado. No toca el OVR.
  Future<void> logSession(String focusId) async {
    await callFunction('logTrainingSession', {'focusId': focusId});
  }
}

final trainingServiceProvider = Provider<TrainingService>(
  (ref) => TrainingService(),
);
