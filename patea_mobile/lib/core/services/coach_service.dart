import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/coach_models.dart';
import 'auth_service.dart';
import 'callable_functions.dart';

/// El mensaje de un error de servidor, sin el prefijo `Exception:`.
String coachErrorMessage(Object error) {
  final text = '$error';
  return text.startsWith('Exception: ') ? text.substring(11) : text;
}

class CoachService {
  /// Las llamadas a la IA tardan más que el resto: se les da margen.
  static const _timeout = Duration(seconds: 90);

  Future<AnalysisResult> analysis() async => AnalysisResult.fromMap(
    await callFunction('getPlayerAnalysis', const {}, timeout: _timeout),
  );

  /// [history] son los turnos anteriores; el servidor se queda con los últimos.
  Future<CoachReply> chat(String message, List<ChatMessage> history) async =>
      CoachReply.fromMap(
        await callFunction('coachChat', {
          'message': message,
          'history': [for (final m in history) m.toWire()],
        }, timeout: _timeout),
      );
}

final coachServiceProvider = Provider<CoachService>((ref) => CoachService());

/// Análisis de la persona con sesión. Se pide al abrir la pantalla; si sus datos
/// no cambiaron, el servidor devuelve el de antes sin gastar IA.
final playerAnalysisProvider = FutureProvider.autoDispose<AnalysisResult>((
  ref,
) async {
  if (ref.watch(authStateProvider).value == null) {
    return const AnalysisResult(null);
  }
  return ref.watch(coachServiceProvider).analysis();
});
