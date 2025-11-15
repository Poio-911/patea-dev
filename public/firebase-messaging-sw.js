
// This file needs to be in the public folder.

importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

// IMPORTANT: Replace this with your project's web app config object.
const firebaseConfig = {
    apiKey: "AIzaSyAes7EVn8hQswS8XgvDMJfN6U4IT_ZL_WY",
    authDomain: "mil-disculpis.firebaseapp.com",
    projectId: "mil-disculpis",
    storageBucket: "mil-disculpis.appspot.com",
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
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || "/icons/icon-192x192.png", // Ensure you have this icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

    