import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/constants/performance_tags.dart';
import '../../core/services/evaluation_service.dart';
import '../../core/services/firestore_service.dart';
import '../../core/services/auth_service.dart';
import '../../core/widgets/player_position_badge.dart';

class EvaluationFormScreen extends ConsumerStatefulWidget {
  final String matchId;

  const EvaluationFormScreen({super.key, required this.matchId});

  @override
  ConsumerState<EvaluationFormScreen> createState() => _EvaluationFormScreenState();
}

class _EvaluationFormScreenState extends ConsumerState<EvaluationFormScreen> {
  String? _selectedTargetPlayerId;
  double _rating = 7.0;
  final Set<String> _selectedTagIds = {};
  final _commentController = TextEditingController();
  bool _isSubmitting = false;

  void _toggleTag(String tagId) {
    setState(() {
      if (_selectedTagIds.contains(tagId)) {
        _selectedTagIds.remove(tagId);
      } else {
        if (_selectedTagIds.length < 5) {
          _selectedTagIds.add(tagId);
        }
      }
    });
  }

  Future<void> _submitEvaluation() async {
    if (_selectedTargetPlayerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor seleccioná el compañero a evaluar.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final currentUser = ref.read(authServiceProvider).currentUser;
    if (currentUser == null) return;

    setState(() => _isSubmitting = true);

    try {
      await ref.read(evaluationServiceProvider).submitEvaluation(
        matchId: widget.matchId,
        evaluatorId: currentUser.uid,
        targetPlayerId: _selectedTargetPlayerId!,
        rating: _rating,
        tagIds: _selectedTagIds.toList(),
        comment: _commentController.text.trim().isNotEmpty ? _commentController.text.trim() : null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Evaluación guardada y OVR actualizado en tiempo real!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al enviar evaluación: $e'),
            backgroundColor: AppColors.destructive,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final playersAsync = ref.watch(playersStreamProvider(null));
    final availableTags = PerformanceTagsData.allTags;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'EVALUAR RENDIMIENTO',
          style: AppTypography.headline(size: 16, weight: FontWeight.w700),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Selector del jugador a evaluar
            Text(
              'SELECCIONÁ AL JUGADOR',
              style: AppTypography.headline(size: 13, color: AppColors.textMuted),
            ),
            const SizedBox(height: 8),

            playersAsync.when(
              data: (players) {
                if (players.isEmpty) {
                  return const Text('No hay jugadores disponibles.');
                }
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedTargetPlayerId,
                      hint: Text(
                        'Elegí un compañero...',
                        style: AppTypography.body(color: AppColors.textMuted),
                      ),
                      dropdownColor: AppColors.card,
                      isExpanded: true,
                      items: players.map((p) {
                        return DropdownMenuItem<String>(
                          value: p.id,
                          child: Row(
                            children: [
                              PlayerPositionBadge(position: p.position, fontSize: 10),
                              const SizedBox(width: 10),
                              Text(p.name, style: AppTypography.headline(size: 14)),
                              const Spacer(),
                              Text('OVR ${p.ovr}', style: AppTypography.sportNumber(size: 13, color: AppColors.voltNeon)),
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (val) => setState(() => _selectedTargetPlayerId = val),
                    ),
                  ),
                );
              },
              loading: () => const LinearProgressIndicator(),
              error: (err, stack) => Text('Error: $err'),
            ),
            const SizedBox(height: 24),

            // 2. Puntuación General (1-10)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Text(
                    'CALIFICACIÓN GENERAL',
                    style: AppTypography.headline(size: 13, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _rating.toStringAsFixed(1),
                    style: AppTypography.sportNumber(size: 42, color: AppColors.voltNeon),
                  ),
                  Slider(
                    value: _rating,
                    min: 1.0,
                    max: 10.0,
                    divisions: 18,
                    activeColor: AppColors.voltNeon,
                    inactiveColor: AppColors.cardSurface,
                    onChanged: (val) => setState(() => _rating = val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 3. Selector de Tags de Rendimiento
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'TAGS DE RENDIMIENTO',
                  style: AppTypography.headline(size: 14, weight: FontWeight.w700),
                ),
                Text(
                  '${_selectedTagIds.length}/5 elegidos',
                  style: AppTypography.code(size: 11, color: AppColors.voltNeon),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: availableTags.map((tag) {
                final isSelected = _selectedTagIds.contains(tag.id);
                final isPositive = tag.impact == 'positive';

                return FilterChip(
                  label: Text(tag.name),
                  selected: isSelected,
                  onSelected: (_) => _toggleTag(tag.id),
                  backgroundColor: AppColors.card,
                  selectedColor: isPositive
                      ? AppColors.voltNeon.withValues(alpha: 0.25)
                      : AppColors.destructive.withValues(alpha: 0.25),
                  checkmarkColor: isPositive ? AppColors.voltNeon : AppColors.destructive,
                  side: BorderSide(
                    color: isSelected
                        ? (isPositive ? AppColors.voltNeon : AppColors.destructive)
                        : AppColors.border,
                  ),
                  labelStyle: AppTypography.headline(
                    size: 12,
                    color: isSelected
                        ? (isPositive ? AppColors.voltNeon : AppColors.destructive)
                        : AppColors.textPrimary,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // 4. Comentarios Opcionales
            TextField(
              controller: _commentController,
              maxLines: 3,
              style: AppTypography.body(),
              decoration: const InputDecoration(
                hintText: 'Comentarios adicionales sobre el partido (opcional)...',
              ),
            ),
            const SizedBox(height: 28),

            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitEvaluation,
              child: _isSubmitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                    )
                  : const Text('ENVIAR EVALUACIÓN'),
            ),
          ],
        ),
      ),
    );
  }
}
