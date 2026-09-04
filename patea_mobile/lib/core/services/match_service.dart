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
    List<String> selectedTeams = const [],
    Map<String, dynamic>? weather,
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
      // Sin esto el partido nace privado aunque el usuario haya prendido el
      // switch: el parámetro existía y no se mandaba.
      'isPublic': isPublic,
      'players': players,
      'playerUids': playerUids,
      'teams': teams,
      // Sólo para 'by_teams'. Los planteles los resuelve el servidor desde
      // `teams/`: no se manda nada armado desde el cliente.
      if (selectedTeams.isNotEmpty) 'selectedTeams': selectedTeams,
      if (weather != null) 'weather': weather,
    });

    return result['matchId'] as String;
  }

  /// Inicia el partido (estado: active). Vía Cloud Function: ver nota arriba.
  Future<void> startMatch(String matchId) async {
    await callFunction('startMatch', {'matchId': matchId});
  }

  /// Cambia el período del partido, o pausa/reanuda el cronómetro.
  ///
  /// [baseMinute] es el minuto desde el que sigue contando el tramo nuevo, no
  /// el minuto que se muestra. El servidor ancla `periodStartTs` al momento de
  /// la llamada cuando el reloj arranca a correr, y de ahí en más el minuto se
  /// calcula solo. Ver `updateLiveState` en functions/src/callable/
  /// match-lifecycle.ts.
  ///
  /// Antes esto era `updateLiveMinute`, que mandaba un número escrito a mano:
  /// el organizador tenía que apretar "+5 min" y, si cerraba la app, el
  /// partido se quedaba clavado en ese minuto.
  Future<void> updateLiveState({
    required String matchId,
    required String liveStatus,
    required int baseMinute,
    bool paused = false,
  }) async {
    await callFunction('updateLiveState', {
      'matchId': matchId,
      'liveStatus': liveStatus,
      'baseMinute': baseMinute,
      'paused': paused,
    });
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

  /// Pide la crónica del partido.
  ///
  /// La función guarda el resultado en el propio partido, así que la pantalla
  /// no necesita el valor de vuelta: lo va a recibir por el stream. Si ya
  /// estaba escrita la devuelve sin volver a gastar una llamada a la IA.
  Future<void> generateMatchChronicle(String matchId, {bool force = false}) async {
    await callFunction('generateMatchChronicle', {
      'matchId': matchId,
      if (force) 'force': true,
    });
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

  // --- Votación de fecha y cancha (partidos en 'planning') ----------------
  //
  // Un partido creado sin fecha queda en 'planning' con la votación abierta.
  // El móvil ya podía crearlo con el switch "definir después", pero no tenía
  // con qué votarlo: quedaba esperando que alguien entrara por la web.

  Future<void> proposeMatchDate(String matchId, String dateIso, String time) async {
    await callFunction('proposeMatchDate', {'matchId': matchId, 'date': dateIso, 'time': time});
  }

  /// Toggle. La fecha admite votar varias opciones a la vez.
  Future<void> voteMatchDate(String matchId, String proposalId) async {
    await callFunction('voteMatchDate', {'matchId': matchId, 'proposalId': proposalId});
  }

  /// Cierra la votación y deja el partido en 'upcoming' con esa fecha.
  Future<void> confirmMatchDate(String matchId, String proposalId) async {
    await callFunction('confirmMatchDate', {'matchId': matchId, 'proposalId': proposalId});
  }

  Future<void> proposeMatchLocation(String matchId, Map<String, dynamic> location) async {
    await callFunction('proposeMatchLocation', {'matchId': matchId, 'location': location});
  }

  /// Voto único: votar una cancha borra tu voto de las otras.
  Future<void> voteMatchLocation(String matchId, String proposalId) async {
    await callFunction('voteMatchLocation', {'matchId': matchId, 'proposalId': proposalId});
  }

  Future<void> confirmMatchLocation(String matchId, String proposalId) async {
    await callFunction('confirmMatchLocation', {'matchId': matchId, 'proposalId': proposalId});
  }

  /// Mueve jugadores entre los dos equipos.
  ///
  /// Se manda sólo `{uid: 0|1}`: el servidor reconstruye los equipos desde el
  /// plantel del partido, así que desde acá no se puede inventar un jugador.
  Future<void> updateMatchTeams(String matchId, Map<String, int> assignments) async {
    await callFunction('updateMatchTeams', {'matchId': matchId, 'assignments': assignments});
  }

  /// Entra al partido, o pide permiso si el partido lo requiere.
  ///
  /// Devuelve `true` si quedó como solicitud pendiente (hay que esperar al
  /// organizador) y `false` si ya está adentro. Existe para que la tarjeta de
  /// Partidos Abiertos y el detalle del partido no repitan —y con el tiempo
  /// desincronicen— la misma decisión.
  Future<bool> joinOrRequest(MatchModel match, String uid) async {
    if (match.needsApprovalFrom(uid)) {
      await requestJoinMatch(match.id);
      return true;
    }
    await joinMatch(match.id, uid);
    return false;
  }

  /// Pide permiso para entrar a un partido manual ajeno.
  ///
  /// La web decide entre esto y `joinMatch` en use-match-actions.ts:88: si el
  /// partido es 'manual' y no es tuyo, se pide; si es colaborativo, se entra
  /// derecho. El móvil llamaba siempre a `joinMatch`, así que se colaba en
  /// partidos manuales sin que el organizador lo aprobara.
  ///
  /// Devuelve true si la solicitud ya estaba hecha.
  Future<bool> requestJoinMatch(String matchId) async {
    final result = await callFunction('requestJoinMatch', {'matchId': matchId});
    return result['alreadyPending'] == true;
  }

  /// El organizador acepta o rechaza una solicitud.
  Future<void> respondJoinRequest(String matchId, String requesterId, bool accepted) async {
    await callFunction('respondJoinRequest', {
      'matchId': matchId,
      'requesterId': requesterId,
      'accepted': accepted,
    });
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
