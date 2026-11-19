import 'group_model.dart';

/// Un equipo que devuelve el buscador de rivales.
///
/// Sólo datos públicos: nombre, camiseta, grupo y cuántos jugadores tiene.
/// Nunca el plantel — eso queda en el servidor.
class TeamSearchResult {
  final String id;
  final String name;
  final JerseyModel jersey;
  final String groupId;
  final String groupName;
  final int memberCount;

  const TeamSearchResult({
    required this.id,
    required this.name,
    required this.jersey,
    this.groupId = '',
    this.groupName = '',
    this.memberCount = 0,
  });

  factory TeamSearchResult.fromMap(Map<String, dynamic> map) =>
      TeamSearchResult(
        id: (map['id'] as String?) ?? '',
        name: (map['name'] as String?) ?? 'Equipo',
        jersey: JerseyModel.fromMap(
          (map['jersey'] as Map?)?.cast<String, dynamic>(),
        ),
        groupId: (map['groupId'] as String?) ?? '',
        groupName: (map['groupName'] as String?) ?? '',
        memberCount: (map['memberCount'] as num?)?.toInt() ?? 0,
      );
}

/// Un desafío pendiente que recibió uno de mis equipos.
class TeamChallenge {
  final String id;
  final String toTeamId;
  final String toTeamName;
  final String fromTeamId;
  final String fromTeamName;
  final JerseyModel fromTeamJersey;
  final String fromGroupName;
  final String message;
  final String proposedDate;
  final String proposedTime;
  final String proposedLocationName;
  final String createdAt;

  const TeamChallenge({
    required this.id,
    required this.toTeamId,
    required this.toTeamName,
    required this.fromTeamId,
    required this.fromTeamName,
    required this.fromTeamJersey,
    this.fromGroupName = '',
    this.message = '',
    this.proposedDate = '',
    this.proposedTime = '',
    this.proposedLocationName = '',
    this.createdAt = '',
  });

  /// Quien desafió ya propuso fecha y hora (si no, se define después).
  bool get hasProposal => proposedDate.isNotEmpty && proposedTime.isNotEmpty;

  factory TeamChallenge.fromMap(Map<String, dynamic> map) => TeamChallenge(
    id: (map['id'] as String?) ?? '',
    toTeamId: (map['toTeamId'] as String?) ?? '',
    toTeamName: (map['toTeamName'] as String?) ?? '',
    fromTeamId: (map['fromTeamId'] as String?) ?? '',
    fromTeamName: (map['fromTeamName'] as String?) ?? 'Equipo',
    fromTeamJersey: JerseyModel.fromMap(
      (map['fromTeamJersey'] as Map?)?.cast<String, dynamic>(),
    ),
    fromGroupName: (map['fromGroupName'] as String?) ?? '',
    message: (map['message'] as String?) ?? '',
    proposedDate: (map['proposedDate'] as String?) ?? '',
    proposedTime: (map['proposedTime'] as String?) ?? '',
    proposedLocationName: (map['proposedLocationName'] as String?) ?? '',
    createdAt: (map['createdAt'] as String?) ?? '',
  );
}
