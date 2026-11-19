class JerseyModel {
  final String pattern;
  final String primaryColor;
  final String secondaryColor;
  final String crestMode; // 'none', 'custom', 'uploaded'
  final String crestShape; // 'classic', 'circle', 'oval', 'heater', 'crest', 'diamond'
  final String crestLayout; // adaptado a crestShape
  final String crestSymbol; // 'none', 'star', 'crown', 'ball', 'sun', 'wings', 'laurel', 'bolt', 'flame', 'swords', 'tower', 'trophy'
  final String crestText;
  final String crestSubtitle;
  final String crestTextLayout; // 'auto', 'center', 'banner', 'none'
  final String crestFont; // 'bold', 'classic', 'condensed'
  final String crestBorderColor; // '' (auto), '#D97706', '#CBD5E1', '#FFFFFF', '#171717'
  final int crestStars; // 0..3
  final bool crestLaurel;
  final bool crestCrownTop;
  final String crestUrl;
  final bool crestClipCircle;

  JerseyModel({
    this.pattern = 'plain',
    this.primaryColor = '#1E90FF',
    this.secondaryColor = '#FFFFFF',
    String? crestMode,
    this.crestShape = 'classic',
    this.crestLayout = 'chief',
    this.crestSymbol = 'crown',
    this.crestText = '',
    this.crestSubtitle = '',
    this.crestTextLayout = 'auto',
    this.crestFont = 'bold',
    this.crestBorderColor = '',
    this.crestStars = 0,
    this.crestLaurel = false,
    this.crestCrownTop = false,
    this.crestUrl = '',
    this.crestClipCircle = false,
  }) : crestMode = crestMode ??
            (crestUrl.trim().isNotEmpty ? 'uploaded' : 'none');

  bool get hasCrest =>
      (crestMode == 'uploaded' && crestUrl.trim().isNotEmpty) ||
      (crestMode == 'custom' && crestShape.isNotEmpty && crestShape != 'none');

  bool get isUploadedCrest =>
      crestMode == 'uploaded' && crestUrl.trim().isNotEmpty;

  /// Layouts interiores válidos para la silueta [shape].
  static String defaultLayoutForShape(String shape) {
    return switch (shape) {
      'circle' || 'oval' => 'ring',
      'diamond' => 'bevel',
      _ => 'chief',
    };
  }

  JerseyModel copyWith({
    String? pattern,
    String? primaryColor,
    String? secondaryColor,
    String? crestMode,
    String? crestShape,
    String? crestLayout,
    String? crestSymbol,
    String? crestText,
    String? crestSubtitle,
    String? crestTextLayout,
    String? crestFont,
    String? crestBorderColor,
    int? crestStars,
    bool? crestLaurel,
    bool? crestCrownTop,
    String? crestUrl,
    bool? crestClipCircle,
  }) {
    final nextShape = crestShape ?? this.crestShape;
    final nextUrl = crestUrl ?? this.crestUrl;
    var nextMode = crestMode ?? this.crestMode;
    if (crestMode == null) {
      if (crestUrl != null && crestUrl.trim().isNotEmpty) {
        nextMode = 'uploaded';
      } else if (crestUrl != null && nextMode == 'uploaded') {
        // Se borró la URL sin decir el modo: un escudo "subido" sin imagen no
        // existe, así que vuelve a "sin escudo" en vez de quedar en un estado
        // donde `isUploadedCrest` da falso pero el modo sigue diciendo
        // "uploaded". Quien quiera quedarse en el modo (la pantalla de subida
        // lo hace para mostrar el selector) lo pasa explícito en `crestMode`.
        nextMode = 'none';
      } else if (crestShape != null &&
          crestShape.isNotEmpty &&
          crestShape != 'none' &&
          nextMode == 'none') {
        nextMode = 'custom';
      }
    }

    return JerseyModel(
      pattern: pattern ?? this.pattern,
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      crestMode: nextMode,
      crestShape: nextShape,
      crestLayout: crestLayout ?? this.crestLayout,
      crestSymbol: crestSymbol ?? this.crestSymbol,
      crestText: crestText ?? this.crestText,
      crestSubtitle: crestSubtitle ?? this.crestSubtitle,
      crestTextLayout: crestTextLayout ?? this.crestTextLayout,
      crestFont: crestFont ?? this.crestFont,
      crestBorderColor: crestBorderColor ?? this.crestBorderColor,
      crestStars: crestStars ?? this.crestStars,
      crestLaurel: crestLaurel ?? this.crestLaurel,
      crestCrownTop: crestCrownTop ?? this.crestCrownTop,
      crestUrl: nextUrl,
      crestClipCircle: crestClipCircle ?? this.crestClipCircle,
    );
  }

  /// Extrae hasta 2-3 iniciales deportivas a partir del nombre del equipo.
  static String initialsFromTeamName(String name) {
    final cleaned = name.trim();
    if (cleaned.isEmpty) return 'FC';
    final words = cleaned
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList(growable: false);
    if (words.length >= 2) {
      final significant = words
          .where(
            (w) => !const {
              'de',
              'del',
              'la',
              'las',
              'el',
              'los',
              'y',
            }.contains(w.toLowerCase()),
          )
          .toList(growable: false);
      final source = significant.length >= 2 ? significant : words;
      return source.take(3).map((w) => w[0]).join().toUpperCase();
    }
    final single = words.first.toUpperCase();
    return single.length <= 3 ? single : single.substring(0, 2);
  }

  static String _legacyPatternToLayout(String shape, String? legacyPattern) {
    return switch (legacyPattern) {
      'stripes' => 'stripes',
      'halves' => 'halves',
      'quarters' => 'quarters',
      'band' => shape == 'circle' || shape == 'oval' ? 'stripes_band' : 'chief',
      'solid' => shape == 'circle' || shape == 'oval' ? 'double_ring' : 'framed',
      'diagonal' => 'diagonal',
      _ => defaultLayoutForShape(shape),
    };
  }

  factory JerseyModel.fromMap(Map<String, dynamic>? map) {
    if (map == null) return JerseyModel();
    final rawUrl = (map['crestUrl'] as String?)?.trim() ?? '';
    final rawShape = (map['crestShape'] as String?)?.trim() ?? '';
    final rawMode = (map['crestMode'] as String?)?.trim() ?? '';
    final resolvedMode = switch (rawMode) {
      'uploaded' when rawUrl.isNotEmpty => 'uploaded',
      'custom' => 'custom',
      'none' => 'none',
      _ => rawUrl.isNotEmpty
          ? 'uploaded'
          : (rawShape.isNotEmpty && rawShape != 'none' ? 'custom' : 'none'),
    };
    final resolvedShape =
        rawShape.isEmpty || rawShape == 'none' ? 'classic' : rawShape;
    final rawLayout = (map['crestLayout'] as String?)?.trim() ?? '';
    final resolvedLayout = rawLayout.isNotEmpty
        ? rawLayout
        : _legacyPatternToLayout(
            resolvedShape,
            map['crestPattern'] as String?,
          );
    final rawText =
        (map['crestText'] as String?) ??
        (map['crestInitials'] as String?) ??
        '';
    final rawSymbol = (map['crestSymbol'] as String?)?.trim() ?? '';
    final resolvedTextLayout =
        (map['crestTextLayout'] as String?)?.trim() ??
        ((map['crestShowBanner'] as bool?) == true ? 'banner' : 'auto');

    return JerseyModel(
      // La web guarda el tipo de camiseta en 'type' (ver Jersey en src/lib/types.ts);
      // 'pattern' se acepta como fallback por si hay datos viejos.
      pattern: map['type'] ?? map['pattern'] ?? 'plain',
      primaryColor: map['primaryColor'] ?? '#1E90FF',
      secondaryColor: map['secondaryColor'] ?? '#FFFFFF',
      crestMode: resolvedMode,
      crestShape: resolvedShape,
      crestLayout: resolvedLayout,
      crestSymbol: rawSymbol == 'initials' || rawSymbol.isEmpty
          ? (rawSymbol == 'initials' ? 'none' : 'crown')
          : rawSymbol,
      crestText: rawText,
      crestSubtitle: (map['crestSubtitle'] as String?) ?? '',
      crestTextLayout: resolvedTextLayout,
      crestFont: (map['crestFont'] as String?) ?? 'bold',
      crestBorderColor: (map['crestBorderColor'] as String?) ?? '',
      crestStars: ((map['crestStars'] as num?)?.toInt() ?? 0).clamp(0, 3),
      crestLaurel: (map['crestLaurel'] as bool?) ?? false,
      crestCrownTop: (map['crestCrownTop'] as bool?) ?? false,
      crestUrl: rawUrl,
      crestClipCircle: (map['crestClipCircle'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    if (crestMode == 'uploaded' && crestUrl.trim().isNotEmpty) {
      return {
        'type': pattern,
        'primaryColor': primaryColor,
        'secondaryColor': secondaryColor,
        'crestMode': 'uploaded',
        'crestUrl': crestUrl.trim(),
        if (crestClipCircle) 'crestClipCircle': true,
      };
    }

    if (crestMode == 'custom' && crestShape != 'none') {
      final cleanText = crestText.trim().toUpperCase();
      final cleanSub = crestSubtitle.trim().toUpperCase();
      return {
        'type': pattern,
        'primaryColor': primaryColor,
        'secondaryColor': secondaryColor,
        'crestMode': 'custom',
        'crestShape': crestShape,
        'crestLayout': crestLayout,
        'crestSymbol': crestSymbol,
        if (cleanText.isNotEmpty) 'crestText': cleanText,
        if (cleanText.isNotEmpty)
          'crestInitials':
              cleanText.length <= 4 ? cleanText : cleanText.substring(0, 4),
        if (cleanSub.isNotEmpty) 'crestSubtitle': cleanSub,
        'crestTextLayout': crestTextLayout,
        'crestFont': crestFont,
        if (crestBorderColor.isNotEmpty) 'crestBorderColor': crestBorderColor,
        if (crestStars > 0) 'crestStars': crestStars.clamp(0, 3),
        if (crestLaurel) 'crestLaurel': true,
        if (crestCrownTop) 'crestCrownTop': true,
      };
    }

    return {
      'type': pattern,
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
    };
  }
}

/// Port de GroupTeamMember (src/lib/types.ts): {playerId, number, status}.
class TeamMemberEntry {
  final String playerId;
  final int number;
  final String status; // 'titular' | 'suplente'

  TeamMemberEntry({required this.playerId, this.number = 0, this.status = 'titular'});

  factory TeamMemberEntry.fromMap(Map<String, dynamic> map) {
    return TeamMemberEntry(
      playerId: (map['playerId'] ?? map['uid'] ?? '').toString(),
      number: (map['number'] as num?)?.toInt() ?? 0,
      status: map['status'] as String? ?? 'titular',
    );
  }

  Map<String, dynamic> toMap() => {'playerId': playerId, 'number': number, 'status': status};
}

class GroupTeamModel {
  final String id;
  final String name;
  final String groupId;
  final JerseyModel jersey;
  final List<TeamMemberEntry> members;
  final String createdBy;

  GroupTeamModel({
    required this.id,
    required this.name,
    this.groupId = '',
    required this.jersey,
    this.members = const [],
    this.createdBy = '',
  });

  List<String> get playerIds => members.map((m) => m.playerId).toList();

  factory GroupTeamModel.fromMap(Map<String, dynamic> map, String id) {
    // La web guarda 'members: {playerId, number, status}[]' (ver GroupTeam en
    // src/lib/types.ts), no una lista plana de ids.
    final rawMembers = (map['members'] ?? map['playerIds'] ?? []) as List<dynamic>;
    final members = rawMembers.map((m) {
      if (m is String) return TeamMemberEntry(playerId: m);
      if (m is Map) return TeamMemberEntry.fromMap(m.cast<String, dynamic>());
      return TeamMemberEntry(playerId: '');
    }).where((m) => m.playerId.isNotEmpty).toList();

    return GroupTeamModel(
      id: id,
      name: map['name'] ?? 'Equipo',
      groupId: map['groupId'] as String? ?? '',
      jersey: JerseyModel.fromMap(map['jersey'] as Map<String, dynamic>?),
      members: members,
      createdBy: map['createdBy'] as String? ?? '',
    );
  }
}

class GroupModel {
  final String id;
  final String name;
  final String ownerUid;
  final String inviteCode;
  final List<String> members;
  final String? logoUrl;
  GroupModel({
    required this.id,
    required this.name,
    required this.ownerUid,
    required this.inviteCode,
    this.members = const [],
    this.logoUrl,
  });

  factory GroupModel.fromFirestore(Map<String, dynamic> data, String id) {
    return GroupModel(
      id: id,
      name: data['name'] ?? 'Mi Grupo',
      ownerUid: data['ownerUid'] ?? '',
      inviteCode: data['inviteCode'] ?? '',
      members: List<String>.from(data['members'] ?? []),
      logoUrl: data['logoUrl'],
    );
  }
}
