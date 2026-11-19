import '../models/player_model.dart';

/// One standout attribute above 70; positional importance breaks equal scores.
String? playerAttributeHighlight(PlayerModel player) {
  final priority = switch (player.position.toUpperCase()) {
    'DEL' => ['SHO', 'PAC', 'DRI', 'PAS', 'PHY', 'DEF'],
    'DEF' => ['DEF', 'PHY', 'PAC', 'PAS', 'DRI', 'SHO'],
    'POR' => ['DEF', 'DRI', 'SHO', 'PHY', 'PAS', 'PAC'],
    _ => ['PAS', 'DRI', 'PAC', 'SHO', 'DEF', 'PHY'],
  };
  final values = {'PAC': player.pac, 'SHO': player.sho, 'PAS': player.pas,
    'DRI': player.dri, 'DEF': player.def, 'PHY': player.phy};
  String? best;
  var highest = 70;
  for (final key in priority) {
    if (values[key]! > highest) {
      highest = values[key]!;
      best = key;
    }
  }
  return best;
}
