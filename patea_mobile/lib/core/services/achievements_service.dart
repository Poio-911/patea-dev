import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/achievement_model.dart';
import 'auth_service.dart';
import 'callable_functions.dart';

/// Logros de la persona con sesión. Cada lectura le pide al servidor que
/// revise el progreso y desbloquee lo que corresponda, así que al volver de
/// jugar un partido el logro aparece sin hacer nada más. `autoDispose`: se
/// vuelve a calcular cada vez que se abre la pantalla.
final achievementsProvider = FutureProvider.autoDispose<AchievementsResult>((
  ref,
) async {
  final uid = ref.watch(authStateProvider).value?.uid;
  if (uid == null) return const AchievementsResult([], {});
  final result = await callFunction('syncAchievements', const {});
  return AchievementsResult.fromMap(result);
});
