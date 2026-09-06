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

  /// El texto sobre foto no puede seguir al tema.
  ///
  /// El banner del próximo partido y la portada del detalle son una foto de
  /// cancha con un velo negro encima: son oscuros en los dos esquemas. Cuando
  /// ese texto usaba `textPrimary`, en tema claro salía casi negro sobre el
  /// césped — ilegible, y no lo veía ningún test de contraste porque el par
  /// que se medía era contra `card`, no contra la foto.
  ///
  /// No se puede medir el contraste contra una fotografía, así que lo que se
  /// fija es la regla: estos tres tokens valen lo mismo en los dos esquemas.
  /// Si alguien los hace seguir al tema, este test lo dice.
  group('sobre foto', () {
    test('no cambian entre esquemas', () {
      expect(PateaColors.light.onPhoto, PateaColors.game.onPhoto);
      expect(PateaColors.light.onPhotoMuted, PateaColors.game.onPhotoMuted);
      expect(PateaColors.light.onPhotoLine, PateaColors.game.onPhotoLine);
    });

    // El velo es `black` al 45 % sobre la foto, y arriba de eso hay un
    // degradado que la oscurece más. El peor caso realista es el parche de
    // césped más claro visto a través del velo; se toma un gris medio como
    // referencia conservadora.
    const peorCaso = Color(0xFF6B6B6B);

    test('onPhoto se lee sobre el peor parche de la foto', () {
      final r = _contraste(PateaColors.game.onPhoto, peorCaso);
      expect(r, greaterThanOrEqualTo(minimo),
          reason: 'onPhoto sobre el césped da ${r.toStringAsFixed(2)}:1');
    });
  });
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
