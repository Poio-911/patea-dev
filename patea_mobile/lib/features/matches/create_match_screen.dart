import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/services/match_service.dart';
import '../../core/services/auth_service.dart';

class CreateMatchScreen extends ConsumerStatefulWidget {
  const CreateMatchScreen({super.key});

  @override
  ConsumerState<CreateMatchScreen> createState() => _CreateMatchScreenState();
}

class _CreateMatchScreenState extends ConsumerState<CreateMatchScreen> {
  final _titleController = TextEditingController(text: 'Picadito Semanal');
  final _locationController = TextEditingController(text: 'Canchas del Parque');
  String _selectedType = 'manual';
  final DateTime _selectedDate = DateTime.now().add(const Duration(days: 2));
  bool _isLoading = false;

  Future<void> _handleCreate() async {
    final user = ref.read(authServiceProvider).currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    try {
      final dateStr = '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year} 20:00';

      await ref.read(matchServiceProvider).createMatch(
        title: _titleController.text.trim(),
        date: dateStr,
        type: _selectedType,
        ownerUid: user.uid,
        location: _locationController.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Partido creado exitosamente!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al crear partido: $e'),
            backgroundColor: AppColors.destructive,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'CREAR PARTIDO',
          style: AppTypography.headline(size: 18, weight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _titleController,
              style: AppTypography.body(),
              decoration: const InputDecoration(
                labelText: 'Título del Partido',
                prefixIcon: Icon(Icons.sports_soccer, color: AppColors.voltNeon),
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _locationController,
              style: AppTypography.body(),
              decoration: const InputDecoration(
                labelText: 'Ubicación / Cancha',
                prefixIcon: Icon(Icons.location_on, color: AppColors.voltNeon),
              ),
            ),
            const SizedBox(height: 20),

            Text(
              'TIPO DE PARTIDO',
              style: AppTypography.headline(size: 13, color: AppColors.textMuted),
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Manual (IA)'),
                    selected: _selectedType == 'manual',
                    onSelected: (_) => setState(() => _selectedType = 'manual'),
                    selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                    checkmarkColor: AppColors.voltNeon,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Colaborativo'),
                    selected: _selectedType == 'collaborative',
                    onSelected: (_) => setState(() => _selectedType = 'collaborative'),
                    selectedColor: AppColors.voltNeon.withValues(alpha: 0.25),
                    checkmarkColor: AppColors.voltNeon,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            ElevatedButton(
              onPressed: _isLoading ? null : _handleCreate,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                    )
                  : const Text('CREAR PARTIDO'),
            ),
          ],
        ),
      ),
    );
  }
}
