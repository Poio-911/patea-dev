import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MatchChatMessage {
  final String id, text, senderId, senderName, senderPhotoUrl;
  final DateTime? createdAt;
  final bool pending;
  const MatchChatMessage({
    required this.id,
    required this.text,
    required this.senderId,
    required this.senderName,
    this.senderPhotoUrl = '',
    this.createdAt,
    this.pending = false,
  });

  factory MatchChatMessage.fromDocument(
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    final raw = data['createdAt'];
    return MatchChatMessage(
      id: doc.id,
      text: data['text'] as String? ?? '',
      senderId: data['senderId'] as String? ?? '',
      senderName: data['senderName'] as String? ?? 'Jugador',
      senderPhotoUrl: data['senderPhotoUrl'] as String? ?? '',
      createdAt: raw is Timestamp
          ? raw.toDate()
          : raw is String
          ? DateTime.tryParse(raw)
          : null,
      pending: doc.metadata.hasPendingWrites,
    );
  }
}

class MatchChatService {
  final FirebaseFirestore firestore;
  MatchChatService(this.firestore);
  CollectionReference<Map<String, dynamic>> _messages(String id) =>
      firestore.collection('matches/$id/messages');
  String newMessageId(String matchId) => _messages(matchId).doc().id;
  Stream<List<MatchChatMessage>> watch(String matchId, {int limit = 60}) =>
      _messages(matchId)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .snapshots(includeMetadataChanges: true)
          .map(
            (snapshot) =>
                snapshot.docs.map(MatchChatMessage.fromDocument).toList(),
          );

  Future<void> send({
    required String matchId,
    required String messageId,
    required String text,
    required String senderId,
    required String senderName,
    required String senderPhotoUrl,
  }) => _messages(matchId).doc(messageId).set({
    'text': text,
    'senderId': senderId,
    'senderName': senderName,
    'senderPhotoUrl': senderPhotoUrl,
    'createdAt': FieldValue.serverTimestamp(),
    'status': 'sent',
  });
}

final matchChatServiceProvider = Provider<MatchChatService>(
  (ref) => MatchChatService(FirebaseFirestore.instance),
);
final matchChatMessagesProvider = StreamProvider.autoDispose
    .family<List<MatchChatMessage>, ({String matchId, int limit})>(
      (ref, query) => ref
          .watch(matchChatServiceProvider)
          .watch(query.matchId, limit: query.limit),
    );
