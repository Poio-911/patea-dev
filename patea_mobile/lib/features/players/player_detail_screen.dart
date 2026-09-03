import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/models/player_model.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/player_card_widget.dart';
import 'widgets/player_match_debrief.dart';
import 'widgets/player_teams_list.dart';

/// Port de `PlayerProfileView` (src/components/player-profile-view.tsx), que en
/// la web es el contenido tanto de `/players/[id]` como de `/profile`.
///
/// Orden y condiciones tomados del componente real:
///   1. Carta del jugador
///   2. Equipos actuales (se oculta si no pertenece a ninguno)
///   3. Accesos a Análisis IA y Progresión — SÓLO en el perfil propio y sólo
///      si `player.id == player.ownerUid` (o sea, no es un jugador manual)
///   4. Historial de partidos, visible en cualquier perfil
///
/// Sigue sin portar, con motivo: generación de foto con IA y recorte manual
/// (consumen créditos, dominio de Pagos no abordado), botón Seguir (depende de
/// Comunidad, Sección 9) y el panel de logros (Achievements, fuera del barrido).
class PlayerDetailScreen extends ConsumerWidget {
  final String playerId;

  /// Cuando es true muestra el encabezado "Mi Perfil" en vez del nombre del
  /// jugador, igual que `/profile` en la web.
  final bool asOwnProfile;

  const PlayerDetailScreen({
    super.key,
    required this.playerId,
    this.asOwnProfile = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));
    final currentUid = ref.watch(authServiceProvider).currentUser?.uid;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          asOwnProfile ? 'MI PERFIL' : 'PERFIL DEL JUGADOR',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: playerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.voltNeon)),
        error: (err, _) => Center(
          child: Text('Error: $err', style: AppTypography.body(color: AppColors.textMuted)),
        ),
        data: (player) {
          if (player == null) return _NotFound(asOwnProfile: asOwnProfile);

          final isOwnProfile = currentUid == player.id;
          // Un jugador "manual" (creado a mano por un organizador) no tiene
          // cuenta propia, así que no tiene análisis ni progresión.
          final hasOwnAccount = player.ownerUid != null && player.id == player.ownerUid;

          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
            children: [
              Text(
                asOwnProfile ? 'Mi Perfil' : player.name,
                style: AppTypography.headline(size: 26, weight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                asOwnProfile
                    ? 'Tu información personal, estadísticas de jugador y actividad.'
                    : 'Perfil y estadísticas del jugador.',
                style: AppTypography.body(size: 13, color: AppColors.textMuted),
              ),
              const SizedBox(height: 20),

              Center(
                child: SizedBox(
                  width: 260,
                  height: 380,
                  child: PlayerCardWidget(player: player),
                ),
              ),

              if (isOwnProfile && hasOwnAccount) ...[
                const SizedBox(height: 14),
                Center(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/profile/edit'),
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    label: const Text('Editar perfil'),
                  ),
                ),
              ],

              if (!isOwnProfile) ...[
                const SizedBox(height: 14),
                Center(
                  child: OutlinedButton.icon(
                    onPressed: () => SharePlus.instance.share(
                      ShareParams(
                        text: 'Mirá el perfil de ${player.name} en Pateá — OVR ${player.ovr}',
                      ),
                    ),
                    icon: const Icon(Icons.share_outlined, size: 16),
                    label: const Text('Compartir'),
                  ),
                ),
              ],

              const SizedBox(height: 26),
              PlayerTeamsList(playerId: playerId, groupId: player.groupId),

              if (isOwnProfile && hasOwnAccount) ...[
                const SizedBox(height: 26),
                Row(
                  children: [
                    _ActionCard(
                      title: 'Análisis con IA',
                      description: 'Descubrí patrones y recibí consejos del DT virtual.',
                      icon: Icons.psychology_outlined,
                      onTap: () => context.push('/coach'),
                    ),
                    const SizedBox(width: 12),
                    _ActionCard(
                      title: 'Progresión de OVR',
                      description: 'Mirá cómo evolucionaron tus estadísticas.',
                      icon: Icons.show_chart,
                      onTap: () => context.push('/players/$playerId/progression'),
                    ),
                  ],
                ),
              ],

              // Acá había un "POLÍGONO DE RENDIMIENTO" (gráfico radar) que no
              // existe en la web: era un invento del port. Además duplicaba los
              // seis atributos que la carta ya muestra con sus barras.

              const SizedBox(height: 28),
              Text(
                'ESTADÍSTICAS',
                style: AppTypography.headline(size: 14, weight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              _StatsRow(player: player),

              const SizedBox(height: 30),
              Text(
                'HISTORIAL DE PARTIDOS',
                style: AppTypography.headline(size: 14, weight: FontWeight.w700),
              ),
              const SizedBox(height: 14),
              PlayerMatchDebrief(playerId: playerId),
            ],
          );
        },
      ),
    );
  }
}

class _NotFound extends StatelessWidget {
  final bool asOwnProfile;

  const _NotFound({required this.asOwnProfile});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_off_outlined, size: 44, color: AppColors.textMuted.withValues(alpha: 0.4)),
            const SizedBox(height: 14),
            Text(
              asOwnProfile
                  ? 'Todavía no tenés un perfil de jugador.'
                  : 'Jugador no encontrado.',
              textAlign: TextAlign.center,
              style: AppTypography.headline(size: 15, weight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              asOwnProfile
                  ? 'Se crea al sumarte a un grupo y jugar tu primer partido.'
                  : 'Puede haber sido eliminado del plantel.',
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => context.go('/players'),
              icon: const Icon(Icons.arrow_back, size: 16),
              label: const Text('Volver al Plantel'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final VoidCallback onTap;

  const _ActionCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: AppTypography.body(size: 12, weight: FontWeight.w700),
                    ),
                  ),
                  Icon(icon, size: 18, color: AppColors.voltNeon),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                description,
                style: AppTypography.body(size: 10, color: AppColors.textMuted, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final PlayerModel player;

  const _StatsRow({required this.player});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatCard(title: 'Partidos', value: '${player.stats.matchesPlayed}'),
        const SizedBox(width: 10),
        _StatCard(title: 'Goles', value: '${player.stats.goals}'),
        const SizedBox(width: 10),
        _StatCard(title: 'Asist.', value: '${player.stats.assists}'),
        const SizedBox(width: 10),
        _StatCard(title: 'Rating', value: player.stats.averageRating.toStringAsFixed(1)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;

  const _StatCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(value, style: AppTypography.sportNumber(size: 18, color: AppColors.voltNeon)),
            const SizedBox(height: 4),
            Text(
              title,
              style: AppTypography.code(size: 10, color: AppColors.textMuted),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
