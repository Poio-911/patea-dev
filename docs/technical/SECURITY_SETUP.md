# 🚨 CONFIGURACIÓN DE SEGURIDAD REQUERIDA

## ⚠️ API Keys Comprometidas

Tus API keys fueron expuestas en GitHub y han sido bloqueadas por Google. **Seguí estos pasos URGENTEMENTE:**

---

## 📋 Pasos a Seguir

### 1️⃣ Generar Nuevas API Keys

#### **Google Gemini (IA)**
1. Andá a [Google AI Studio](https://aistudio.google.com/apikey)
2. Eliminá la key antigua (si aparece)
3. Creá una nueva API key
4. Copiá la key generada

#### **Google Maps**
1. Andá a [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Buscá tu API key de Maps
3. Generá una nueva key
4. Copiá la key generada

---

### 2️⃣ Configurar Variables de Entorno Localmente

```bash
# 1. Copiar el template
cp .env.example .env.local

# 2. Editar .env.local con tus nuevas keys
```

**Contenido de `.env.local`:**
```bash
# --- GOOGLE GENAI (Gemini) ---
GOOGLE_GENAI_API_KEY=TU_NUEVA_KEY_DE_GEMINI_AQUI
GEMINI_API_KEY=TU_NUEVA_KEY_DE_GEMINI_AQUI

# --- FIREBASE ---
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAes7EVn8hQswS8XgvDMJfN6U4IT_ZL_WY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mil-disculpis.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mil-disculpis
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mil-disculpis.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=5614567933
NEXT_PUBLIC_FIREBASE_APP_ID=1:5614567933:web:6d7b7dde5f994c36861994
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-56F70EMSVB
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BKW3qYRW72BtPqyI1oC3IEzafEAx4CXg7ooux7-v3zzn9Hxsgxnk4k1hnIZ9Jb_tEWJn3CU5ncRF4gP3OlwMfKA

# --- OTROS SERVICIOS ---
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=TU_NUEVA_KEY_DE_MAPS_AQUI
```

---

### 3️⃣ Reiniciar el Servidor

```bash
# Detener el servidor actual (Ctrl+C)
# Limpiar cache
rm -rf .next

# Reiniciar
npm run dev
```

---

### 4️⃣ Verificar que Funciona

1. Abrí la app en `http://localhost:3001`
2. Intentá crear un nuevo partido
3. Verificá que se muestre el pronóstico del clima
4. Si ves el clima, ¡todo está funcionando! ✅

---

## ✅ ¿Qué se Arregló?

- ✅ Archivos `.env` y `src/.env` removidos del repositorio
- ✅ `.gitignore` actualizado para prevenir futuras filtraciones
- ✅ Creado `.env.example` como template seguro
- ✅ Keys comprometidas ya no están en GitHub

---

## 📌 Notas Importantes

- **NUNCA** commitees archivos `.env` o `.env.local`
- Solo `.env.example` debe estar en git (sin keys reales)
- Las keys de Firebase son públicas y están OK
- Verificá siempre el `.gitignore` antes de hacer push

---

## 🔒 Buenas Prácticas

1. **Rotar keys periódicamente** (cada 3-6 meses)
2. **Restringir keys por dominio** en Google Cloud Console
3. **Monitorear uso** en la consola de Google
4. **Usar diferentes keys** para desarrollo y producción

---

## ❓ ¿Necesitás Ayuda?

Si después de seguir estos pasos el clima sigue sin funcionar:

1. Verificá que las keys estén correctas en `.env.local`
2. Revisá los logs del servidor (consola donde corrés `npm run dev`)
3. Asegurate que las keys tengan los permisos correctos en Google Cloud

---

**Última actualización:** 2025-11-01
