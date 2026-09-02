import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';
import '../models/match_model.dart';

final matchServiceProvider = Provider<MatchService>((ref) {
  return MatchService();
});

class MatchService {
  /// Crea un partido vía la Cloud Function `createMatch`.
  ///
  /// No se puede escribir 'matches' directo desde el cliente: firestore.rules
  /// tiene `allow create: if false` a propósito (igual que la web, que
  /// siempre pasa por su API route con el Admin SDK) — ver
  /// functions/src/callable/create-match.ts.
  Future<String> createMatch({
    required String title,
    required String type,
    required String ownerUid,
    required int matchSize,
    String date = '',
    String time = '',
    String? groupId,
    String locationName = '',
    String locationAddress = '',
    double locationLat = 0,
    double locationLng = 0,
    String locationPlaceId = '',
    bool isPublic = false,
    List<Map<String, dynamic>> players = const [],
    List<String> playerUids = const [],
    List<dynamic> teams = const [],
  }) async {
    final result = await callFunction('createMatch', {
      'title': title,
      'type': type,
      'matchSize': matchSize,
      'date': date,
      'time': time,
      'locationName': locationName,
      'locationAddress': locationAddress,
      'locationLat': locationLat,
      'locationLng': locationLng,
      'locationPlaceId': locationPlaceId,
      'players': players,
      'playerUids': playerUids,
      'teams': teams,
    });

    return result['matchId'] as String;
  }

  /// Inicia el partido (estado: active). Vía Cloud Function: ver nota arriba.
  Future<void> startMatch(String matchId) async {
    await callFunction('startMatch', {'matchId': matchId});
  }

  /// Actualiza el minuto en vivo y el estado del tiempo.
  Future<void> updateLiveMinute(String matchId, int minute, String liveStatus) async {
    await callFunction('updateLiveMinute', {'matchId': matchId, 'minute': minute, 'liveStatus': liveStatus});
  }

  /// Registra un evento en vivo (gol, tarjeta, sustitución, etc.) y actualiza el marcador.
  Future<void> recordLiveEvent({
    required String matchId,
    required MatchEvent event,
    int? teamAScore,
    int? teamBScore,
  }) async {
    await callFunction('recordLiveEvent', {
      'matchId': matchId,
      'event': event.toMap(),
      if (teamAScore != null) 'teamAScore': teamAScore,
      if (teamBScore != null) 'teamBScore': teamBScore,
    });
  }

  /// Finaliza el partido (estado: completed). No recibe score: el marcador
  /// final ya quedó guardado en `teams[].score` vía los eventos en vivo
  /// (recordLiveEvent). Igual que `finishMatchAction` en la web, esto además
  /// genera los equipos con IA si todavía no existen y genera las
  /// asignaciones de evaluación de pares.
  Future<void> finishMatch(String matchId) async {
    await callFunction('finishMatch', {'matchId': matchId});
  }

  /// Finaliza en lote partidos vencidos que quedaron en 'upcoming'
  /// (PendingFinalizationDialog en la web).
  Future<int> finalizePendingMatches(List<String> matchIds) async {
    final result = await callFunction('finalizePendingMatches', {'matchIds': matchIds});
    return (result['finalizedCount'] as num?)?.toInt() ?? 0;
  }

  /// Unirse a un partido colaborativo/manual.
  Future<void> joinMatch(String matchId, String playerId) async {
    await callFunction('joinMatch', {'matchId': matchId});
  }

  /// Darse de baja de un partido colaborativo/manual.
  Future<void> leaveMatch(String matchId, String playerId) async {
    await callFunction('leaveMatch', {'matchId': matchId});
  }

  /// Elimina el partido (solo el organizador). Port de deleteMatchAction.
  Future<void> deleteMatch(String matchId) async {
    await callFunction('deleteMatch', {'matchId': matchId});
  }

  /// Reprograma fecha/hora (solo el organizador). Port de updateMatchDateAction.
  Future<void> updateMatchDate(String matchId, String date, String time) async {
    await callFunction('updateMatchDate', {'matchId': matchId, 'date': date, 'time': time});
  }

  /// Cambia la cancha (solo el organizador). Port de updateMatchLocationAction.
  Future<void> updateMatchLocation({
    required String matchId,
    required String locationName,
    String locationAddress = '',
    double locationLat = 0,
    double locationLng = 0,
    String locationPlaceId = '',
  }) async {
    await callFunction('updateMatchLocation', {
      'matchId': matchId,
      'locationName': locationName,
      'locationAddress': locationAddress,
      'locationLat': locationLat,
      'locationLng': locationLng,
      'locationPlaceId': locationPlaceId,
    });
  }

  /// Vuelve a sortear los equipos con IA (solo el organizador). Port de
  /// shuffleMatchTeamsAction. Gemini en frío puede tardar 30s+, igual que
  /// generateBalancedTeams — mismo timeout ampliado.
  Future<void> shuffleTeams(String matchId) async {
    await callFunction('shuffleTeams', {'matchId': matchId}, timeout: const Duration(seconds: 60));
  }
}
