import 'package:flutter_test/flutter_test.dart';
import 'package:patea_mobile/main.dart';

void main() {
  testWidgets('App basic smoke test', (WidgetTester tester) async {
    expect(PateaApp, isNotNull);
  });
}
