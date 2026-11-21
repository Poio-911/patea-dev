import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/player_message_model.dart';

void main() {
  test('PlayerMessageModel.fromFirestore parses match_invite and direct_message', () {
    final invite = PlayerMessageModel.fromFirestore({
      'type': 'match_invite',
      'fromUid': 'u2',
      'fromName': 'Juan',
      'fromPhotoUrl': 'https://example.com/juan.jpg',
      'text': 'Nos falta 1 hoy a las 21, sumate!',
      'matchId': 'm1',
      'matchTitle': 'Fútbol 5 Carrasco',
      'matchDate': '2026-12-01',
      'matchTime': '21:00',
      'matchLocation': 'Plaza Fútbol 5',
      'isRead': false,
      'createdAt': '2026-11-21T20:00:00.000Z',
    }, 'msg1');

    expect(invite.id, 'msg1');
    expect(invite.hasMatch, isTrue);
    expect(invite.matchTitle, 'Fútbol 5 Carrasco');
    expect(invite.text, 'Nos falta 1 hoy a las 21, sumate!');
    expect(invite.isRead, isFalse);

    final direct = PlayerMessageModel.fromFirestore({
      'type': 'direct_message',
      'fromUid': 'u3',
      'fromName': 'Pedro',
      'text': '¿Jugás el jueves?',
      'isRead': true,
      'createdAt': '2026-11-21T20:05:00.000Z',
    }, 'msg2');

    expect(direct.hasMatch, isFalse);
    expect(direct.fromPhotoUrl, isNull);
    expect(direct.isRead, isTrue);
  });
}
