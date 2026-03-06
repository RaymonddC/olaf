'use client';

import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { app } from './firebase';
import { api } from './api';

let messagingInstance: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (e) {
      console.warn('Firebase Messaging not available:', e);
      return null;
    }
  }
  return messagingInstance;
}

/**
 * Request notification permission, get FCM token, and register with backend.
 * Returns the token if successful, null otherwise.
 */
export async function setupPushNotifications(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Check browser support
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications not supported in this browser');
    return null;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission denied');
    return null;
  }

  const messaging = getMessagingInstance();
  if (!messaging) return null;

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
    );

    // Get FCM token
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('Failed to get FCM token');
      return null;
    }

    // Register token with backend
    await api.post('/api/notifications/register-token', {
      token,
      device_id: '',
    });

    console.log('FCM token registered successfully');
    return token;
  } catch (err) {
    console.error('Failed to setup push notifications:', err);
    return null;
  }
}

/**
 * Listen for foreground FCM messages. Returns an unsubscribe function.
 * The callback receives the notification payload.
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void,
): (() => void) | null {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const unsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'OLAF Alert';
    const body = payload.notification?.body ?? '';
    const data = payload.data as Record<string, string> | undefined;
    callback({ title, body, data });
  });

  return unsubscribe;
}

/**
 * Unregister FCM token from backend and clear service worker.
 */
export async function teardownPushNotifications(token: string): Promise<void> {
  try {
    await api.delete('/api/notifications/unregister-token', {
      body: { token },
    });
  } catch (err) {
    console.error('Failed to unregister FCM token:', err);
  }
}
