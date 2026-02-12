
// This file needs to be in the public folder.

importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

// IMPORTANT: Replace this with your project's web app config object.
const firebaseConfig = {
  apiKey: "AIzaSyAes7EVn8hQswS8XgvDMJfN6U4IT_ZL_WY",
  authDomain: "mil-disculpis.firebaseapp.com",
  projectId: "mil-disculpis",
  storageBucket: "mil-disculpis.firebasestorage.app",
  messagingSenderId: "5614567933",
  appId: "1:5614567933:web:6d7b7dde5f994c36861994",
  measurementId: "G-56F70EMSVB"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  const notificationTitle = payload.notification?.title || "Pateá";
  const link = payload.fcmOptions?.link || payload.data?.link || "/";
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-48x48.png",
    data: { link, ...payload.data },
    tag: payload.data?.type || "default",
    vibrate: [100, 50, 100],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open/focus the app and navigate to the deep link
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing tab
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // No existing tab — open a new one
      return clients.openWindow(urlToOpen);
    })
  );
});

