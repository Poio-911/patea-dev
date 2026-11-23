import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../constants/sections.dart';
import '../theme/app_radii.dart';
import '../theme/app_typography.dart';
import '../theme/match_theme.dart';
import '../theme/patea_colors.dart';
import 'ovr_accent.dart';
import 'patea_brand.dart';
import 'section_icon.dart';

/// Guías contextuales disponibles según la sección donde esté el usuario.
enum HelpTopic {
  overview,
  players,
  matches,
  evaluations,
  competitions,
  explore,
  groups,
  community,
  ranking,
}

/// Resuelve el tema de ayuda según la ruta activa de navegación.
HelpTopic helpTopicForRoute(String? path) {
  final clean = (path ?? '').trim();
  if (clean.startsWith('/players') || clean == '/profile') {
    return HelpTopic.players;
  }
  if (clean.startsWith('/matches')) {
    return HelpTopic.matches;
  }
  if (clean.startsWith('/evaluations')) {
    return HelpTopic.evaluations;
  }
  if (clean.startsWith('/competitions')) {
    return HelpTopic.competitions;
  }
  if (clean.startsWith('/explorar')) {
    return HelpTopic.explore;
  }
  if (clean.startsWith('/groups')) {
    return HelpTopic.groups;
  }
  if (clean.startsWith('/leaderboard')) {
    return HelpTopic.ranking;
  }
  if (clean.startsWith('/social')) {
    return HelpTopic.community;
  }
  return HelpTopic.overview;
}

/// Abre la ayuda correspondiente al [topic]: para `overview` abre el tour de
/// bienvenida de 6 pasos; para cualquier sección abre la hoja contextual.
Future<void> openContextualHelp(
  BuildContext context, {
  required HelpTopic topic,
}) {
  if (topic == HelpTopic.overview) {
    return showDialog<void>(
      context: context,
      builder: (_) => const PateaHelpDialog(),
    );
  }
  return showContextualHelpSheet(context, topic: topic);
}

/// Resuelve de forma segura la ruta actual sin requerir GoRouter en tests aislados.
String? maybeCurrentRoutePath(BuildContext context) {
  try {
    return GoRouterState.of(context).uri.path;
  } catch (_) {
    return null;
  }
}

/// Abre la hoja inferior contextual de la sección actual.
Future<void> showContextualHelpSheet(
  BuildContext context, {
  required HelpTopic topic,
}) {
  if (topic == HelpTopic.overview) {
    return showDialog<void>(
      context: context,
      builder: (_) => const PateaHelpDialog(),
    );
  }
  final rootNavigator = Navigator.of(context, rootNavigator: true);
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetCtx) => PateaSectionHelpSheet(
      topic: topic,
      onOpenFullTour: () {
        Navigator.of(sheetCtx).pop();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!rootNavigator.mounted) return;
          showDialog<void>(
            context: rootNavigator.context,
            builder: (_) => const PateaHelpDialog(),
          );
        });
      },
    ),
  );
}

/// Recorrido general de bienvenida (primera vez / "Cómo funciona Pateá").
///
/// Sin cajas anidadas ni bordes dobles: la fotografía editorial se funde
/// directamente sobre `c.popover` y usa la barra segmentada de la app.
class PateaHelpDialog extends StatefulWidget {
  const PateaHelpDialog({super.key});

  @override
  State<PateaHelpDialog> createState() => _PateaHelpDialogState();
}

class _PateaHelpDialogState extends State<PateaHelpDialog> {
  int _currentPage = 0;
  final PageController _pageController = PageController();

