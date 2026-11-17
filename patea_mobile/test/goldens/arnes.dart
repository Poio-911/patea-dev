/// El arnés de providers que faltaba para poder montar una pantalla entera.
///
/// Los goldens del sistema de diseño (`design_system_test.dart`) cubren los
/// tokens y los componentes compartidos, pero no las pantallas: cada una
/// cuelga de Riverpod y de Firestore, y sin sobrescribir sus providers ni
/// siquiera se puede llamar a `pumpWidget`. Esto es ese arnés — datos falsos
/// fijos y una lista de overrides que sirve para todas.
///
/// **Los datos son deterministas a propósito.** Nada de `DateTime.now()` ni
/// nombres al azar: un golden que cambia con el reloj no es un golden. Las
/// fechas y el reloj de las pantallas se fijan en septiembre de 2026 para
/// que los partidos próximos no pasen al historial al cambiar el día real.
///
/// **Hay un nombre largo y un OVR de tres cifras a propósito.** El arnés no
/// sirve sólo para sacar la foto: la pasada a 1,3× de escala de texto es la
/// que encuentra los `height:` fijos que recortan, y para eso el contenido
/// tiene que ser incómodo, no cómodo.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:patea_mobile/core/models/player_activity_models.dart';
import 'package:patea_mobile/core/services/player_profile_service.dart';

import 'package:patea_mobile/core/services/match_result_service.dart';
import 'package:patea_mobile/core/services/match_presence_service.dart';
import 'package:patea_mobile/core/services/match_chat_service.dart';

import 'package:cloud_firestore/cloud_firestore.dart'
    show FirebaseFirestore, DocumentSnapshot;
import 'package:firebase_auth/firebase_auth.dart' show User;
import 'package:patea_mobile/core/services/competition_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:patea_mobile/core/models/available_player_model.dart';
import 'package:patea_mobile/core/models/competition_model.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/models/group_permissions.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/evaluation_service.dart';
import 'package:patea_mobile/core/services/explore_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/group_service.dart';
import 'package:patea_mobile/core/services/match_clips_service.dart';
import 'package:patea_mobile/core/widgets/patea_background.dart';
import 'package:patea_mobile/core/utils/clock.dart';
import 'package:patea_mobile/features/matches/widgets/join_requests_section.dart';

const String uidYo = 'uid-yo';
const String idGrupo = 'grp-1';
const String idPartido = 'match-1';

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

