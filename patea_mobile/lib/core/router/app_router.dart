import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/auth_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../../features/auth/login_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/players/players_list_screen.dart';
import '../../features/players/player_detail_screen.dart';
import '../../features/matches/matches_screen.dart';
import '../../features/matches/live_match_screen.dart';
import '../../features/matches/create_match_screen.dart';
import '../../features/competitions/competitions_screen.dart';
import '../../features/competitions/cup_bracket_screen.dart';
import '../../features/evaluations/evaluation_form_screen.dart';
import '../../features/social/social_feed_screen.dart';
import '../../features/social/leaderboard_screen.dart';
import '../../features/coach/ai_coach_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.value != null;
      final isLoggingIn = state.uri.toString() == '/login';

      if (!isLoggedIn && !isLoggingIn) return '/login';
      if (isLoggedIn && isLoggingIn) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => _ScaffoldWithNavBar(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/players',
            builder: (context, state) => const PlayersListScreen(),
          ),
          GoRoute(
            path: '/matches',
            builder: (context, state) => const MatchesScreen(),
          ),
          GoRoute(
            path: '/competitions',
            builder: (context, state) => const CompetitionsScreen(),
          ),
          GoRoute(
            path: '/social',
            builder: (context, state) => const SocialFeedScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/matches/create',
        builder: (context, state) => const CreateMatchScreen(),
      ),
      GoRoute(
        path: '/players/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return PlayerDetailScreen(playerId: id);
        },
      ),
      GoRoute(
        path: '/matches/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return LiveMatchScreen(matchId: id);
        },
      ),
      GoRoute(
        path: '/competitions/cup/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return CupBracketScreen(cupId: id);
        },
      ),
      GoRoute(
        path: '/evaluations/:matchId',
        builder: (context, state) {
          final matchId = state.pathParameters['matchId'] ?? '';
          return EvaluationFormScreen(matchId: matchId);
        },
      ),
      GoRoute(
        path: '/leaderboard',
        builder: (context, state) => const LeaderboardScreen(),
      ),
      GoRoute(
        path: '/coach',
        builder: (context, state) => const AICoachScreen(),
      ),
    ],
  );
});

class _ScaffoldWithNavBar extends StatelessWidget {
  final Widget child;

  const _ScaffoldWithNavBar({required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/players')) return 1;
    if (location.startsWith('/matches')) return 2;
    if (location.startsWith('/competitions')) return 3;
    if (location.startsWith('/social')) return 4;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/players');
        break;
      case 2:
        context.go('/matches');
        break;
      case 3:
        context.go('/competitions');
        break;
      case 4:
        context.go('/social');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedIdx = _calculateSelectedIndex(context);

    final navItems = [
      {'icon': Icons.dashboard_outlined, 'activeIcon': Icons.dashboard_rounded, 'label': 'Inicio'},
      {'icon': Icons.groups_outlined, 'activeIcon': Icons.groups_rounded, 'label': 'Vestuario'},
      {'icon': Icons.sports_soccer_outlined, 'activeIcon': Icons.sports_soccer_rounded, 'label': 'Partidos'},
      {'icon': Icons.emoji_events_outlined, 'activeIcon': Icons.emoji_events_rounded, 'label': 'Torneos'},
      {'icon': Icons.public_outlined, 'activeIcon': Icons.public_rounded, 'label': 'Comunidad'},
    ];

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xF210151E),
          border: Border(
            top: BorderSide(
              color: AppColors.border.withValues(alpha: 0.35),
              width: 1.0,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 60,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(navItems.length, (index) {
                final item = navItems[index];
                final isSelected = selectedIdx == index;

                return Expanded(
                  child: InkWell(
                    onTap: () => _onItemTapped(index, context),
                    splashColor: Colors.transparent,
                    highlightColor: Colors.transparent,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isSelected ? item['activeIcon'] as IconData : item['icon'] as IconData,
                          size: 22,
                          color: isSelected ? AppColors.voltNeon : AppColors.textMuted,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item['label'] as String,
                          style: AppTypography.headline(
                            size: 10,
                            weight: isSelected ? FontWeight.w800 : FontWeight.w500,
                            color: isSelected ? AppColors.voltNeon : AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 2),
                        // Dot indicator animado de la pestaña activa
                        Container(
                          width: 4,
                          height: 4,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isSelected ? AppColors.voltNeon : Colors.transparent,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
