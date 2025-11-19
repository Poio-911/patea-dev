# Guía Paso a Paso: Configurar Google Fit en Google Cloud Console

## ⏱️ Tiempo estimado: 10-15 minutos

Esta guía te llevará paso a paso para configurar Google Fit OAuth2. **No te preocupes si no tenés experiencia**, está todo explicado.

---

## 📋 Requisitos Previos

- ✅ Cuenta de Google (Gmail)
- ✅ Proyecto de Firebase ya creado (Pateá)
- ✅ 10-15 minutos de tiempo

---

## 🚀 PASO 1: Acceder a Google Cloud Console

1. **Ir a:** https://console.cloud.google.com/
2. **Iniciar sesión** con tu cuenta de Google
3. **Seleccionar tu proyecto:**
   - En la parte superior, click en el selector de proyecto
   - Buscar y seleccionar el proyecto de Firebase (probablemente se llame algo como "patea-dev" o similar)
   - Si no existe, crear uno nuevo con el mismo ID que tu proyecto de Firebase

---

## 🔧 PASO 2: Habilitar Google Fitness API

### 2.1. Ir a la biblioteca de APIs

1. En el menú lateral (☰), click en **"APIs & Services"** → **"Library"**
   - URL directa: https://console.cloud.google.com/apis/library

### 2.2. Buscar Google Fitness API

1. En el buscador, escribir: **"Fitness API"**
2. Click en **"Fitness API"** (debe tener el logo de Google Fit)

### 2.3. Habilitar la API

1. Click en el botón **"ENABLE"** (Habilitar)
2. Esperar 10-30 segundos mientras se habilita
3. ✅ Deberías ver "API enabled" (API habilitada)

---

## 🔐 PASO 3: Configurar Pantalla de Consentimiento OAuth

### 3.1. Ir a la configuración OAuth

1. En el menú lateral, click en **"APIs & Services"** → **"OAuth consent screen"**
   - URL directa: https://console.cloud.google.com/apis/credentials/consent

### 3.2. Seleccionar tipo de usuario

Vas a ver dos opciones:

- **Internal**: Solo para usuarios dentro de tu organización (Google Workspace)
- **External**: Para cualquier usuario con cuenta de Google

**Selecciona:** ⭐ **External** (es la opción para la mayoría de apps)

Click en **"CREATE"**

### 3.3. Completar información de la app (Paso 1 de 4)

**App information:**
```
App name: Pateá
User support email: [TU EMAIL AQUÍ]
App logo: (opcional - podés subirlo después)
```

**App domain (opcional pero recomendado):**
```
Application home page: https://tu-dominio.com (o dejarlo vacío por ahora)
Privacy policy: (dejarlo vacío por ahora)
Terms of service: (dejarlo vacío por ahora)
```

**Authorized domains:**
```
Si estás usando Firebase Hosting, agregar:
- tu-proyecto.web.app
- tu-proyecto.firebaseapp.com

Si tenés dominio propio:
- tu-dominio.com
```

**Developer contact information:**
```
Email addresses: [TU EMAIL AQUÍ]
```

Click en **"SAVE AND CONTINUE"**

### 3.4. Agregar Scopes (Paso 2 de 4)

1. Click en **"ADD OR REMOVE SCOPES"**
2. En el buscador, buscar: **"fitness"**
3. **Seleccionar estos 3 scopes** (marcar checkbox):

```
✅ https://www.googleapis.com/auth/fitness.activity.read
   Ver tu información sobre actividad física

✅ https://www.googleapis.com/auth/fitness.heart_rate.read
   Ver tu ritmo cardíaco

✅ https://www.googleapis.com/auth/fitness.location.read
   Ver tu ubicación registrada en Google Fit
```

4. Click en **"UPDATE"** (abajo)
5. Click en **"SAVE AND CONTINUE"**

### 3.5. Agregar usuarios de prueba (Paso 3 de 4)

⚠️ **IMPORTANTE**: Mientras la app esté en modo "Testing", solo estos usuarios podrán conectar Google Fit.

1. Click en **"ADD USERS"**
2. Agregar emails de prueba (incluyendo el tuyo):
```
tu-email@gmail.com
usuario-prueba@gmail.com
```
3. Click en **"ADD"**
4. Click en **"SAVE AND CONTINUE"**

### 3.6. Resumen (Paso 4 de 4)

1. Revisar que todo esté correcto
2. Click en **"BACK TO DASHBOARD"**

---

## 🔑 PASO 4: Crear Credenciales OAuth 2.0

### 4.1. Ir a Credentials

1. En el menú lateral, click en **"APIs & Services"** → **"Credentials"**
   - URL directa: https://console.cloud.google.com/apis/credentials

### 4.2. Crear credenciales

1. Click en **"+ CREATE CREDENTIALS"** (arriba)
2. Seleccionar **"OAuth client ID"**

### 4.3. Configurar tipo de aplicación

**Application type:**
- Seleccionar: **"Web application"**

**Name:**
```
Pateá - Google Fit Integration
```

### 4.4. Configurar URIs autorizadas

⚠️ **SUPER IMPORTANTE**: Estas URIs deben ser EXACTAS

**Authorized JavaScript origins:**

Click en **"+ ADD URI"** y agregar:

```
Para desarrollo:
http://localhost:3000

Para producción (cuando la tengas):
https://tu-dominio.com
```

**Authorized redirect URIs:**

Click en **"+ ADD URI"** y agregar:

