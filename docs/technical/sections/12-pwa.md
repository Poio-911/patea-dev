# PWA - Progressive Web App Features

## Descripción General

Pateá es una Progressive Web App (PWA) completa que se puede instalar en dispositivos móviles y desktop, ofreciendo una experiencia similar a una app nativa con capacidades offline, notificaciones push y acceso desde home screen.

## Configuración

### Next.js PWA Plugin

**Package**: `@ducanh2912/next-pwa`

**Configuración en `next.config.mjs`:**

```javascript
import withPWA from '@ducanh2912/next-pwa';

const nextConfig = {
  // ... otras configuraciones
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})(nextConfig);
```

**Características:**
- Service Worker generado automáticamente
- Caching de assets estáticos
- Precaching de rutas importantes
- Offline fallback pages
- Workbox integration

### Service Worker

**Archivo**: `public/sw.js`

Service Worker customizado que maneja:
- Caching strategies (cache-first, network-first, stale-while-revalidate)
- Offline page fallback
- Background sync
- Push notifications
- Periodic background sync (futuro)

**Caching Strategies:**

```javascript
// Cache-first para assets estáticos (imágenes, fonts)
workbox.routing.registerRoute(
  /\.(png|jpg|jpeg|svg|gif|webp)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      }),
    ],
  })
);

// Network-first para API calls (Firestore)
workbox.routing.registerRoute(
  /^https:\/\/firestore\.googleapis\.com/,
  new workbox.strategies.NetworkFirst({
    cacheName: 'firestore-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutos
      }),
    ],
  })
);

// Stale-while-revalidate para páginas
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'pages-cache',
  })
);
```

### Web App Manifest

**Archivo**: `public/manifest.json`

```json
{
  "name": "Pateá - Gestión de Fútbol Amateur",
  "short_name": "Pateá",
  "description": "Organiza partidos, gestiona jugadores y mejora con IA",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#10b981",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["sports", "social", "productivity"],
  "screenshots": [
    {
      "src": "/screenshot-mobile-1.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "platform": "narrow"
    },
    {
      "src": "/screenshot-desktop-1.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "platform": "wide"
    }
  ],
  "shortcuts": [
    {
      "name": "Crear Partido",
      "short_name": "Nuevo Partido",
      "description": "Crear un partido rápidamente",
      "url": "/matches?action=create",
      "icons": [{ "src": "/icon-match.png", "sizes": "96x96" }]
    },
    {
      "name": "Ver Jugadores",
      "short_name": "Jugadores",
      "description": "Ver mis jugadores",
      "url": "/players",
      "icons": [{ "src": "/icon-players.png", "sizes": "96x96" }]
    }
  ]
}
```

## Componentes

### pwa/install-prompt.tsx

Componente que detecta si la app puede instalarse y muestra prompt personalizado.

**Features:**
- Detecta evento `beforeinstallprompt`
- Banner personalizado con branding de Pateá
- Guarda preferencia si usuario dismissea (no mostrar de nuevo)
- Analytics tracking de instalaciones
- Solo muestra en mobile
- Dismissable con timeout (no molestar mucho)

**Diseño:**
```
┌───────────────────────────────────┐
│ ⚽ Instala Pateá                  │
│                                   │
│ Accede más rápido y recibe       │
│ notificaciones de tus partidos   │
│                                   │
│ [Instalar] [Ahora no]            │
└───────────────────────────────────┘
```

**Lógica:**
```typescript
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // No mostrar si usuario dismisseó antes
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 10000); // 10s delay
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
      // Track analytics
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt">
      {/* UI del prompt */}
    </div>
  );
}
```

### pwa/update-notification.tsx

Notificación que aparece cuando hay una nueva versión de la app disponible.

**Features:**
- Detecta cuando Service Worker está listo para actualizar
- Muestra toast notification con botón "Actualizar"
- Al clickear, actualiza y recarga la página
- No intrusivo (dismissable)

**Diseño:**
```
┌─────────────────────────────────┐
│ 🎉 Nueva versión disponible     │
│                                 │
│ [Actualizar Ahora] [Después]   │
└─────────────────────────────────┘
```

**Lógica:**
```typescript
export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
                setRegistration(reg);
              }
            });
          }
        });
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <Toast>
      <p>Nueva versión disponible</p>
      <Button onClick={handleUpdate}>Actualizar Ahora</Button>
    </Toast>
  );
}
```

## Capacidades Offline

### Páginas Offline

**Rutas cacheadas para acceso offline:**
- `/dashboard` - Dashboard principal
- `/players` - Lista de jugadores
- `/matches` - Lista de partidos
- `/groups` - Mis grupos
- `/profile` - Perfil personal

**Offline Fallback:**

Cuando no hay conexión y la ruta no está cacheada:

```html
<!-- public/offline.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Sin Conexión - Pateá</title>
</head>
<body>
  <div class="offline-page">
    <h1>⚽ Sin Conexión</h1>
    <p>Parece que no tienes conexión a internet.</p>
    <p>Algunas funciones están disponibles offline.</p>
    <button onclick="window.location.reload()">
      Reintentar
    </button>
  </div>
</body>
</html>
```

### Datos Offline (Firestore Cache)

Firestore tiene cache persistence habilitado:

```typescript
// firebase/config.ts
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
```

**Beneficios:**
- Queries funcionan offline si fueron ejecutados antes
- Escrituras se encolan y sincronizan cuando vuelve la conexión
- Lecturas desde cache son instantáneas

### Background Sync

Para acciones críticas que necesitan conexión:

