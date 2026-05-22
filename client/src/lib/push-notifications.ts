/**
 * OneSignal web push notifications — client-side.
 * Silently skips if VITE_ONESIGNAL_APP_ID is not set.
 */
import OneSignal from "react-onesignal";

let initialized = false;

export async function initPush() {
  if (initialized) return;
  if (!import.meta.env.VITE_ONESIGNAL_APP_ID) {
    console.warn("[push] VITE_ONESIGNAL_APP_ID not set; skipping init");
    return;
  }
  try {
    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
    });
    initialized = true;
  } catch (err) {
    console.warn("[push] OneSignal init failed:", err);
  }
}

export async function subscribePush(userId: string) {
  await initPush();
  if (!initialized) return;
  try {
    await OneSignal.login(userId);
  } catch (err) {
    console.warn("[push] subscribePush failed:", err);
  }
}

export async function unsubscribePush() {
  if (!initialized) return;
  try {
    await OneSignal.logout();
  } catch (err) {
    console.warn("[push] unsubscribePush failed:", err);
  }
}
