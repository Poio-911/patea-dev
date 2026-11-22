import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/player_model.dart';
import '../models/match_model.dart';
import '../models/competition_model.dart';
import '../models/group_model.dart';
import '../models/venue_model.dart';
import '../models/evaluation_models.dart';
import '../utils/photo_url.dart';
import 'auth_service.dart';

/// Ojo con la dependencia de abajo: NO es decorativa.
///
/// Todo stream de Firestore tiene que colgar de la sesión. Al cerrar sesión
/// las pantallas siguen montadas un instante y sus listeners salen sin token;
/// Firestore los rechaza con permission-denied y **no los reintenta** — da el
/// listener por terminado. Riverpod cachea ese error, y como estos providers
/// no dependían de la sesión, al entrar el usuario siguiente nadie los volvía
/// a crear: la app quedaba mostrando "permission denied" en TODAS las
/// pantallas hasta reiniciarla. Bug real, encontrado cambiando de usuario
/// (2026-09-04).
///
/// Al observar el uid, este provider se reconstruye en cada cambio de sesión
/// y con él los 20 streams que lo usan: se cancelan los viejos y se abren
/// nuevos con la sesión nueva.
final firestoreServiceProvider = Provider<FirestoreService>((ref) {
  ref.watch(currentUidProvider);
  return FirestoreService(FirebaseFirestore.instance);
});

/// Límites por defecto de las consultas.
///
/// Hasta 2026-09-03 los streams de `players` y `matches` no tenían ni filtro
/// obligatorio ni `limit`: cuatro pantallas los pedían con `groupId = null` y
/// eso abría un `onSnapshot` sobre la colección ENTERA de la plataforma —
/// incluidos los jugadores y partidos de grupos ajenos, que además nunca se
/// mostraban. El costo por usuario crecía con el total de usuarios de la app.
class QueryLimits {
  static const int players = 200;
  static const int matches = 100;
  static const int competitions = 50;
  static const int publicMatches = 50;
}

/// UID del usuario actual, o null. Sincrónico respecto al stream de auth.
final currentUidProvider = Provider<String?>((ref) {
  return ref.watch(authStateProvider).value?.uid;
});

/// Grupo activo del usuario actual.
///
/// Es el equivalente de `user.activeGroupId` en la web: `players/page.tsx:44`
/// directamente no arma la query si no hay grupo activo, y muestra un estado
/// vacío. Acá se replica lo mismo — sin grupo activo no se lee nada.
final activeGroupIdProvider = Provider<AsyncValue<String?>>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return const AsyncValue.data(null);
  return ref.watch(activeGroupIdStreamProvider(uid));
});

// Streams
final playersStreamProvider = StreamProvider.family<List<PlayerModel>, String?>((ref, groupId) {
  final uid = ref.watch(currentUidProvider);
  final authPhoto = ref.watch(currentAuthPhotoUrlProvider);
  return ref.watch(firestoreServiceProvider).getResolvedPlayersStream(
    groupId: groupId,
    currentUid: uid,
    currentAuthPhotoUrl: authPhoto,
  );
});

/// Jugadores del grupo activo — la forma que deberían usar las pantallas.
/// Resuelve el grupo por sí solo en vez de recibir `null` y leer todo.
///
/// Mientras el grupo activo todavía se está resolviendo NO devuelve lista
/// vacía: se queda en `loading`. Si no, la pantalla mostraba "No hay
/// jugadores" durante un instante en cada apertura, como si el grupo estuviera
/// vacío — un estado vacío falso.
final activeGroupPlayersProvider = StreamProvider<List<PlayerModel>>((ref) {
  final groupAsync = ref.watch(activeGroupIdProvider);
  if (groupAsync.isLoading) return const Stream<List<PlayerModel>>.empty();
  final uid = ref.watch(currentUidProvider);
  final authPhoto = ref.watch(currentAuthPhotoUrlProvider);
  return ref.watch(firestoreServiceProvider).getResolvedPlayersStream(
    groupId: groupAsync.value,
    currentUid: uid,
    currentAuthPhotoUrl: authPhoto,
  );
});

/// Partidos del grupo activo. Mismo criterio de carga que los jugadores.
final activeGroupMatchesProvider = StreamProvider<List<MatchModel>>((ref) {
  final groupAsync = ref.watch(activeGroupIdProvider);
  if (groupAsync.isLoading) return const Stream<List<MatchModel>>.empty();
  return ref
      .watch(firestoreServiceProvider)
      .getMatchesStream(
        groupId: groupAsync.value,
        uid: ref.watch(currentUidProvider),
      );
});

