import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/match_model.dart';
import 'package:patea_mobile/core/utils/cost_split.dart';

void main() {
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
