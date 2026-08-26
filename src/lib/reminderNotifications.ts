const preferenceKey = (userId: string) => `tenderexpert:notifications:${userId}`;
const deliveryKey = (userId: string, reminderId: string) =>
  `tenderexpert:notification-delivered:${userId}:${reminderId}`;

export const notificationSupport = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const notificationsEnabled = (userId?: string | null) =>
  Boolean(
    userId &&
      notificationSupport() &&
      Notification.permission === 'granted' &&
      localStorage.getItem(preferenceKey(userId)) === 'enabled',
  );

export async function setNotificationsEnabled(userId: string, enabled: boolean) {
  if (!enabled) {
    localStorage.setItem(preferenceKey(userId), 'disabled');
    window.dispatchEvent(new Event('tenderexpert:notification-preferences'));
    return true;
  }

  if (!notificationSupport()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  localStorage.setItem(preferenceKey(userId), 'enabled');
  window.dispatchEvent(new Event('tenderexpert:notification-preferences'));
  return true;
}

export async function deliverReminderNotification(
  userId: string,
  reminderId: string,
  title: string,
  body: string,
) {
  if (!notificationsEnabled(userId)) return;

  const key = deliveryKey(userId, reminderId);
  if (localStorage.getItem(key)) return;

  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: reminderId,
  };

  try {
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined;

    if (registration?.active) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    localStorage.setItem(key, new Date().toISOString());
  } catch (error) {
    console.warn('Unable to display TenderExpert reminder notification.', error);
  }
}
