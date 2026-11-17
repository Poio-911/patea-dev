import 'package:flutter/material.dart';
import 'competition_hub_screen.dart';

class CupBracketScreen extends StatelessWidget {
  final String cupId;
  const CupBracketScreen({super.key, required this.cupId});
  @override
  Widget build(BuildContext context) =>
      CompetitionHubScreen(collection: 'cups', id: cupId);
}
