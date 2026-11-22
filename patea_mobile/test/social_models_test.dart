import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/social_models.dart';

void main() {
  test('SocialPostModel.fromFirestore parses post, poll, reactions and match card', () {
    final post = SocialPostModel.fromFirestore({
      'type': 'match_moment',
      'userId': 'u1',
      'playerName': 'Santiago',
      'playerPosition': 'DEL',
      'playerOvr': 81,
      'groupId': 'g1',
      'text': 'Gran victoria hoy!',
      'imageUrl': 'https://example.com/foto.jpg',
      'metadata': {
        'matchId': 'm1',
        'matchTitle': 'Clásico del Jueves',
        'teamAName': 'Negros',
        'teamAScore': 5,
        'teamBName': 'Blancos',
        'teamBScore': 3,
      },
      'poll': {
        'question': '¿Quién fue la figura?',
        'options': [
          {'id': 'opt_1', 'text': 'Santiago'},
          {'id': 'opt_2', 'text': 'Lucas'},
        ],
        'votes': {'u1': 'opt_1', 'u2': 'opt_1', 'u3': 'opt_2'},
      },
      'reactions': {
        '⚽': ['u2', 'u3'],
        '🔥': ['u1'],
      },
      'commentCount': 4,
      'createdAt': '2026-11-21T20:00:00.000Z',
    }, 'post1');

    expect(post.id, 'post1');
    expect(post.hasMatchCard, isTrue);
    expect(post.teamAScore, 5);
    expect(post.reactionCount('⚽'), 2);
    expect(post.hasReacted('🔥', 'u1'), isTrue);
    expect(post.totalReactions, 3);
    expect(post.poll, isNotNull);
    expect(post.poll!.totalVotes, 3);
    expect(post.poll!.votesFor('opt_1'), 2);
    expect(post.poll!.userVote('u3'), 'opt_2');
  });
}
