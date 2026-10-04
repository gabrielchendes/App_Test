// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

console.log('[Push SW] firebase-messaging-sw.js loaded');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// In-memory deduplication map with 15s sliding expiration window
const seenNotificationTags = new Map();
function shouldShowNotification(key) {
  if (!key) return true;
  const now = Date.now();
  for (const [k, time] of seenNotificationTags.entries()) {
    if (now - time > 15000) seenNotificationTags.delete(k);
  }
  if (seenNotificationTags.has(key)) {
    console.log('[Push SW] Deduplicating notification for tag:', key);
    return false;
  }
  seenNotificationTags.set(key, now);
  return true;
}

// Initialize the Firebase app in the service worker with solid fallbacks
try {
  let apiKey = 'AIzaSyDjl30PtezVKv0eJvEnNJopGCHGGQGLiAg';
  let authDomain = 'app-maternidade.firebaseapp.com';
  let projectId = 'app-maternidade';
  let storageBucket = 'app-maternidade.firebasestorage.app';
  let messagingSenderId = '669118811483';
  let appId = '1:669118811483:web:0402740c397b1c7cb55e7e';

  try {
    const urlParams = new URL(self.location.href).searchParams;
    if (urlParams.get('apiKey')) apiKey = urlParams.get('apiKey');
    if (urlParams.get('authDomain')) authDomain = urlParams.get('authDomain');
    if (urlParams.get('projectId')) projectId = urlParams.get('projectId');
    if (urlParams.get('storageBucket')) storageBucket = urlParams.get('storageBucket');
    if (urlParams.get('messagingSenderId')) messagingSenderId = urlParams.get('messagingSenderId');
    if (urlParams.get('appId')) appId = urlParams.get('appId');
  } catch (_) {}

  if (typeof firebase !== 'undefined') {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId
      });
    }

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[Push SW] Background message received:', {
        hasNotification: !!payload.notification,
        hasData: !!payload.data,
        title: payload.notification?.title || payload.data?.title
      });
      
      // If the message already includes a notification payload, Firebase SDK automatically handles display.
      // We only display a manual notification if this is a data-only payload to avoid duplicate popups.
      if (!payload.notification && payload.data) {
        const notificationTitle = payload.data.title || 'Nova Notificação';
        const tag = payload.data.broadcast_id || payload.data.broadcastId || payload.data.id || payload.data.tag || 'maternidade-push';
        
        if (!shouldShowNotification(tag)) return;

        const notificationOptions = {
          body: payload.data.body || 'Você recebeu uma nova notificação.',
          icon: payload.data.icon || '/icon-192.png',
          badge: payload.data.badge || '/icon-192.png',
          tag: tag,
          renotify: false,
          data: payload.data || {}
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
      }
    });

    console.log('[Push SW] Firebase Cloud Messaging background handler active');
  }
} catch (e) {
  console.warn('[Push SW] Initialization deferred or failed:', e);
}

// Resilient native push event listener fallback (handles data-only push without duplicate display)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const raw = event.data.json();
    console.log('[Push SW] Native push event received:', raw);

    // If payload has a notification object and Firebase Messaging is initialized, Firebase handles it automatically.
    // Avoid double-displaying!
    const hasSdkNotification = Boolean(raw.notification || raw.webpush?.notification);
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && hasSdkNotification) {
      console.log('[Push SW] Notification handled by Firebase SDK; native push listener skipping duplicate');
      return;
    }

    const notification = raw.notification || raw.data || {};
    const title = notification.title || raw.data?.title || 'Nova Notificação';
    const body = notification.body || raw.data?.body || '';
    const icon = notification.icon || raw.data?.icon || '/icon-192.png';
    const badge = notification.badge || raw.data?.badge || '/icon-192.png';
    const tag = raw.data?.broadcast_id || raw.data?.broadcastId || raw.data?.id || raw.data?.tag || `push-${title}`;

    if (!shouldShowNotification(tag)) {
      console.log('[Push SW] Skipping duplicate push event for tag:', tag);
      return;
    }

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        data: raw.data || raw || {},
        renotify: false
      })
    );
  } catch (err) {
    console.warn('[Push SW] Native push fallback parse note:', err);
  }
});

// Handle notification click: focus existing window or open new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const rawUrl = event.notification.data?.url ||
                 event.notification.data?.link ||
                 event.notification.data?.click_action || 
                 event.notification.click_action || 
                 '/';

  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if exact URL is open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Check if any app window from our origin is open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // 3. Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