final userDisplayNameProvider = FutureProvider.family<String?, String>((
  ref,
  uid,
) async {
  if (uid.isEmpty) return null;
  final data = await ref.watch(firestoreServiceProvider).getUserProfile(uid);
  final name =
      (data?['displayName'] as String?) ?? (data?['name'] as String?);
  if (name == null) return null;
  final trimmed = name.trim();
  return trimmed.isEmpty ? null : trimmed;
});

final singlePlayerStreamProvider = StreamProvider.family<PlayerModel?, String>((ref, playerId) {
  final uid = ref.watch(currentUidProvider);
  final authPhoto = ref.watch(currentAuthPhotoUrlProvider);
  return ref.watch(firestoreServiceProvider).getResolvedPlayerStream(
    playerId,
    currentUid: uid,
    currentAuthPhotoUrl: authPhoto,
  );
});

final ovrHistoryStreamProvider = StreamProvider.family<List<OvrHistoryEntry>, String>((ref, playerId) {
  return ref.watch(firestoreServiceProvider).getOvrHistoryStream(playerId);
});

final singleGroupStreamProvider = StreamProvider.family<GroupModel?, String>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getGroupStream(groupId);
});

/// `users/{uid}.activeGroupId` — la web lo trae embebido en el objeto `user`
/// (custom claims/perfil fusionado), acá se lee directo del doc de Firestore.
final activeGroupIdStreamProvider = StreamProvider.family<String?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getActiveGroupIdStream(uid);
});

/// `groups` donde `members` contiene al uid — para elegir grupo activo.
final userGroupsStreamProvider = StreamProvider.family<List<GroupModel>, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getUserGroupsStream(uid);
});

final groupTeamsStreamProvider = StreamProvider.family<List<GroupTeamModel>, String>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getGroupTeamsStream(groupId);
});

final groupVenuesStreamProvider = StreamProvider.family<List<VenueModel>, String>((ref, groupId) {
  return ref.watch(firestoreServiceProvider).getGroupVenuesStream(groupId);
});

final singleTeamStreamProvider = StreamProvider.family<GroupTeamModel?, String>((ref, teamId) {
  return ref.watch(firestoreServiceProvider).getTeamStream(teamId);
});

final matchesStreamProvider = StreamProvider.family<List<MatchModel>, String?>((ref, groupId) {
  return ref
      .watch(firestoreServiceProvider)
      .getMatchesStream(groupId: groupId, uid: ref.watch(currentUidProvider));
});

final singleMatchStreamProvider = StreamProvider.family<MatchModel?, String>((ref, matchId) {
  return ref.watch(firestoreServiceProvider).getMatchStream(matchId);
});

/// Port de getPublicMatchesAction — a diferencia de esa server action (Admin
/// SDK), esto es una query directa: `matches` permite `read` a cualquier
/// autenticado, solo los writes están bloqueados.
final publicMatchesStreamProvider = StreamProvider<List<MatchModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getPublicMatchesStream();
});

final myAvailabilityStreamProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getAvailablePlayerDocStream(uid);
});

final savedLocationStreamProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getSavedLocationStream(uid);
});

/// Only organizers can recruit; participating is not enough.
final ownedUpcomingMatchesProvider = StreamProvider.family<List<MatchModel>, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getOwnedUpcomingMatchesStream(uid);
});

final userUpcomingMatchesStreamProvider = StreamProvider.family<List<MatchModel>, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getUserUpcomingMatchesStream(uid);
});

/// Todos los assignments de un partido (para la pantalla de finalizar
/// evaluación del organizador — progreso X/Y evaluadores).
final matchAssignmentsStreamProvider = StreamProvider.family<List<EvaluationAssignmentModel>, String>((ref, matchId) {
  return ref.watch(firestoreServiceProvider).getMatchAssignmentsStream(matchId);
});

/// Perfil crudo de un usuario — hoy sólo para "organiza: X" en las tarjetas
/// de partido.
///
/// Estaba tres veces escrito como `FirebaseFirestore.instance...get()` dentro
/// de un `FutureBuilder`, que era la única forma en la app de leer Firestore
/// sin pasar por acá. Tres problemas de una: una lectura por tarjeta y otra
/// en cada rebuild (`Future` nuevo cada vez, sin caché), ninguna atadura a la
/// sesión —lo que explica el comentario de arriba—, y ninguna forma de montar
/// la pantalla en un test sin Firebase.
final userProfileProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, uid) {
  return ref.watch(firestoreServiceProvider).getUserProfile(uid);
});

