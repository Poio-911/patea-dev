import 'dart:async';
import '../../core/theme/app_radii.dart';
import 'dart:ui';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../constants/sections.dart';
import '../services/auth_service.dart';
import '../theme/patea_colors.dart';
import '../theme/app_typography.dart';
import '../widgets/patea_top_header.dart';
import '../widgets/patea_background.dart';
import '../../features/splash/splash_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/players/players_list_screen.dart';
import '../../features/players/player_detail_screen.dart';
import '../../features/players/edit_profile_screen.dart';
import '../../features/players/player_history_screen.dart';
import '../../features/players/player_progression_screen.dart';
import '../../features/matches/matches_screen.dart';
import '../../features/matches/live_match_screen.dart';
import '../../features/matches/match_detail_screen.dart';
import '../../features/matches/match_evaluate_screen.dart';
import '../../features/matches/create_match_screen.dart';
import '../../features/competitions/competitions_screen.dart';
import '../../features/competitions/cup_bracket_screen.dart';
import '../../features/evaluations/evaluation_form_screen.dart';
import '../../features/social/social_feed_screen.dart';
import '../../features/social/leaderboard_screen.dart';
import '../../features/coach/ai_coach_screen.dart';
import '../../features/dev/design_gallery_screen.dart';
import '../../features/explorar/explorar_screen.dart';
import '../../features/evaluations/evaluations_inbox_screen.dart';
import '../../features/groups/groups_screen.dart';
import '../../features/groups/create_team_screen.dart';
import '../../features/groups/team_detail_screen.dart';

/// Estado de sesión expuesto como `Listenable` para `GoRouter`.
///
/// Antes el provider del router hacía `ref.watch(authStateProvider)`, así que
/// cualquier refresh de token reconstruía el `GoRouter` entero y tiraba la
/// pila de navegación. Ahora el router se construye UNA vez y sólo se le
/// avisa que reevalúe el redirect.
///
/// `initialized` distingue "todavía no sé si hay sesión" de "no hay sesión".
/// Sin esa distinción, en cada arranque en frío el usuario con sesión válida
/// era mandado a /login y devuelto un instante después — el parpadeo que se
/// veía al abrir la app.
class AuthRouterState extends ChangeNotifier {
  AuthRouterState(Stream<User?> stream) {
    _sub = stream.listen((user) {
      _user = user;
      _initialized = true;
      notifyListeners();
    });
  }

  StreamSubscription<User?>? _sub;
  User? _user;
  bool _initialized = false;

