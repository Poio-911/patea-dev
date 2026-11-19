import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/constants/performance_tags.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/utils/ovr_calculator.dart';

/// Espejo 1:1 de `functions/test/ovr-progression.test.cjs`.
/// Verifica que la previsualización local en Dart coincida exactamente con el
/// motor unificado desplegado en Cloud Functions (`ovr-progression.ts`).
void main() {
  Map<String, int> uniformAttrs(int v) => {
    'pac': v,
    'sho': v,
    'pas': v,
    'dri': v,
    'def': v,
    'phy': v,
  };

  int sumDeltas(Map<String, int> deltas) =>
      deltas.values.fold<int>(0, (sum, v) => sum + v);

  PerformanceTagItem tagById(String id) =>
      PerformanceTagsData.allTags.firstWhere((t) => t.id == id);

  group('constantes alineadas con el servidor', () {
    test('coinciden con OVR_PROGRESSION de ovr-progression.ts', () {
      expect(OvrCalculator.minOvr, 40);
      expect(OvrCalculator.maxOvr, 99);
      expect(OvrCalculator.minAttribute, 20);
      expect(OvrCalculator.maxAttribute, 99);
      expect(OvrCalculator.maxStep, 1.5);
    });
  });

  group('catálogo de etiquetas limpio y simétrico', () {
    test('positivas solo suman, negativas solo restan y sin IDs repetidos', () {
      final seen = <String>{};
      for (final tag in PerformanceTagsData.allTags) {
        expect(seen.add(tag.id), isTrue, reason: 'ID duplicado: ${tag.id}');
        expect(tag.effects, isNotEmpty);
        for (final entry in tag.effects.entries) {
          if (tag.impact == 'positive') {
            expect(entry.value, greaterThan(0), reason: '${tag.id}.${entry.key}');
          } else {
            expect(entry.value, lessThan(0), reason: '${tag.id}.${entry.key}');
          }
        }
      }
    });

    test('todas las posiciones tienen al menos 5 etiquetas positivas y 5 negativas', () {
      for (final pos in ['POR', 'DEF', 'MED', 'DEL']) {
        final tags = PerformanceTagsData.getTagsForPosition(pos);
        final posCount = tags.where((t) => t.impact == 'positive').length;
        final negCount = tags.where((t) => t.impact == 'negative').length;
        expect(posCount, greaterThanOrEqualTo(5), reason: '$pos positivas');
        expect(negCount, greaterThanOrEqualTo(5), reason: '$pos negativas');
      }
    });
  });

  group('calculateOvrChange — escala anti-inflación por tramo', () {
    test('rating 5.0 es neutro en cualquier tramo', () {
      for (final ovr in [45, 55, 65, 75, 85, 95]) {
        expect(OvrCalculator.calculateOvrChange(ovr, 5.0), 0.0);
      }
    });

    test('cuanto más alto el OVR, menos se mueve con el mismo rating', () {
      expect(OvrCalculator.calculateOvrChange(45, 8.0), closeTo(1.5, 0.001));
      expect(OvrCalculator.calculateOvrChange(55, 8.0), closeTo(1.2, 0.001));
      expect(OvrCalculator.calculateOvrChange(65, 8.0), closeTo(0.9, 0.001));
      expect(OvrCalculator.calculateOvrChange(75, 8.0), closeTo(0.6, 0.001));
      expect(OvrCalculator.calculateOvrChange(85, 8.0), closeTo(0.3, 0.001));
      expect(OvrCalculator.calculateOvrChange(95, 8.0), closeTo(0.15, 0.001));
    });

    test('el tope de ±1.5 por partido se respeta', () {
      expect(OvrCalculator.calculateOvrChange(45, 10.0), 1.5);
      expect(OvrCalculator.calculateOvrChange(45, 1.0), -1.5);
    });

    test('los bordes de tramo caen del lado correcto', () {
      expect(OvrCalculator.calculateOvrChange(49, 7.0), closeTo(1.0, 0.001));
      expect(OvrCalculator.calculateOvrChange(50, 7.0), closeTo(0.8, 0.001));
      expect(OvrCalculator.calculateOvrChange(89, 7.0), closeTo(0.2, 0.001));
      expect(OvrCalculator.calculateOvrChange(90, 7.0), closeTo(0.1, 0.001));
    });
  });

  group('positionWeights y computeOvr', () {
    test('cada posición reparte exactamente 1.0 y prioriza su atributo clave', () {
      OvrCalculator.positionWeights.forEach((position, weights) {
        final total = weights.values.fold<double>(0, (a, b) => a + b);
        expect(total, closeTo(1.0, 0.0001), reason: position);
      });
      expect(OvrCalculator.positionWeights['DEL']!['sho']!,
          greaterThan(OvrCalculator.positionWeights['DEL']!['def']!));
      expect(OvrCalculator.positionWeights['MED']!['pas']!,
          greaterThan(OvrCalculator.positionWeights['MED']!['sho']!));
      expect(OvrCalculator.positionWeights['DEF']!['def']!,
          greaterThan(OvrCalculator.positionWeights['DEF']!['sho']!));
      expect(OvrCalculator.positionWeights['POR']!['def']!,
          greaterThan(OvrCalculator.positionWeights['POR']!['dri']!));
    });

    test('OVR final es media simple en todas las posiciones', () {
      final attrs = {'pac': 40, 'sho': 90, 'pas': 60, 'dri': 70, 'def': 20, 'phy': 80};
      for (final position in ['DEL', 'MED', 'DEF', 'POR']) {
        expect(OvrCalculator.computeOvr(attrs, position), 60);
      }
    });
  });

  group('paridad entre los 4 modos (Nota, Etiquetas, Texto y Audio)', () {
    test('misma potencia total de atributos y OVR en todos los tramos', () {
      final fivePosTags = [
        tagById('goleador_nato'),
        tagById('endiablado'),
        tagById('terror_area'),
        tagById('asistidor'),
        tagById('correcaminos'),
      ];
      final threePosTags = fivePosTags.sublist(0, 3);
      final fiveNegTags = [
        tagById('se_comio_elefante'),
        tagById('lento_definiendo'),
        tagById('sin_presion_arriba'),
        tagById('decision_mal'),
        tagById('control_cemento'),
      ];
      const raveAi = [
        TextPerformanceChange(attribute: 'sho', change: 3, reason: ''),
        TextPerformanceChange(attribute: 'dri', change: 3, reason: ''),
        TextPerformanceChange(attribute: 'pas', change: 2, reason: ''),
        TextPerformanceChange(attribute: 'pac', change: 2, reason: ''),
      ];
      const goodAi = [
        TextPerformanceChange(attribute: 'sho', change: 2, reason: ''),
        TextPerformanceChange(attribute: 'dri', change: 2, reason: ''),
        TextPerformanceChange(attribute: 'pac', change: 1, reason: ''),
      ];
      const harshAi = [
        TextPerformanceChange(attribute: 'sho', change: -3, reason: ''),
        TextPerformanceChange(attribute: 'dri', change: -3, reason: ''),
        TextPerformanceChange(attribute: 'pas', change: -2, reason: ''),
        TextPerformanceChange(attribute: 'pac', change: -2, reason: ''),
      ];

      for (final ovr in [55, 65, 75, 85, 93]) {
        final attrs = uniformAttrs(ovr);

        // 10/10 == 5 etiquetas positivas == reseña fuerte
        final p10 = OvrCalculator.previewFromPoints(
          currentAttributes: attrs, currentOvr: ovr, position: 'DEL', rating: 10,
        );
        final t5 = OvrCalculator.previewFromTags(
          currentAttributes: attrs, currentOvr: ovr, tags: fivePosTags,
        );
        final aRave = OvrCalculator.previewFromAI(
          currentAttributes: attrs, currentOvr: ovr, aiChanges: raveAi,
        );
        expect(sumDeltas(t5.attributeDeltas), sumDeltas(p10.attributeDeltas));
        expect(sumDeltas(aRave.attributeDeltas), sumDeltas(p10.attributeDeltas));
        expect(t5.newOvr, p10.newOvr);
        expect(aRave.newOvr, p10.newOvr);

        // 8/10 == 3 etiquetas positivas == reseña buena
        final p8 = OvrCalculator.previewFromPoints(
          currentAttributes: attrs, currentOvr: ovr, position: 'DEL', rating: 8,
        );
        final t3 = OvrCalculator.previewFromTags(
          currentAttributes: attrs, currentOvr: ovr, tags: threePosTags,
        );
        final aGood = OvrCalculator.previewFromAI(
          currentAttributes: attrs, currentOvr: ovr, aiChanges: goodAi,
        );
        expect(sumDeltas(t3.attributeDeltas), sumDeltas(p8.attributeDeltas));
        expect(sumDeltas(aGood.attributeDeltas), sumDeltas(p8.attributeDeltas));
        expect(t3.newOvr, p8.newOvr);
        expect(aGood.newOvr, p8.newOvr);

        // 1/10 == 5 etiquetas negativas == reseña muy crítica
        final p1 = OvrCalculator.previewFromPoints(
          currentAttributes: attrs, currentOvr: ovr, position: 'DEL', rating: 1,
        );
        final t5Neg = OvrCalculator.previewFromTags(
          currentAttributes: attrs, currentOvr: ovr, tags: fiveNegTags,
        );
        final aHarsh = OvrCalculator.previewFromAI(
          currentAttributes: attrs, currentOvr: ovr, aiChanges: harshAi,
        );
        expect(sumDeltas(t5Neg.attributeDeltas), sumDeltas(p1.attributeDeltas));
        expect(sumDeltas(aHarsh.attributeDeltas), sumDeltas(p1.attributeDeltas));
        expect(t5Neg.newOvr, p1.newOvr);
        expect(aHarsh.newOvr, p1.newOvr);
      }
    });

    test('POR prioriza DEF sin sesgo del primer atributo y respeta simetría', () {
      final player = PlayerModel(
        id: 'p', name: 'P', position: 'POR',
        ovr: 75, pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75,
      );
      final up = OvrCalculator.calculateAttributeChangesFromPoints(
        player: player, ovrChange: 1.0,
      );
      expect(up['def'], 78);
      expect(up['def']!, greaterThan(up['pac']!));

      final down = OvrCalculator.previewFromPoints(
        currentAttributes: uniformAttrs(75), currentOvr: 75, position: 'POR', rating: 2,
      );
      expect(down.attributeDeltas['def'], lessThan(0));
      expect(down.newOvr, 74);
    });

    test('etiquetas mixtas 2+2 mantienen OVR neutro moviendo atributos opuestos', () {
      final preview = OvrCalculator.previewFromTags(
        currentAttributes: uniformAttrs(75),
        currentOvr: 75,
        tags: [
          tagById('goleador_nato'),
          tagById('asistidor'),
          tagById('sin_presion_arriba'),
          tagById('se_escondio'),
        ],
      );
      expect(preview.ovrDelta, 0);
      expect(preview.equivalentRating, 5.0);
      expect(preview.nonZeroDeltas.any((e) => e.value > 0), isTrue);
      expect(preview.nonZeroDeltas.any((e) => e.value < 0), isTrue);
    });

    test('micro-bono uniforme de goles y asistencias tiene tope +1.0', () {
      final b0 = OvrCalculator.selfReportMicroBonusVector(0, 0);
      final b1 = OvrCalculator.selfReportMicroBonusVector(1, 0);
      final b3 = OvrCalculator.selfReportMicroBonusVector(3, 0);
      final b15 = OvrCalculator.selfReportMicroBonusVector(15, 0);
      expect(b0.values.fold<double>(0, (a, b) => a + b), 0.0);
      expect(b1.values.fold<double>(0, (a, b) => a + b), closeTo(0.4, 1e-9));
      expect(b3.values.fold<double>(0, (a, b) => a + b), closeTo(1.0, 1e-9));
      expect(b15, b3);
    });

    test('jugadores con OVR inicial posicional distinto a la media simple no bajan en partido neutro', () {
      const attrs = {'pac': 78, 'sho': 74, 'pas': 86, 'dri': 83, 'def': 71, 'phy': 76};
      final neutral = OvrCalculator.previewFromPoints(
        currentAttributes: attrs, currentOvr: 82, position: 'MED', rating: 5,
      );
      expect(neutral.newOvr, 82);
      expect(neutral.ovrDelta, 0);

      final great = OvrCalculator.previewFromPoints(
        currentAttributes: attrs, currentOvr: 82, position: 'MED', rating: 10,
      );
      expect(great.newOvr, 83);
      expect(great.ovrDelta, 1);
    });
  });
}
