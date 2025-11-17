# Análisis de Viabilidad: Integración con Smartwatch y Datos de Salud

**Fecha:** 2025-11-20
**Autor:** App Prototyper
**Objetivo:** Analizar la viabilidad y definir la estrategia para integrar datos de actividad física de smartwatches (como Xiaomi, Garmin, Apple Watch, etc.) en el perfil de rendimiento de los jugadores.

---

## 1. Visión General y Propuesta de Valor

### El Problema
El sistema de evaluación actual se basa en la percepción subjetiva de los compañeros de equipo (ratings y etiquetas). Si bien esto es excelente para medir la habilidad técnica y táctica, carece de una métrica objetiva del esfuerzo físico real.

### La Solución
Integrar datos biométricos y de actividad física de los smartwatches de los jugadores para enriquecer su perfil y hacer que la progresión de atributos sea más realista y basada en datos concretos.

### Propuesta de Valor
- **Gamificación Mejorada:** Los jugadores verán un impacto directo de su esfuerzo físico en sus estadísticas, incentivándolos a correr más y a mejorar su condición.
- **Datos Objetivos:** Añade una capa de objetividad a la evaluación, complementando la percepción de los compañeros.
- **Factor "Wow":** Posiciona a la aplicación como una plataforma de vanguardia que une el fútbol amateur con la tecnología deportiva.
- **Nuevas Métricas:** Permite crear nuevos logros y rankings como "MVP Físico", "El que más corrió", "Corazón de Acero" (basado en ritmo cardíaco).

---

## 2. Arquitectura de Integración (Propuesta)

La integración directa con cada marca de reloj (Xiaomi, Garmin, Samsung, etc.) no es escalable. La estrategia correcta es utilizar las plataformas de salud centralizadas que actúan como un hub de datos.

```mermaid
graph TD
    subgraph "Dispositivos del Usuario"
        A[Xiaomi Watch] --> B[App Mi Fitness];
        C[Apple Watch] --> D[App Actividad];
        E[Garmin Watch] --> F[App Garmin Connect];
    end

    subgraph "Plataformas de Salud (Hubs)"
        B --> G[Google Fit / Apple Health];
        D --> G;
        F --> G;
    end

    subgraph "Nuestra Aplicación"
        G --"API (con permiso del usuario)"--> H[Pateá App];
    end

    subgraph "Base de Datos Pateá"
        H --> I[Firestore: /matches/{id}/playerPerformance/{playerId}];
    end
```

### Flujo Técnico:
1.  **Registro de Actividad:** El jugador inicia una actividad de "Fútbol" o "Correr" en su reloj al comenzar el partido.
2.  **Sincronización:** Al terminar, los datos (distancia, ritmo cardíaco, duración) se sincronizan desde el reloj a su app nativa (Mi Fitness, etc.) y de ahí a la plataforma de salud central (Google Fit o Apple Health).
3.  **Importación en Pateá:**
    - Después de que un partido es `evaluado`, en la pantalla de resultados del partido, aparecerá un botón: **"Vincular mi Actividad Física"**.
    - Al hacer clic, se iniciará un flujo de autenticación OAuth2 para que el usuario nos dé permiso de **solo lectura** a sus datos de actividad de Google Fit o Apple Health para un período de tiempo específico (el día del partido).
4.  **Procesamiento de Datos:**
    - La aplicación buscará sesiones de actividad que coincidan con la hora y duración del partido.
    - Se extraerán métricas clave:
        - **Distancia recorrida (km)**
        - **Ritmo cardíaco promedio y máximo (ppm)**
        - **Pasos totales**
        - **Calorías quemadas**
5.  **Almacenamiento y Visualización:**
    - Los datos se almacenarán en una nueva subcolección: `/matches/{matchId}/playerPerformance/{playerId}`.
    - Se mostrarán en la página de detalle del partido y en el historial de evaluaciones del jugador.
6.  **Impacto en Atributos:**
    - Una `Cloud Function` o `Server Action` podría procesar estos datos para influir en la actualización de los atributos del jugador:
        - **Distancia y Sprints:** Impactarían positivamente en **Ritmo (PAC)**.
        - **Ritmo Cardíaco y Duración:** Impactarían positivamente en **Físico (PHY)**.

---

## 3. Desafíos Técnicos

### a. Google Fit (Para Android y Web)
- **API:** Google Fit REST API.
- **Ventaja:** Funciona bien en la web.
- **Desafío:** Requiere un flujo OAuth2 complejo para gestionar los permisos de usuario de forma segura. Necesitaremos registrar nuestra app en Google Cloud Console y solicitar los "scopes" (permisos) de `fitness.activity.read`.

### b. Apple Health (Solo para iOS)
- **API:** HealthKit.
- **Ventaja:** Es el estándar en el ecosistema de Apple.
- **Desafío:** HealthKit **no es accesible desde una aplicación web (PWA)** por razones de seguridad y privacidad. La integración con Apple Health solo sería posible si desarrollamos una **aplicación nativa para iOS**.

---

## 4. Plan de Implementación por Fases

### Fase 1: Integración con Google Fit (MVP para Web/Android)
1.  **Configuración en Google Cloud:**
    - Crear un nuevo proyecto en Google Cloud Console.
    - Habilitar la API de Google Fit.
    - Configurar la pantalla de consentimiento de OAuth2.
    - Obtener las credenciales (Client ID y Client Secret).
2.  **Nueva Subcolección en Firestore:**
    - Crear `/matches/{matchId}/playerPerformance/{playerId}` para almacenar los datos importados.
3.  **Modificar la UI:**
    - Añadir el botón "Vincular Actividad Física" en la pantalla de resultados del partido.
    - Crear un componente para mostrar los datos de rendimiento físico importados.
4.  **Implementar Flujo OAuth2:**
    - Crear las rutas de `server-side` en Next.js para manejar el callback de la autenticación de Google.
5.  **Desarrollar la Lógica de Importación:**
    - Crear una `Server Action` que, usando el token de acceso, haga la llamada a la API de Google Fit para buscar y extraer los datos de la sesión de entrenamiento.

### Fase 2: Integración con Apple Health (Post-MVP, App Nativa)
- Este paso se abordaría únicamente como parte del desarrollo de una aplicación nativa para iOS. La lógica de backend para procesar y almacenar los datos sería la misma que la de Google Fit.

---

## 5. Conclusión

La integración con smartwatches es **altamente viable y estratégicamente valiosa**, comenzando con Google Fit. Añade una dimensión de datos objetivos que enriquece enormemente la experiencia de "progresión" del jugador.

Se recomienda proceder con la **Fase 1** como una nueva funcionalidad "premium" o como un diferenciador clave para aumentar el engagement de los usuarios de Android y la web.
