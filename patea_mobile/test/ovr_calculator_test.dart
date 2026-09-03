import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/utils/ovr_calculator.dart';

/// La progresión de OVR es el corazón del producto y está implementada por
/// triplicado: la web (`src/lib/actions/server-actions.ts`), la Cloud Function
/// que realmente escribe (`functions/src/callable/evaluations.ts`) y esta copia
/// en Dart, que existe sólo para previsualizar el cambio en la UI.
///
/// Ya divergieron una vez: `minAttribute` estaba en 30 acá y en 20 en las otras
/// dos, así que un jugador en el piso mostraba un número distinto en la app que
/// en la web. Estos tests fijan los valores del servidor para que la próxima
/// divergencia falle acá y no en producción.
void main() {
  group('constantes alineadas con el servidor', () {
    test('coinciden con OVR_PROGRESSION de evaluations.ts', () {
      expect(OvrCalculator.minOvr, 40);
      expect(OvrCalculator.maxOvr, 99);
      expect(OvrCalculator.minAttribute, 20, reason: 'el servidor usa 20, no 30');
      expect(OvrCalculator.maxAttribute, 99);
      expect(OvrCalculator.maxStep, 1.5);
    });
  });

  group('calculateOvrChange — escala anti-inflación por tramo', () {
    test('rating 5.0 es neutro en cualquier tramo', () {
      for (final ovr in [45, 55, 65, 75, 85, 95]) {
        expect(OvrCalculator.calculateOvrChange(ovr, 5.0), 0.0);
      }
    });

    test('cuanto más alto el OVR, menos se mueve con el mismo rating', () {
      // rating 8.0 => delta 3.0, multiplicado por la escala del tramo.
      expect(OvrCalculator.calculateOvrChange(45, 8.0), closeTo(1.5, 0.001)); // 3.0*0.50 = 1.5
      expect(OvrCalculator.calculateOvrChange(55, 8.0), closeTo(1.2, 0.001)); // 3.0*0.40
      expect(OvrCalculator.calculateOvrChange(65, 8.0), closeTo(0.9, 0.001)); // 3.0*0.30
      expect(OvrCalculator.calculateOvrChange(75, 8.0), closeTo(0.6, 0.001)); // 3.0*0.20
      expect(OvrCalculator.calculateOvrChange(85, 8.0), closeTo(0.3, 0.001)); // 3.0*0.10
      expect(OvrCalculator.calculateOvrChange(95, 8.0), closeTo(0.15, 0.001)); // 3.0*0.05
    });

    test('el tope de ±1.5 por partido se respeta', () {
      // OVR 45, rating 10 => delta 5.0 * 0.50 = 2.5, recortado a 1.5.
      expect(OvrCalculator.calculateOvrChange(45, 10.0), 1.5);
      // OVR 45, rating 1 => delta -4.0 * 0.50 = -2.0, recortado a -1.5.
      expect(OvrCalculator.calculateOvrChange(45, 1.0), -1.5);
    });

    test('un rating bajo baja el OVR', () {
      expect(OvrCalculator.calculateOvrChange(75, 3.0), closeTo(-0.4, 0.001));
    });

    test('los bordes de tramo caen del lado correcto', () {
      // 50 ya NO es "<50": usa 0.40, no 0.50.
      expect(OvrCalculator.calculateOvrChange(49, 7.0), closeTo(1.0, 0.001));
      expect(OvrCalculator.calculateOvrChange(50, 7.0), closeTo(0.8, 0.001));
      // 90 en adelante es el tramo leyenda.
      expect(OvrCalculator.calculateOvrChange(89, 7.0), closeTo(0.2, 0.001));
      expect(OvrCalculator.calculateOvrChange(90, 7.0), closeTo(0.1, 0.001));
    });
  });

  group('positionWeights', () {
    test('cada posición reparte exactamente 1.0', () {
      OvrCalculator.positionWeights.forEach((position, weights) {
        final total = weights.values.fold<double>(0, (a, b) => a + b);
        expect(total, closeTo(1.0, 0.0001), reason: 'la posición $position no suma 1.0');
      });
    });

    test('están las 4 posiciones con los 6 atributos', () {
      expect(OvrCalculator.positionWeights.keys.toSet(), {'DEL', 'MED', 'DEF', 'POR'});
      for (final weights in OvrCalculator.positionWeights.values) {
        expect(weights.keys.toSet(), {'pac', 'sho', 'pas', 'dri', 'def', 'phy'});
      }
    });

    test('cada posición prioriza su atributo característico', () {
      double w(String pos, String attr) => OvrCalculator.positionWeights[pos]![attr]!;
      // El delantero define por tiro; el defensor y el arquero, por defensa.
      expect(w('DEL', 'sho'), greaterThan(w('DEL', 'def')));
      expect(w('MED', 'pas'), greaterThan(w('MED', 'sho')));
      expect(w('DEF', 'def'), greaterThan(w('DEF', 'sho')));
      expect(w('POR', 'def'), greaterThan(w('POR', 'dri')));
    });
  });
}
