import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/team_challenge_model.dart';
import '../models/team_rival_model.dart';
import 'callable_functions.dart';

/// Mínimo de letras para buscar. Con menos no se llama al servidor ni se lista
/// nada: el buscador de rivales no muestra equipos hasta que se escribe.
const int kTeamSearchMinChars = 2;

/// Texto de un error de Cloud Function sin el prefijo `Exception: `.
String challengeErrorMessage(
  Object error, {
  String fallback = 'No se pudo completar. Intentá de nuevo.',
}) {
  final raw = error
      .toString()
      .replaceFirst(RegExp(r'^Exception:\s*'), '')
      .trim();
  if (raw.isEmpty || raw.startsWith('Instance of')) return fallback;
  // Los errores de red/timeout no le sirven a nadie tal cual.
  if (raw.contains('SocketException') || raw.contains('TimeoutException')) {
    return 'No hay conexión. Intentá de nuevo.';
  }
  return raw;
}

final teamChallengeServiceProvider = Provider<TeamChallengeService>(
  (ref) => TeamChallengeService(),
);

/// Desafíos entre equipos de distintos grupos. Todo pasa por Cloud Functions:
/// `teams` e invitaciones no se escriben desde el cliente.
class TeamChallengeService {
  Future<TeamRivalsPage> getTeamRivals(
    String ownTeamId, {
    bool includeHidden = false,
    String? hiddenCursor,
  }) async => TeamRivalsPage.fromMap(
    await callFunction('getTeamRivals', {
      'ownTeamId': ownTeamId,
      'includeHidden': includeHidden,
      'hiddenCursor': ?hiddenCursor,
    }),
  );

  Future<void> setTeamRival(
    String ownTeamId,
    String rivalTeamId, {
    bool? favorite,
    bool? hidden,
    bool save = false,
  }) async {
    await callFunction('setTeamRival', {
      'ownTeamId': ownTeamId,
      'rivalTeamId': rivalTeamId,
      'favorite': ?favorite,
      'hidden': ?hidden,
      if (save) 'save': true,
    });
  }

  /// Busca equipos por nombre (coincidencia por prefijo en cualquier palabra).
  /// Con menos de [kTeamSearchMinChars] letras devuelve vacío sin llamar.
  Future<List<TeamSearchResult>> searchTeams({
    required String query,
    String? excludeTeamId,
    String? excludeGroupId,
  }) async {
    final text = query.trim();
    if (text.length < kTeamSearchMinChars) return const [];
    final result = await callFunction('searchTeams', {
      'query': text,
      if (excludeTeamId != null && excludeTeamId.isNotEmpty)
        'excludeTeamId': excludeTeamId,
      if (excludeGroupId != null && excludeGroupId.isNotEmpty)
        'excludeGroupId': excludeGroupId,
    });
    return ((result['teams'] as List<dynamic>?) ?? const [])
        .map(
          (t) => TeamSearchResult.fromMap((t as Map).cast<String, dynamic>()),
        )
        .where((t) => t.id.isNotEmpty)
        .toList();
  }

  /// Manda el desafío. Devuelve el id de la invitación.
  Future<String> challengeTeam({
    required String fromTeamId,
    required String toTeamId,
    String message = '',
    String? date,
    String? time,
    String? locationName,
  }) async {
    final result = await callFunction('challengeTeam', {
      'fromTeamId': fromTeamId,
      'toTeamId': toTeamId,
      if (message.trim().isNotEmpty) 'message': message.trim(),
      if (date != null && date.isNotEmpty) 'date': date,
      if (time != null && time.isNotEmpty) 'time': time,
      if (locationName != null && locationName.trim().isNotEmpty)
        'locationName': locationName.trim(),
    });
    return (result['invitationId'] as String?) ?? '';
  }

  /// Acepta (crea el partido y devuelve su id) o rechaza (devuelve `null`).
  Future<String?> respondTeamChallenge({
    required String toTeamId,
    required String invitationId,
    required bool accepted,
  }) async {
    final result = await callFunction('respondTeamChallenge', {
      'toTeamId': toTeamId,
      'invitationId': invitationId,
      'accepted': accepted,
    }, timeout: const Duration(seconds: 45));
    return accepted ? result['matchId'] as String? : null;
  }

  Future<List<TeamChallenge>> getMyTeamChallenges() async {
    final result = await callFunction('getMyTeamChallenges', {});
    return ((result['incoming'] as List<dynamic>?) ?? const [])
        .map((c) => TeamChallenge.fromMap((c as Map).cast<String, dynamic>()))
        .where((c) => c.id.isNotEmpty && c.toTeamId.isNotEmpty)
        .toList();
  }

  /// "Recibir desafíos": `optOut = true` saca al equipo del buscador y rechaza
  /// desafíos nuevos.
  Future<void> setTeamChallengeOptOut({
    required String teamId,
    required bool optOut,
  }) async {
    await callFunction('setTeamChallengeOptOut', {
      'teamId': teamId,
      'optOut': optOut,
    });
  }
}

final teamRivalsProvider = FutureProvider.autoDispose
    .family<TeamRivalsPage, (String, bool)>(
      (ref, key) => ref
          .watch(teamChallengeServiceProvider)
          .getTeamRivals(key.$1, includeHidden: key.$2),
    );

final teamRivalSeriesProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>(
      (ref, matchId) =>
          callFunction('getTeamRivalSeries', {'matchId': matchId}),
    );

/// Desafíos pendientes de los equipos que administro. Se vuelve a pedir cada
/// vez que se abre la bandeja (autoDispose) y al invalidarlo después de
/// responder.
final myTeamChallengesProvider =
    FutureProvider.autoDispose<List<TeamChallenge>>(
      (ref) => ref.watch(teamChallengeServiceProvider).getMyTeamChallenges(),
    );
