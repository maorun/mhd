import { loadProducts, markNotified } from './storage.ts';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function checkAndNotify(): void {
  if (Notification.permission !== 'granted') return;

  const products = loadProducts();
  for (const product of products) {
    if (product.notified) continue;
    const daysLeft = getDaysUntilExpiry(product.expiryDate);
    if (daysLeft <= product.notifyDaysBefore) {
      const title = daysLeft <= 0 ? `⚠️ MHD abgelaufen: ${product.name}` : `🔔 MHD bald erreicht: ${product.name}`;
      const body =
        daysLeft <= 0
          ? `Das MHD von "${product.name}" ist abgelaufen!`
          : daysLeft === 1
            ? `Das MHD von "${product.name}" läuft morgen ab.`
            : `Das MHD von "${product.name}" läuft in ${daysLeft} Tagen ab.`;

      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: product.id,
      });
      markNotified(product.id);
    }
  }
}
