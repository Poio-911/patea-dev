import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/competition_extras_models.dart';
import 'package:patea_mobile/core/models/competition_model.dart';

void main() {
  test('patrocinadores: lee los válidos y descarta el resto', () {
    final list = CompetitionSponsor.listFrom([
      {'id': 's1', 'name': ' Don Pepe ', 'websiteUrl': 'https://donpepe.com'},
      {'id': 's2', 'name': 'Sin enlace', 'websiteUrl': ''},
      {'id': 's3', 'name': '  '},
      {'name': 5},
      'texto',
      null,
    ]);
    expect(list.map((s) => s.name), ['Don Pepe', 'Sin enlace']);
    expect(list[0].websiteUrl, 'https://donpepe.com');
    expect(list[1].websiteUrl, isNull);
    expect(CompetitionSponsor.listFrom(null), isEmpty);
  });

  test('sede: lee los datos y pone nombre por defecto', () {
    final v = CompetitionVenue.fromMap({
      'name': 'Club Norte',
      'address': ' Av. 1 ',
      'capacity': 120,
      'costPerMatch': 1500.5,
      'notes': '',
    }, 'v1');
    expect(v.id, 'v1');
    expect(v.address, 'Av. 1');
    expect(v.capacity, 120);
    expect(v.costPerMatch, 1500.5);
    expect(v.notes, isNull);
    expect(CompetitionVenue.fromMap(const {}, 'v2').name, 'Sede');
  });

  test('aviso: lee fecha y alcance', () {
    final m = CompetitionMessage.fromMap({
      'subject': 'Cambio',
      'body': 'Jugamos en la otra cancha',
      'audience': 'captains',
      'recipientCount': 7,
      'createdAt': '2026-11-23T12:00:00.000Z',
    }, 'm1');
    expect(m.audience, 'captains');
    expect(m.recipientCount, 7);
    expect(m.createdAt, isNotNull);
    expect(CompetitionMessage.fromMap(const {}, 'm2').audience, 'all');
  });

  test('la competición trae sus patrocinadores', () {
    final c = CompetitionModel.fromFirestore({
      'name': 'Liga',
      'ownerUid': 'o',
      'sponsors': [
        {'id': 'a', 'name': 'Uno'},
      ],
    }, 'l1', 'league');
    expect(c.sponsors.single.name, 'Uno');
    expect(
      CompetitionModel.fromFirestore({'name': 'x'}, 'l2', 'league').sponsors,
      isEmpty,
    );
  });
}