```
Para desarrollo:
http://localhost:3000/api/auth/google-fit/callback

Para producción (cuando la tengas):
https://tu-dominio.com/api/auth/google-fit/callback
```

⚠️ **Cuidado con:**
- No debe haber espacios
- No debe terminar en `/` (barra)
- Debe ser exactamente como está escrito
- Si usás Firebase Hosting, usar tu URL de Firebase (tu-proyecto.web.app)

### 4.5. Crear

1. Click en **"CREATE"**
2. Vas a ver un popup con tus credenciales

---

## 📋 PASO 5: Copiar Credenciales

### 5.1. Guardar Client ID y Client Secret

En el popup que apareció, vas a ver:

```
Your Client ID
abc123...xyz.apps.googleusercontent.com

Your Client Secret
GOCSPX-abc...xyz
```

**⚠️ IMPORTANTE:**
- El Client ID es PÚBLICO (puede ir en el frontend)
- El Client Secret es **SECRETO** (nunca compartir, nunca commitear)

### 5.2. Descargar JSON (opcional pero recomendado)

Click en **"DOWNLOAD JSON"** para tener un backup

---

## 📝 PASO 6: Agregar a Variables de Entorno

### 6.1. Abrir archivo `.env.local`

En tu proyecto Pateá, editar el archivo `.env.local` (o crearlo si no existe)

### 6.2. Agregar estas líneas:

```env
# ==========================================
# GOOGLE FIT INTEGRATION
# ==========================================

# Client ID (copiado del paso 5.1)
GOOGLE_FIT_CLIENT_ID=abc123...xyz.apps.googleusercontent.com

# Client Secret (copiado del paso 5.1)
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-abc...xyz

# Redirect URI (debe coincidir EXACTAMENTE con lo configurado)
GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/api/auth/google-fit/callback

# Para producción, cambiar a:
# GOOGLE_FIT_REDIRECT_URI=https://tu-dominio.com/api/auth/google-fit/callback
```

### 6.3. Guardar archivo

⚠️ **VERIFICAR que `.env.local` esté en `.gitignore`**

---

## ✅ PASO 7: Verificación

### 7.1. Reiniciar servidor de desarrollo

```bash
# Detener el servidor (Ctrl+C)
# Iniciar de nuevo
npm run dev
```

### 7.2. Verificar que las variables estén cargadas

Podés agregar esto temporalmente en cualquier server action:

```typescript
console.log('Google Fit configured:', {
  hasClientId: !!process.env.GOOGLE_FIT_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_FIT_CLIENT_SECRET,
  hasRedirectUri: !!process.env.GOOGLE_FIT_REDIRECT_URI,
});
```

Deberías ver:
```
Google Fit configured: {
  hasClientId: true,
  hasClientSecret: true,
  hasRedirectUri: true
}
```

---

## 🚨 Problemas Comunes y Soluciones

### Error: "redirect_uri_mismatch"

**Causa:** El redirect URI no coincide exactamente

**Solución:**
1. Verificar en Google Cloud Console que la URI esté escrita EXACTAMENTE como en `.env.local`
2. No debe tener espacios ni `/` al final
3. Debe incluir el protocolo (`http://` o `https://`)
4. Reiniciar el servidor después de cambiar `.env.local`

### Error: "Access blocked: This app's request is invalid"

**Causa:** Falta configurar la pantalla de consentimiento OAuth

**Solución:**
- Volver al PASO 3 y completar la configuración OAuth

### Error: "User email not in testing list"

**Causa:** El usuario que intenta conectar no está en la lista de usuarios de prueba

**Solución:**
1. Ir a OAuth consent screen
2. Agregar el email del usuario en "Test users"
3. O publicar la app (cambiar de "Testing" a "In production")

### No puedo encontrar mi proyecto

**Solución:**
1. Verificar que estés usando la cuenta de Google correcta
2. Ir a https://console.firebase.google.com/ y copiar el Project ID
3. Usar ese Project ID para buscar en Google Cloud Console

---

## 🎯 Checklist Final

Antes de continuar, verificar que tengas:

- [ ] Google Fitness API habilitada
- [ ] OAuth consent screen configurado (External)
- [ ] 3 scopes agregados (activity, heart_rate, location)
- [ ] Al menos 1 usuario de prueba agregado (tu email)
- [ ] Credenciales OAuth 2.0 creadas (Web application)
- [ ] Redirect URI configurado correctamente
- [ ] Client ID y Client Secret copiados a `.env.local`
- [ ] Servidor reiniciado
- [ ] Variables de entorno verificadas

---

## 🚀 Siguiente Paso

Una vez completada esta configuración, el backend ya está listo para funcionar.

**Lo que falta:**
- Crear el frontend (botón "Conectar Google Fit", dialogs, etc.)
- Crear la página de callback (`/api/auth/google-fit/callback`)

¿Querés que te ayude con eso ahora?

---

## 📚 Referencias Útiles

- [Google Fitness API Docs](https://developers.google.com/fit)
- [OAuth 2.0 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OAuth Consent Screen](https://support.google.com/cloud/answer/10311615)

---

## 💡 Tip Pro

**Para publicar la app (cuando esté lista para todos los usuarios):**

1. Ir a OAuth consent screen
2. Click en **"PUBLISH APP"**
3. Submit for verification (Google revisará tu app)
4. Una vez aprobada, cualquier usuario podrá conectar sin estar en lista de prueba

**Por ahora, dejala en "Testing"** y solo agregá usuarios de prueba.