  User? get user => _user;
  bool get initialized => _initialized;
  bool get isLoggedIn => _user != null;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final authRouterStateProvider = Provider<AuthRouterState>((ref) {
  final notifier = AuthRouterState(ref.watch(authServiceProvider).authStateChanges);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  // `read`, no `watch`: el router no debe reconstruirse nunca.
  final auth = ref.read(authRouterStateProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final loc = state.uri.path;

      // Todavía no llegó el primer evento de Firebase Auth: no decidir nada.
      if (!auth.initialized) {
        return loc == '/splash' ? null : '/splash';
      }

      final isLoggedIn = auth.isLoggedIn;

      if (loc == '/splash') {
        return isLoggedIn ? '/' : '/login';
      }
      if (!isLoggedIn && loc != '/login') return '/login';
      if (isLoggedIn && loc == '/login') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // `StatefulShellRoute.indexedStack` en vez de `ShellRoute`: cada
      // pestaña conserva su estado, su scroll y su pila de navegación al
      // cambiar de sección. Con `ShellRoute` cada toque en la barra inferior
      // destruía la pantalla y volvía a suscribir todos los listeners de
      // Firestore — es decir, se volvían a cobrar todas las lecturas.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            _ScaffoldWithNavBar(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (context, state) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/players', builder: (context, state) => const PlayersListScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/matches', builder: (context, state) => const MatchesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/competitions', builder: (context, state) => const CompetitionsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/social', builder: (context, state) => const SocialFeedScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/explorar', builder: (context, state) => const ExplorarScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/evaluations', builder: (context, state) => const EvaluationsInboxScreen()),
          ]),
        ],
      ),

      GoRoute(
        path: '/matches/create',
        builder: (context, state) => _withBackground(const CreateMatchScreen()),
      ),
      GoRoute(
        path: '/groups',
        builder: (context, state) => _withBackground(const GroupsScreen()),
      ),
      GoRoute(
        path: '/groups/teams/new',
        builder: (context, state) {
          final groupId = state.uri.queryParameters['groupId'] ?? '';
          return _withBackground(CreateTeamScreen(groupId: groupId));
        },
      ),
      GoRoute(
        path: '/groups/teams/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(TeamDetailScreen(teamId: id));
        },
      ),
      // Las pantallas de detalle son de nivel superior a propósito: se abren
      // a pantalla completa, sin la barra inferior, igual que en la web.
      GoRoute(
        path: '/players/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(PlayerDetailScreen(playerId: id));
        },
      ),
      GoRoute(
        path: '/players/:id/historial',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(PlayerHistoryScreen(playerId: id));
        },
      ),
      GoRoute(
        path: '/players/:id/progression',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(PlayerProgressionScreen(playerId: id));
        },
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (context, state) {
          final uid = auth.user?.uid ?? '';
          return _withBackground(EditProfileScreen(playerId: uid));
        },
      ),
      // `/profile` en la web es el MISMO contenido que `/players/[id]`
      // (ambos renderizan PlayerProfileView), sólo cambia el encabezado.
      GoRoute(
        path: '/profile',
        builder: (context, state) {
          final uid = auth.user?.uid ?? '';
          return _withBackground(PlayerDetailScreen(playerId: uid, asOwnProfile: true));
        },
      ),
      GoRoute(
        path: '/matches/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(MatchDetailScreen(matchId: id));
        },
      ),
      GoRoute(
        path: '/matches/:id/live',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(LiveMatchScreen(matchId: id));
        },
      ),
      GoRoute(
        path: '/matches/:id/evaluate',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(MatchEvaluateScreen(matchId: id));
        },
      ),
      GoRoute(
        path: '/competitions/cup/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return _withBackground(CupBracketScreen(cupId: id));
        },
      ),
      GoRoute(
        path: '/evaluations/:matchId',
        builder: (context, state) {
          final matchId = state.pathParameters['matchId'] ?? '';
          return _withBackground(EvaluationFormScreen(matchId: matchId));
        },
      ),
      GoRoute(
        path: '/leaderboard',
        builder: (context, state) => _withBackground(const LeaderboardScreen()),
      ),
      GoRoute(
        path: '/coach',
        builder: (context, state) => _withBackground(const AICoachScreen()),
      ),
      // La galeria del sistema de diseno. Sin `_withBackground` a proposito:
      // es para mirar los tokens contra el fondo real de cada tema, no contra
      // la foto de cancha. Solo en debug; en release la ruta no existe.
      if (kDebugMode)
        GoRoute(
          path: '/dev/gallery',
          builder: (context, state) => const DesignGalleryScreen(),
        ),
    ],
  );
});

/// Envuelve una pantalla de nivel superior con el fondo de cancha.
///
/// Las rutas dentro del `StatefulShellRoute` lo heredan del shell, pero las de
/// nivel superior (detalles, perfil, crear partido) quedaban con el fondo negro
/// del tema. En la web el fondo está en la raíz y se ve en TODAS las páginas.
Widget _withBackground(Widget child) => PateaBackground(child: child);

/// Índices de las ramas del `StatefulShellRoute`, en el mismo orden que
/// `branches` de arriba. Salen de `core/constants/sections.dart`, que es
/// donde vive la identidad de cada sección: ruta, rótulo del menú, título,
/// bajada e íconos. Antes el rótulo estaba acá y el título en la pantalla, y
/// dos de las cinco secciones ya habían divergido.
class _Branch {
  static final panel = spec(Section.panel).branch;
  static final players = spec(Section.players).branch;
  static final matches = spec(Section.matches).branch;
  static final competitions = spec(Section.competitions).branch;
  static final explorar = spec(Section.explorar).branch;
  static final evaluations = spec(Section.evaluations).branch;
}

