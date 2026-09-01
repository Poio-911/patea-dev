import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/widgets/player_card_widget.dart';
import '../../core/widgets/patea_background.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(matchesStreamProvider(null));
    final playersAsync = ref.watch(playersStreamProvider(null));
    final currentUser = ref.watch(authServiceProvider).currentUser;

    return Scaffold(
      body: PateaBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: AppColors.voltNeon,
            backgroundColor: AppColors.card,
            onRefresh: () async {
              ref.invalidate(matchesStreamProvider(null));
              ref.invalidate(playersStreamProvider(null));
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. Cabecera con Saludo y Perfil
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PATEÁ',
                            style: AppTypography.headline(
                              size: 11,
                              weight: FontWeight.w900,
                              color: AppColors.voltNeon,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            currentUser?.displayName != null
                                ? '¡Hola, ${currentUser!.displayName!.split(' ').first}!'
                                : '¡Bienvenido, Crack!',
                            style: AppTypography.headline(
                              size: 22,
                              weight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.smart_toy_outlined, color: AppColors.voltNeon),
                            tooltip: 'DT Virtual IA',
                            onPressed: () => context.push('/coach'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.leaderboard_outlined, color: AppColors.textSecondary),
                            tooltip: 'Rankings',
                            onPressed: () => context.push('/leaderboard'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.logout_rounded, color: AppColors.destructive, size: 20),
                            tooltip: 'Cerrar Sesión',
                            onPressed: () async {
                              await ref.read(authServiceProvider).signOut();
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // 2. Banner de Próximo Partido / Partido en Vivo
                  matchesAsync.when(
                    data: (matches) {
                      final liveMatch = matches.where((m) => m.status == 'active').firstOrNull;
                      final nextMatch = matches.where((m) => m.status == 'upcoming').firstOrNull;
                      final displayMatch = liveMatch ?? nextMatch;

                      if (displayMatch == null) {
                        return Container(
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                            color: AppColors.card.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.sports_soccer, size: 36, color: AppColors.textMuted),
                              const SizedBox(height: 10),
                              Text(
                                'No hay partidos programados',
                                style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Creá un nuevo partido para que empiece a rodar la pelota.',
                                style: AppTypography.body(size: 12, color: AppColors.textSecondary),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 14),
                              ElevatedButton(
                                onPressed: () => context.push('/matches/create'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.voltNeon,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                ),
                                child: const Text('CREAR PARTIDO'),
                              ),
                            ],
                          ),
                        );
                      }

                      final isLive = displayMatch.status == 'active';

                      return InkWell(
                        onTap: () => context.push('/matches/${displayMatch.id}'),
                        borderRadius: BorderRadius.circular(22),
                        child: Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: AppColors.card,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: isLive ? AppColors.destructive : AppColors.voltNeon.withValues(alpha: 0.5),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: (isLive ? AppColors.destructive : AppColors.voltNeon).withValues(alpha: 0.15),
                                blurRadius: 20,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Badge de Estado y Fecha
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isLive
                                          ? AppColors.destructive.withValues(alpha: 0.2)
                                          : AppColors.voltNeon.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isLive ? AppColors.destructive : AppColors.voltNeon,
                                        width: 1,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        if (isLive) ...[
                                          Container(
                                            width: 7,
                                            height: 7,
                                            decoration: const BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: AppColors.destructive,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                        ],
                                        Text(
                                          isLive ? 'EN VIVO • MINUTO ${displayMatch.currentMinute ?? 1}\'' : 'PRÓXIMO PARTIDO',
                                          style: AppTypography.headline(
                                            size: 10,
                                            weight: FontWeight.w800,
                                            color: isLive ? AppColors.destructive : AppColors.voltNeon,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    displayMatch.date,
                                    style: AppTypography.code(size: 11, color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),

                              // Título del partido
                              Text(
                                displayMatch.title,
                                style: AppTypography.headline(size: 18, weight: FontWeight.w800),
                              ),
                              if (displayMatch.location != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      displayMatch.location!,
                                      style: AppTypography.body(size: 12, color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                              ],
                              const SizedBox(height: 16),

                              // Enfrentamiento de Equipos y Marcador
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.cardSurface.withValues(alpha: 0.7),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        displayMatch.teamA?.name ?? 'Equipo A',
                                        style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: AppColors.card,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Text(
                                        '${displayMatch.teamA?.score ?? 0} : ${displayMatch.teamB?.score ?? 0}',
                                        style: AppTypography.sportNumber(
                                          size: 20,
                                          color: isLive ? AppColors.destructive : AppColors.voltNeon,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        displayMatch.teamB?.name ?? 'Equipo B',
                                        style: AppTypography.headline(size: 15, weight: FontWeight.w700),
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                    loading: () => const LinearProgressIndicator(),
                    error: (err, _) => const SizedBox(),
                  ),
                  const SizedBox(height: 26),

                  // 3. Mis Estadísticas Rápidas
                  Text(
                    'MIS ESTADÍSTICAS',
                    style: AppTypography.headline(size: 13, weight: FontWeight.w800, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      _StatCard(label: 'PARTIDOS', value: '12', icon: Icons.sports_soccer),
                      const SizedBox(width: 8),
                      _StatCard(label: 'GOLES', value: '8', icon: Icons.local_fire_department, color: AppColors.voltNeon),
                      const SizedBox(width: 8),
                      _StatCard(label: 'ASISTENCIAS', value: '5', icon: Icons.handshake_outlined),
                      const SizedBox(width: 8),
                      _StatCard(label: 'RATING', value: '7.8', icon: Icons.star_rate_rounded, color: AppColors.goldBorder),
                    ],
                  ),
                  const SizedBox(height: 26),

                  // 4. Carrusel de Cartas 3D del Plantel
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'EL VESTUARIO',
                        style: AppTypography.headline(size: 13, weight: FontWeight.w800, color: AppColors.textSecondary),
                      ),
                      GestureDetector(
                        onTap: () => context.go('/players'),
                        child: Text(
                          'Ver todos →',
                          style: AppTypography.headline(size: 12, weight: FontWeight.w700, color: AppColors.voltNeon),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  playersAsync.when(
                    data: (players) {
                      if (players.isEmpty) {
                        return Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: AppColors.card,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Center(
                            child: Text(
                              'Añadí jugadores a tu grupo para ver sus cartas coleccionables.',
                              style: AppTypography.body(size: 12, color: AppColors.textMuted),
                            ),
                          ),
                        );
                      }

                      return SizedBox(
                        height: 230,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: players.length,
                          separatorBuilder: (_, index) => const SizedBox(width: 14),
                          itemBuilder: (context, index) {
                            final player = players[index];
                            return SizedBox(
                              width: 155,
                              child: PlayerCardWidget(
                                player: player,
                                onTap: () => context.push('/players/${player.id}'),
                              ),
                            );
                          },
                        ),
                      );
                    },
                    loading: () => const SizedBox(height: 200, child: Center(child: CircularProgressIndicator())),
                    error: (err, stack) => Center(child: Text('Error: $err')),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
            const SizedBox(height: 4),
            Text(
              value,
              style: AppTypography.sportNumber(size: 18, color: color ?? AppColors.textPrimary),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: AppTypography.code(size: 8, weight: FontWeight.w700, color: AppColors.textMuted),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
