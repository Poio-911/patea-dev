/// Conversación 1 a 1 estilo WhatsApp/Telegram en `directChats/{chatId}`.
class DirectChatModel {
  final String id;
  final List<String> participants;
  final String otherUid;
  final String otherName;
  final String? otherPhotoUrl;
  final String lastMessageText;
  final String lastMessageAt;
  final String lastSenderUid;
  final int unreadCount;

  const DirectChatModel({
    required this.id,
    required this.participants,
    required this.otherUid,
    required this.otherName,
    this.otherPhotoUrl,
    required this.lastMessageText,
    required this.lastMessageAt,
    required this.lastSenderUid,
    this.unreadCount = 0,
  });

  factory DirectChatModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
    String myUid,
  ) {
    final participants = ((data['participants'] as List?) ?? const [])
        .whereType<String>()
        .toList();
    final otherUid = participants.firstWhere(
      (p) => p != myUid,
      orElse: () => '',
    );

    String otherName = 'Jugador';
    String? otherPhotoUrl;
    final info = data['participantInfo'];
    if (info is Map && otherUid.isNotEmpty && info[otherUid] is Map) {
      final otherMap = info[otherUid] as Map;
      final name = otherMap['name'] as String?;
      if (name != null && name.isNotEmpty) otherName = name;
      final photo = otherMap['photoUrl'] as String?;
      if (photo != null && photo.isNotEmpty) otherPhotoUrl = photo;
    }

    int unread = 0;
    final unreadCounts = data['unreadCounts'];
    if (unreadCounts is Map && unreadCounts[myUid] is num) {
      unread = (unreadCounts[myUid] as num).toInt();
    }

    return DirectChatModel(
      id: id,
      participants: participants,
      otherUid: otherUid,
      otherName: otherName,
      otherPhotoUrl: otherPhotoUrl,
      lastMessageText: data['lastMessageText'] as String? ?? '',
      lastMessageAt: data['lastMessageAt'] as String? ?? '',
      lastSenderUid: data['lastSenderUid'] as String? ?? '',
      unreadCount: unread < 0 ? 0 : unread,
    );
  }
}

/// Mensaje individual dentro de `directChats/{chatId}/messages/{id}`.
class DirectMessageModel {
  final String id;
  final String senderUid;
  final String senderName;
  final String? senderPhotoUrl;
  final String text;
  final String type; // 'text' | 'match_invite'
  final String? matchId;
  final String? matchTitle;
  final String? matchDate;
  final String? matchTime;
  final String? matchLocation;
  final String createdAt;

  const DirectMessageModel({
    required this.id,
    required this.senderUid,
    required this.senderName,
    this.senderPhotoUrl,
    required this.text,
    required this.type,
    this.matchId,
    this.matchTitle,
    this.matchDate,
    this.matchTime,
    this.matchLocation,
    required this.createdAt,
  });

  bool get hasMatch => matchId != null && matchId!.isNotEmpty;

  factory DirectMessageModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
  ) {
    final photo = data['senderPhotoUrl'] as String?;
    return DirectMessageModel(
      id: id,
      senderUid: data['senderUid'] as String? ?? '',
      senderName: data['senderName'] as String? ?? 'Jugador',
      senderPhotoUrl: photo != null && photo.isNotEmpty ? photo : null,
      text: data['text'] as String? ?? '',
      type: data['type'] as String? ?? 'text',
      matchId: data['matchId'] as String?,
      matchTitle: data['matchTitle'] as String?,
      matchDate: data['matchDate'] as String?,
      matchTime: data['matchTime'] as String?,
      matchLocation: data['matchLocation'] as String?,
      createdAt: data['createdAt'] as String? ?? '',
    );
  }
}