/// El plantel. Nueve jugadores, uno de ellos el usuario de la sesión.
///
/// `photoUrl` va en null en todos: en un test las imágenes de red no cargan y
/// lo que quedaría en el golden es el error, no el avatar. Los avatares por
/// iniciales sí son lo que la app dibuja cuando no hay foto, así que el
/// golden muestra un estado real.
final List<PlayerModel> jugadores = [
  PlayerModel(
    id: uidYo,
    name: 'Santiago Fernández',
    position: 'MED',
    ovr: 82,
    pac: 78,
    sho: 74,
    pas: 86,
    dri: 83,
    def: 71,
    phy: 76,
    groupId: idGrupo,
    ownerUid: uidYo,
    preferredFoot: 'derecho',
    birthYear: 1994,
    nationality: 'Uruguay',
    bio: 'Volante central. Juega los sábados desde 2011.',
    stats: PlayerStats(
      matchesPlayed: 48,
      goals: 12,
      assists: 21,
      averageRating: 7.4,
      mvpCount: 5,
    ),
  ),
  PlayerModel(
    id: 'uid-2',
    // Largo a propósito: es el que se recorta primero cuando alguien agranda
    // la letra del sistema.
    name: 'Juan Ignacio Rodríguez Etchegaray',
    position: 'DEL',
    ovr: 91,
    pac: 94,
    sho: 92,
    pas: 78,
    dri: 90,
    def: 42,
    phy: 80,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 52,
      goals: 61,
      assists: 18,
      averageRating: 8.1,
      mvpCount: 14,
    ),
  ),
  PlayerModel(
    id: 'uid-3',
    name: 'Nicolás Gómez',
    position: 'DEF',
    ovr: 78,
    pac: 70,
    sho: 45,
    pas: 68,
    dri: 62,
    def: 85,
    phy: 84,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 40,
      goals: 3,
      assists: 6,
      averageRating: 7.0,
    ),
  ),
  PlayerModel(
    id: 'uid-4',
    name: 'Mateo Rossi',
    position: 'MED',
    ovr: 74,
    pac: 72,
    sho: 66,
    pas: 79,
    dri: 75,
    def: 64,
    phy: 68,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 33,
      goals: 9,
      assists: 14,
      averageRating: 6.8,
    ),
  ),
  PlayerModel(
    id: 'uid-5',
    name: 'Diego Píriz',
    position: 'POR',
    ovr: 69,
    pac: 55,
    sho: 30,
    pas: 52,
    dri: 48,
    def: 72,
    phy: 74,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 29,
      goals: 0,
      assists: 1,
      averageRating: 6.9,
    ),
  ),
  PlayerModel(
    id: 'uid-6',
    name: 'Facundo Bentancur',
    position: 'DEL',
    ovr: 86,
    pac: 88,
    sho: 87,
    pas: 72,
    dri: 85,
    def: 38,
    phy: 77,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 44,
      goals: 47,
      assists: 11,
      averageRating: 7.9,
      mvpCount: 9,
    ),
  ),
  PlayerModel(
    id: 'uid-7',
    name: 'Bruno Cardozo',
    position: 'DEF',
    ovr: 63,
    pac: 61,
    sho: 38,
    pas: 55,
    dri: 52,
    def: 70,
    phy: 72,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 18,
      goals: 1,
      assists: 2,
      averageRating: 6.2,
    ),
  ),
  PlayerModel(
    id: 'uid-8',
    name: 'Emiliano Sosa',
    position: 'MED',
    ovr: 71,
    pac: 69,
    sho: 60,
    pas: 74,
    dri: 70,
    def: 66,
    phy: 65,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 25,
      goals: 5,
      assists: 9,
      averageRating: 6.7,
    ),
  ),
  PlayerModel(
    id: 'uid-9',
    name: 'Álvaro Da Silva',
    position: 'DEL',
    ovr: 58,
    pac: 64,
    sho: 57,
    pas: 50,
    dri: 59,
    def: 33,
    phy: 61,
    groupId: idGrupo,
    stats: PlayerStats(
      matchesPlayed: 11,
      goals: 4,
      assists: 1,
      averageRating: 6.0,
    ),
  ),
];

MatchPlayerEntry _entrada(PlayerModel p) => MatchPlayerEntry(
  uid: p.id,
  displayName: p.name,
  ovr: p.ovr,
  position: p.position,
);

final MatchTeam _equipoA = MatchTeam(
  name: 'Los Galácticos',
  playerIds: [uidYo, 'uid-2', 'uid-3', 'uid-4', 'uid-5'],
  players: jugadores.take(5).map(_entrada).toList(),
  score: 4,
);

final MatchTeam _equipoB = MatchTeam(
  name: 'La Furia Roja del Prado',
  playerIds: ['uid-6', 'uid-7', 'uid-8', 'uid-9'],
  players: jugadores.skip(5).map(_entrada).toList(),
  score: 2,
);

/// Un partido de cada estado que la lista sabe dibujar distinto.
final List<MatchModel> partidos = [
  MatchModel(
    id: idPartido,
    title: 'Clásico del Barrio',
    date: '2026-09-12',
    time: '21:30',
    status: 'upcoming',
    type: 'manual',
    matchSize: 10,
    ownerUid: uidYo,
    groupId: idGrupo,
    location: 'Complejo Prado — Cancha 5',
    players: jugadores.map(_entrada).toList(),
    playerUids: jugadores.map((p) => p.id).toList(),
    teamA: _equipoA,
    teamB: _equipoB,
  ),
  MatchModel(
    id: 'match-2',
    title: 'Fecha 7 · Liga de Invierno',
    date: '2026-09-06',
    time: '20:00',
    status: 'active',
    type: 'league',
    matchSize: 10,
    ownerUid: 'uid-2',
    groupId: idGrupo,
    location: 'Cancha Municipal',
    currentMinute: 34,
    liveStatus: 'first_half',
    players: jugadores.map(_entrada).toList(),
    playerUids: jugadores.map((p) => p.id).toList(),
    teamA: _equipoA,
    teamB: _equipoB,
  ),
  MatchModel(
    id: 'match-3',
    title: 'Amistoso de los Miércoles',
    date: '2026-08-27',
    time: '19:00',
    status: 'completed',
    type: 'collaborative',
    matchSize: 10,
    ownerUid: uidYo,
    groupId: idGrupo,
    location: 'Punta Gorda',
    hasFinalScore: true,
    players: jugadores.map(_entrada).toList(),
    playerUids: jugadores.map((p) => p.id).toList(),
    teamA: _equipoA,
    teamB: _equipoB,
  ),
  MatchModel(
    id: 'match-4',
    title: 'Final de Copa Verano',
    date: '2026-08-15',
    time: '18:30',
    status: 'evaluated',
    type: 'cup',
    matchSize: 10,
    ownerUid: 'uid-6',
    groupId: idGrupo,
    location: 'Estadio Charrúa',
    hasFinalScore: true,
    bestPlayerId: 'uid-2',
    players: jugadores.map(_entrada).toList(),
    playerUids: jugadores.map((p) => p.id).toList(),
    teamA: _equipoA,
    teamB: _equipoB,
  ),
];

