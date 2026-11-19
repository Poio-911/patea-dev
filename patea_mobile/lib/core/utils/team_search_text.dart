import 'package:flutter/painting.dart';

/// Lo mismo que hace el servidor (`normalizeSearchText`) pero conservando el
/// LARGO: cada letra con tilde pasa a su letra simple una por una, así una
/// posición en el texto normalizado es la misma en el original y se puede
/// resaltar la coincidencia sin desfasarse.
String foldSearchText(String value) {
  const from = 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ';
  const to = 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC';
  final buffer = StringBuffer();
  for (final rune in value.runes) {
    final ch = String.fromCharCode(rune);
    final i = from.indexOf(ch);
    buffer.write(i >= 0 ? to[i] : ch);
  }
  return buffer.toString().toLowerCase();
}

/// Las palabras de lo que escribió la persona, ya normalizadas.
List<String> searchQueryWords(String query) => foldSearchText(
  query,
).split(RegExp(r'[^a-z0-9]+')).where((w) => w.isNotEmpty).toList();

/// Parte [text] en pedazos marcando cuáles coinciden con la búsqueda: el
/// comienzo de cada palabra del nombre que empiece igual que alguna palabra
/// escrita. Es la misma regla del servidor (prefijo en cualquier palabra), así
/// lo que se resalta es exactamente por lo que apareció el resultado.
List<TextSpan> highlightSearchMatch(
  String text,
  String query, {
  required TextStyle base,
  required TextStyle highlight,
}) {
  final words = searchQueryWords(query);
  if (words.isEmpty) return [TextSpan(text: text, style: base)];

  final folded = foldSearchText(text);
  // Largo por largo: si algo no se pudo plegar 1:1, no se resalta (mejor que
  // resaltar mal).
  if (folded.length != text.length) return [TextSpan(text: text, style: base)];

  final marks = List<bool>.filled(text.length, false);
  for (final match in RegExp(r'[a-z0-9]+').allMatches(folded)) {
    final word = match.group(0)!;
    var best = 0;
    for (final q in words) {
      if (word.startsWith(q) && q.length > best) best = q.length;
    }
    for (var i = 0; i < best; i++) {
      marks[match.start + i] = true;
    }
  }

  final spans = <TextSpan>[];
  var start = 0;
  for (var i = 1; i <= text.length; i++) {
    if (i == text.length || marks[i] != marks[start]) {
      spans.add(
        TextSpan(
          text: text.substring(start, i),
          style: marks[start] ? highlight : base,
        ),
      );
      start = i;
    }
  }
  return spans;
}
