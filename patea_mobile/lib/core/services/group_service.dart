import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'callable_functions.dart';

final groupServiceProvider = Provider<GroupService>((ref) {
  return GroupService();
});

/// Port de src/lib/actions/{group-actions,team-actions}.ts. `groups` y
/// `teams` tienen `allow create/update/delete: if false` en firestore.rules
/// a propósito — toda escritura pasa por estas Cloud Functions
/// (functions/src/callable/group-management.ts).
class GroupService {
  Future<String> createGroup(String name) async {
    final result = await callFunction('createGroup', {'name': name});
    return result['groupId'] as String;
  }

  Future<String> joinGroupByInviteCode(String inviteCode) async {
    final result = await callFunction('joinGroupByInviteCode', {'inviteCode': inviteCode});
    return result['groupId'] as String;
  }

  Future<void> setActiveGroup(String groupId) async {
    await callFunction('setActiveGroup', {'groupId': groupId});
  }

  Future<String> createTeam({
    required String groupId,
    required String name,
    required Map<String, dynamic> jersey,
    required List<Map<String, dynamic>> members,
  }) async {
    final result = await callFunction('createTeam', {
      'groupId': groupId,
      'name': name,
      'jersey': jersey,
      'members': members,
    });
    return result['id'] as String;
  }

  Future<void> updateTeam({required String teamId, required String name, required Map<String, dynamic> jersey}) async {
    await callFunction('updateTeam', {'teamId': teamId, 'name': name, 'jersey': jersey});
  }

  Future<void> updateTeamMembers({required String teamId, required List<Map<String, dynamic>> members}) async {
    await callFunction('updateTeamMembers', {'teamId': teamId, 'members': members});
  }

  Future<void> deleteTeam(String teamId) async {
    await callFunction('deleteTeam', {'teamId': teamId});
  }
}
