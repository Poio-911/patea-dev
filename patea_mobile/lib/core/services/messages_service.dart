import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/player_message_model.dart';
import 'auth_service.dart';
import 'callable_functions.dart';

final messagesServiceProvider = Provider<MessagesService>((ref) {
  return MessagesService();
});

final playerMessagesStreamProvider =
    StreamProvider<List<PlayerMessageModel>>((ref) {
      final uid = ref.watch(authStateProvider).value?.uid;
      if (uid == null) return Stream.value(const []);
      return ref.watch(messagesServiceProvider).streamMessages(uid);
    });

final unreadMessagesCountProvider = Provider<int>((ref) {
  final list = ref.watch(playerMessagesStreamProvider).value ?? const [];
  return list.where((m) => !m.isRead).length;
});

class MessagesService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<List<PlayerMessageModel>> streamMessages(String uid) {
    return _firestore
        .collection('users/$uid/messages')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => PlayerMessageModel.fromFirestore(d.data(), d.id))
              .toList(),
        );
  }

  Future<void> markAsRead({
    required String uid,
    required String messageId,
  }) async {
    await _firestore
        .collection('users/$uid/messages')
        .doc(messageId)
        .update({'isRead': true});
  }

  Future<void> sendMessage({
    required String toUid,
    required String text,
    String? matchId,
  }) async {
    await callFunction('sendPlayerMessage', {
      'toUid': toUid,
      'text': text.trim(),
      if (matchId != null && matchId.isNotEmpty) 'matchId': matchId,
    });
  }
}
