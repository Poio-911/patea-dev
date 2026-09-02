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
import '../../features/matches/match_detail_screen.dart';
import '../../features/matches/match_evaluate_screen.dart';
import '../../features/matches/create_match_screen.dart';
import '../../features/competitions/competitions_screen.dart';
import '../../features/competitions/cup_bracket_screen.dart';
import '../../features/evaluations/evaluation_form_screen.dart';
import '../../features/social/social_feed_screen.dart';
import '../../features/social/leaderboard_screen.dart';
import '../../features/coach/ai_coach_screen.dart';
import '../../features/explorar/explorar_screen.dart';
import '../../features/evaluations/evaluations_inbox_screen.dart';
import '../../features/groups/groups_screen.dart';
import '../../features/groups/create_team_screen.dart';
import '../../features/groups/team_detail_screen.dart';

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
          GoRoute(
            path: '/explorar',
            builder: (context, state) => const ExplorarScreen(),
          ),
          GoRoute(
            path: '/evaluations',
            builder: (context, state) => const EvaluationsInboxScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/matches/create',
        builder: (context, state) => const CreateMatchScreen(),
      ),
      GoRoute(
        path: '/groups',
        builder: (context, state) => const GroupsScreen(),
      ),
      GoRoute(
        path: '/groups/teams/new',
        builder: (context, state) {
          final groupId = state.uri.queryParameters['groupId'] ?? '';
          return CreateTeamScreen(groupId: groupId);
        },
      ),
      GoRoute(
        path: '/groups/teams/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return TeamDetailScreen(teamId: id);
        },
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
          return MatchDetailScreen(matchId: id);
        },
      ),
      GoRoute(
        path: '/matches/:id/live',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return LiveMatchScreen(matchId: id);
        },
      ),
      GoRoute(
        path: '/matches/:id/evaluate',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return MatchEvaluateScreen(matchId: id);
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

/// Port de nav-config.ts + mobile-nav.tsx (web): 5 slots reales —
/// Panel, Jugadores, Partidos (botón central que abre un bottom sheet con
/// "Mis Partidos" / "Competiciones"), Explorar, Evaluaciones.
class _ScaffoldWithNavBar extends StatelessWidget {
  final Widget child;

  const _ScaffoldWithNavBar({required this.child});

  void _openPartidosSheet(BuildContext context) {
    final isMatchesActive = GoRouterState.of(context).uri.toString().startsWith('/matches');
    final isCompetitionsActive = GoRouterState.of(context).uri.toString().startsWith('/competitions');

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        decoration: const BoxDecoration(
          color: Color(0xFF141B27),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 5,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            _PartidosSheetItem(
              icon: Icons.calendar_today,
              label: 'Mis Partidos',
              isActive: isMatchesActive,
              onTap: () {
                Navigator.pop(sheetContext);
                context.go('/matches');
              },
            ),
            const SizedBox(height: 8),
            _PartidosSheetItem(
              icon: Icons.emoji_events,
              label: 'Competiciones',
              isActive: isCompetitionsActive,
              onTap: () {
                Navigator.pop(sheetContext);
                context.go('/competitions');
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final isMatchesActive = location.startsWith('/matches') || location.startsWith('/competitions');

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xF210151E),
          border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.35), width: 1.0)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, -4))],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 60,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(
                  icon: Icons.dashboard_outlined,
                  activeIcon: Icons.dashboard_rounded,
                  label: 'Panel',
                  isSelected: location == '/',
                  onTap: () => context.go('/'),
                ),
                _NavItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Jugadores',
                  isSelected: location.startsWith('/players'),
                  onTap: () => context.go('/players'),
                ),
                _NavItem(
                  icon: Icons.calendar_today_outlined,
                  activeIcon: Icons.calendar_today,
                  label: 'Partidos',
                  isSelected: isMatchesActive,
                  onTap: () => _openPartidosSheet(context),
                ),
                _NavItem(
                  icon: Icons.public_outlined,
                  activeIcon: Icons.public,
                  label: 'Explorar',
                  isSelected: location.startsWith('/explorar'),
                  onTap: () => context.go('/explorar'),
                ),
                _NavItem(
                  icon: Icons.checklist_rtl_outlined,
                  activeIcon: Icons.checklist_rtl,
                  label: 'Evaluaciones',
                  isSelected: location.startsWith('/evaluations'),
                  onTap: () => context.go('/evaluations'),
                ),
              ],
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
              color: isSelected ? AppColors.voltNeon : AppColors.textMuted,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: AppTypography.headline(
                size: 10,
                weight: isSelected ? FontWeight.w800 : FontWeight.w500,
                color: isSelected ? AppColors.voltNeon : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 2),
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
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActive ? AppColors.voltNeon.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isActive ? AppColors.voltNeon : AppColors.cardSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: isActive ? Colors.black : AppColors.textMuted),
            ),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppTypography.headline(size: 15, color: isActive ? AppColors.voltNeon : AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