final GroupModel grupo = GroupModel(
  id: idGrupo,
  name: 'Los Pibes del Miércoles',
  ownerUid: uidYo,
  inviteCode: 'PATEA-2026',
  members: jugadores.map((p) => p.id).toList(),
);

final List<GroupTeamModel> equipos = [
  GroupTeamModel(
    id: 'team-1',
    name: 'Los Galácticos',
    groupId: idGrupo,
    createdBy: uidYo,
    jersey: JerseyModel(
      pattern: 'vertical',
      primaryColor: '#1E90FF',
      secondaryColor: '#FFFFFF',
    ),
    members: [
      TeamMemberEntry(playerId: uidYo, number: 5),
      TeamMemberEntry(playerId: 'uid-2', number: 9),
      TeamMemberEntry(playerId: 'uid-3', number: 4),
    ],
  ),
  GroupTeamModel(
    id: 'team-2',
    name: 'La Furia Roja del Prado',
    groupId: idGrupo,
    createdBy: 'uid-6',
    jersey: JerseyModel(
      pattern: 'band',
      primaryColor: '#C62828',
      secondaryColor: '#FFEB3B',
    ),
    members: [
      TeamMemberEntry(playerId: 'uid-6', number: 7),
      TeamMemberEntry(playerId: 'uid-7', number: 2),
    ],
  ),
];

final List<CompetitionModel> ligas = [
  CompetitionModel(
    id: 'liga-1',
    name: 'Liga de Invierno 2026',
    type: 'league',
    status: 'in_progress',
    ownerUid: uidYo,
    description: 'Todos contra todos, ida y vuelta.',
    groupId: idGrupo,
    format: 'double_round_robin',
    teamIds: equipos.map((t) => t.id).toList(),
    maxTeams: 8,
    teamSnapshots: {
      for (final t in equipos)
        t.id: {'name': t.name, 'jersey': t.jersey.toMap()},
    },
  ),
  CompetitionModel(
    id: 'liga-2',
    name: 'Liga Relámpago',
    type: 'league',
    status: 'completed',
    ownerUid: 'uid-6',
  ),
];

final List<CompetitionModel> copas = [
  CompetitionModel(
    id: 'copa-1',
    name: 'Copa Verano',
    type: 'cup',
    status: 'in_progress',
    ownerUid: uidYo,
    description: 'La final del encuentro del barrio.',
    groupId: idGrupo,
    format: 'single_elimination',
    teamIds: equipos.map((t) => t.id).toList(),
    maxTeams: 8,
    currentRound: 'final',
    teamSnapshots: {
      for (final t in equipos)
        t.id: {'name': t.name, 'jersey': t.jersey.toMap()},
    },
    bracket: [
      BracketMatchModel(
        id: 'final',
        round: 'final',
        matchNumber: 1,
        team1Id: equipos.first.id,
        team2Id: equipos.last.id,
        team1Name: equipos.first.name,
        team2Name: equipos.last.name,
        matchId: 'competition-cup-next',
      ),
    ],
  ),
];

