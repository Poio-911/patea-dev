import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/group_model.dart';

final groupServiceProvider = Provider<GroupService>((ref) {
  return GroupService(FirebaseFirestore.instance);
});

class GroupService {
  final FirebaseFirestore _firestore;

  GroupService(this._firestore);

  String _generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final random = Random();
    return String.fromCharCodes(Iterable.generate(6, (_) => chars.codeUnitAt(random.nextInt(chars.length))));
  }

  /// Crea un grupo nuevo con código de invitación único
  Future<String> createGroup({
    required String name,
    required String ownerUid,
  }) async {
    final inviteCode = _generateInviteCode();
    final docRef = _firestore.collection('groups').doc();

    await docRef.set({
      'name': name,
      'ownerUid': ownerUid,
      'inviteCode': inviteCode,
      'members': [ownerUid],
      'createdAt': FieldValue.serverTimestamp(),
    });

    return docRef.id;
  }

  /// Unirse a un grupo mediante código de invitación de 6 caracteres
  Future<String> joinGroupWithCode({
    required String inviteCode,
    required String userId,
  }) async {
    final snap = await _firestore
        .collection('groups')
        .where('inviteCode', isEqualTo: inviteCode.trim().toUpperCase())
        .limit(1)
        .get();

    if (snap.docs.isEmpty) {
      throw Exception('Código de grupo no encontrado.');
    }

    final groupDoc = snap.docs.first;
    await groupDoc.reference.update({
      'members': FieldValue.arrayUnion([userId]),
    });

    return groupDoc.id;
  }

  /// Crea un jugador manual/"fantasma" para el grupo
  Future<String> createManualPlayer({
    required String groupId,
    required String ownerUid,
    required String name,
    required String position,
    int ovr = 70,
    int pac = 70,
    int sho = 70,
    int pas = 70,
    int dri = 70,
    int def = 70,
    int phy = 70,
    String? photoUrl,
  }) async {
    final docRef = _firestore.collection('players').doc();

    await docRef.set({
      'name': name,
      'position': position.toUpperCase(),
      'ovr': ovr,
      'pac': pac,
      'sho': sho,
      'pas': pas,
      'dri': dri,
      'def': def,
      'phy': phy,
      'photoUrl': photoUrl,
      'ownerUid': ownerUid,
      'groupId': groupId,
      'isManual': true,
      'createdAt': FieldValue.serverTimestamp(),
      'stats': {
        'matchesPlayed': 0,
        'goals': 0,
        'assists': 0,
        'averageRating': 0.0,
        'mvpCount': 0,
      },
    });

    return docRef.id;
  }

  /// Actualiza la indumentaria/camiseta de un equipo
  Future<void> updateTeamJersey({
    required String groupId,
    required String teamId,
    required JerseyModel jersey,
  }) async {
    await _firestore.collection('groups').doc(groupId).collection('teams').doc(teamId).set({
      'jersey': jersey.toMap(),
    }, SetOptions(merge: true));
  }
}