/// Port de nav-config.ts + mobile-nav.tsx (web): 5 slots reales —
/// Panel, Jugadores, Partidos (botón central que abre un bottom sheet con
/// "Mis Partidos" / "Competiciones"), Explorar, Evaluaciones.
class _ScaffoldWithNavBar extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const _ScaffoldWithNavBar({required this.navigationShell});

  /// `goBranch` con `initialLocation: true` cuando se vuelve a tocar la
  /// pestaña activa — el gesto estándar de "volver al inicio de la sección".
  void _goBranch(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  void _openPartidosSheet(BuildContext context) {
    final current = navigationShell.currentIndex;
    final isMatchesActive = current == _Branch.matches;
    final isCompetitionsActive = current == _Branch.competitions;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        decoration: BoxDecoration(
          color: context.c.popover,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.surface)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 5,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: context.c.textSecondary.withValues(alpha: 0.3),
                borderRadius: AppRadii.hairAll,
              ),
            ),
            _PartidosSheetItem(
              icon: Icons.calendar_today,
              label: 'Mis Partidos',
              isActive: isMatchesActive,
              onTap: () {
                Navigator.pop(sheetContext);
                _goBranch(_Branch.matches);
              },
            ),
            const SizedBox(height: 8),
            _PartidosSheetItem(
              icon: Icons.emoji_events,
              label: spec(Section.competitions).navLabel,
              isActive: isCompetitionsActive,
              onTap: () {
                Navigator.pop(sheetContext);
                _goBranch(_Branch.competitions);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = navigationShell.currentIndex;
    final isMatchesActive = current == _Branch.matches || current == _Branch.competitions;

    return Scaffold(
      extendBody: true,
      extendBodyBehindAppBar: true,
      appBar: const PateaTopHeader(),
      // `GameModeBackground` en la web se monta una sola vez, arriba de
      // todas las pestañas — acá va en el shell (no por pantalla) para que
      // las 5 secciones compartan la misma foto random y no haga falta
      // repetirlo en cada una (antes solo lo tenían Panel y Jugadores;
      // Partidos/Explorar/Evaluaciones se quedaban sin fondo).
      body: PateaBackground(child: navigationShell),
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            decoration: BoxDecoration(
              color: context.c.card.withValues(alpha: 0.40), // bg-card/40
              border: Border(
                top: BorderSide(
                  color: context.c.overlayLine,
                  width: 1.0,
                ),
              ),
              boxShadow: [
                BoxShadow(
                  // Una sombra es negra en los dos temas.
color: Colors.black.withValues(alpha: 0.4),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: SizedBox(
                height: 60,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _NavItem(
                      icon: spec(Section.panel).icon,
                      activeIcon: spec(Section.panel).activeIcon,
                      label: spec(Section.panel).navLabel,
                      isSelected: current == _Branch.panel,
                      onTap: () => _goBranch(_Branch.panel),
                    ),
                    _NavItem(
                      icon: spec(Section.players).icon,
                      activeIcon: spec(Section.players).activeIcon,
                      label: spec(Section.players).navLabel,
                      isSelected: current == _Branch.players,
                      onTap: () => _goBranch(_Branch.players),
                    ),
                    _NavItem(
                      icon: spec(Section.matches).icon,
                      activeIcon: spec(Section.matches).activeIcon,
                      label: spec(Section.matches).navLabel,
                      isSelected: isMatchesActive,
                      onTap: () => _openPartidosSheet(context),
                    ),
                    _NavItem(
                      icon: spec(Section.explorar).icon,
                      activeIcon: spec(Section.explorar).activeIcon,
                      label: spec(Section.explorar).navLabel,
                      isSelected: current == _Branch.explorar,
                      onTap: () => _goBranch(_Branch.explorar),
                    ),
                    _NavItem(
                      icon: spec(Section.evaluations).icon,
                      activeIcon: spec(Section.evaluations).activeIcon,
                      label: spec(Section.evaluations).navLabel,
                      isSelected: current == _Branch.evaluations,
                      onTap: () => _goBranch(_Branch.evaluations),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              size: 22,
              color: isSelected ? context.c.primary : context.c.textSecondary,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: AppTypography.headline(
                size: 10,
                weight: isSelected ? FontWeight.w800 : FontWeight.w500,
                color: isSelected ? context.c.primary : context.c.textSecondary,
              ),
            ),
            const SizedBox(height: 2),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? context.c.primary : Colors.transparent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PartidosSheetItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _PartidosSheetItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardAll,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActive ? context.c.primary.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: AppRadii.cardAll,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isActive ? context.c.primary : context.c.cardSurface,
                borderRadius: AppRadii.cardAll,
              ),
              child: Icon(icon, size: 20, color: isActive ? context.c.onPrimary : context.c.textSecondary),
            ),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppTypography.headline(size: 15, color: isActive ? context.c.primary : context.c.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