final List<OvrHistoryEntry> historialOvr = [
  OvrHistoryEntry(date: DateTime(2026, 5, 3), oldOVR: 74, newOVR: 76),
  OvrHistoryEntry(date: DateTime(2026, 6, 1), oldOVR: 76, newOVR: 75),
  OvrHistoryEntry(date: DateTime(2026, 6, 28), oldOVR: 75, newOVR: 79),
  OvrHistoryEntry(date: DateTime(2026, 7, 19), oldOVR: 79, newOVR: 80),
  OvrHistoryEntry(date: DateTime(2026, 8, 15), oldOVR: 80, newOVR: 82),
];

final List<EvaluationInboxItem> bandejaEvaluaciones = [
  EvaluationInboxItem(
    matchId: 'match-3',
    matchTitle: 'Amistoso de los Miércoles',
    matchDate: '2026-08-27',
    isSubmitted: false,
    assignedPlayers: [
      AssignedPlayerInfo(
        id: 'uid-2',
        name: 'Juan Ignacio Rodríguez Etchegaray',
        position: 'DEL',
      ),
      AssignedPlayerInfo(id: 'uid-3', name: 'Nicolás Gómez', position: 'DEF'),
    ],
  ),
  EvaluationInboxItem(
    matchId: 'match-4',
    matchTitle: 'Final de Copa Verano',
    matchDate: '2026-08-15',
    isSubmitted: true,
    submittedAt: '2026-08-16',
    submittedEvaluationsCount: 2,
    submittedGoals: 1,
    submittedAssists: 3,
  ),
];

final List<IdentityRevealRequest> solicitudesIdentidad = [
  IdentityRevealRequest(
    evaluationId: 'ev-1',
    fromPlayerName: 'Facundo Bentancur',
    fromPlayerPhotoUrl: '',
    matchTitle: 'Final de Copa Verano',
  ),
];

final List<AvailablePlayerModel> agentesLibres = [
  AvailablePlayerModel(
    uid: 'libre-1',
    displayName: 'Rodrigo Amarilla',
    position: 'DEF',
    ovr: 77,
    distanceKm: 2.4,
    matchScore: 3,
    availability: const {
      'sabado': ['tarde', 'noche'],
    },
  ),
  AvailablePlayerModel(
    uid: 'libre-2',
    displayName: 'Sebastián Núñez',
    position: 'POR',
    ovr: 72,
    distanceKm: 6.1,
    matchScore: 2,
    availability: const {
      'domingo': ['manana'],
    },
  ),
];

const Map<String, dynamic> docDisponibilidad = {
  'availability': {
    'sabado': ['tarde', 'noche'],
    'domingo': ['manana'],
  },
};

const Map<String, dynamic> ubicacionGuardada = {
  'lat': -34.8836,
  'lng': -56.1819,
  'label': 'Prado, Montevideo',
};

const Map<String, dynamic> perfilUsuario = {
  'displayName': 'Santiago Fernández',
  'activeGroupId': idGrupo,
};

// ---------------------------------------------------------------------------
// Dobles
// ---------------------------------------------------------------------------

