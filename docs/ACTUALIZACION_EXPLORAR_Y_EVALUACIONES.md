# Documentacion Tecnica: OVR de Arqueros, Rediseno de Seleccion y Modulo Explorar

Este documento consolida las mejoras implementadas en **Patea** tanto en la version Web (Next.js) como en la aplicacion movil (Flutter), abarcando dos areas principales:

---

## 1. Sistema de OVR y Evaluaciones para Arqueros (GK / POR)

### 1.1 Contexto y Problema Previo
- Los arqueros tenian atributos estandar de campo (PAC, SHO, PAS, DRI, DEF, PHY) o atributos de arquero guardados en goalkeeperAttributes (diving, handling, kicking, eflexes, speed, positioning) que no se reflejaban en el calculo del OVR general.
- En la pantalla de evaluacion de partidos, asignar a un arquero no desplegaba las metricas ni tags de rendimiento especificos para arqueros.
- El dialogo de "Agregar Jugador" y las tarjetas de seleccion en creacion de partidos no tenian una interfaz deportiva unificada para elegir posicion, atributos y visualizar el estado del jugador.

### 1.2 Implementacion

#### Web (src/):
- **Calculo de OVR por Posicion** (src/lib/ovr-utils.ts):
  - Se implemento la ponderacion oficial inspirada en EA Sports FC:
    - **POR**: 21% Reflejos, 21% Estirada, 21% Paradas/Manejo, 21% Posicionamiento, 11% Saque, 5% Velocidad.
    - **DEF**: 30% DEF, 25% PHY, 15% PAC, 15% PAS, 10% DRI, 5% SHO.
    - **MED**: 30% PAS, 25% DRI, 15% SHO, 15% DEF, 10% PHY, 5% PAC.
    - **DEL**: 35% SHO, 25% DRI, 20% PAC, 10% PAS, 7% PHY, 3% DEF.
- **Evaluacion de Partidos** (src/app/evaluations/[matchId]/page.tsx):
  - Deteccion automatica si el evaluado jugo de arquero en el partido (isGoalkeeper).
  - Tags de rendimiento especificos para arqueros (GK_TAGS) y atributos GK interactivos en la evaluacion.
  - Sincronizacion en evaluation-actions.ts y server-actions.ts para persistir el OVR recalculado.
- **Dialogo de Agregar Jugador** (src/components/add-player-dialog.tsx):
  - Selector de posicion con badges semanticos y switches dinamicos para atributos GK o Campo.

#### Mobile Flutter (patea_mobile/):
- **Calculador de OVR y Modelos**:
  - ovr_calculator.dart: Logica de calculo ponderado por posicion y compatibilidad con arqueros.
  - performance_tags.dart: Tags de arquero y campo sincronizados con la web.
- **Componente de Seleccion de Jugadores**:
  - player_select_card.dart: Tarjeta interactiva con badge de tier, indicador de posicion, foto de perfil y estado de seleccion.
  - Utilizado en create_match_screen.dart, edit_teams_sheet.dart y ecruit_players_sheet.dart.
- **Creacion de Jugador en Flutter**:
  - create_player_dialog.dart: Rediseno completo con soporte para atributos GK, selector de posicion tactico y vista previa en tiempo real.

---

## 2. Modulo de Explorar y Modo Agente Libre

### 2.1 Contexto y Problemas Reportados
1. **Fotos desactualizadas y tarjetas inconsistentes**: Las tarjetas de agentes libres mostraban fotos viejas cacheadas en vailablePlayers y tenian un diseno plano que no coincidia con el diseno oficial de cartas coleccionables de la app.
2. **Modal de Detalle bloqueado**: Al tocar una tarjeta, el bottom sheet de detalle quedaba recortado por debajo del Bottom Navigation Bar, ocultando el boton "Invitar a mi partido".
3. **Espaciado fantasma en grilla**: Existia un hueco en blanco desproporcionado (~150-200px) entre el titulo *"JUGADORES DISPONIBLES"* y la grilla.
4. **Colores en Tema Claro / Game**: En modo claro aparecian tonalidades verdosas/amarillentas desaturadas (randVolt), perjudicando el contraste.

### 2.2 Soluciones Implementadas

#### Backend & Base de Datos:
- **Sincronizacion de Firestore** (scripts/sync-available-players.ts):
  - Script que actualizo todos los registros de vailablePlayers con las fotos reales y OVR actual desde players y users.
- **Cloud Function getAvailableLocalPlayers** (unctions/src/callable/explore.ts):
  - Modificada para cruzar dinamicamente cada jugador disponible con su documento en players/{playerId}.
  - Retorna en tiempo real: photoURL, ovr, position, 
ame y atributos individuales (PAC, SHO, PAS, DRI, DEF, PHY).
  - Desplegada a produccion en Firebase Functions.

#### Frontend Mobile (patea_mobile/lib/features/explorar/explorar_screen.dart):
- **Integracion de PlayerCardWidget**:
  - Se sustituyo la tarjeta personalizada por el componente oficial de Patea: PlayerCardWidget(photoStyle: CardPhotoStyle.halfTop).
  - Incorpora bordes metalicos por tier (Oro, Elite, Plata, Bronce), acabado foil holografico, badge oficial de OVR y posicion, y debajo una pildora deportiva con coincidencia horaria y distancia.
- **Navegacion del Modal de Detalle**:
  - showModalBottomSheet(..., useRootNavigator: true): Asegura que el modal pertenezca al Navigator raiz de la app, posicionandose por encima de la barra de navegacion del ShellRoute.
  - Inclusion de SafeArea(top: false, bottom: true) con padding inferior dinamico.
- **Correccion del Grid**:
  - Se removio el padding heredado del notch/recorte con padding: EdgeInsets.zero en el GridView.builder.
  - Calibracion de aspect ratio (childAspectRatio: 0.58) para una grilla proporcionada sin solapamientos ni desbordamientos de texto.
- **Paleta Estricta Claro / Game**:
  - Tema Claro: Acentos en context.c.primary (Royal Blue #156BF4) y texto en context.c.onPrimary (Blanco #F8FAFC), fondos en context.c.card puro con sombras de elevacion sutiles.
  - Tema Game: Acentos en Neon Volt (#CCFF33) y fondos carbon oscuro.

---

## 3. Pruebas y Verificacion

- **Compilacion de Cloud Functions**: TypeScript compilado con cero errores y desplegado exitosamente a Firebase.
- **Analisis Estatico Flutter**: lutter analyze lib/features/explorar/ ejecutado sin advertencias ni errores.
- **Compilacion Android**: lutter build apk --debug ejecutado con exito.
- **Instalacion y Despliegue en Emulador**: APK instalado mediante db install -r en emulator-5554 y lanzado para validacion visual.
