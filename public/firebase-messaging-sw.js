// public/firebase-messaging-sw.js
// Firebase Cloud Messaging (FCM) Service Worker for Background Notifications

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDNeWehs1DnPvpVcRYShMpmJYHOd89BSvM",
  authDomain: "pavithra-gold-finance.firebaseapp.com",
  projectId: "pavithra-gold-finance",
  storageBucket: "pavithra-gold-finance.firebasestorage.app",
  messagingSenderId: "711653969",
  appId: "1:711653969:web:e3f147500e80d49b529670",
  measurementId: "G-H8VX2BEZ9J"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Pavithra Gold Finance';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'You have a new update.',
    icon: '/logo.jpg',
    badge: '/icon.jpg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