/// El feed de Comunidad.
final feedActivitiesStreamProvider =
    StreamProvider<List<Map<String, dynamic>>>((ref) {
  // Las novedades son del grupo activo: sin grupo no hay nada que mostrar.
  final group = ref.watch(activeGroupIdProvider);
  if (group.isLoading) return const Stream<List<Map<String, dynamic>>>.empty();
  return ref
      .watch(firestoreServiceProvider)
      .getFeedActivitiesStream(groupId: group.asData?.value);
});

final leaguesStreamProvider = StreamProvider<List<CompetitionModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getCompetitionsStream(type: 'leagues');
});

final cupsStreamProvider = StreamProvider<List<CompetitionModel>>((ref) {
  return ref.watch(firestoreServiceProvider).getCompetitionsStream(type: 'cups');
});

class FirestoreService {
  final FirebaseFirestore _firestore;

  FirestoreService(this._firestore);

  // Jugadores
  //
  // Sin `groupId` NO se consulta nada: se devuelve una lista vacía sin abrir
  // listener. Es exactamente lo que hace la web (`players/page.tsx:44`
  // devuelve `null` como query cuando no hay `activeGroupId`). Antes, `null`
  // significaba "traé la colección entera".
  //
  // Ordena y limita en el servidor usando el índice `groupId ASC, ovr DESC`
  // que ya existe en firestore.indexes.json.
  Stream<List<PlayerModel>> getPlayersStream({
    String? groupId,
    int limit = QueryLimits.players,
  }) {
    if (groupId == null || groupId.isEmpty) {
      return Stream.value(const <PlayerModel>[]);
    }
    return _firestore
        .collection('players')
        .where('groupId', isEqualTo: groupId)
        .orderBy('ovr', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => PlayerModel.fromFirestore(doc.data(), doc.id))
            .toList());
  }

  Stream<PlayerModel?> getPlayerStream(String playerId) {
    return _firestore.collection('players').doc(playerId).snapshots().asyncMap((
      doc,
    ) async {
      if (!doc.exists || doc.data() == null) return null;
      final claimedBy = doc.data()!['claimedBy'];
      if (claimedBy is String &&
          claimedBy.isNotEmpty &&
          claimedBy != playerId) {
        final linked = await _firestore
            .collection('players')
            .doc(claimedBy)
            .get();
        if (linked.exists && linked.data() != null)
          return PlayerModel.fromFirestore(linked.data()!, linked.id);
      }
      return PlayerModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  /// Maps `uid -> photoURL` for members of [groupId] so linked player cards
  /// match user avatars when `players/{uid}.photoUrl` is absent (matching web).
  Stream<Map<String, String>> getGroupUserPhotosStream(String? groupId) {
    if (groupId == null || groupId.isEmpty) {
      return Stream.value(const <String, String>{});
    }
    return _firestore
        .collection('users')
        .where('groups', arrayContains: groupId)
        .limit(QueryLimits.players)
        .snapshots()
        .map((snap) {
          final photos = <String, String>{};
          for (final doc in snap.docs) {
            final url = nonEmptyPhotoUrl(doc.data()['photoURL'] as String?);
            if (url != null) photos[doc.id] = url;
          }
          return photos;
        });
  }

  Stream<String?> getUserPhotoStream(String uid) {
    return _firestore
        .collection('users')
        .doc(uid)
        .snapshots()
        .map((doc) => nonEmptyPhotoUrl(doc.data()?['photoURL'] as String?));
  }

  /// Combines group players with linked `users/{uid}.photoURL` (and Auth photo for
  /// the signed-in user) without blocking on fallback failures.
  Stream<List<PlayerModel>> getResolvedPlayersStream({
    String? groupId,
    int limit = QueryLimits.players,
    String? currentUid,
    String? currentAuthPhotoUrl,
  }) {
    final controller = StreamController<List<PlayerModel>>();
    List<PlayerModel>? latestPlayers;
    var latestUserPhotos = const <String, String>{};

    void emit() {
      final players = latestPlayers;
      if (players == null || controller.isClosed) return;
      controller.add([
        for (final p in players)
          p.withFallbackPhoto(
            latestUserPhotos[p.id] ??
                (p.id == currentUid ? nonEmptyPhotoUrl(currentAuthPhotoUrl) : null),
          ),
      ]);
    }

    final playersSub = getPlayersStream(groupId: groupId, limit: limit).listen(
      (players) {
        latestPlayers = players;
        emit();
      },
      onError: (Object error, StackTrace stack) {
        if (!controller.isClosed) controller.addError(error, stack);
      },
    );

    final userPhotosSub = getGroupUserPhotosStream(groupId).listen(
      (photos) {
        latestUserPhotos = photos;
        emit();
      },
      onError: (_, _) {
        // Fallback photos are best-effort; keep roster streaming on failure.
      },
    );

    controller.onCancel = () async {
      await playersSub.cancel();
      await userPhotosSub.cancel();
    };
    return controller.stream;
  }

  /// Resolves missing photo on a linked player lazily from `users/{playerId}`
  /// or [currentAuthPhotoUrl] without extra reads when `player.photoUrl` exists.
  Stream<PlayerModel?> getResolvedPlayerStream(
    String playerId, {
    String? currentUid,
    String? currentAuthPhotoUrl,
  }) {
    final controller = StreamController<PlayerModel?>();
    PlayerModel? latestPlayer;
    String? latestUserPhoto;
    StreamSubscription<String?>? userSub;

    void emit() {
      if (controller.isClosed) return;
      final player = latestPlayer;
      if (player == null) {
        controller.add(null);
        return;
      }
      final fallback =
          latestUserPhoto ??
          (player.id == currentUid ? nonEmptyPhotoUrl(currentAuthPhotoUrl) : null);
      controller.add(player.withFallbackPhoto(fallback));
    }

    final playerSub = getPlayerStream(playerId).listen(
      (player) {
        latestPlayer = player;
        final needsUserFallback =
            player != null &&
            player.hasAccount &&
            nonEmptyPhotoUrl(player.photoUrl) == null;
        if (!needsUserFallback) {
          userSub?.cancel();
          userSub = null;
          latestUserPhoto = null;
        } else {
          userSub ??= getUserPhotoStream(playerId).listen(
            (url) {
              latestUserPhoto = url;
              emit();
            },
            onError: (_, _) {},
          );
        }
        emit();
      },
      onError: (Object error, StackTrace stack) {
        if (!controller.isClosed) controller.addError(error, stack);
      },
    );

    controller.onCancel = () async {
      await playerSub.cancel();
      await userSub?.cancel();
    };
    return controller.stream;
  }

  Stream<List<OvrHistoryEntry>> getOvrHistoryStream(String playerId) {
    return _firestore
        .collection('players/$playerId/ovrHistory')
        .orderBy('date')
        .snapshots()
        .map((snap) => snap.docs.map((d) => OvrHistoryEntry.fromMap(d.data())).toList());
  }

  Stream<GroupModel?> getGroupStream(String groupId) {
    return _firestore.collection('groups').doc(groupId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return GroupModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  Stream<String?> getActiveGroupIdStream(String uid) {
    return _firestore.collection('users').doc(uid).snapshots().map((doc) => doc.data()?['activeGroupId'] as String?);
  }

  Stream<List<GroupModel>> getUserGroupsStream(String uid) {
    return _firestore
        .collection('groups')
        .where('members', arrayContains: uid)
        .snapshots()
        .map((snap) => snap.docs.map((d) => GroupModel.fromFirestore(d.data(), d.id)).toList());
  }

  Stream<List<GroupTeamModel>> getGroupTeamsStream(String groupId) {
    return _firestore
        .collection('teams')
        .where('groupId', isEqualTo: groupId)
        .snapshots()
        .map((snap) => snap.docs.map((d) => GroupTeamModel.fromMap(d.data(), d.id)).toList());
  }

  /// Canchas guardadas del grupo en `venues/`. Se ordenan en cliente por
  /// `usageCount` desc y `lastUsedAt` desc para no requerir índice compuesto.
  Stream<List<VenueModel>> getGroupVenuesStream(String groupId) {
    if (groupId.isEmpty) return Stream.value(const []);
    return _firestore
        .collection('venues')
        .where('groupId', isEqualTo: groupId)
        .snapshots()
        .map((snap) {
          final list = snap.docs
              .map((d) => VenueModel.fromFirestore(d.data(), d.id))
              .where((v) => v.name.isNotEmpty)
              .toList();
          list.sort((a, b) {
            final cmp = b.usageCount.compareTo(a.usageCount);
            if (cmp != 0) return cmp;
            return (b.lastUsedAt ?? '').compareTo(a.lastUsedAt ?? '');
          });
          return list;
        });
  }

  Stream<GroupTeamModel?> getTeamStream(String teamId) {
    return _firestore.collection('teams').doc(teamId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return GroupTeamModel.fromMap(doc.data()!, doc.id);
    });
  }

  // Partidos — mismo criterio que jugadores.
  // Usa el índice `groupId ASC, date DESC`, ya existente.
  Stream<List<MatchModel>> getMatchesStream({
    String? groupId,
    String? uid,
    int limit = QueryLimits.matches,
  }) {
    if (groupId == null || groupId.isEmpty) {
      return Stream.value(const <MatchModel>[]);
    }
    final own = _firestore
        .collection('matches')
        .where('groupId', isEqualTo: groupId)
        .orderBy('date', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MatchModel.fromFirestore(doc.data(), doc.id))
            .toList());

    // Un partido entre grupos distintos se guarda con el `groupId` de UN solo
    // equipo: el otro grupo lo ve por `secondaryGroupId` (las reglas no pueden
    // consultar el arreglo `participantGroupIds`). Índice `secondaryGroupId +
    // date DESC`.
    final shared = _firestore
        .collection('matches')
        .where('secondaryGroupId', isEqualTo: groupId)
        .orderBy('date', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MatchModel.fromFirestore(doc.data(), doc.id))
            .toList());

    final groupMatches = mergeMatchLists(own, shared, limit: limit);
    if (uid == null || uid.isEmpty) return groupMatches;

    // Los partidos en los que estoy anotado aunque sean de otro grupo (un
    // desafío, un partido de un amigo). Sin orderBy: no necesita otro índice;
    // el orden lo pone la mezcla.
    final mine = _firestore
        .collection('matches')
        .where('playerUids', arrayContains: uid)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MatchModel.fromFirestore(doc.data(), doc.id))
            .toList());
    return mergeMatchLists(groupMatches, mine, limit: limit);
  }

  Stream<MatchModel?> getMatchStream(String matchId) {
    return _firestore.collection('matches').doc(matchId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return MatchModel.fromFirestore(doc.data()!, doc.id);
    });
  }

  Stream<List<MatchModel>> getPublicMatchesStream() {
    final now = DateTime.now();
    final today = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return _firestore
        .collection('matches')
        .where('status', isEqualTo: 'upcoming')
        .where('isPublic', isEqualTo: true)
        .where('date', isGreaterThanOrEqualTo: today)
        .orderBy('date')
        .limit(50)
        .snapshots()
        .map((snap) => snap.docs.map((d) => MatchModel.fromFirestore(d.data(), d.id)).toList());
  }

  Stream<Map<String, dynamic>?> getAvailablePlayerDocStream(String uid) {
    return _firestore.collection('availablePlayers').doc(uid).snapshots().map((doc) => doc.data());
  }

  Stream<Map<String, dynamic>?> getSavedLocationStream(String uid) {
    return _firestore.collection('users').doc(uid).snapshots().map((doc) => doc.data()?['savedLocation'] as Map<String, dynamic>?);
  }

  Stream<List<MatchModel>> getOwnedUpcomingMatchesStream(String uid) {
    return _firestore.collection('matches')
        .where('ownerUid', isEqualTo: uid)
        .where('status', isEqualTo: 'upcoming')
        .limit(QueryLimits.matches).snapshots()
        .map((snap) => snap.docs.map((d) => MatchModel.fromFirestore(d.data(), d.id)).toList());
  }

  Future<bool> hasPendingMatchInvitation(String matchId, String playerId) async {
    final snap = await _firestore.collection('matches').doc(matchId)
        .collection('invitations').where('playerId', isEqualTo: playerId)
        .where('status', isEqualTo: 'pending').limit(1).get();
    return snap.docs.isNotEmpty;
  }

  Stream<List<MatchModel>> getUserUpcomingMatchesStream(String uid) {
    return _firestore
        .collection('matches')
        .where('playerUids', arrayContains: uid)
        .where('status', isEqualTo: 'upcoming')
        .snapshots()
        .map((snap) => snap.docs.map((d) => MatchModel.fromFirestore(d.data(), d.id)).toList());
  }

  /// `users/{uid}` crudo. Sólo se usa para el nombre y la foto de quien
  /// organiza un partido, que no tienen modelo propio.
  Future<Map<String, dynamic>?> getUserProfile(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    return doc.data();
  }

  /// El feed de Comunidad. Los documentos van crudos porque todavía no hay un
  /// modelo: la pantalla lee `type`, `playerName`, `change` y `newOvr`.
  Stream<List<Map<String, dynamic>>> getFeedActivitiesStream({
    String? groupId,
  }) {
    if (groupId == null || groupId.isEmpty) return Stream.value(const []);
    return _firestore
        .collection('feedActivities')
        .where('groupId', isEqualTo: groupId)
        .orderBy('createdAt', descending: true)
        .limit(25)
        .snapshots()
        .map((snap) => snap.docs.map((d) => d.data()).toList());
  }

  Stream<List<EvaluationAssignmentModel>> getMatchAssignmentsStream(String matchId) {
    return _firestore
        .collection('matches/$matchId/assignments')
        .snapshots()
        .map((snap) => snap.docs.map((d) => EvaluationAssignmentModel.fromMap(d.data(), d.id)).toList());
  }

  // Competiciones (Ligas y Copas) — acotadas, antes traían la colección entera.
  Stream<List<CompetitionModel>> getCompetitionsStream({
    required String type,
    int limit = QueryLimits.competitions,
  }) {
    return _firestore.collection(type).limit(limit).snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return CompetitionModel.fromFirestore(
          doc.data(),
          doc.id,
          type == 'leagues' ? 'league' : 'cup',
        );
      }).toList();
    });
  }

  Stream<CompetitionModel?> getSingleCompetitionStream({
    required String id,
    required String collection,
  }) {
    return _firestore.collection(collection).doc(id).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return CompetitionModel.fromFirestore(
        doc.data()!,
        doc.id,
        collection == 'leagues' ? 'league' : 'cup',
      );
    });
  }
}

