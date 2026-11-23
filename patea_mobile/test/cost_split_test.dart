import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/models/venue_model.dart';
import 'package:patea_mobile/core/utils/cost_split.dart';

void main() {
  _canchas();
  test('la parte se redondea hacia arriba al centavo', () {
    expect(sharePerPlayer(1500, 10), 150);
    expect(sharePerPlayer(1000, 3), 333.34);
    expect(sharePerPlayer(100, 7), 14.29);
    expect(sharePerPlayer(0, 5), 0);
    expect(sharePerPlayer(500, 0), 0);
  });

  test('lo que se junta nunca queda por debajo del costo', () {
    for (final total in [10.0, 99.99, 1000.0, 1234.57]) {
      for (var n = 1; n <= 22; n++) {
        expect(
          sharePerPlayer(total, n) * n,
          greaterThanOrEqualTo(total - 1e-9),
          reason: '$total entre $n',
        );
      }
    }
  });

  test('resumen: cuenta solo a los que siguen en el plantel', () {
    const cost = MatchCost(total: 1000, currency: 'UYU');
    final s = summarizeCost(
      cost,
      ['a', 'b', 'c', 'd'],
      ['a', 'c', 'salio', 'a'],
    );
    expect(s.players, 4);
    expect(s.share, 250);
    expect(s.paidCount, 2);
    expect(s.pendingCount, 2);
    expect(s.collected, 500);
    expect(s.pending, 500);
    expect(s.progress, 0.5);
    expect(s.allPaid, isFalse);
    expect(
      summarizeCost(cost, ['a'], ['a']).allPaid,
      isTrue,
    );
    final vacio = summarizeCost(cost, const [], const []);
    expect(vacio.share, 0);
    expect(vacio.progress, 0);
    expect(vacio.allPaid, isFalse);
  });

  test('formato de dinero', () {
    expect(formatMoney(1500, 'UYU'), r'$ 1.500');
    expect(formatMoney(1234.57, 'ARS'), r'$ 1.234,57');
    expect(formatMoney(20, 'USD'), r'US$ 20');
    expect(formatMoney(0.5, 'UYU'), r'$ 0,50');
    expect(formatMoney(1000000, 'UYU'), r'$ 1.000.000');
    expect(formatMoney(999, 'EUR'), 'EUR 999');
  });

  test('el modelo lee costo y transmisión, y las ignora si no sirven', () {
    final m = MatchModel.fromFirestore({
      'title': 'P',
      'cost': {'total': 800, 'currency': 'ARS'},
      'costPaidUids': ['a', 'b'],
      'stream': {
        'provider': 'youtube',
        'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'active': true,
      },
    }, 'm1');
    expect(m.cost!.total, 800);
    expect(m.cost!.currency, 'ARS');
    expect(m.costPaidUids, ['a', 'b']);
    expect(m.stream!.provider, 'youtube');

    final vacio = MatchModel.fromFirestore({
      'title': 'P',
      'cost': {'total': 0},
      'stream': {'url': '', 'active': true},
    }, 'm2');
    expect(vacio.cost, isNull);
    expect(vacio.costPaidUids, isEmpty);
    expect(vacio.stream, isNull);
    expect(
      MatchModel.fromFirestore({'stream': {'url': 'https://x', 'active': false}}, 'm3').stream,
      isNull,
    );
  });
}

void _canchas() {
  VenueModel v(String id, String name, {String placeId = '', double? cost, String cur = 'UYU'}) =>
      VenueModel(id: id, groupId: 'g', name: name, placeId: placeId, costPerMatch: cost, costCurrency: cur);
  MatchModel m({String? name, String placeId = '', MatchCost? cost}) => MatchModel(
    id: 'm', title: 'P', date: '2026-11-23', status: 'upcoming', type: 'manual',
    location: name,
    locationDetail: MatchLocationModel(name: name ?? '', placeId: placeId),
    cost: cost,
  );
  final venues = [
    v('1', 'Club Norte', placeId: 'p1', cost: 1800),
    v('2', 'Cancha del Parque', cost: 900, cur: 'ARS'),
    v('3', 'Sin costo', placeId: 'p3'),
  ];

  test('la cancha del partido: por placeId y si no por nombre', () {
    expect(venueForMatch(m(name: 'otro', placeId: 'p1'), venues)!.id, '1');
    expect(venueForMatch(m(name: ' cancha DEL parque '), venues)!.id, '2');
    expect(venueForMatch(m(name: 'No existe'), venues), isNull);
    expect(venueForMatch(m(), venues), isNull);
  });

  test('el costo rige de la cancha, salvo que el partido tenga uno propio', () {
    expect(effectiveMatchCost(m(name: 'Club Norte', placeId: 'p1'), venues)!.total, 1800);
    final parque = effectiveMatchCost(m(name: 'Cancha del Parque'), venues)!;
    expect((parque.total, parque.currency), (900, 'ARS'));
    expect(effectiveMatchCost(m(name: 'Sin costo', placeId: 'p3'), venues), isNull);
    expect(effectiveMatchCost(m(name: 'Nueva'), venues), isNull);
    const propio = MatchCost(total: 2500, currency: 'USD');
    expect(effectiveMatchCost(m(name: 'Club Norte', placeId: 'p1', cost: propio), venues), same(propio));
  });

  test('la cancha lee su costo y lo ignora si falta', () {
    final c = VenueModel.fromFirestore({'name': 'X', 'costPerMatch': 1500, 'costCurrency': 'ARS'}, 'v');
    expect((c.costPerMatch, c.costCurrency), (1500, 'ARS'));
    final sin = VenueModel.fromFirestore({'name': 'X'}, 'v');
    expect((sin.costPerMatch, sin.costCurrency), (null, 'UYU'));
  });
}
