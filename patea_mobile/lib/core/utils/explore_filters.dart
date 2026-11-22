import 'dart:math' as math;
import '../models/match_model.dart';

/// Discovery uses the scheduled local date and time, not midnight alone.
DateTime? discoveryKickoff(MatchModel match) {
  final date = DateTime.tryParse(match.date)?.toLocal();
  if (date == null) return null;
  final parts = (match.time ?? '').split(':');
  final hour = int.tryParse(parts.first);
  final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
  if (hour == null || minute == null) {
    return DateTime(date.year, date.month, date.day, 23, 59, 59);
  }
  return DateTime(date.year, date.month, date.day, hour, minute);
}

bool isDiscoverableFuture(MatchModel match, DateTime now) =>
    match.status == 'upcoming' &&
    (discoveryKickoff(match)?.isAfter(now) ?? false);

bool canRecruitFor(MatchModel match, String uid, DateTime now) =>
    match.ownerUid == uid &&
    // Un partido de plantel fijo (entre equipos o de competición) no se
    // completa con jugadores sueltos; el servidor rechaza la invitación.
    !match.hasFixedRoster &&
    isDiscoverableFuture(match, now) &&
    (match.matchSize == 0 || match.playerUids.length < match.matchSize);

bool isPublicDiscoveryMatch(MatchModel match, String uid, DateTime now) =>
    match.ownerUid != uid &&
    // Los partidos entre equipos tienen plantel armado: no se ofrecen para
    // anotarse de a un jugador.
    !match.isTeamMatch &&
    isDiscoverableFuture(match, now) &&
    (match.matchSize == 0 ||
        match.playerUids.length < match.matchSize ||
        match.playerUids.contains(uid) ||
        match.pendingPlayerUids.contains(uid));

double discoveryDistance(
  double lat,
  double lng,
  double otherLat,
  double otherLng,
) {
  double rad(double v) => v * math.pi / 180;
  final a =
      math.pow(math.sin(rad(otherLat - lat) / 2), 2) +
      math.cos(rad(lat)) *
          math.cos(rad(otherLat)) *
          math.pow(math.sin(rad(otherLng - lng) / 2), 2);
  return 6371 * 2 * math.asin(math.sqrt(a.clamp(0, 1)));
}