/// Une los partidos del grupo con los que comparte con otro grupo.
///
/// [primary] manda: la lista se emite apenas llega, sin esperar a [secondary].
/// Si [secondary] falla —por ejemplo, el índice todavía no está desplegado— se
/// la trata como vacía en vez de romper la lista del grupo. Sin repetidos
/// (un partido entre dos equipos del mismo grupo aparece en las dos), de más
/// nuevo a más viejo.
Stream<List<MatchModel>> mergeMatchLists(
  Stream<List<MatchModel>> primary,
  Stream<List<MatchModel>> secondary, {
  int limit = 50,
}) {
  late final StreamController<List<MatchModel>> controller;
  StreamSubscription<List<MatchModel>>? primarySub;
  StreamSubscription<List<MatchModel>>? secondarySub;
  List<MatchModel>? latestPrimary;
  List<MatchModel> latestSecondary = const [];
  var primaryDone = false;
  var secondaryDone = false;

  void closeWhenDone() {
    if (primaryDone && secondaryDone && !controller.isClosed) {
      controller.close();
    }
  }

  void emit() {
    final first = latestPrimary;
    if (first == null || controller.isClosed) return;
    final byId = <String, MatchModel>{
      for (final match in first) match.id: match,
    };
    for (final match in latestSecondary) {
      byId.putIfAbsent(match.id, () => match);
    }
    final merged = byId.values.toList()
      ..sort((a, b) {
        final byDate = b.date.compareTo(a.date);
        return byDate != 0 ? byDate : a.id.compareTo(b.id);
      });
    controller.add(merged.length > limit ? merged.sublist(0, limit) : merged);
  }

  controller = StreamController<List<MatchModel>>(
    onListen: () {
      primarySub = primary.listen(
        (value) {
          latestPrimary = value;
          emit();
        },
        onError: controller.addError,
        onDone: () {
          primaryDone = true;
          closeWhenDone();
        },
      );
      secondarySub = secondary.listen(
        (value) {
          latestSecondary = value;
          emit();
        },
        onError: (Object _) {
          latestSecondary = const [];
          emit();
        },
        onDone: () {
          secondaryDone = true;
          closeWhenDone();
        },
      );
    },
    onCancel: () async {
      await primarySub?.cancel();
      await secondarySub?.cancel();
    },
  );
  return controller.stream;
}
