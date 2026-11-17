import 'package:flutter/material.dart';
import 'competition_hub_screen.dart';
export 'competitions_screen.dart' show competitionStatusLabel;

class LeagueDetailScreen extends StatelessWidget {
  final String leagueId;
  const LeagueDetailScreen({super.key, required this.leagueId});
  @override
  Widget build(BuildContext context) =>
      CompetitionHubScreen(collection: 'leagues', id: leagueId);
}
