# Análisis de Funciones Usadas y Potenciales Costos en Google Cloud

## 1. Funciones y Servicios Usados en el Proyecto

### App (Frontend y Utilidades)
- Hooks personalizados para presencia, notificaciones, chat, permisos, acciones de partido, FCM, etc.
- Utilidades para validación, manejo de jugadores, temas, mapas, logger, etc.
- Componentes React para UI, diálogos, gestión de equipos, chat, etc.

### IA (src/ai/ y ai/)
- Flujos de análisis de progresión de jugador, generación de equipos balanceados, generación de imágenes, recomendaciones, ayuda, etc.
- Uso de modelos generativos (Gemini/GenAI) vía API de Google GenAI.

### Backend (Cloud Functions)
- Función programada para resetear créditos mensuales (`resetMonthlyCredits`).
- Acceso y escritura en Firestore (lectura/escritura masiva de documentos de jugadores).

### Scripts y Pruebas
- Scripts para inicializar paquetes de créditos, migrar brackets de copas, testear avance de copas, chequeo de copas.
- Uso de Firebase Admin SDK para acceso a Firestore y Storage.

---

## 2. Servicios de Google Cloud que Pueden Generar Costos Extra

### a) Firestore
- Lecturas y escrituras frecuentes (presencia en partidos, actualizaciones de jugadores, migraciones, reseteos masivos).
- Escrituras masivas en funciones programadas y scripts.
- Consultas complejas o de alto volumen (por ejemplo, migraciones, análisis de datos históricos).

### b) Cloud Functions
- Ejecución de funciones programadas (reset mensual de créditos).
- Costos por invocaciones, tiempo de ejecución y recursos usados.

### c) Google GenAI / Gemini API
- Llamadas a modelos generativos para IA (análisis, generación de imágenes, recomendaciones, etc.).
- Cada llamada a la API puede tener costo según el modelo y volumen de uso.

### d) Firebase Storage
- Uso potencial en scripts y funciones para manejo de imágenes, videos, backups, etc.
- Costos por almacenamiento y transferencias.

### e) Firebase Cloud Messaging (FCM)
- Generalmente gratuito, pero puede haber costos si se exceden límites de uso o se usan funciones avanzadas.

---

## 3. Resumen de Riesgo de Costos
- **Alto**: Uso intensivo de Firestore (lecturas/escrituras masivas, migraciones, presencia en tiempo real).
- **Alto**: Llamadas a Google GenAI/Gemini API (IA generativa).
- **Medio**: Cloud Functions programadas o invocadas frecuentemente.
- **Bajo/Medio**: Firebase Storage (si se usan imágenes/videos en gran volumen).
- **Bajo**: FCM y otros servicios básicos.

---

## 4. Recomendaciones
- Monitorear el uso de Firestore y limitar operaciones masivas.
- Controlar la frecuencia de llamadas a APIs de IA generativa.
- Revisar triggers y periodicidad de Cloud Functions.
- Auditar scripts de migración y pruebas para evitar ejecuciones innecesarias en producción.

---

> Este análisis cubre lo que actualmente está en uso y los puntos que pueden generar costos extra en Google Cloud. Se recomienda revisar periódicamente el uso real y ajustar según el presupuesto y necesidades del proyecto.
