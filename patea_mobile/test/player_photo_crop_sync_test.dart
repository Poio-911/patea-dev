import 'dart:io';

import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:patea_mobile/core/models/player_model.dart';
import 'package:patea_mobile/core/services/auth_service.dart';
import 'package:patea_mobile/core/services/firestore_service.dart';
import 'package:patea_mobile/core/services/profile_service.dart';
import 'package:patea_mobile/core/theme/app_theme.dart';
import 'package:patea_mobile/core/widgets/cropped_photo.dart';
import 'package:patea_mobile/core/widgets/patea_avatar.dart';
import 'package:patea_mobile/core/widgets/patea_top_header.dart';
import 'package:patea_mobile/features/players/edit_profile_screen.dart';
import 'package:patea_mobile/features/players/player_detail_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'goldens/arnes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const pathChannel = MethodChannel('plugins.flutter.io/path_provider');
  late Directory cacheTempDir;

  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    cacheTempDir = Directory.systemTemp.createTempSync('patea_img_cache_test_');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pathChannel, (_) async => cacheTempDir.path);
  });
  tearDownAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pathChannel, null);
    if (cacheTempDir.existsSync()) cacheTempDir.deleteSync(recursive: true);
  });

  group('Player photo resolution and crop clipping', () {
    test('PlayerModel normalizes blank photoUrl and limits fallback to linked accounts', () {
      final linked = PlayerModel.fromFirestore({
        'name': 'Fiorenzo',
        'position': 'POR',
        'ovr': 58,
        'ownerUid': 'uid-1',
        'photoUrl': '   ',
      }, 'uid-1');
      expect(linked.photoUrl, isNull);
      expect(
        linked.withFallbackPhoto('https://example.com/user.jpg').photoUrl,
        'https://example.com/user.jpg',
      );

      final manual = PlayerModel.fromFirestore({
        'name': 'Invitado',
        'position': 'DEL',
        'ovr': 60,
        'ownerUid': 'uid-1',
      }, 'manual-1');
      expect(manual.isManual, isTrue);
      expect(
        manual.withFallbackPhoto('https://example.com/user.jpg').photoUrl,
        isNull,
      );
    });

    test('getResolvedPlayersStream fills linked player photo from users collection only', () async {
      final db = FakeFirebaseFirestore();
      await db.collection('users').doc('uid-1').set({
        'photoURL': 'https://example.com/fiorenzo.jpg',
        'groups': ['g1'],
      });
      await db.collection('players').doc('uid-1').set({
        'name': 'Fiorenzo',
        'position': 'POR',
        'ovr': 58,
        'ownerUid': 'uid-1',
        'groupId': 'g1',
      });
      await db.collection('players').doc('manual-1').set({
        'name': 'Manual',
        'position': 'DEF',
        'ovr': 55,
        'ownerUid': 'uid-1',
        'groupId': 'g1',
      });

      final service = FirestoreService(db);
      final players = await service
          .getResolvedPlayersStream(groupId: 'g1')
          .firstWhere((list) => list.any((p) => p.id == 'uid-1' && p.photoUrl != null));

      final linked = players.firstWhere((p) => p.id == 'uid-1');
      final manual = players.firstWhere((p) => p.id == 'manual-1');
      expect(linked.photoUrl, 'https://example.com/fiorenzo.jpg');
      expect(manual.photoUrl, isNull);
    });

    test('getResolvedPlayerStream falls back to currentAuthPhotoUrl when user doc lacks photo', () async {
      final db = FakeFirebaseFirestore();
      await db.collection('players').doc('uid-2').set({
        'name': 'Fiorenzo',
        'position': 'POR',
        'ovr': 58,
        'ownerUid': 'uid-2',
      });

      final service = FirestoreService(db);
      final resolved = await service
          .getResolvedPlayerStream(
            'uid-2',
            currentUid: 'uid-2',
            currentAuthPhotoUrl: 'https://example.com/auth.jpg',
          )
          .first;

      expect(resolved?.photoUrl, 'https://example.com/auth.jpg');
    });

    testWidgets('PlayerDetailScreen wraps zoomed portrait in CroppedPhoto with ClipRect', (tester) async {
      final zoomedPlayer = PlayerModel(
        id: uidYo,
        name: 'Briseida',
        position: 'DEL',
        ovr: 55,
        pac: 56,
        sho: 57,
        pas: 66,
        dri: 63,
        def: 40,
        phy: 49,
        ownerUid: uidYo,
        photoUrl: 'https://example.com/briseida.jpg',
        cropX: 25,
        cropY: 12,
        cropZoom: 2.4,
      );

      final errors = await montarPantalla(
        tester,
        const PlayerDetailScreen(playerId: uidYo, asOwnProfile: true),
        tema: AppTheme.darkTheme,
        extraOverrides: [
          singlePlayerStreamProvider(uidYo).overrideWith((ref) => Stream.value(zoomedPlayer)),
        ],
      );

      expect(errors, isEmpty, reason: resumirErrores(errors));
      final cropFinder = find.byType(CroppedPhoto);
      expect(cropFinder, findsOneWidget);
      final cropWidget = tester.widget<CroppedPhoto>(cropFinder);
      expect(cropWidget.cropZoom, 2.4);
      expect(cropWidget.cropY, 12);
      expect(
        find.descendant(of: cropFinder, matching: find.byType(ClipRect)),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.descendant(of: cropFinder, matching: find.byType(ClipRect)),
          matching: find.byType(Transform),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('PateaTopHeader forwards auth fallback photo and player crop to PateaAvatar', (tester) async {
      final playerWithCrop = PlayerModel(
        id: uidYo,
        name: 'Fiorenzo',
        position: 'POR',
        ovr: 58,
        pac: 64,
        sho: 51,
        pas: 62,
        dri: 46,
        def: 62,
        phy: 62,
        ownerUid: uidYo,
        photoUrl: null,
        cropX: 30,
        cropY: 20,
        cropZoom: 1.8,
      );

      final errors = await montarPantalla(
        tester,
        const Scaffold(appBar: PateaTopHeader()),
        tema: AppTheme.darkTheme,
        extraOverrides: [
          singlePlayerStreamProvider(uidYo).overrideWith((ref) => Stream.value(playerWithCrop)),
          currentAuthPhotoUrlProvider.overrideWithValue('https://example.com/google.jpg'),
        ],
      );

      expect(errors, isEmpty, reason: resumirErrores(errors));
      final avatar = tester.widget<PateaAvatar>(find.byType(PateaAvatar));
      expect(avatar.photoUrl, 'https://example.com/google.jpg');
      expect(avatar.cropX, 30);
      expect(avatar.cropY, 20);
      expect(avatar.cropZoom, 1.8);
    });

    testWidgets('EditProfileScreen surfaces AI error near header', (tester) async {
      final basePlayer = PlayerModel(
        id: uidYo,
        name: 'Santiago',
        position: 'MED',
        ovr: 82,
        pac: 78,
        sho: 74,
        pas: 86,
        dri: 83,
        def: 71,
        phy: 76,
        ownerUid: uidYo,
        cardGenerationCredits: 2,
      );

      final errors = await montarPantalla(
        tester,
        const EditProfileScreen(playerId: uidYo),
        tema: AppTheme.darkTheme,
        extraOverrides: [
          singlePlayerStreamProvider(uidYo).overrideWith((ref) => Stream.value(basePlayer)),
          profileServiceProvider.overrideWithValue(_FailingAiProfileService()),
        ],
      );
      expect(errors, isEmpty, reason: resumirErrores(errors));

      await tester.tap(find.text('Cambiar foto'));
      await tester.pumpAndSettle();
      expect(find.textContaining('2 disponibles'), findsOneWidget);

      await tester.tap(find.text('Generar con IA'));
      await tester.pumpAndSettle();
      expect(find.text('Primero subí una foto de perfil.'), findsAtLeastNWidgets(1));
    });

    testWidgets('EditProfileScreen disables AI photo generation at 0 credits', (tester) async {
      final zeroCreditPlayer = PlayerModel(
        id: uidYo,
        name: 'Santiago',
        position: 'MED',
        ovr: 82,
        pac: 78,
        sho: 74,
        pas: 86,
        dri: 83,
        def: 71,
        phy: 76,
        ownerUid: uidYo,
        cardGenerationCredits: 0,
      );

      final errors = await montarPantalla(
        tester,
        const EditProfileScreen(playerId: uidYo),
        tema: AppTheme.darkTheme,
        extraOverrides: [
          singlePlayerStreamProvider(uidYo).overrideWith((ref) => Stream.value(zeroCreditPlayer)),
          profileServiceProvider.overrideWithValue(_FailingAiProfileService()),
        ],
      );
      expect(errors, isEmpty, reason: resumirErrores(errors));

      await tester.tap(find.text('Cambiar foto'));
      await tester.pumpAndSettle();
      expect(find.text('Sin créditos disponibles este mes.'), findsOneWidget);
      await tester.tap(find.text('Generar con IA'));
      await tester.pumpAndSettle();
      expect(find.text('Sin créditos disponibles este mes.'), findsOneWidget);
    });
  });
}

class _FailingAiProfileService extends Fake implements ProfileService {
  @override
  Future<({String photoUrl, int? creditsRemaining})> generateAiPhoto() async {
    throw Exception('Primero subí una foto de perfil.');
  }
}
