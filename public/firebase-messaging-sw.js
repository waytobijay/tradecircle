importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            self.FIREBASE_API_KEY            || '',
  authDomain:        self.FIREBASE_AUTH_DOMAIN        || '',
  projectId:         self.FIREBASE_PROJECT_ID         || '',
  storageBucket:     self.FIREBASE_STORAGE_BUCKET     || '',
  appId:             self.FIREBASE_APP_ID             || '',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'TradeCircle', {
    body:  body  ?? '',
    icon:  icon  ?? '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data:  payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.linkTo ?? '/';
  event.waitUntil(clients.openWindow(url));
});
