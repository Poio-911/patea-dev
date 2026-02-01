# Configuración de Variables de Entorno en Firebase

Este documento te guía paso a paso para configurar las credenciales de tu aplicación de forma segura en Firebase App Hosting.

## 📋 Resumen

Tu aplicación necesita 2 credenciales principales:
1. **API Key de Google Gemini** - Para funcionalidades de IA
2. **Service Account JSON** - Para Firebase Admin SDK (Firestore, Storage, Auth)

## 🔐 Paso 1: Generar Nuevo Service Account

### 1.1. Acceder a Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **mil-disculpis**
3. Haz clic en el ícono de engranaje ⚙️ → **Project settings**
4. Ve a la pestaña **Service accounts**

### 1.2. Generar Nueva Clave

1. En la sección **Firebase Admin SDK**, haz clic en **Generate new private key**
2. Confirma haciendo clic en **Generate key**
3. Se descargará un archivo JSON (por ejemplo: `mil-disculpis-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`)
4. **IMPORTANTE**: Guarda este archivo en un lugar seguro. Nunca lo subas a GitHub.

### 1.3. Preparar el Service Account para Variables de Entorno

Necesitas convertir el archivo JSON a una sola línea de texto:

**Opción A: Usando tu editor de código**
1. Abre el archivo JSON descargado
2. Copia TODO el contenido
3. Asegúrate de que esté en UNA sola línea (sin saltos de línea)

**Opción B: Usando herramienta online**
1. Ve a [JSON Minifier](https://www.cleancss.com/json-minify/)
2. Pega el contenido del archivo JSON
3. Haz clic en "Minify / Uglify"
4. Copia el resultado

## 🌟 Paso 2: Configurar Variables en Firebase App Hosting

### 2.1. Acceder a App Hosting

1. En Firebase Console, ve a la sección **App Hosting** (en el menú lateral izquierdo)
2. Selecciona tu backend/aplicación
3. Ve a la pestaña **Environment** o **Variables de entorno**

### 2.2. Agregar Variables de Entorno

Agrega las siguientes variables una por una:

#### Variable 1: GOOGLE_GENAI_API_KEY
```
Nombre: GOOGLE_GENAI_API_KEY
Valor: [Tu nueva API key de Gemini]
```

#### Variable 2: FIREBASE_SERVICE_ACCOUNT_KEY
```
Nombre: FIREBASE_SERVICE_ACCOUNT_KEY
Valor: [El contenido del JSON en una sola línea del Paso 1.3]
```

#### Variables adicionales (opcionales, si no están autodetectadas)
```
Nombre: NEXT_PUBLIC_FIREBASE_PROJECT_ID
Valor: mil-disculpis

Nombre: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
Valor: mil-disculpis.firebasestorage.app

Nombre: GCLOUD_PROJECT
Valor: mil-disculpis
```

### 2.3. Guardar y Aplicar

1. Haz clic en **Save** o **Guardar**
2. Firebase App Hosting redesplegará automáticamente tu aplicación con las nuevas variables

## 💻 Paso 3: Configurar Desarrollo Local

### 3.1. Actualizar .env.local

1. Abre el archivo `.env.local` en la raíz de tu proyecto
2. Reemplaza los placeholders:

```bash
# Reemplaza con tu nueva API key de Gemini
GOOGLE_GENAI_API_KEY=AIzaSy___TU_NUEVA_API_KEY_AQUI___

# Reemplaza con el contenido del service account JSON (una sola línea)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"mil-disculpis",...}
```

### 3.2. Verificar que Funciona Localmente

```bash
# Instalar dependencias (si no las tienes)
npm install

# Correr en desarrollo
npm run dev

# Abrir en el navegador
# http://localhost:3000
```

### 3.3. Probar Genkit (Opcional)

Para probar las funcionalidades de IA de forma independiente:

```bash
# Iniciar Genkit UI
npm run genkit:dev

# Se abrirá una interfaz web donde puedes probar los flows de IA
```

## ✅ Verificación

### Verificar que TODO funciona:

1. **Firebase Admin SDK**:
   - Crea un partido nuevo
   - Agrega un jugador
   - Verifica que se guarde en Firestore

2. **Gemini AI**:
   - Usa la función de "Generar equipos balanceados"
   - Prueba el "Coach AI" con un jugador
   - Verifica pronóstico del tiempo

Si algo falla, revisa los logs en:
- **Local**: Consola del navegador (F12) y terminal
- **Producción**: Firebase Console → App Hosting → Logs

## 🚨 Seguridad

### ❌ NUNCA hagas esto:
- Subir archivos `.env`, `.env.local`, o service account JSONs a GitHub
- Compartir API keys en chats, emails, o documentos públicos
- Hacer commit de credenciales

### ✅ SIEMPRE haz esto:
- Mantener credenciales en variables de entorno
- Usar `.gitignore` para archivos sensibles
- Regenerar keys si se exponen
- Usar diferentes keys para desarrollo y producción (opcional pero recomendado)

## 🔄 Redespliegue a Firebase

Una vez configuradas las variables de entorno, cualquier push a tu rama principal redesplega automáticamente:

```bash
# Hacer cambios en tu código
git add .
git commit -m "feat: nueva funcionalidad"
git push origin dev-app-Ai

# Firebase App Hosting redespliega automáticamente
# Revisa el progreso en Firebase Console → App Hosting → Deployments
```

## 📚 Referencias

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Genkit Documentation](https://firebase.google.com/docs/genkit)

---

**¿Necesitas ayuda?** Revisa los logs en Firebase Console o abre un issue en el repositorio.
