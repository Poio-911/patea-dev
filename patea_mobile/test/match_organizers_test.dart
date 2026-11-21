import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/core/models/group_model.dart';
import 'package:patea_mobile/core/models/group_permissions.dart';
import 'package:patea_mobile/core/models/match_model.dart';

void main() {
  group('GroupModel roles', () {
    test('roleFor resolves owner as admin and explicit memberRoles', () {
      final group = GroupModel.fromFirestore({
        'name': 'Los Pibes',
        'ownerUid': 'u1',
        'inviteCode': 'ABC123',
        'members': ['u1', 'u2', 'u3', 'u4'],
        'memberRoles': [
          {'userId': 'u2', 'role': 'admin'},
          {'userId': 'u3', 'role': 'moderator'},
          {'userId': 'u4', 'role': 'member'},
        ],
      }, 'g1');

      expect(group.roleFor('u1'), 'admin');
      expect(group.roleFor('u2'), 'admin');
      expect(group.roleFor('u3'), 'moderator');
      expect(group.roleFor('u4'), 'member');
      expect(group.roleFor('unknown'), 'member');
    });
  });

  group('MatchModel organizers & guest players', () {
    test('MatchPlayerEntry detects guest players by flag or prefix', () {
      final guest1 = MatchPlayerEntry.fromMap({
        'uid': 'guest_1234abcd',
        'displayName': 'Lucas',
        'position': 'DEL',
        'ovr': 72,
      });
      final guest2 = MatchPlayerEntry.fromMap({
        'uid': 'custom_id',
        'displayName': 'Invitado',
        'isGuest': true,
      });
      final regular = MatchPlayerEntry.fromMap({
        'uid': 'u1',
        'displayName': 'Juan',
      });

      expect(guest1.isGuest, isTrue);
      expect(guest2.isGuest, isTrue);
      expect(regular.isGuest, isFalse);
    });

    test('isManagedBy allows owner, coOrganizers, captains and group admins/moderators', () {
      final match = MatchModel(
        id: 'm1',
        title: 'Fútbol 5',
        date: '2026-12-01',
        status: 'upcoming',
        type: 'collaborative',
        ownerUid: 'owner',
        captains: const ['cap1'],
        coOrganizerUids: const ['co1'],
      );

      expect(match.isManagedBy('owner'), isTrue);
      expect(match.isManagedBy('cap1'), isTrue);
      expect(match.isManagedBy('co1'), isTrue);
      expect(match.isManagedBy('other'), isFalse);
      expect(match.isManagedBy('other', groupRole: GroupRole.admin), isTrue);
      expect(match.isManagedBy('other', groupRole: GroupRole.moderator), isTrue);
      expect(match.isManagedBy('other', groupRole: GroupRole.member), isFalse);
    });
  });
}
