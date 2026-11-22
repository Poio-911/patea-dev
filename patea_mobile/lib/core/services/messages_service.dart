import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/player_message_model.dart';
import 'auth_service.dart';
import 'callable_functions.dart';

final messagesServiceProvider = Provider<MessagesService>((ref) {
  return MessagesService();
});

String buildDirectChatId(String uidA, String uidB) {
  final pair = [uidA, uidB]..sort();
  return '${pair[0]}_${pair[1]}';
}

final directChatsStreamProvider = StreamProvider<List<DirectChatModel>>((ref) {
  final uid = ref.watch(authStateProvider).value?.uid;
  if (uid == null) return Stream.value(const []);
  return ref.watch(messagesServiceProvider).streamChats(uid);
});

final directChatMessagesStreamProvider =
    StreamProvider.family<List<DirectMessageModel>, String>((ref, chatId) {
      if (chatId.isEmpty) return Stream.value(const []);
      return ref.watch(messagesServiceProvider).streamChatMessages(chatId);
    });

final unreadMessagesCountProvider = Provider<int>((ref) {
  final list = ref.watch(directChatsStreamProvider).value ?? const [];
  return list.fold<int>(0, (sum, c) => sum + c.unreadCount);
});

class MessagesService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<List<DirectChatModel>> streamChats(String uid) {
    return _firestore
        .collection('directChats')
        .where('participants', arrayContains: uid)
        .snapshots()
        .map((snap) {
          final list = snap.docs
              .map((d) => DirectChatModel.fromFirestore(d.data(), d.id, uid))
              .toList();
          list.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
          return list;
        });
  }

  Stream<List<DirectMessageModel>> streamChatMessages(String chatId) {
    return _firestore
        .collection('directChats/$chatId/messages')
        .orderBy('createdAt', descending: true)
        .limit(100)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => DirectMessageModel.fromFirestore(d.data(), d.id))
              .toList(),
        );
  }

  Future<void> markChatAsRead({
    required String chatId,
    required String uid,
  }) async {
    await _firestore
        .collection('directChats')
        .doc(chatId)
        .update({'unreadCounts.$uid': 0})
        .catchError((_) {});
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