  static const List<_TutorialStep> _steps = [
    _TutorialStep(
      assetPath: 'assets/brand/patea_groups.webp',
      eyebrow: 'Paso 1 · Comunidad',
      title: 'Tu grupo, tu punto de encuentro',
      content:
          'Creá un grupo o unite con su código. Ahí convive todo el plantel y se organizan los partidos con tu gente.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_locker_room.webp',
      eyebrow: 'Paso 2 · Identidad',
      title: 'Equipos con identidad propia',
      content:
          'Diseñá la camiseta, el escudo y definí el plantel de tu equipo para armar cruces o entrar a torneos.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_matchday.webp',
      eyebrow: 'Paso 3 · Convocatoria',
      title: 'Elegí cómo se arma el partido',
      content:
          'Organizá amistosos manuales, partidos colaborativos con votación o duelos por equipos con cancha y clima.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_evaluations.webp',
      eyebrow: 'Paso 4 · Tercer tiempo',
      title: 'Evaluá por nota o con etiquetas',
      content:
          'Después del partido valorá a tus compañeros de forma anónima para mover su OVR y sus seis atributos.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_explore.webp',
      eyebrow: 'Paso 5 · Explorar',
      title: 'Encontrá a quien te falta',
      content:
          'Buscá jugadores libres cerca tuyo o anotate en partidos abiertos cuando tengas ganas de jugar.',
    ),
    _TutorialStep(
      assetPath: 'assets/brand/patea_ranking.webp',
      eyebrow: 'Paso 6 · Carrera',
      title: 'Seguí tu evolución y tu historial',
      content:
          'Consultá tu ficha, tus devoluciones partido a partido, tus trofeos y tu puesto en el ranking.',
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goToPage(int index) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced) {
      _pageController.jumpToPage(index);
    } else {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scaler = MediaQuery.textScalerOf(context);
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final pageHeight = scaler
        .scale(264)
        .clamp(256.0, (viewportHeight * 0.48).clamp(256.0, 350.0));

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Container(
          decoration: BoxDecoration(
            color: c.popover,
            borderRadius: AppRadii.surfaceAll,
            border: Border.all(color: c.overlayLine),
          ),
          clipBehavior: Clip.antiAlias,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Cabecera limpia con marca y acción discreta de cierre
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 12, 10),
                  child: Row(
                    children: [
                      const Expanded(child: PateaBrand(height: 22)),
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(
                          'Cerrar',
                          style: AppTypography.action(
                            size: 13,
                            color: c.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Barra segmentada de pasos en estilo Pateá
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Row(
                    children: [
                      for (int i = 0; i < _steps.length; i++) ...[
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => _goToPage(i),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 160),
                                height: 3,
                                decoration: BoxDecoration(
                                  color: i <= _currentPage
                                      ? c.primary
                                      : c.overlayLine,
                                  borderRadius: AppRadii.hairAll,
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (i < _steps.length - 1) const SizedBox(width: 5),
                      ],
                    ],
                  ),
                ),

                // Escenas sin tarjeta interna: la foto sangra y se funde al popover
                SizedBox(
                  height: pageHeight,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _steps.length,
                    onPageChanged: (idx) => setState(() => _currentPage = idx),
                    itemBuilder: (context, index) {
                      final step = _steps[index];
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            height: 122,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                Image.asset(
                                  step.assetPath,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) =>
                                      ColoredBox(color: c.cardSurface),
                                ),
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      stops: const [0.0, 0.55, 1.0],
                                      colors: [
                                        c.popover.withValues(alpha: 0.05),
                                        c.popover.withValues(alpha: 0.45),
                                        c.popover,
                                      ],
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 20,
                                  bottom: 8,
                                  child: Text(
                                    step.eyebrow,
                                    style: AppTypography.code(
                                      size: 11,
                                      weight: FontWeight.w700,
                                      color: c.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    step.title,
                                    style: AppTypography.headline(
                                      size: 19,
                                      weight: FontWeight.w800,
                                      color: c.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    step.content,
                                    style: AppTypography.body(
                                      size: 14,
                                      color: c.textSecondary,
                                      height: 1.45,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Row(
                    children: [
                      if (_currentPage > 0) ...[
                        OutlinedButton(
                          onPressed: () => _goToPage(_currentPage - 1),
                          child: const Text('Anterior'),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: FilledButton(
                          onPressed: () {
                            if (_currentPage < _steps.length - 1) {
                              _goToPage(_currentPage + 1);
                            } else {
                              Navigator.of(context).pop();
                            }
                          },
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: AppRadii.cardAll,
                            ),
                          ),
                          child: Text(
                            _currentPage < _steps.length - 1
                                ? 'Siguiente'
                                : 'Empezar a jugar',
                            style: AppTypography.action(
                              size: 15,
                              color: c.onPrimary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TutorialStep {
  final String assetPath;
  final String eyebrow;
  final String title;
  final String content;

  const _TutorialStep({
    required this.assetPath,
    required this.eyebrow,
    required this.title,
    required this.content,
  });
}

/// Hoja inferior de ayuda contextual: muestra reglas, insignias y definiciones
/// propias de la sección activa sobre superficie abierta `c.popover`.
class PateaSectionHelpSheet extends StatefulWidget {
  final HelpTopic topic;
  final VoidCallback? onOpenFullTour;

  const PateaSectionHelpSheet({
    super.key,
    required this.topic,
    this.onOpenFullTour,
  });

  @override
  State<PateaSectionHelpSheet> createState() => _PateaSectionHelpSheetState();
}

class _PateaSectionHelpSheetState extends State<PateaSectionHelpSheet> {
  bool _showGoalkeeperStats = false;

  ({String title, String subtitle, Widget icon}) _headerMeta(BuildContext context) {
    final c = context.c;
    return switch (widget.topic) {
      HelpTopic.players => (
        title: 'Jugadores, OVR y atributos',
        subtitle: 'Qué significa cada sigla y cómo evoluciona la ficha.',
        icon: SectionIcon(
          section: Section.players,
          active: true,
          size: 22,
          color: c.primary,
        ),
      ),
      HelpTopic.matches => (
        title: 'Tipos y ciclo de partidos',
        subtitle: 'Qué cambia según cómo armes o juegues el encuentro.',
        icon: SectionIcon(
          section: Section.matches,
          active: true,
          size: 22,
          color: c.primary,
        ),
      ),
      HelpTopic.evaluations => (
        title: 'Evaluaciones y anonimato',
        subtitle: 'Cómo se califica, plazos de cierre y solicitudes.',
        icon: SectionIcon(
          section: Section.evaluations,
          active: true,
          size: 22,
          color: c.primary,
        ),
      ),
      HelpTopic.competitions => (
        title: 'Torneos: Ligas y Copas',
        subtitle: 'Diferencias entre campeonato por puntos y llaves.',
        icon: Icon(Icons.emoji_events_rounded, size: 22, color: c.primary),
      ),
      HelpTopic.explore => (
        title: 'Explorar jugadores y partidos',
        subtitle: 'Sumá refuerzos o encontrá cancha fuera de tu grupo.',
        icon: Icon(Icons.explore_rounded, size: 22, color: c.primary),
      ),
      HelpTopic.groups => (
        title: 'Grupos y equipos',
        subtitle: 'Cómo conviven tu comunidad y tus camisetas.',
        icon: Icon(Icons.groups_rounded, size: 22, color: c.primary),
      ),
      HelpTopic.ranking => (
        title: 'Rankings y desempates',
        subtitle: 'Cómo se ordenan las tablas del plantel.',
        icon: Icon(Icons.leaderboard_rounded, size: 22, color: c.primary),
      ),
      HelpTopic.community || HelpTopic.overview => (
        title: 'Comunidad Pateá',
        subtitle: 'Novedades, subidas de nivel y resultados del grupo.',
        icon: Icon(Icons.forum_rounded, size: 22, color: c.primary),
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final meta = _headerMeta(context);
    final maxHeight = MediaQuery.sizeOf(context).height * 0.86;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: BoxDecoration(
        color: c.popover,
        borderRadius: AppRadii.surfaceTop,
        border: Border(top: BorderSide(color: c.overlayLine)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              decoration: BoxDecoration(
                color: c.textSecondary.withValues(alpha: 0.32),
                borderRadius: AppRadii.pillAll,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 8, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: meta.icon,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        meta.title,
                        style: AppTypography.headline(
                          size: 20,
                          weight: FontWeight.w800,
                          color: c.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        meta.subtitle,
                        style: AppTypography.body(
                          size: 13,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Cerrar ayuda',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: c.textSecondary),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: c.overlayLine),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                20 + MediaQuery.paddingOf(context).bottom,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildTopicBody(context),
                  if (widget.onOpenFullTour != null) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Divider(height: 1, color: c.overlayLine),
                    ),
                    Center(
                      child: TextButton.icon(
                        onPressed: widget.onOpenFullTour,
                        icon: const Icon(Icons.menu_book_rounded, size: 17),
                        label: const Text('Ver recorrido completo de Pateá'),
                      ),
                    ),
                  ],
                  // Lo que la guía no responde, se le pregunta al asistente.
                  Padding(
                    padding: EdgeInsets.only(
                      top: widget.onOpenFullTour == null ? 16 : 0,
                    ),
                    child: Center(
                      child: TextButton.icon(
                        onPressed: () {
                          final router = GoRouter.of(context);
                          Navigator.of(context).pop();
                          router.push('/help');
                        },
                        icon: const Icon(Icons.auto_awesome_outlined, size: 17),
                        label: const Text('Preguntale al asistente'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopicBody(BuildContext context) {
    return switch (widget.topic) {
      HelpTopic.players => _buildPlayersGuide(context),
      HelpTopic.matches => _buildMatchesGuide(context),
      HelpTopic.evaluations => _buildEvaluationsGuide(context),
      HelpTopic.competitions => _buildCompetitionsGuide(context),
      HelpTopic.explore => _buildExploreGuide(context),
      HelpTopic.groups => _buildGroupsGuide(context),
      HelpTopic.ranking => _buildRankingGuide(context),
      HelpTopic.community || HelpTopic.overview => _buildCommunityGuide(context),
    };
  }

  Widget _buildPlayersGuide(BuildContext context) {
    final c = context.c;
    final tiers = [
      (label: '< 55 Base', ovr: 50),
      (label: '55–64 Cobre', ovr: 60),
      (label: '65–69 Plata', ovr: 67),
      (label: '70–79 PRO', ovr: 75),
      (label: '80–89 ELITE', ovr: 85),
      (label: '90+ ELITE+', ovr: 93),
    ];

    const fieldAttrs = [
      (code: 'RIT', name: 'Ritmo', desc: 'Velocidad en pique, arranque y retroceso.'),
      (code: 'TIR', name: 'Tiro', desc: 'Definición, potencia y puntería al arco.'),
      (code: 'PAS', name: 'Pase', desc: 'Precisión en corto o largo y visión de pase.'),
      (code: 'REG', name: 'Regate', desc: 'Control de pelota, agilidad y gambeta.'),
      (code: 'DEF', name: 'Defensa', desc: 'Marca, quites, anticipación e intercepción.'),
      (code: 'FIS', name: 'Físico', desc: 'Resistencia, fuerza en duelos y aguante.'),
    ];

    const gkAttrs = [
      (code: 'EST', name: 'Estirada', desc: 'Alcance aéreo y voladas hacia los palos.'),
      (code: 'REF', name: 'Reflejos', desc: 'Tiempo de reacción ante remates cercanos.'),
      (code: 'PAR', name: 'Paradas', desc: 'Seguridad para embolsar o desviar tiros.'),
      (code: 'VEL', name: 'Velocidad', desc: 'Rapidez al salir a achicar en mano a mano.'),
      (code: 'SAQ', name: 'Saque', desc: 'Alcance y precisión con la mano o el pie.'),
      (code: 'POS', name: 'Posicionamiento', desc: 'Ubicación bajo los tres palos y lectura de centros.'),
    ];

    final activeAttrs = _showGoalkeeperStats ? gkAttrs : fieldAttrs;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _HelpSectionTitle('¿Qué es el OVR (40–99)?'),
        const SizedBox(height: 6),
        const _HelpBodyText(
          'Resume el nivel general del jugador ponderando sus atributos según la posición: los delanteros pesan más Tiro y Ritmo; los mediocampistas, Pase y Regate; defensores y arqueros, Defensa y Físico.',
        ),
        const SizedBox(height: 8),
        const _HelpBodyText(
          'Cambia partido a partido con las evaluaciones del grupo (máximo ±1,5 por encuentro). A partir de 80 y 90 cuesta más subir.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Categorías y reflejo prisma'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final tier in tiers)
              _OvrTierPill(
                label: tier.label,
                color: ovrAccentColor(c, tier.ovr),
              ),
          ],
        ),
        const SizedBox(height: 8),
        const _HelpBodyText(
          'El color distingue la categoría del OVR, y desde 71 activa el reflejo prisma ocasional sobre el número.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Los 6 atributos de la ficha'),
        const SizedBox(height: 10),
        SegmentedButton<bool>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment<bool>(
              value: false,
              label: Text('Cancha', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            ButtonSegment<bool>(
              value: true,
              label: Text(
                'Arquero (POR)',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          selected: {_showGoalkeeperStats},
          onSelectionChanged: (s) =>
              setState(() => _showGoalkeeperStats = s.first),
        ),
        const SizedBox(height: 12),
        for (final attr in activeAttrs) ...[
          _HelpAttrRow(
            code: attr.code,
            name: attr.name,
            desc: attr.desc,
          ),
          const SizedBox(height: 10),
        ],
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Jugadores manuales'),
        const SizedBox(height: 6),
        const _HelpBodyText(
          'Las fichas marcadas como Manual representan amigos sin cuenta todavía. Acumulan partidos y notas igual, y pueden reclamar su ficha cuando se registran en Pateá.',
        ),
      ],
    );
  }

  Widget _buildMatchesGuide(BuildContext context) {
    final c = context.c;
    final types = [
      (
        theme: getMatchTypeTheme('manual'),
        desc:
            'El organizador elige quién juega y la IA o el creador arma equipos parejos por OVR. Si no figurás en la lista podés pedir lugar.',
      ),
      (
        theme: getMatchTypeTheme('collaborative'),
        desc:
            'Partido abierto al grupo: cada jugador se anota o se da de baja directo hasta completar cupos. Puede incluir votación de horario o cancha.',
      ),
      (
        theme: getMatchTypeTheme('by_teams'),
        desc:
            'Enfrenta dos equipos fijos creados en tu grupo, respetando sus planteles titulares/suplentes, camiseta y escudo.',
      ),
      (
        theme: getMatchTypeTheme('intergroup_friendly'),
        desc: 'Desafío amistoso contra otro grupo dentro de la plataforma.',
      ),
      (
        theme: getMatchTypeTheme('league'),
        desc: 'Fecha oficial de un campeonato; suma puntos y goles en la tabla.',
      ),
      (
        theme: getMatchTypeTheme('cup'),
        desc: 'Cruce oficial de eliminación directa (si empata puede definir la llave).',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _HelpSectionTitle('Tipos de partido'),
        const SizedBox(height: 10),
        for (final item in types) ...[
          _HelpIconRow(
            icon: item.theme.icon,
            color: item.theme.brandColor,
            title: item.theme.label,
            desc: item.desc,
          ),
          const SizedBox(height: 12),
        ],
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Momentos del partido'),
        const SizedBox(height: 8),
        _HelpIconRow(
          icon: Icons.event_available_rounded,
          color: c.primary,
          title: 'Próximo',
          desc: 'Confirmá asistencia, mirá el pronóstico del clima, cómo llegar y coordiná en el chat.',
        ),
        const SizedBox(height: 10),
        _HelpIconRow(
          icon: Icons.play_circle_outline_rounded,
          color: c.primary,
          title: 'En juego',
          desc: 'Seguí o dirigí el marcador minuto a minuto con cronómetro y goles en vivo.',
        ),
        const SizedBox(height: 10),
        _HelpIconRow(
          icon: Icons.fact_check_outlined,
          color: c.primary,
          title: 'Finalizado',
          desc: 'Queda la crónica del partido y se abre la ventana para evaluar a tus compañeros.',
        ),
      ],
    );
  }

  Widget _buildEvaluationsGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _HelpSectionTitle('Cómo funciona cada evaluación'),
        const SizedBox(height: 8),
        _HelpIconRow(
          icon: Icons.rate_review_outlined,
          color: c.primary,
          title: 'Nota, etiquetas o reseña (texto o voz)',
          desc:
              'Después de cada partido se te asignan compañeros para valorar. Podés dar puntaje del 1 al 10 (5 es neutro), elegir de 3 a 5 etiquetas o dejar una reseña escrita o por nota de voz, más voto al MVP y tus goles/asistencias.',
        ),
        const SizedBox(height: 12),
        _HelpIconRow(
          icon: Icons.trending_up_rounded,
          color: c.primary,
          title: 'Impacto parejo en el plantel',
          desc:
              'Todos los métodos pesan igual y se promedian entre los evaluadores al cerrar el partido, más un pequeño bono parejo por goles y asistencias. En cada tarjeta ves el impacto estimado antes de enviar.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Plazos y privacidad'),
        const SizedBox(height: 8),
        _HelpIconRow(
          icon: Icons.schedule_rounded,
          color: c.destructive,
          title: 'Ventana de 72 horas',
          desc:
              'Tenés 3 días desde el encuentro para enviar tu devolución. Cuando quedan menos de 12 h aparece el aviso urgente.',
        ),
        const SizedBox(height: 12),
        _HelpIconRow(
          icon: Icons.visibility_off_outlined,
          color: c.primary,
          title: 'Anónimas + pestaña Solicitudes',
          desc:
              'Tu nombre y tu nota de voz nunca se muestran mientras la evaluación sea anónima (sólo el resumen). Si el compañero pide saber quién lo evaluó, te llega acá en Solicitudes para elegir si revelar identidad y habilitar el audio.',
        ),
      ],
    );
  }

  Widget _buildCompetitionsGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HelpIconRow(
          icon: Icons.table_rows_rounded,
          color: getMatchTypeTheme('league').brandColor,
          title: 'Ligas (todos contra todos)',
          desc:
              'Armás un torneo por puntos con equipos del grupo. Cada cruce carga resultado, goles a favor/en contra y arma la tabla general.',
        ),
        const SizedBox(height: 14),
        _HelpIconRow(
          icon: Icons.emoji_events_rounded,
          color: getMatchTypeTheme('cup').brandColor,
          title: 'Copas (eliminación directa)',
          desc:
              'Llaves a partido único hasta la final. Los ganadores avanzan de ronda y suman el trofeo a la ficha del equipo y sus jugadores.',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Divider(height: 1, color: c.overlayLine),
        ),
        const _HelpSectionTitle('Requisitos'),
        const SizedBox(height: 6),
        const _HelpBodyText(
          'Creá al menos dos equipos desde tu grupo (con camiseta, escudo y plantel) para poder generar el fixture de liga o copa.',
        ),
      ],
    );
  }

  Widget _buildExploreGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HelpIconRow(
          icon: Icons.person_search_rounded,
          color: c.primary,
          title: 'Pestaña Jugadores',
          desc:
              'Agentes libres cerca tuyo para cubrir bajas de último momento o sumar gente estable a tu grupo.',
        ),
        const SizedBox(height: 14),
        _HelpIconRow(
          icon: Icons.stadium_outlined,
          color: c.primary,
          title: 'Pestaña Partidos',
          desc:
              'Partidos abiertos publicados por otros grupos para anotarte y jugar aunque no tengas fecha armada.',
        ),
      ],
    );
  }

  Widget _buildGroupsGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HelpIconRow(
          icon: Icons.vpn_key_outlined,
          color: c.primary,
          title: 'El Grupo (tu comunidad)',
          desc:
              'Reúne a tu gente, su código de invitación y sus roles. Podés pertenecer a varios grupos y cambiar el activo en cualquier momento.',
        ),
        const SizedBox(height: 14),
        _HelpIconRow(
          icon: Icons.checkroom_rounded,
          color: getMatchTypeTheme('by_teams').brandColor,
          title: 'Equipos del grupo',
          desc:
              'Club o camiseta interna con diseño, escudo propio y titulares/suplentes fijos para competir en Ligas, Copas o partidos Por Equipos.',
        ),
      ],
    );
  }

  Widget _buildRankingGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HelpIconRow(
          icon: Icons.leaderboard_rounded,
          color: c.primary,
          title: 'Métricas del grupo',
          desc:
              'Alterná entre OVR actual, Goles y Asistencias acumuladas del grupo activo. Los empates comparten exactamente el mismo puesto.',
        ),
      ],
    );
  }

  Widget _buildCommunityGuide(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HelpIconRow(
          icon: Icons.auto_awesome_outlined,
          color: c.primary,
          title: 'Actividad reciente',
          desc:
              'Muestra partidos cerrados, crónicas, MVP votados y movimientos de nivel de los jugadores de tu grupo.',
        ),
      ],
    );
  }
}

class _HelpSectionTitle extends StatelessWidget {
  final String text;
  const _HelpSectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.headline(
        size: 15,
        weight: FontWeight.w700,
        color: context.c.textPrimary,
      ),
    );
  }
}

class _HelpBodyText extends StatelessWidget {
  final String text;
  const _HelpBodyText(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.body(
        size: 13.5,
        color: context.c.textSecondary,
        height: 1.45,
      ),
    );
  }
}

class _HelpAttrRow extends StatelessWidget {
  final String code;
  final String name;
  final String desc;

  const _HelpAttrRow({
    required this.code,
    required this.name,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 46,
          padding: const EdgeInsets.symmetric(vertical: 4),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.primary.withValues(alpha: 0.14),
            borderRadius: AppRadii.chipAll,
          ),
          child: Text(
            code,
            style: AppTypography.code(
              size: 12,
              weight: FontWeight.w800,
              color: c.primary,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: '$name · ',
                  style: AppTypography.body(
                    size: 13.5,
                    weight: FontWeight.w700,
                    color: c.textPrimary,
                  ),
                ),
                TextSpan(
                  text: desc,
                  style: AppTypography.body(
                    size: 13.5,
                    color: c.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _HelpIconRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String desc;

  const _HelpIconRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.16),
            borderRadius: AppRadii.chipAll,
          ),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.body(
                  size: 14,
                  weight: FontWeight.w700,
                  color: c.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: AppTypography.body(
                  size: 13,
                  color: c.textSecondary,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OvrTierPill extends StatelessWidget {
  final String label;
  final Color color;

  const _OvrTierPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Text(
        label,
        style: AppTypography.code(
          size: 11.5,
          weight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