```typescript
// En Service Worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-match-creation') {
    event.waitUntil(syncMatchCreation());
  }
});

async function syncMatchCreation() {
  const pendingMatches = await getPendingMatches();
  for (const match of pendingMatches) {
    try {
      await createMatchInFirestore(match);
      await removePendingMatch(match.id);
    } catch (error) {
      console.error('Failed to sync match:', error);
    }
  }
}
```

**Uso:**
Usuario crea partido sin conexión → se encola → se sincroniza cuando vuelve la conexión

## Push Notifications

### Firebase Cloud Messaging (FCM)

**Configuración:**
```typescript
// firebase/config.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const messaging = getMessaging(app);

// Obtener token de notificaciones
export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    // Guardar token en Firestore
    await saveNotificationToken(token);

    return token;
  }

  return null;
}

// Escuchar mensajes en foreground
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);

  // Mostrar notification custom
  showNotification(payload.notification);
});
```

**Tipos de notificaciones:**
- **Match reminder**: 1 hora antes del partido
- **Match invitation**: Cuando te invitan a un partido
- **Challenge received**: Cuando reciben desafío tu equipo
- **Evaluation ready**: Cuando puedes evaluar después del partido
- **Credit purchase**: Cuando compra de créditos es exitosa
- **New follower**: Cuando alguien te sigue
- **OVR change**: Cuando tu OVR sube/baja

### Service Worker Notification Handler

```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();

  const options = {
    body: data.notification.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.notification.tag || 'default',
    data: {
      url: data.notification.click_action || '/dashboard',
    },
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/icons/view.png',
      },
      {
        action: 'dismiss',
        title: 'Cerrar',
        icon: '/icons/close.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.notification.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

## Instalación por Plataforma

### Android (Chrome)

1. Usuario navega a patea.app
2. Chrome detecta manifest y Service Worker
3. Banner "Agregar a pantalla de inicio" aparece
4. Usuario acepta
5. App se instala con icono en home screen
6. Launch standalone (sin browser chrome)

### iOS (Safari)

Safari no soporta `beforeinstallprompt`, así que mostramos instrucciones manuales:

```typescript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIOS && !isInStandaloneMode) {
  // Mostrar instrucciones para instalar en iOS
  showIOSInstallInstructions();
}
```

**Instrucciones iOS:**
```
Para instalar Pateá en iOS:

1. Toca el botón "Compartir" (cuadrado con flecha)
2. Desplázate y toca "Agregar a pantalla de inicio"
3. Toca "Agregar"

¡Listo! Ahora puedes acceder a Pateá desde tu home screen.
```

### Desktop (Chrome, Edge)

Desktop también soporta PWA install:

1. Usuario navega a patea.app
2. Botón "Instalar" aparece en address bar
3. Usuario hace click
4. App se abre en ventana standalone
5. Icono se agrega al sistema (taskbar en Windows, dock en Mac)

## Optimizaciones PWA

### App Shell Architecture

Estructura que carga rápido y luego carga contenido dinámico:

```
┌─────────────────────┐
│   Navigation Bar    │  ← Cacheado (shell)
├─────────────────────┤
│                     │
│   Dynamic Content   │  ← Fetched
│                     │
├─────────────────────┤
│   Bottom Nav Bar    │  ← Cacheado (shell)
└─────────────────────┘
```

### Precaching

Rutas críticas precacheadas en instalación:
```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('patea-v1').then((cache) => {
      return cache.addAll([
        '/dashboard',
        '/players',
        '/matches',
        '/offline.html',
        '/icon-192.png',
        '/manifest.json',
      ]);
    })
  );
});
```

### Code Splitting

Next.js automáticamente hace code splitting, pero para PWA agregamos:
- Dynamic imports para rutas no críticas
- Lazy loading de componentes pesados
- Route-based splitting

### Asset Optimization

- Imágenes comprimidas (WebP con fallback)
- Lazy loading de imágenes below-the-fold
- Font subsetting (solo caracteres usados)
- Minificación de CSS/JS

## Métricas y Analytics

### Install Tracking

```typescript
window.addEventListener('appinstalled', (event) => {
  console.log('PWA installed');

  // Track con analytics
  gtag('event', 'pwa_install', {
    event_category: 'engagement',
    event_label: 'PWA Install',
  });
});
```

### Usage Metrics

- % de usuarios que instalan PWA
- Retention rate (instalados vs no instalados)
- Tiempo de carga (standalone vs browser)
- Offline usage (requests from cache)
- Push notification engagement rate

### Performance

- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)

Target Lighthouse PWA score: **> 90**

## Limitaciones

### iOS

- No soporta `beforeinstallprompt`
- Notificaciones push limitadas (no funcionan en home screen app)
- Background sync no soportado
- Install requiere pasos manuales

### Android

- Funcionalidad completa
- Algunos OEMs (Samsung, Xiaomi) pueden tener quirks

### Desktop

- Soporte variable según browser
- Chrome/Edge: Excelente
- Firefox: Limitado
- Safari: No soporta PWA install

## Próximas Mejoras

- [ ] Periodic background sync para actualizar datos
- [ ] Share target API (compartir desde otras apps a Pateá)
- [ ] Contact picker API
- [ ] Geolocation background tracking (partidos)
- [ ] Biometric authentication (Web Authentication API)
- [ ] Bluetooth integration (smartwatches, wearables)
- [ ] NFC para check-in en partidos
- [ ] Badging API (contador de notificaciones no leídas en icon)

---

**Nota**: La PWA permite que Pateá compita con apps nativas en stores sin necesidad de publicar en Play Store o App Store, reduciendo costos y fricción de instalación mientras mantiene una experiencia de calidad.
