import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/social_models.dart';
import 'auth_service.dart';
import 'callable_functions.dart';
import 'firestore_service.dart';

final socialServiceProvider = Provider<SocialService>((ref) {
  return SocialService();
});

/// UIDs a los que sigue el usuario actual (`follows` donde `followerId == uid`).
final followingUidsStreamProvider = StreamProvider<Set<String>>((ref) {
  final uid = ref.watch(authStateProvider).value?.uid;
  if (uid == null) return Stream.value(const <String>{});
  return ref.watch(socialServiceProvider).streamFollowingUids(uid);
});

/// Cantidad de seguidores de un jugador (`follows` donde `followingId == targetUid`).
final followersCountStreamProvider =
    StreamProvider.family<int, String>((ref, targetUid) {
      if (targetUid.isEmpty) return Stream.value(0);
      return ref.watch(socialServiceProvider).streamFollowersCount(targetUid);
    });

/// Feed del grupo activo (todos los integrantes del grupo ven todo lo del grupo).
final groupSocialFeedStreamProvider = StreamProvider<List<SocialPostModel>>((
  ref,
) {
  final groupAsync = ref.watch(activeGroupIdProvider);
  if (groupAsync.isLoading) return const Stream.empty();
  final groupId = groupAsync.value;
  return ref.watch(socialServiceProvider).streamGroupFeed(groupId);
});

/// Feed global / de jugadores seguidos (incluye jugadores de otros grupos).
final communitySocialFeedStreamProvider =
    StreamProvider<List<SocialPostModel>>((ref) {
      final uid = ref.watch(authStateProvider).value?.uid;
      if (uid == null) return Stream.value(const []);
      return ref.watch(socialServiceProvider).streamCommunityFeed();
    });

/// Comentarios en tiempo real de una publicación.
final socialCommentsStreamProvider =
    StreamProvider.family<List<SocialCommentModel>, String>((ref, activityId) {
      if (activityId.isEmpty) return Stream.value(const []);
      return ref.watch(socialServiceProvider).streamComments(activityId);
    });

class SocialService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<Set<String>> streamFollowingUids(String uid) {
    return _firestore
        .collection('follows')
        .where('followerId', isEqualTo: uid)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => d.data()['followingId'] as String? ?? '')
              .where((s) => s.isNotEmpty)
              .toSet(),
        );
  }

  Stream<int> streamFollowersCount(String targetUid) {
    return _firestore
        .collection('follows')
        .where('followingId', isEqualTo: targetUid)
        .snapshots()
        .map((snap) => snap.docs.length);
  }

  /// Lee las publicaciones de `socialActivities` del grupo activo (ordenadas en
  /// cliente por `createdAt` desc para no requerir índice compuesto). Si no hay
  /// `groupId`, muestra las más recientes.
  Stream<List<SocialPostModel>> streamGroupFeed(String? groupId) {
    if (groupId == null || groupId.isEmpty) {
      return streamCommunityFeed();
    }
    return _firestore
        .collection('socialActivities')
        .where('groupId', isEqualTo: groupId)
        .snapshots()
        .map((snap) {
          final list = snap.docs
              .map((d) => SocialPostModel.fromFirestore(d.data(), d.id))
              .toList();
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list;
        });
  }

  Stream<List<SocialPostModel>> streamCommunityFeed() {
    return _firestore
        .collection('socialActivities')
        .orderBy('createdAt', descending: true)
        .limit(60)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => SocialPostModel.fromFirestore(d.data(), d.id))
              .toList(),
        );
  }

  Stream<List<SocialCommentModel>> streamComments(String activityId) {
    return _firestore
        .collection('socialActivities/$activityId/comments')
        .orderBy('createdAt', descending: false)
        .limit(100)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => SocialCommentModel.fromFirestore(d.data(), d.id))
              .toList(),
        );
  }

  Future<String> uploadPostImage(File file) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('Iniciá sesión para subir una imagen.');
    }
    final ts = DateTime.now().millisecondsSinceEpoch;
    final ref = FirebaseStorage.instance
        .ref()
        .child('social-posts/${user.uid}/post_$ts.jpg');
    final bytes = await file.readAsBytes();
    final snap = await ref.putData(
      bytes,
      SettableMetadata(contentType: 'image/jpeg'),
    );
    return snap.ref.getDownloadURL();
  }

  Future<String> createPost({
    String text = '',
    String? imageUrl,
    String? matchId,
    String? groupId,
    String? pollQuestion,
    List<String>? pollOptions,
  }) async {
    Map<String, dynamic>? poll;
    if (pollQuestion != null &&
        pollQuestion.trim().isNotEmpty &&
        pollOptions != null &&
        pollOptions.where((o) => o.trim().isNotEmpty).length >= 2) {
      poll = {
        'question': pollQuestion.trim(),
        'options': pollOptions
            .map((o) => o.trim())
            .where((o) => o.isNotEmpty)
            .toList(),
      };
    }

    final result = await callFunction('createSocialPost', {
      'text': text.trim(),
      if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (matchId != null && matchId.isNotEmpty) 'matchId': matchId,
      if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      if (poll != null) 'poll': poll,
    });
    return result['postId'] as String? ?? '';
  }

  Future<bool> toggleReaction({
    required String activityId,
    required String reaction,
  }) async {
    final result = await callFunction('toggleSocialReaction', {
      'activityId': activityId,
      'reaction': reaction,
    });
    return result['added'] as bool? ?? false;
  }

  Future<void> votePoll({
    required String activityId,
    required String optionId,
  }) async {
    await callFunction('voteSocialPoll', {
      'activityId': activityId,
      'optionId': optionId,
    });
  }

  Future<void> addComment({
    required String activityId,
    required String text,
  }) async {
    await callFunction('addSocialComment', {
      'activityId': activityId,
      'text': text.trim(),
    });
  }

  Future<void> deletePost(String activityId) async {
    await callFunction('deleteSocialPost', {'activityId': activityId});
  }

  Future<bool> toggleFollow(String targetUid) async {
    final result = await callFunction('toggleFollowUser', {
      'targetUid': targetUid,
    });
    return result['following'] as bool? ?? false;
  }

  Future<List<SocialDiscoverPlayer>> searchPlayers({String query = ''}) async {
    final result = await callFunction('searchSocialPlayers', {'query': query});
    final raw = result['players'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((m) => SocialDiscoverPlayer.fromMap(Map<String, dynamic>.from(m)))
        .toList();
  }
}
