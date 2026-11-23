import '../models/match_model.dart';

/// Parte de cada jugador: el total dividido en partes iguales y redondeado
/// hacia arriba al centavo, así lo que se junta nunca queda por debajo del
/// costo (puede sobrar hasta un centavo por persona).
double sharePerPlayer(double total, int players) {
  if (players <= 0 || total <= 0) return 0;
  return (total / players * 100).ceilToDouble() / 100;
}

/// Cómo viene el cobro de un partido.
class CostSummary {
  final double total;
  final int players;
  final double share;
  final int paidCount;

  const CostSummary({
    required this.total,
    required this.players,
    required this.share,
    required this.paidCount,
  });

  int get pendingCount => players - paidCount;
  double get collected => share * paidCount;
  double get pending => share * pendingCount;
  double get progress => players == 0 ? 0 : paidCount / players;
  bool get allPaid => players > 0 && paidCount == players;
}

/// [roster] son los ids de quienes juegan; [paidUids] puede traer ids que ya
/// no están en el plantel (alguien que salió): no cuentan.
CostSummary summarizeCost(
  MatchCost cost,
  List<String> roster,
  List<String> paidUids,
) {
  final unique = roster.toSet();
  final paid = paidUids.toSet().intersection(unique).length;
  return CostSummary(
    total: cost.total,
    players: unique.length,
    share: sharePerPlayer(cost.total, unique.length),
    paidCount: paid,
  );
}

const _symbols = {'UYU': r'$', 'ARS': r'$', 'USD': r'US$'};

/// «$ 1.500», «$ 1.234,57», «US$ 20». Sin decimales cuando el monto es entero.
String formatMoney(double amount, String currency) {
  final symbol = _symbols[currency] ?? currency;
  final cents = (amount * 100).round();
  final whole = cents ~/ 100;
  final fraction = cents % 100;
  final digits = whole.toString();
  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) grouped.write('.');
    grouped.write(digits[i]);
  }
  final decimals = fraction == 0 ? '' : ',${fraction.toString().padLeft(2, '0')}';
  return '$symbol $grouped$decimals';
}
