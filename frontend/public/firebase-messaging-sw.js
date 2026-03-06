/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging Service Worker.
 * Handles background push notifications for the OLAF Family Dashboard.
 */

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js',
);

// Firebase config — these must match the main app config
firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG__?.apiKey ?? '',
  authDomain: self.__FIREBASE_CONFIG__?.authDomain ?? '',
  projectId: self.__FIREBASE_CONFIG__?.projectId ?? '',
  storageBucket: self.__FIREBASE_CONFIG__?.storageBucket ?? '',
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId ?? '',
  appId: self.__FIREBASE_CONFIG__?.appId ?? '',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function (payload) {
  const notificationTitle = payload.notification?.title ?? 'OLAF Alert';
  const notificationOptions = {
    body: payload.notification?.body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: payload.data?.alert_id ?? 'olaf-notification',
    data: {
      url: '/dashboard',
      ...payload.data,
    },
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// Handle notification click — open the dashboard
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