/// `noSuchMethod` hace de red: cualquier miembro que una pantalla use y este
/// arnés no haya previsto explota con el nombre del método, en vez de
/// arrastrar un `null` hasta un error de layout ilegible.
class _UsuarioFalso implements User {
  @override
  String get uid => uidYo;
  @override
  String? get displayName => 'Santiago Fernández';
  @override
  String? get email => 'santiago@ejemplo.com';
  @override
  String? get photoURL => null;
  @override
  bool get isAnonymous => false;
  @override
  bool get emailVerified => true;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _AuthFalso implements AuthService {
  @override
  User? get currentUser => _UsuarioFalso();
  @override
  Stream<User?> get authStateChanges => Stream.value(_UsuarioFalso());

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

/// Sólo existe para que `firestoreServiceProvider` se pueda construir sin
/// Firebase. Si una pantalla llega hasta acá es que le falta un override, y
/// el error dice exactamente qué método pidió.
class _FirestoreFalso implements FirebaseFirestore {
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _ExploreFalso implements ExploreService {
  @override
  Future<List<AvailablePlayerModel>> getAvailableLocalPlayers({
    required double lat,
    required double lng,
    double radiusInKm = 50,
    String? dayOfWeek,
    String? timeOfDay,
    List<String> matchPlayerUids = const [],
  }) async => agentesLibres;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _EvaluacionesFalso implements EvaluationService {
  @override
  Future<bool> hasSubmittedFor(String matchId, String uid) async => false;
  @override
  Future<List<EvaluationAssignmentModel>> getPendingAssignmentsForMatch(
    String matchId,
    String uid,
  ) async => [
    for (final p in jugadores.skip(1).take(2))
      EvaluationAssignmentModel(
        id: 'assignment-${p.id}',
        matchId: matchId,
        evaluatorId: uid,
        subjectId: p.id,
        status: 'pending',
      ),
  ];
  @override
  Future<List<PlayerModel>> getPlayersByIds(List<String> ids) async =>
      jugadores.where((p) => ids.contains(p.id)).toList();

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

/// Todo lo que las pantallas leen, con datos fijos.
///
/// Es una sola lista para todas en vez de una por pantalla: cuando alguien
/// agregue un `ref.watch` nuevo, el test que falla dice qué falta y se agrega
/// acá una vez.
final partidoDirigir = MatchModel(
  id: 'match-director-review',
  title: 'Clásico del Barrio',
  date: '2026-09-12',
  time: '21:30',
  type: 'manual',
  status: 'active',
  matchSize: 10,
  ownerUid: uidYo,
  playerUids: jugadores.map((p) => p.id).toList(),
  players: partidos.first.players,
  teamA: partidos.first.teamA,
  teamB: partidos.first.teamB,
  liveStatus: 'first_half',
  currentMinute: 12,
  events: [
    MatchEvent(
      type: 'goal',
      playerId: uidYo,
      playerName: 'Santiago Fernández',
      minute: 8,
    ),
  ],
);
final mensajesChat = [
  MatchChatMessage(
    id: 'message-3',
    text: 'Dale, llevo la pelota. Nos vemos ahí.',
    senderId: uidYo,
    senderName: 'Santiago Fernández',
    createdAt: DateTime(2026, 9, 12, 20, 36),
  ),
  MatchChatMessage(
    id: 'message-2',
    text: '¿Quién lleva pelota hoy?',
    senderId: 'uid-2',
    senderName: 'Juan Ignacio Rodríguez Etchegaray',
    createdAt: DateTime(2026, 9, 12, 20, 35),
  ),
  MatchChatMessage(
    id: 'message-1',
    text: 'Llego un rato antes para reservar la cancha.',
    senderId: 'uid-3',
    senderName: 'Mateo Rossi',
    createdAt: DateTime(2026, 9, 12, 20, 30),
  ),
];

const feedbackDePerfil = MatchFeedback(
  matchId: 'feedback-review',
  title: 'Amistoso Fecha 2 · Puntos y etiquetas',
  date: '2026-09-06',
  locationName: 'Av. Corrientes 4500, CABA',
  selfEvaluation: SelfEvaluationSummary(goals: 2, assists: 0),
  ovrUpdate: OvrUpdate(previousOvr: 55, newOvr: 56),
  peerEvaluations: [
    PeerEvaluation(
      id: 'peer-1',
      evaluatorId: 'anonymous',
      isAnonymous: true,
      rating: 7,
      performanceTags: [
        EvaluationTag(
          id: 'area',
          name: 'El Terror del Área',
          impact: 'positive',
          effects: [
            AttributeChange(attribute: 'dri', change: 2),
            AttributeChange(attribute: 'def', change: -2),
          ],
        ),
        EvaluationTag(
          id: 'assist',
          name: 'Asistidor Serial',
          impact: 'positive',
          effects: [AttributeChange(attribute: 'pas', change: 2)],
        ),
      ],
    ),
    PeerEvaluation(
      id: 'peer-2',
      evaluatorId: 'anonymous',
      isAnonymous: true,
      rating: 7,
      performanceTags: [
        EvaluationTag(
          id: 'area',
          name: 'El Terror del Área',
          impact: 'positive',
          effects: [
            AttributeChange(attribute: 'dri', change: 2),
            AttributeChange(attribute: 'def', change: -2),
          ],
        ),
        EvaluationTag(
          id: 'assist',
          name: 'Asistidor Serial',
          impact: 'positive',
          effects: [AttributeChange(attribute: 'pas', change: 2)],
        ),
      ],
    ),
  ],
);

List<Map<String, dynamic>> competitionFixtureMatches(
  String collection,
  String id,
) {
  List<Map<String, dynamic>> sides() => [
    for (final t in equipos)
      {
        'id': t.id,
        'name': t.name,
        'jersey': t.jersey.toMap(),
        'score': 0,
        'players': [
          for (final p in jugadores.where((p) => t.playerIds.contains(p.id)))
            {
              'uid': p.id,
              'displayName': p.name,
              'position': p.position,
              'ovr': p.ovr,
            },
        ],
      },
  ];
  return [
    if (collection == 'leagues')
      {
        'id': 'competition-league-finished',
        'type': 'league',
        'title': 'Los Galácticos vs La Furia Roja',
        'status': 'completed',
        'ownerUid': uidYo,
        'date': '2026-11-16',
        'time': '21:00',
        'participantTeamIds': equipos.map((t) => t.id).toList(),
        'teams': sides(),
        'finalScore': {'team1': 2, 'team2': 1},
        'leagueInfo': {'leagueId': id, 'round': 1},
        'location': {'name': 'El Galpón Fútbol 5'},
        'events': [
          {
            'id': '1',
            'type': 'goal',
            'playerId': uidYo,
            'playerName': 'Santiago Fernández',
            'assistId': 'uid-2',
            'assistName': 'Briseida',
          },
          {
            'id': '2',
            'type': 'goal',
            'playerId': 'uid-2',
            'playerName': 'Briseida',
          },
          {
            'id': '3',
            'type': 'card',
            'playerId': 'uid-6',
            'playerName': 'Matías',
            'cardType': 'yellow',
          },
        ],
      },
    {
      'id': collection == 'cups'
          ? 'competition-cup-next'
          : 'competition-league-next',
      'type': collection == 'cups' ? 'cup' : 'league',
      'title': 'Los Galácticos vs La Furia Roja',
      'status': 'upcoming',
      'ownerUid': uidYo,
      'date': '2032-11-20',
      'time': '21:00',
      'participantTeamIds': equipos.map((t) => t.id).toList(),
      'teams': sides(),
      'leagueInfo': {'leagueId': id, 'round': 2},
      'location': {'name': 'El Galpón Fútbol 5'},
      'events': [],
    },
  ];
}

class CompetitionServiceFake extends CompetitionService {
  CompetitionServiceFake() : super(_FirestoreFalso());
  @override
  Future<CompetitionPage> page({
    required String collection,
    required String scope,
    required String? uid,
    required String? groupId,
    DocumentSnapshot<Map<String, dynamic>>? after,
  }) async => CompetitionPage(collection == 'cups' ? copas : ligas);
  @override
  Stream<CompetitionModel?> watchCompetition(String collection, String id) =>
      Stream.value(
        (collection == 'cups' ? copas : ligas)
            .where((c) => c.id == id)
            .firstOrNull,
      );
  @override
  Stream<List<Map<String, dynamic>>> watchMatches(
    String collection,
    String id,
  ) => Stream.value(competitionFixtureMatches(collection, id));
  @override
  Stream<List<GroupTeamModel>> watchTeams(
    String collection,
    String id,
    List<String> ids,
  ) => Stream.value(equipos.where((t) => ids.contains(t.id)).toList());
  @override
  Stream<List<GroupTeamModel>> watchOwnedTeams(String uid) =>
      Stream.value(equipos.where((t) => t.createdBy == uid).toList());
  @override
  Stream<List<Map<String, dynamic>>> watchApplications(
    String collection,
    String id, {
    String? submittedBy,
  }) => Stream.value([]);
  @override
  Future<Map<String, dynamic>> command(
    String collection,
    String id,
    String action, [
    Map<String, dynamic> payload = const {},
  ]) async => {
    'ok': true,
    'id': 'created-competition',
    'matchId': 'competition-cup-next',
  };
}

List<Override> overridesDelArnes() {
  return [
    competitionServiceProvider.overrideWithValue(CompetitionServiceFake()),
    playerActivityProvider(
      'feedback-review',
    ).overrideWith((ref) async => [feedbackDePerfil]),
    singleMatchStreamProvider(
      partidoDirigir.id,
    ).overrideWith((ref) => Stream.value(partidoDirigir)),
    matchClipsProvider(
      partidoDirigir.id,
    ).overrideWith((ref) => Stream.value(const [])),
    matchPresenceProvider(
      partidoDirigir.id,
    ).overrideWith((ref) => Stream.value(MatchPresence.none)),
    matchChatMessagesProvider((
      matchId: idPartido,
      limit: 60,
    )).overrideWith((ref) => Stream.value(mensajesChat)),
    // Sesión
    authServiceProvider.overrideWithValue(_AuthFalso()),
    authStateProvider.overrideWith((ref) => Stream.value(_UsuarioFalso())),
    currentUidProvider.overrideWithValue(uidYo),

    // Red de seguridad: ningún stream debería llegar a Firestore.
    firestoreServiceProvider.overrideWithValue(
      FirestoreService(_FirestoreFalso()),
    ),

    // Grupo
    activeGroupIdStreamProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value(idGrupo)),
    singleGroupStreamProvider(
      idGrupo,
    ).overrideWith((ref) => Stream.value(grupo)),
    userGroupsStreamProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value([grupo])),
    groupTeamsStreamProvider(
      idGrupo,
    ).overrideWith((ref) => Stream.value(equipos)),
    myGroupRoleProvider(
      idGrupo,
    ).overrideWith((ref) => Stream.value(GroupRole.admin)),
    for (final e in equipos) ...[
      singleTeamStreamProvider(e.id).overrideWith((ref) => Stream.value(e)),
      teamTrophiesProvider(e.id).overrideWith(
        (ref) => Stream.value(const [
          TeamTrophy(name: 'Copa Verano 2026', isCup: true),
        ]),
      ),
    ],

    // Jugadores
    activeGroupPlayersProvider.overrideWith((ref) => Stream.value(jugadores)),
    playersStreamProvider(
      idGrupo,
    ).overrideWith((ref) => Stream.value(jugadores)),
    playersStreamProvider(null).overrideWith((ref) => Stream.value(jugadores)),
    for (final p in jugadores)
      singlePlayerStreamProvider(p.id).overrideWith((ref) => Stream.value(p)),
    for (final p in jugadores)
      ovrHistoryStreamProvider(
        p.id,
      ).overrideWith((ref) => Stream.value(historialOvr)),

    // Partidos
    activeGroupMatchesProvider.overrideWith((ref) => Stream.value(partidos)),
    matchesStreamProvider(
      idGrupo,
    ).overrideWith((ref) => Stream.value(partidos)),
    matchesStreamProvider(null).overrideWith((ref) => Stream.value(partidos)),
    publicMatchesStreamProvider.overrideWith(
      (ref) => Stream.value(partidos.take(2).toList()),
    ),
    ownedUpcomingMatchesProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value([partidos.first])),
    userUpcomingMatchesStreamProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value([partidos.first])),
    for (final m in partidos) ...[
      matchResultStatsProvider(
        m.id,
      ).overrideWith((ref) => Stream.value(MatchResultStats.empty)),
      singleMatchStreamProvider(m.id).overrideWith((ref) => Stream.value(m)),
      matchClipsProvider(m.id).overrideWith((ref) => Stream.value(const [])),
      matchJoinRequestsProvider(
        m.id,
      ).overrideWith((ref) => Stream.value(const [])),
      matchAssignmentsStreamProvider(
        m.id,
      ).overrideWith((ref) => Stream.value(const [])),
    ],

    // Perfiles crudos (nombre del organizador)
    for (final uid in {uidYo, 'uid-2', 'uid-6'})
      userProfileProvider(uid).overrideWith((ref) async => perfilUsuario),

    // Competiciones
    leaguesStreamProvider.overrideWith((ref) => Stream.value(ligas)),
    cupsStreamProvider.overrideWith((ref) => Stream.value(copas)),

    // Explorar
    exploreServiceProvider.overrideWithValue(_ExploreFalso()),
    myAvailabilityStreamProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value(docDisponibilidad)),
    savedLocationStreamProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value(ubicacionGuardada)),

