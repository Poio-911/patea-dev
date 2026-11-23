# Versión 1.0.46 (47) — 23/11/2026

Primera versión con todo lo migrado de la PWA desde cero. Detalle de cada pieza en
[MIGRACION_PWA_A_APP_2026-11-23.md](MIGRACION_PWA_A_APP_2026-11-23.md).

## Qué trae

- **Logros** y **Configuración** (cuenta, tema, notificaciones, bloqueados, legales).
- **DT con IA:** análisis del jugador y chat; **ayuda** con chat; **resumen del grupo**;
  sugerencias de refuerzos.
- **Partidos:** costo por cancha (se carga en Grupos) y pagos, transmisión, calendario,
  aviso de sin conexión. Lo del organizador vive en su panel.
- **Competiciones:** avisos a los equipos, sedes y patrocinadores.
- **Comunidad:** logros en las novedades y cambios de OVR agrupados por partido.
- **Menú de usuario** más corto (el resto en Configuración) y pestañas que ahora se pueden
  recorrer hasta la última.

## Entregas

- **Android:** APK release firmado con la clave de subida (`dfce3e…597e`), versionCode 47,
  distribuido por Firebase App Distribution a los testers.
  [Entrega](https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/4vnolg73o2td0).
- **iOS:** tag `ios-testflight-1.0.46-20261123` (commit `16deba9d`), workflow
  `ios-testflight` de Codemagic.

## Backend desplegado antes de esta versión

`syncAchievements`, `getPlayerAnalysis`, `coachChat`, `askAppHelp`, `getGroupSummary`,
`recommendRecruits`, `setMatchCost`, `markMatchPayment`, `setMatchStream`,
`sendCompetitionMessage`, `manageCompetitionVenue`, `manageCompetitionSponsor`,
`updateGroupVenue` y las reglas de Firestore.

## Datos de prueba en el proyecto real

La copa `Copa_de_prueba_organizador` (borrador, solo del grupo) y su sede
`Cancha_de_prueba` siguen en Firestore; los testers las ven. Conviene borrarlas.
También hay un costo de $ 1.800 en la cancha «Goleadores Fútbol 5».

## Sin probar en un teléfono

Cargar y marcar pagos, la transmisión, los avisos a equipos (no se mandó ninguno) y la
publicación de logros en el feed.
