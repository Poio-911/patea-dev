import 'package:cloud_firestore/cloud_firestore.dart';

const List<String> kSocialReactions = ['⚽', '🔥', '👏', '💪', '😂'];

class SocialPollOption {
  final String id;
  final String text;

  const SocialPollOption({required this.id, required this.text});

  factory SocialPollOption.fromMap(Map<String, dynamic> map) {
    return SocialPollOption(
      id: map['id'] as String? ?? '',
      text: map['text'] as String? ?? '',
    );
  }
}

class SocialPollModel {
  final String question;
  final List<SocialPollOption> options;
  final Map<String, String> votes; // uid -> optionId

  const SocialPollModel({
    required this.question,
    required this.options,
    required this.votes,
  });

  int get totalVotes => votes.length;

  int votesFor(String optionId) =>
      votes.values.where((v) => v == optionId).length;

  double ratioFor(String optionId) {
    if (totalVotes == 0) return 0;
    return votesFor(optionId) / totalVotes;
  }

  String? userVote(String? uid) => uid == null ? null : votes[uid];

  factory SocialPollModel.fromMap(Map<String, dynamic> map) {
    final rawOptions = map['options'];
    final options = rawOptions is List
        ? rawOptions
              .whereType<Map>()
              .map((m) => SocialPollOption.fromMap(Map<String, dynamic>.from(m)))
              .where((o) => o.id.isNotEmpty && o.text.isNotEmpty)
              .toList()
        : const <SocialPollOption>[];
    final rawVotes = map['votes'];
    final votes = <String, String>{};
    if (rawVotes is Map) {
      rawVotes.forEach((k, v) {
        if (k is String && v is String) votes[k] = v;
      });
    }
    return SocialPollModel(
      question: map['question'] as String? ?? '',
      options: options,
      votes: votes,
    );
  }
}

class SocialPostModel {
  final String id;
  final String type;
  final String userId;
  final String playerId;
  final String playerName;
  final String? playerPhotoUrl;
  final String playerPosition;
  final int playerOvr;
  final String groupId;
  final String text;
  final String? imageUrl;
  final Map<String, dynamic> metadata;
  final SocialPollModel? poll;
  final Map<String, List<String>> reactions;
  final List<String> likes;
  final int commentCount;
  final DateTime createdAt;

  const SocialPostModel({
    required this.id,
    required this.type,
    required this.userId,
    required this.playerId,
    required this.playerName,
    this.playerPhotoUrl,
    this.playerPosition = '',
    this.playerOvr = 0,
    this.groupId = '',
    required this.text,
    this.imageUrl,
    this.metadata = const {},
    this.poll,
    this.reactions = const {},
    this.likes = const [],
    this.commentCount = 0,
    required this.createdAt,
  });

  String? get matchId => metadata['matchId'] as String?;
  String? get matchTitle => metadata['matchTitle'] as String?;
  String? get matchDate => metadata['matchDate'] as String?;
  String? get matchLocation => metadata['matchLocation'] as String?;
  String? get teamAName => metadata['teamAName'] as String?;
  int? get teamAScore => (metadata['teamAScore'] as num?)?.toInt();
  String? get teamBName => metadata['teamBName'] as String?;
  int? get teamBScore => (metadata['teamBScore'] as num?)?.toInt();
  String? get mvpName => metadata['mvpName'] as String?;
  int? get oldOvr => (metadata['oldOvr'] as num?)?.toInt();
  int? get newOvr => (metadata['newOvr'] as num?)?.toInt();
  int? get ovrChange => (metadata['ovrChange'] as num?)?.toInt();

  bool get hasMatchCard =>
      (matchId != null && matchId!.isNotEmpty) ||
      (teamAName != null && teamBName != null);

  int reactionCount(String key) => reactions[key]?.length ?? 0;

  bool hasReacted(String key, String? uid) =>
      uid != null && (reactions[key]?.contains(uid) ?? false);

  int get totalReactions {
    final all = <String>{...likes};
    for (final list in reactions.values) {
      all.addAll(list);
    }
    return all.length;
  }

