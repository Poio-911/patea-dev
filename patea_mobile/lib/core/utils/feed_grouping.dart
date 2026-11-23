// Agrupa las novedades de OVR de un mismo partido en una sola.
//
// Al cerrar las evaluaciones de un partido el servidor escribe una novedad por
// jugador (`ovr_updated`). Con diez jugadores eso son diez filas seguidas que
// tapan todo lo demás. Acá se juntan en una sola entrada por partido; el resto
// de las novedades pasan igual.

/// Un jugador dentro de la novedad agrupada.
class OvrChange {
  final String playerId;
  final String name;
  final String? photoUrl;
  final int newOvr;
  final int change;

  const OvrChange({
    required this.playerId,
    required this.name,
    required this.photoUrl,
    required this.newOvr,
    required this.change,
  });
}

/// Las novedades de OVR de un partido, de quien más subió a quien más bajó.
class OvrRound {
  final String matchId;
  final DateTime at;
  final List<OvrChange> changes;

  const OvrRound({
    required this.matchId,
    required this.at,
    required this.changes,
  });

  int get risers => changes.where((c) => c.change > 0).length;
  int get steady => changes.where((c) => c.change == 0).length;
  int get fallers => changes.where((c) => c.change < 0).length;

  /// Los [n] que más subieron (solo los que subieron de verdad).
  List<OvrChange> top([int n = 3]) =>
      changes.where((c) => c.change > 0).take(n).toList();
}

/// Un elemento ya resuelto del feed: o una ronda agrupada, o una novedad suelta.
sealed class FeedItem {
  final DateTime at;
  const FeedItem(this.at);
}

class FeedRound extends FeedItem {
  final OvrRound round;
  FeedRound(this.round) : super(round.at);
}

class FeedSingle extends FeedItem {
  final Map<String, dynamic> data;
  const FeedSingle(super.at, this.data);
}

int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

/// [dateOf] saca la fecha de cada novedad. Una novedad de OVR sin partido, o la
/// única de su partido, no se agrupa: una sola fila no necesita un resumen.
List<FeedItem> groupOvrNews(
  List<Map<String, dynamic>> news,
  DateTime Function(Map<String, dynamic>) dateOf,
) {
  final byMatch = <String, List<Map<String, dynamic>>>{};
  for (final data in news) {
    final matchId = data['matchId'];
    if (data['type'] == 'ovr_updated' && matchId is String && matchId.isNotEmpty) {
      byMatch.putIfAbsent(matchId, () => []).add(data);
    }
  }

  final grouped = <String>{
    for (final e in byMatch.entries)
      if (e.value.length >= 2) e.key,
  };

  final items = <FeedItem>[];
  for (final data in news) {
    final matchId = data['matchId'];
    final isOvr = data['type'] == 'ovr_updated';
    if (isOvr && matchId is String && grouped.contains(matchId)) continue;
    items.add(FeedSingle(dateOf(data), data));
  }

  for (final matchId in grouped) {
    final list = byMatch[matchId]!;
    final changes = [
      for (final d in list)
        OvrChange(
          playerId: '${d['playerId'] ?? ''}',
          name: (d['playerName'] as String?)?.trim().isNotEmpty == true
              ? d['playerName'] as String
              : 'Jugador',
          photoUrl: (d['playerPhotoUrl'] as String?)?.isNotEmpty == true
              ? d['playerPhotoUrl'] as String
              : null,
          newOvr: _int(d['newOvr']),
          change: _int(d['change']),
        ),
    ]
      ..sort((a, b) {
        final byChange = b.change.compareTo(a.change);
        return byChange != 0 ? byChange : a.name.compareTo(b.name);
      });
    // La ronda se muestra con la fecha de la novedad más reciente.
    final at = list.map(dateOf).reduce((a, b) => a.isAfter(b) ? a : b);
    items.add(FeedRound(OvrRound(matchId: matchId, at: at, changes: changes)));
  }
  return items;
}
