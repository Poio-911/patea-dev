import 'package:flutter/material.dart';

/// Progress that follows its button's resolved active or disabled foreground.
class PateaButtonProgress extends StatelessWidget {
  const PateaButtonProgress({super.key});

  @override
  Widget build(BuildContext context) => CircularProgressIndicator(
    color: DefaultTextStyle.of(context).style.color,
    strokeWidth: 2,
    value: MediaQuery.disableAnimationsOf(context) ? 0.75 : null,
  );
}
