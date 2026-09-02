import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/widgets/attributes_radar_chart.dart';
import '../../core/widgets/player_card_widget.dart';

/// Port de src/app/players/[id]/page.tsx → PlayerProfileView →
/// PlayerDetailCard (src/components/player-detail-card.tsx).
///
/// La carta grande (PlayerCardWidget, ya con barras de progreso de
/// atributos) reemplaza el header chico con avatar circular que tenía esta
/// pantalla antes — esa era la brecha real señalada en el plan ("barras de
/// progreso en stats"), ya que PlayerCardWidget ya las tiene.
///
/// Deliberadamente NO portado en esta pasada: watermark de jersey de fondo
/// (solo visible al 10% de opacidad en el tema "game" de la web cuando el
/// jugador pertenece a un equipo — bajísimo valor visual para el esfuerzo
/// de resolver el lookup de equipo/jersey), botón "Seguir" (depende del
/// sistema de follows de Comunidad/Social, Sección 9, 0%), generación de
/// foto con IA / recorte manual (créditos + Cloud Function de imagen,
/// dominio de Pagos no abordado), PlayerTeamsList (depende de
/// Grupos/Equipos, Sección 5, 0%), PlayerAchievementsPanel (Achievements,
/// fuera del barrido), y el historial completo de evaluaciones de partido
/// (`PlayerMatchDebriefView` — usa `getPlayerEvaluationsAction`, un Cloud
/// Function con lógica de privacidad de identidad de evaluadores bastante
/// compleja; queda pendiente para cuando se aborde la Sección 8
/// Evaluaciones).
class PlayerDetailScreen extends ConsumerWidget {
  final String playerId;

  const PlayerDetailScreen({super.key, required this.playerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerAsync = ref.watch(singlePlayerStreamProvider(playerId));
    final currentUid = ref.watch(authServiceProvider).currentUser?.uid;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'PERFIL DEL JUGADOR',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: playerAsync.when(
        data: (player) {
          if (player == null) {
            return Center(child: Text('Jugador no encontrado', style: AppTypography.body(color: AppColors.textMuted)));
          }

          final isOwnProfile = currentUid == player.id;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: SizedBox(
                    width: 260,
                    height: 380,
                    child: PlayerCardWidget(player: player),
                  ),
                ),
                if (!isOwnProfile) ...[
                  const SizedBox(height: 16),
                  Center(
                    child: OutlinedButton.icon(
                      onPressed: () => SharePlus.instance.share(
                        ShareParams(text: 'Mirá el perfil de ${player.name} en Pateá — OVR ${player.ovr}'),
                      ),
                      icon: const Icon(Icons.share_outlined, size: 16),
                      label: const Text('Compartir'),
                    ),
                  ),
                ],
                const SizedBox(height: 28),

                Text('POLÍGONO DE RENDIMIENTO', style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
                  child: AttributesRadarChart(player: player),
                ),
                const SizedBox(height: 24),

                Text('ESTADÍSTICAS', style: AppTypography.headline(size: 14, weight: FontWeight.w700)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _StatCard(title: 'Partidos', value: '${player.stats.matchesPlayed}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Goles', value: '${player.stats.goals}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Asistencias', value: '${player.stats.assists}'),
                    const SizedBox(width: 10),
                    _StatCard(title: 'Rating', value: player.stats.averageRating.toStringAsFixed(1)),
                  ],
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
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
            Text(title, style: AppTypography.code(size: 10, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
