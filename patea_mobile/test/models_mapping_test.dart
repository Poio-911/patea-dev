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
      final draft =
          PlayerEvaluationDraft(
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
      final draft =
          PlayerEvaluationDraft(
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
      final p = PlayerModel.fromFirestore({
        'name': 'Pepe',
        'position': 'DEL',
        'ovr': 99,
        'photoUrl': 'https://a/1.jpg',
      }, 'id1');
      expect(p.photoUrl, 'https://a/1.jpg');
    });

    test('cae a photoURL en mayúsculas cuando falta el camelCase', () {
      final p = PlayerModel.fromFirestore({
        'name': 'Pepe',
        'position': 'DEL',
        'ovr': 99,
        'photoURL': 'https://a/2.jpg',
      }, 'id2');
      expect(p.photoUrl, 'https://a/2.jpg');
    });

    test('sin foto queda null, no rompe', () {
      final p = PlayerModel.fromFirestore({
        'name': 'Pepe',
        'position': 'DEL',
        'ovr': 99,
      }, 'id3');
      expect(p.photoUrl, isNull);
    });
  });

  group('catálogo de etiquetas de rendimiento', () {
    test('conserva los IDs del catálogo móvil, incluidos los de golero', () {
      const expectedIds = {
        'el_pulpo',
        'reflejos_felinos',
        'achique_dominante',
        'dueno_del_aire',
        'distribucion_clave',
        'atajapenales',
        'valla_invicta',
        'lider_del_fondo',
        'muro_defensivo',
        'cierre_providencial',
        'orden_defensivo',
        'cobertura_oportuna',
        'titiritero',
        'pase_filtrado',
        'recuperador',
        'cambio_frente',
        'goleador_nato',
        'endiablado',
        'terror_area',
        'asistidor',
        'garra_charrua',
        'correcaminos',
        'equipo_hombro',
        'manos_manteca',
        'rebote_peligroso',
        'salio_en_falso',
        'estatua',
        'saque_descalibrado',
        'salio_tarde',
        'se_comio_amague',
        'perdio_marca',
        'falta_innecesaria',
        'pase_al_rival',
        'se_enamoro_pelota',
        'abuso_pelotazo',
        'desconectado',
        'se_comio_elefante',
        'lento_definiendo',
        'sin_presion_arriba',
        'decision_mal',
        'se_escondio',
        'control_cemento',
      };
      expect(PerformanceTagsData.allTags.map((t) => t.id).toSet(), expectedIds);
      expect(
        PerformanceTagsData.allTags.where((t) => t.impact == 'positive').length,
        23,
      );
      expect(
        PerformanceTagsData.allTags.where((t) => t.impact == 'negative').length,
        19,
      );
    });

    test(
      'cada posición tiene etiquetas propias y comunes suficientes para el formulario',
      () {
        for (final position in ['POR', 'DEF', 'MED', 'DEL']) {
          final pool = PerformanceTagsData.getTagsForPosition(
            position.toLowerCase(),
          );
          expect(
            pool.every(
              (tag) =>
                  tag.positions.contains(position) ||
                  tag.positions.contains('ALL'),
            ),
            isTrue,
          );
          expect(
            pool.where((tag) => tag.impact == 'positive').length,
            greaterThanOrEqualTo(6),
          );
          expect(
            pool.where((tag) => tag.impact == 'negative').length,
            greaterThanOrEqualTo(4),
          );
          expect(pool.any((tag) => tag.positions.contains(position)), isTrue);
          expect(pool.any((tag) => tag.positions.contains('ALL')), isTrue);
        }
      },
    );

    test('no hay ids duplicados', () {
      final ids = PerformanceTagsData.allTags.map((t) => t.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('cada etiqueta tiene al menos un efecto y un impacto válido', () {
      for (final tag in PerformanceTagsData.allTags) {
        expect(tag.effects, isNotEmpty, reason: '${tag.id} no tiene efectos');
        expect(
          tag.effects.keys.every(
            {'pac', 'sho', 'pas', 'dri', 'def', 'phy'}.contains,
          ),
          isTrue,
          reason: '${tag.id} tiene un atributo desconocido',
        );
        expect(tag.effects.values.every((value) => value != 0), isTrue);
        expect(tag.positions, isNotEmpty);
        expect(
          tag.positions.every({'POR', 'DEF', 'MED', 'DEL', 'ALL'}.contains),
          isTrue,
        );
        expect(
          ['positive', 'negative'],
          contains(tag.impact),
          reason: tag.id,
        );
      }
    });
  });
}
