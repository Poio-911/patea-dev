import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/player_message_model.dart';
import 'package:patea_mobile/core/services/messages_service.dart';

void main() {
  test('buildDirectChatId is deterministic regardless of order', () {
    expect(buildDirectChatId('u2', 'u1'), 'u1_u2');
    expect(buildDirectChatId('u1', 'u2'), 'u1_u2');
  });

  test('DirectChatModel.fromFirestore resolves other participant and unread count', () {
    final chat = DirectChatModel.fromFirestore({
      'participants': ['u1', 'u2'],
      'participantInfo': {
        'u1': {'name': 'Yo', 'photoUrl': ''},
        'u2': {'name': 'Juan', 'photoUrl': 'https://example.com/juan.jpg'},
      },
      'lastMessageText': '¿Jugás hoy?',
      'lastMessageAt': '2026-11-21T20:00:00.000Z',
      'lastSenderUid': 'u2',
      'unreadCounts': {'u1': 2, 'u2': 0},
    }, 'u1_u2', 'u1');

    expect(chat.otherUid, 'u2');
    expect(chat.otherName, 'Juan');
    expect(chat.otherPhotoUrl, 'https://example.com/juan.jpg');
    expect(chat.unreadCount, 2);
  });

  test('DirectMessageModel.fromFirestore parses match_invite and text', () {
    final invite = DirectMessageModel.fromFirestore({
      'type': 'match_invite',
      'senderUid': 'u2',
      'senderName': 'Juan',
      'text': 'Nos falta 1 hoy a las 21, sumate!',
      'matchId': 'm1',
      'matchTitle': 'Fútbol 5 Carrasco',
      'matchDate': '2026-12-01',
      'matchTime': '21:00',
      'matchLocation': 'Plaza Fútbol 5',
      'createdAt': '2026-11-21T20:00:00.000Z',
    }, 'msg1');

    expect(invite.id, 'msg1');
    expect(invite.hasMatch, isTrue);
    expect(invite.matchTitle, 'Fútbol 5 Carrasco');

    final textMsg = DirectMessageModel.fromFirestore({
      'type': 'text',
      'senderUid': 'u1',
      'senderName': 'Yo',
      'text': 'Dale, voy!',
      'createdAt': '2026-11-21T20:05:00.000Z',
    }, 'msg2');

    expect(textMsg.hasMatch, isFalse);
  });
}
