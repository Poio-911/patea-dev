/// Mensaje recibido de otro jugador en `users/{uid}/messages/{id}`.
class PlayerMessageModel {
  final String id;
  final String type; // 'match_invite' | 'direct_message'
  final String fromUid;
  final String fromName;
  final String? fromPhotoUrl;
  final String text;
  final String? matchId;
  final String? matchTitle;
  final String? matchDate;
  final String? matchTime;
  final String? matchLocation;
  final bool isRead;
  final String createdAt;

  const PlayerMessageModel({
    required this.id,
    required this.type,
    required this.fromUid,
    required this.fromName,
    this.fromPhotoUrl,
    required this.text,
    this.matchId,
    this.matchTitle,
    this.matchDate,
    this.matchTime,
    this.matchLocation,
    this.isRead = false,
    required this.createdAt,
  });

  bool get hasMatch => matchId != null && matchId!.isNotEmpty;

  factory PlayerMessageModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
  ) {
    final photo = data['fromPhotoUrl'] as String?;
    return PlayerMessageModel(
      id: id,
      type: data['type'] as String? ?? 'direct_message',
      fromUid: data['fromUid'] as String? ?? '',
      fromName: data['fromName'] as String? ?? 'Jugador',
      fromPhotoUrl: photo != null && photo.isNotEmpty ? photo : null,
      text: data['text'] as String? ?? '',
      matchId: data['matchId'] as String?,
      matchTitle: data['matchTitle'] as String?,
      matchDate: data['matchDate'] as String?,
      matchTime: data['matchTime'] as String?,
      matchLocation: data['matchLocation'] as String?,
      isRead: data['isRead'] as bool? ?? false,
      createdAt: data['createdAt'] as String? ?? '',
    );
  }
}
