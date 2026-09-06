/// Quién es cada sección de la app. Un solo lugar.
///
/// El nombre de cada sección estaba escrito en **dos archivos**: el rótulo del
/// menú de abajo en el router, y el título de la pantalla en la pantalla. Dos
/// de las cinco ya habían divergido —jugadores es "Jugadores" abajo y
/// "Plantel" arriba; el panel es "Panel" y "EL VESTUARIO"— y las otras tres
/// coincidían por casualidad: cambiar el título de Partidos no cambiaba el
/// rótulo del menú.
///
/// **`navLabel` y `title` siguen siendo dos campos, a propósito.** El menú de
/// abajo tiene un quinto del ancho de la pantalla y el encabezado no, así que
/// puede haber una razón real para que digan cosas distintas — y de hecho la
/// web hace el mismo corte:
///
/// ```
/// src/components/nav/nav-config.ts:5   label: 'Jugadores'
/// src/app/players/page.tsx:112         title="Plantel"
/// ```
///
/// Lo que se arregla no es el nombre: es que ahora la diferencia es una
/// decisión visible en una línea, y no el resultado de que nadie miró los dos
/// archivos a la vez.
///
/// Esto **no** es i18n. La versión grande —`flutter_localizations` más
/// archivos ARB— además permite traducir, y es la que hay que hacer si algún
/// día la app sale del español. Para que un título viva en un solo lugar
/// alcanza con este archivo.
///
/// Ver `docs/technical/AUDITORIA_DE_ESTILOS_Y_MODO_CLARO.md`.
library;

import 'package:flutter/material.dart';

enum Section { panel, players, matches, competitions, explorar, evaluations }

@immutable
class SectionSpec {
  /// El índice de la rama en el `StatefulShellRoute`. Tiene que coincidir con
  /// el orden de `branches` en `app_router.dart`.
  final int branch;
  final String route;

  /// Cómo se llama en el menú de abajo, donde entra poco.
  final String navLabel;

  /// Cómo se llama en el encabezado de su pantalla.
  final String title;

  /// La bajada del encabezado. Null en las secciones que no la tienen.
  final String? description;

  final IconData icon;
  final IconData activeIcon;

  /// El rótulo del botón de acción del encabezado, si la sección tiene uno.
  final String? action;

  const SectionSpec({
    required this.branch,
    required this.route,
    required this.navLabel,
    required this.title,
    required this.icon,
    required this.activeIcon,
    this.description,
    this.action,
  });
}

const sections = <Section, SectionSpec>{
  Section.panel: SectionSpec(
    branch: 0,
    route: '/',
    navLabel: 'Panel',
    title: 'El Vestuario',
    description: 'El pantallazo del cuadro sin vueltas.',
    icon: Icons.dashboard_outlined,
    activeIcon: Icons.dashboard_rounded,
  ),
  Section.players: SectionSpec(
    branch: 1,
    route: '/players',
    // Distintos a propósito: así lo hace la web. Ver el doc de arriba.
    navLabel: 'Jugadores',
    title: 'Plantel',
    description:
        'Gestioná la plantilla de tu equipo y las estadísticas de los jugadores.',
    icon: Icons.person_outline,
    activeIcon: Icons.person,
    action: 'Agregar Jugador',
  ),
  Section.matches: SectionSpec(
    branch: 2,
    route: '/matches',
    navLabel: 'Partidos',
    title: 'Partidos',
    description: 'Organizá y gestioná todos tus partidos.',
    icon: Icons.calendar_today_outlined,
    activeIcon: Icons.calendar_today,
    action: 'Armar Partido',
  ),
  Section.competitions: SectionSpec(
    branch: 3,
    route: '/competitions',
    navLabel: 'Competiciones',
    title: 'Torneos y Copas',
    icon: Icons.emoji_events_outlined,
    activeIcon: Icons.emoji_events,
  ),
  Section.explorar: SectionSpec(
    branch: 5,
    route: '/explorar',
    navLabel: 'Explorar',
    title: 'Explorar',
    description:
        'Reclutá agentes libres para tus partidos, o sumate a partidos abiertos.',
    icon: Icons.public_outlined,
    activeIcon: Icons.public,
  ),
  Section.evaluations: SectionSpec(
    branch: 6,
    route: '/evaluations',
    navLabel: 'Evaluaciones',
    title: 'Evaluaciones',
    icon: Icons.checklist_rtl_outlined,
    activeIcon: Icons.checklist_rtl,
  ),
};

SectionSpec spec(Section s) => sections[s]!;
