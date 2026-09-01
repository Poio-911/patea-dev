# 🔄 Guía de Mapeo: Next.js (TypeScript) ➔ Flutter (Dart)

Este documento resume la equivalencia exacta entre componentes, pantallas, hooks y servicios de la versión web de Pateá y la versión móvil en Flutter.

---

## 1. Mapeo de Componentes Visuales

| Componente Web (Next.js / React) | Widget Flutter (Dart) | Descripción |
| :--- | :--- | :--- |
| `src/components/player-card.tsx` | `PlayerCardWidget` | Carta FIFA con tiers, auras y física táctil 3D (`Matrix4`) |
| `src/components/player-styles.tsx` | `PlayerPositionBadge` | Badge deportivo con estilos específicos para `DEL`, `MED`, `DEF`, `POR` |
| `src/components/team-builder/jersey-preview.tsx` | `JerseyWidget` / `JerseyPainter` | Renderizador vectorial nativo en `CustomPainter` de los 6 patrones de camiseta |
| `src/components/attributes-radar.tsx` | `AttributesRadarChart` | Gráfico de polígono radar de 6 ejes posicionales (`fl_chart`) |
| `src/components/nav/mobile-nav.tsx` | `_ScaffoldWithNavBar` (`app_router.dart`) | Dock flotante con acabado Dark Glass, pestaña Neon Volt e indicador animado |
| `src/components/dashboard/resumen-tab.tsx` | `DashboardScreen` | Panel con banner hero, métricas y carrusel de vestuario |
| `src/components/next-match-card.tsx` | `_NextMatchBanner` (`dashboard_screen.dart`) | Banner de partido con estado, marcador y ubicación |
| `src/components/competitions/cup-bracket.tsx` | `CupBracketScreen` | Visor de llaves de eliminación directa con Zoom & Pan (`InteractiveViewer`) |
| `src/components/evaluations/evaluation-form.tsx` | `EvaluationFormScreen` | Formulario de peer-review con selector de los 45 tags de rendimiento |

---

## 2. Mapeo de Lógica de Negocio y Servicios

| Lógica Web (Next.js / Server Actions) | Servicio / Utilidad Flutter | Función |
| :--- | :--- | :--- |
| `src/lib/player-utils.ts` & `server-actions.ts` | `lib/core/utils/ovr_calculator.dart` | Cálculo de delta de OVR, ponderación por posición y resistencia de atributos |
| `src/lib/utils/cup-bracket.ts` | `lib/core/utils/bracket_generator.dart` | Estructura de bracket de copas y algoritmo de avance de ganadores |
| `src/lib/actions/evaluation-actions.ts` | `lib/core/services/evaluation_service.dart` | Envío de evaluaciones, recálculo de OVR y log en `ovrHistory` |
| `src/lib/actions/match-actions.ts` | `lib/core/services/match_service.dart` | Creación, inicio, registro de goles/tarjetas y finalización de partidos |
| `src/lib/actions/group-actions.ts` | `lib/core/services/group_service.dart` | Creación de grupos con código de 6 caracteres y jugadores manuales |
| `src/lib/actions/tournament-actions.ts` | `lib/core/services/tournament_service.dart` | Sorteo de copas y persistencia de resultados de llaves |

---

## 3. Tokens de Color y Temas

| Token CSS Web (`globals.css`) | Constante Flutter (`AppColors`) | Valor Hex / Color |
| :--- | :--- | :--- |
| `--background` (`220 25% 6%`) | `AppColors.background` | `#0C1017` (Carbon Dark) |
| `--card` (`220 20% 12%`) | `AppColors.card` | `#181F2B` (Dark Surface) |
| `--primary` (`75 100% 60%`) | `AppColors.voltNeon` | `#CCFF00` (Volt Yellow / Neon) |
| `--accent` (`175 100% 45%`) | `AppColors.turquoise` | `#00E5CC` (Turquesa) |
| `--ovr-elite` | `AppColors.eliteBorder` | `#F8FAFC` (Platino brillante) |
| `--ovr-gold` | `AppColors.goldBorder` | `#FFD700` (Oro brillante) |
| `--ovr-silver` | `AppColors.silverBorder` | `#CBD5E1` (Plata) |
| `--ovr-bronze` | `AppColors.bronzeBorder` | `#CD7F32` (Bronce) |
| `--pos-del` | `AppColors.posDel` | `#FF453A` (Delantero) |
| `--pos-med` | `AppColors.posMed` | `#BF5AF2` (Medio) |
| `--pos-def` | `AppColors.posDef` | `#0A84FF` (Defensa) |
| `--pos-por` | `AppColors.posPor` | `#FF9F0A` (Portero) |