    // Evaluaciones
    evaluationServiceProvider.overrideWithValue(_EvaluacionesFalso()),
    evaluationInboxItemsProvider(
      uidYo,
    ).overrideWith((ref) => Stream.value(bandejaEvaluaciones)),
    identityRevealRequestsProvider(
      uidYo,
    ).overrideWith((ref) async => solicitudesIdentidad),

    // Comunidad
    feedActivitiesStreamProvider.overrideWith(
      (ref) => Stream.value(const [
        {
          'type': 'ovr_updated',
          'playerName': 'Juan Ignacio Rodríguez Etchegaray',
          'change': 3,
          'newOvr': 91,
        },
        {
          'type': 'match_played',
          'playerName': 'Nicolás Gómez',
          'change': -1,
          'newOvr': 78,
        },
      ]),
    ),

    // El fondo elige una foto al azar: fijarla es lo que hace comparable la
    // imagen entre corridas.
    clockProvider.overrideWithValue(() => DateTime(2026, 9, 6, 12)),
  ];
}

/// Monta una pantalla como la ve el usuario: con el fondo que el router le
/// pone alrededor, el tema pedido y una escala de texto.
///
/// La escala va en un `MediaQuery` **dentro** del `MaterialApp` y copiando lo
/// que ya había: si se pone afuera con un `MediaQueryData()` nuevo, el tamaño
/// de pantalla queda en cero y las pantallas que lo consultan se dibujan mal.
/// Devuelve los errores de layout que la pantalla haya tirado, en orden.
///
/// Se recogen a mano en vez de dejárselos al binding porque `takeException()`
/// se queda con el primero y devuelve sólo el mensaje: "desbordó 38 píxeles"
/// sin decir dónde. Acá el fallo nombra el widget y el archivo, que es lo
/// único que sirve cuando el test corre en CI.
Future<List<FlutterErrorDetails>> montarPantalla(
  WidgetTester tester,
  Widget pantalla, {
  required ThemeData tema,
  double escala = 1.0,
  Size tamano = const Size(1080, 2400),
  List<Override> extraOverrides = const [],
}) async {
  tester.view.physicalSize = tamano;
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);

  // Se restaura antes de volver, no en un `addTearDown`: el binding revienta
  // si el test llama a `expect` con `FlutterError.onError` todavia desviado.
  final errores = <FlutterErrorDetails>[];
  final anterior = FlutterError.onError;
  FlutterError.onError = errores.add;
  try {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [...overridesDelArnes(), ...extraOverrides],
        child: MaterialApp(
          theme: tema,
          debugShowCheckedModeBanner: false,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(escala),
              // El recorte de la cámara y la barra de gestos: sin esto el
              // `SafeArea` de cada pantalla no aporta nada y el golden miente
              // sobre el espacio de arriba.
              padding: const EdgeInsets.only(top: 34, bottom: 16),
            ),
            child: child!,
          ),
          home: PateaBackground(child: pantalla),
        ),
      ),
    );

    // `pumpAndSettle` no sirve: varias pantallas tienen animaciones infinitas
    // (el pulso del partido en vivo, los spinners) y la espera nunca termina.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    // Los SVG (camisetas, el mate, los escudos) se leen del bundle con
    // `Future` de verdad, y adentro del test el reloj es falso: por más que
    // se bombee, esos futuros no avanzan y el golden sale con los huecos en
    // blanco. `runAsync` es el único respiro en tiempo real.
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 80)),
    );
    await tester.pump();
    // Y este salto largo deja terminar las animaciones de entrada
    // (`flutter_animate` en las tarjetas de partido). Sin él, media pantalla
    // quedaba retratada a mitad del fundido y el golden mostraba texto gris
    // que en la app no existe.
    await tester.pump(const Duration(milliseconds: 1500));
  } finally {
    FlutterError.onError = anterior;
  }

  return errores;
}

/// El mismo desborde se repite una vez por tarjeta; lo que importa es el
/// widget, no cuántas veces salió.
String resumirErrores(List<FlutterErrorDetails> errores) {
  final vistos = <String>{};
  final lineas = <String>[];
  for (final e in errores) {
    // El widget culpable no está en la excepción ni en el
    // `informationCollector` crudo: ahí viaja un `DebugCreator` opaco. Es
    // `debugTransformDebugCreator` —lo mismo que usa el binding— quien lo
    // convierte en "the relevant error-causing widget" con archivo y línea.
    final texto = debugTransformDebugCreator(
      e.informationCollector?.call() ?? const [],
    ).map((n) => n.toStringDeep()).join('\n');
    final donde = RegExp(r':(file:///\S+\.dart:\d+:\d+)')
        .firstMatch(texto)
        ?.group(1)
        ?.replaceAll('file:///', '')
        .replaceAll('%C3%A1', 'á');
    final linea = '${e.exception} — ${donde ?? "origen desconocido"}';
    if (vistos.add(linea)) lineas.add(linea);
  }
  return lineas.join('\n');
}
