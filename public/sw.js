// Service Worker for Push Notifications

const CACHE_NAME = 'order-notifications-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = {
    title: 'Order Update',
    body: 'You have a new order update',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'order-update',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'order-update',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'View Order'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === 'view' || !action) {
    // Open the orders page or tracking page
    let url = '/orders';
    
    if (notificationData && notificationData.trackingCode) {
      url = `/track/${notificationData.trackingCode}`;
    } else if (notificationData && notificationData.orderId) {
      url = '/orders';
    }

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open a new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
