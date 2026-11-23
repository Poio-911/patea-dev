import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/coach_models.dart';
import 'callable_functions.dart';

/// Las ayudas con IA que no son el DT: asistente de la app, resumen del grupo y
/// refuerzos para un partido.
class AiAssistService {
  static const _timeout = Duration(seconds: 90);

  Future<CoachReply> askHelp(String message, List<ChatMessage> history) async =>
      CoachReply.fromMap(
        await callFunction('askAppHelp', {
          'message': message,
          'history': [for (final m in history) m.toWire()],
        }, timeout: _timeout),
      );

  Future<String> groupSummary(String groupId) async {
    final result = await callFunction('getGroupSummary', {
      'groupId': groupId,
    }, timeout: _timeout);
    return result['summary'] as String? ?? '';
  }

  /// Entre [candidateUids], a quiénes conviene llamar para completar el partido.
  Future<List<RecruitRecommendation>> recommendRecruits(
    String matchId,
    List<String> candidateUids,
  ) async {
    final result = await callFunction('recommendRecruits', {
      'matchId': matchId,
      'candidateUids': candidateUids,
    }, timeout: _timeout);
    return [
      for (final r in (result['recommendations'] as List? ?? const []))
        RecruitRecommendation.fromMap(Map<String, dynamic>.from(r as Map)),
    ];
  }
}

final aiAssistServiceProvider = Provider<AiAssistService>(
  (ref) => AiAssistService(),
);

/// Resumen de un grupo. Se pide al mostrar la tarjeta; el servidor lo guarda una
/// semana mientras los datos del grupo no cambien.
final groupSummaryProvider = FutureProvider.autoDispose.family<String, String>(
  (ref, groupId) => ref.watch(aiAssistServiceProvider).groupSummary(groupId),
);
