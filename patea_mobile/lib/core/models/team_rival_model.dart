import 'group_model.dart';
import 'team_challenge_model.dart';

class TeamRival {
  final String id, name, groupName, groupId, reason, createdAt;
  final JerseyModel jersey;
  final bool favorite, hidden, canChallenge, pendingChallenge;
  final String? upcomingMatchId, lastPlayedAt;
  final int played, wins, draws, losses, goalsFor, goalsAgainst, memberCount;
  final List<Map<String, dynamic>> recent;
  TeamRival.fromMap(Map<String, dynamic> map)
    : id = map['rivalTeamId'] as String,
      createdAt = map['createdAt'] as String? ?? '',
      name = map['name'] as String? ?? 'Equipo',
      groupName = map['groupName'] as String? ?? '',
      groupId = map['rivalGroupId'] as String? ?? '',
      reason = map['unavailableReason'] as String? ?? '',
      jersey = JerseyModel.fromMap(
        (map['jersey'] as Map?)?.cast<String, dynamic>(),
      ),
      favorite = map['favorite'] == true,
      hidden = map['hidden'] == true,
      canChallenge = map['canChallenge'] == true,
      pendingChallenge = map['pendingChallenge'] == true,
      upcomingMatchId = map['upcomingMatchId'] as String?,
      lastPlayedAt = map['lastPlayedAt'] as String?,
      played = (map['played'] as num?)?.toInt() ?? 0,
      wins = (map['wins'] as num?)?.toInt() ?? 0,
      draws = (map['draws'] as num?)?.toInt() ?? 0,
      losses = (map['losses'] as num?)?.toInt() ?? 0,
      goalsFor = (map['goalsFor'] as num?)?.toInt() ?? 0,
      goalsAgainst = (map['goalsAgainst'] as num?)?.toInt() ?? 0,
      memberCount = (map['memberCount'] as num?)?.toInt() ?? 0,
      recent = (map['recent'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  String get record => '${wins}G ${draws}E ${losses}P';
  String lastPlayedLabel(DateTime now) {
    final date = DateTime.tryParse(lastPlayedAt ?? '');
    if (date == null) return 'Todavía no jugaron';
    final days = now.difference(date).inDays.clamp(0, 100000);
    if (days == 1) return 'Último partido: ayer';
    return days == 0
        ? 'Último partido: hoy'
        : days < 7
        ? 'Último: hace $days días'
        : 'Último: hace ${days ~/ 7} ${days ~/ 7 == 1 ? 'semana' : 'semanas'}';
  }

  TeamSearchResult get searchResult => TeamSearchResult(
    id: id,
    name: name,
    jersey: jersey,
    groupId: groupId,
    groupName: groupName,
    memberCount: memberCount,
  );
}

class TeamRivalsPage {
  final List<TeamRival> rivals;
  final bool canManage, hasMoreHidden;
  final String? hiddenCursor;
  TeamRivalsPage.fromMap(Map<String, dynamic> map)
    : rivals = (map['rivals'] as List? ?? [])
          .map((e) => TeamRival.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      canManage = map['canManage'] == true,
      hasMoreHidden = map['hasMoreHidden'] == true,
      hiddenCursor = map['hiddenCursor'] as String?;
}
