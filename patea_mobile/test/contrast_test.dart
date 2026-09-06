import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/theme/patea_colors.dart';

/// Que ningún par texto-sobre-superficie baje de 4,5:1, en los dos esquemas.
///
/// Es el test que hoy habría fallado: `textMuted` daba **3,48:1** sobre una
/// tarjeta y era el color de texto más usado de la app, con 316 apariciones.
/// Un defecto así no lo encuentra nadie mirando; lo encuentra un número.
///
/// **Por qué sólo texto.** WCAG pide 4,5:1 para texto normal y 3:1 para
/// elementos gráficos. Varios colores del tema claro —`warning` 2,13,
/// `ovr-gold` 2,14, `pos-por` 2,21— están debajo incluso de eso, y están bien:
/// en la web se usan como relleno o borde, no como letra. Este test cubre los
/// pares que *sí* son texto; si alguno de esos colores termina siendo texto
/// chico, hay que agregarle acá su variante oscura y verlo fallar primero.
void main() {
  const minimo = 4.5;

  for (final (nombre, c) in [
    ('game', PateaColors.game),
    ('claro', PateaColors.light),
  ]) {
    group(nombre, () {
      final superficies = {
        'background': c.background,
        'card': c.card,
        'cardSurface': c.cardSurface,
        'popover': c.popover,
      };
      final textos = {
        'textPrimary': c.textPrimary,
        'textSecondary': c.textSecondary,
      };

      superficies.forEach((sn, sc) {
        textos.forEach((tn, tc) {
          test('$tn sobre $sn', () {
            final r = _contraste(tc, sc);
            expect(r, greaterThanOrEqualTo(minimo),
                reason: '$tn sobre $sn da ${r.toStringAsFixed(2)}:1');
          });
        });
      });

      test('onPrimary sobre primary', () {
        final r = _contraste(c.onPrimary, c.primary);
        expect(r, greaterThanOrEqualTo(minimo),
            reason: 'el texto del botón primario da '
                '${r.toStringAsFixed(2)}:1');
      });
    });
  }
}

double _luminancia(Color c) {
  double ch(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

double _contraste(Color a, Color b) {
  final la = _luminancia(a), lb = _luminancia(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}