  factory SocialPostModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
  ) {
    final rawPhoto =
        (data['playerPhotoUrl'] ?? data['photoUrl']) as String?;
    final rawImage = data['imageUrl'] as String?;
    final rawMeta = data['metadata'];
    final meta = rawMeta is Map
        ? Map<String, dynamic>.from(rawMeta)
        : <String, dynamic>{};

    // Compatibilidad con feedActivities legados que tenían `newOvr`/`change` en raíz
    if (data['newOvr'] != null && meta['newOvr'] == null) {
      meta['newOvr'] = data['newOvr'];
    }
    if (data['change'] != null && meta['ovrChange'] == null) {
      meta['ovrChange'] = data['change'];
    }

    final rawReactions = data['reactions'];
    final reactions = <String, List<String>>{};
    if (rawReactions is Map) {
      rawReactions.forEach((k, v) {
        if (k is String && v is List) {
          final list = v.whereType<String>().where((s) => s.isNotEmpty).toList();
          if (list.isNotEmpty) reactions[k] = list;
        }
      });
    }

    final rawLikes = data['likes'];
    final likes = rawLikes is List
        ? rawLikes.whereType<String>().toList()
        : const <String>[];

    SocialPollModel? poll;
    if (data['poll'] is Map) {
      final parsed = SocialPollModel.fromMap(
        Map<String, dynamic>.from(data['poll'] as Map),
      );
      if (parsed.question.isNotEmpty && parsed.options.length >= 2) {
        poll = parsed;
      }
    }

    DateTime created = DateTime.fromMillisecondsSinceEpoch(0);
    final rawTs = data['timestamp'] ?? data['createdAt'];
    if (rawTs is Timestamp) {
      created = rawTs.toDate();
    } else if (rawTs is String) {
      created = DateTime.tryParse(rawTs) ?? created;
    }

    final type = data['type'] as String? ?? 'user_post';
    final rawText =
        (data['text'] ?? data['message'] ?? data['description']) as String? ??
        '';

    return SocialPostModel(
      id: id,
      type: type,
      userId: (data['userId'] ?? data['playerId'] ?? '') as String,
      playerId: (data['playerId'] ?? data['userId'] ?? '') as String,
      playerName: data['playerName'] as String? ?? 'Jugador',
      playerPhotoUrl:
          (rawPhoto != null && rawPhoto.isNotEmpty) ? rawPhoto : null,
      playerPosition: data['playerPosition'] as String? ?? '',
      playerOvr: (data['playerOvr'] as num?)?.toInt() ?? 0,
      groupId: data['groupId'] as String? ?? '',
      text: rawText,
      imageUrl: (rawImage != null && rawImage.isNotEmpty) ? rawImage : null,
      metadata: meta,
      poll: poll,
      reactions: reactions,
      likes: likes,
      commentCount: (data['commentCount'] as num?)?.toInt() ?? 0,
      createdAt: created,
    );
  }
}

class SocialCommentModel {
  final String id;
  final String activityId;
  final String userId;
  final String userName;
  final String? userPhotoUrl;
  final String text;
  final DateTime createdAt;

  const SocialCommentModel({
    required this.id,
    required this.activityId,
    required this.userId,
    required this.userName,
    this.userPhotoUrl,
    required this.text,
    required this.createdAt,
  });

  factory SocialCommentModel.fromFirestore(
    Map<String, dynamic> data,
    String id,
  ) {
    final photo = data['userPhotoUrl'] as String?;
    DateTime created = DateTime.now();
    final rawTs = data['createdAt'];
    if (rawTs is Timestamp) {
      created = rawTs.toDate();
    } else if (rawTs is String) {
      created = DateTime.tryParse(rawTs) ?? created;
    }
    return SocialCommentModel(
      id: id,
      activityId: data['activityId'] as String? ?? '',
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String? ?? 'Jugador',
      userPhotoUrl: (photo != null && photo.isNotEmpty) ? photo : null,
      text: data['text'] as String? ?? '',
      createdAt: created,
    );
  }
}

class SocialDiscoverPlayer {
  final String uid;
  final String name;
  final String? photoUrl;
  final String position;
  final int ovr;
  final String groupId;
  final bool isFollowing;

  const SocialDiscoverPlayer({
    required this.uid,
    required this.name,
    this.photoUrl,
    required this.position,
    required this.ovr,
    required this.groupId,
    required this.isFollowing,
  });

  factory SocialDiscoverPlayer.fromMap(Map<String, dynamic> map) {
    final photo = map['photoUrl'] as String?;
    return SocialDiscoverPlayer(
      uid: map['uid'] as String? ?? '',
      name: map['name'] as String? ?? 'Jugador',
      photoUrl: (photo != null && photo.isNotEmpty) ? photo : null,
      position: map['position'] as String? ?? 'MED',
      ovr: (map['ovr'] as num?)?.toInt() ?? 50,
      groupId: map['groupId'] as String? ?? '',
      isFollowing: map['isFollowing'] as bool? ?? false,
    );
  }
}
