import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/coach_models.dart';
import 'package:patea_mobile/core/services/coach_service.dart';

void main() {
  test('análisis: lee la respuesta del servidor', () {
    final r = AnalysisResult.fromMap({
      'status': 'ok',
      'analysis': {
        'headline': 'Viene en alza',
        'summary': 'Buen momento.',
        'strengths': [
          {'title': 'Ritmo', 'detail': 'Pica bien.'},
        ],
        'improvements': [],
        'patterns': ['Sube con la pelota parada'],
        'plan': ['a', 'b', 'c'],
      },
    });
    expect(r.notEnoughData, isFalse);
    expect(r.analysis!.strengths.single.title, 'Ritmo');
    expect(r.analysis!.plan, hasLength(3));
  });

  test('análisis: sin datos suficientes', () {
    expect(
      AnalysisResult.fromMap({'status': 'not_enough_data'}).notEnoughData,
      isTrue,
    );
    expect(AnalysisResult.fromMap(const {}).notEnoughData, isTrue);
  });

  test('chat: respuesta, sugerencias y formato del historial', () {
    final reply = CoachReply.fromMap({
      'reply': 'Dale',
      'suggestions': ['¿Y el físico?'],
    });
    expect(reply.reply, 'Dale');
    expect(reply.suggestions, ['¿Y el físico?']);
    expect(const ChatMessage(ChatRole.user, 'hola').toWire(), {
      'role': 'user',
      'content': 'hola',
    });
    expect(const ChatMessage(ChatRole.coach, 'che').toWire()['role'], 'coach');
  });

  test('refuerzos: lee las recomendaciones', () {
    final r = RecruitRecommendation.fromMap({
      'playerId': 'u1',
      'reason': 'Te falta un golero',
    });
    expect(r.playerId, 'u1');
    expect(r.reason, 'Te falta un golero');
    expect(RecruitRecommendation.fromMap(const {}).playerId, '');
  });

  test('el mensaje de error pierde el prefijo Exception', () {
    expect(coachErrorMessage(Exception('Hablaste mucho.')), 'Hablaste mucho.');
    expect(coachErrorMessage('otro'), 'otro');
  });
}
