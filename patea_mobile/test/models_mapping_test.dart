import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/constants/performance_tags.dart';
import 'package:patea_mobile/core/models/evaluation_models.dart';
import 'package:patea_mobile/core/models/player_model.dart';

/// Tests de los dos puntos de mapeo Firestore↔Dart donde ya aparecieron bugs
/// reales en producción. No son tests de cobertura: cada uno fija un bug
/// concreto que costó encontrar.
void main() {
  group('PlayerEvaluationDraft.toSubmissionMap — forma de los efectos', () {
    // BUG REAL: `effects` se serializaba como el Map<String,int> interno de
    // Dart (`{"def": 3}`) en vez del TagEffect[] que espera el backend
    // (`[{"attribute":"def","change":3}]`). La Cloud Function de finalización
    // hacía `for (const effect of tag.effects)` y explotaba con
    // "TypeError: object is not iterable", dejando el partido sin finalizar.
    test('serializa effects como lista de {attribute, change}', () {
      final draft = PlayerEvaluationDraft(
        assignmentId: 'a1',
        subjectId: 'p1',
        displayName: 'Pepe',
        photoURL: '',
        position: 'DEL',
        tagPool: const [],
      )
        ..evaluationType = 'tags'
        ..performanceTags = [
          const PerformanceTagItem(
            id: 'muralla',
            name: 'Muralla',
            description: 'No pasó nadie',
            impact: 'positive',
            positions: ['DEF'],
            effects: {'def': 3, 'phy': 1},
          ),
        ];

      final map = draft.toSubmissionMap();
      final tags = map['performanceTags'] as List;
      final effects = (tags.first as Map)['effects'];

      expect(effects, isA<List>(), reason: 'debe ser una lista, no un Map');
      expect(effects, [
        {'attribute': 'def', 'change': 3},
        {'attribute': 'phy', 'change': 1},
      ]);
    });

    test('el tipo puntos manda rating entero y no manda etiquetas', () {
      final draft = PlayerEvaluationDraft(
        assignmentId: 'a2',
        subjectId: 'p2',
        displayName: 'Clemente',
        photoURL: '',
        position: 'DEF',
        tagPool: const [],
      )
        ..evaluationType = 'points'
        ..rating = 7.6;

      final map = draft.toSubmissionMap();
      expect(map['rating'], 8, reason: 'se redondea antes de enviarse');
      expect(map.containsKey('performanceTags'), isFalse);
    });
  });

  group('PlayerModel.fromFirestore — doble campo de foto', () {
    // BUG REAL: los documentos de `players` traen la foto a veces en
    // `photoUrl` (camelCase) y a veces en `photoURL` (uppercase). Leer sólo
    // uno dejaba jugadores sin avatar según cómo se hubiera creado el doc.
    test('lee photoUrl en camelCase', () {
      final p = PlayerModel.fromFirestore(
        {'name': 'Pepe', 'position': 'DEL', 'ovr': 99, 'photoUrl': 'https://a/1.jpg'},
        'id1',
      );
      expect(p.photoUrl, 'https://a/1.jpg');
    });

    test('cae a photoURL en mayúsculas cuando falta el camelCase', () {
      final p = PlayerModel.fromFirestore(
        {'name': 'Pepe', 'position': 'DEL', 'ovr': 99, 'photoURL': 'https://a/2.jpg'},
        'id2',
      );
      expect(p.photoUrl, 'https://a/2.jpg');
    });

    test('sin foto queda null, no rompe', () {
      final p = PlayerModel.fromFirestore(
        {'name': 'Pepe', 'position': 'DEL', 'ovr': 99},
        'id3',
      );
      expect(p.photoUrl, isNull);
    });
  });

  group('catálogo de etiquetas de rendimiento', () {
    test('tiene las 34 etiquetas reales de la web', () {
      expect(PerformanceTagsData.allTags.length, 34);
    });

    test('no hay ids duplicados', () {
      final ids = PerformanceTagsData.allTags.map((t) => t.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('cada etiqueta tiene al menos un efecto y un impacto válido', () {
      for (final tag in PerformanceTagsData.allTags) {
        expect(tag.effects, isNotEmpty, reason: '${tag.id} no tiene efectos');
        expect(['positive', 'negative'], contains(tag.impact), reason: '${tag.id}');
      }
    });
  });
}
