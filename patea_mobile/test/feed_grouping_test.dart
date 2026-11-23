import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/utils/feed_grouping.dart';

Map<String, dynamic> ovr(String player, String? match, int change, {int newOvr = 60, String? at}) => {
  'type': 'ovr_updated',
  'playerId': player,
  'playerName': player.toUpperCase(),
  'matchId': match,
  'change': change,
  'newOvr': newOvr,
  'createdAt': at ?? '2026-11-23T10:00:00.000Z',
};

DateTime dateOf(Map<String, dynamic> d) => DateTime.parse(d['createdAt'] as String);

void main() {
  test('junta las novedades de OVR de un partido y ordena por quién más subió', () {
    final items = groupOvrNews([
      ovr('a', 'm1', 0),
      ovr('b', 'm1', 3),
      ovr('c', 'm1', -1),
      ovr('d', 'm1', 5),
    ], dateOf);
    expect(items, hasLength(1));
    final round = (items.single as FeedRound).round;
    expect(round.matchId, 'm1');
    expect(round.changes.map((c) => c.playerId), ['d', 'b', 'a', 'c']);
    expect(round.risers, 2);
    expect(round.steady, 1);
    expect(round.fallers, 1);
    expect(round.top(1).single.playerId, 'd');
    expect(round.top().map((c) => c.playerId), ['d', 'b'], reason: 'solo los que subieron');
  });

  test('una sola novedad de un partido, o sin partido, queda suelta', () {
    final items = groupOvrNews([
      ovr('a', 'm1', 2),
      ovr('b', null, 2),
      ovr('c', '', 2),
    ], dateOf);
    expect(items.whereType<FeedRound>(), isEmpty);
    expect(items.whereType<FeedSingle>(), hasLength(3));
  });

  test('lo que no es de OVR pasa igual y no se mezcla', () {
    final other = {
      'type': 'match_finished',
      'matchId': 'm1',
      'createdAt': '2026-11-23T09:00:00.000Z',
    };
    final items = groupOvrNews([ovr('a', 'm1', 1), other, ovr('b', 'm1', 2)], dateOf);
    expect(items.whereType<FeedRound>(), hasLength(1));
    final singles = items.whereType<FeedSingle>().toList();
    expect(singles, hasLength(1));
    expect(singles.single.data['type'], 'match_finished');
  });

  test('dos partidos dan dos rondas, cada una con la fecha de su novedad más nueva', () {
    final items = groupOvrNews([
      ovr('a', 'm1', 1, at: '2026-11-23T10:00:00.000Z'),
      ovr('b', 'm1', 2, at: '2026-11-23T10:05:00.000Z'),
      ovr('c', 'm2', 1, at: '2026-11-22T10:00:00.000Z'),
      ovr('d', 'm2', 4, at: '2026-11-22T10:01:00.000Z'),
    ], dateOf);
    final rounds = items.whereType<FeedRound>().map((r) => r.round).toList();
    expect(rounds, hasLength(2));
    final m1 = rounds.firstWhere((r) => r.matchId == 'm1');
    expect(m1.at, DateTime.parse('2026-11-23T10:05:00.000Z'));
  });

  test('datos incompletos no rompen: nombre y OVR por defecto', () {
    final items = groupOvrNews([
      {'type': 'ovr_updated', 'matchId': 'm1', 'createdAt': '2026-11-23T10:00:00.000Z'},
      {'type': 'ovr_updated', 'matchId': 'm1', 'change': '2', 'newOvr': '61', 'playerName': ' ', 'createdAt': '2026-11-23T10:00:00.000Z'},
    ], dateOf);
    final c = (items.single as FeedRound).round.changes;
    expect(c.first.change, 2);
    expect(c.first.newOvr, 61);
    expect(c.every((x) => x.name == 'Jugador'), isTrue);
  });
}
