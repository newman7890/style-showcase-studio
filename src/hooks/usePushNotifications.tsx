import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      
      if (isSupported) {
        const permission = Notification.permission;
        let isSubscribed = false;
        
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await (registration as any).pushManager.getSubscription();
          isSubscribed = subscription !== null;
        } catch (error) {
          console.log("Error checking subscription:", error);
        }
        
        setState({
          isSupported,
          isSubscribed,
          permission,
        });
      } else {
        setState({
          isSupported: false,
          isSubscribed: false,
          permission: "default",
        });
      }
    };

    checkSupport();
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers not supported");
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service worker registered:", registration);
      return registration;
    } catch (error) {
      console.error("Service worker registration failed:", error);
      throw error;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      toast.error("Push notifications are not supported in your browser");
      return false;
    }

    setLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setState((prev) => ({ ...prev, permission }));
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log("Push subscription:", subscription);

      // Store subscription in localStorage for now
      // In production, you'd send this to your backend
      localStorage.setItem("pushSubscription", JSON.stringify(subscription));

      setState({
        isSupported: true,
        isSubscribed: true,
        permission: "granted",
      });

      toast.success("Push notifications enabled!");
      return true;
    } catch (error: any) {
      console.error("Error subscribing to push notifications:", error);
      toast.error("Failed to enable push notifications");
      return false;
    } finally {
      setLoading(false);
    }
  }, [state.isSupported, registerServiceWorker]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        localStorage.removeItem("pushSubscription");
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
      }));

      toast.success("Push notifications disabled");
      return true;
    } catch (error: any) {
      console.error("Error unsubscribing from push notifications:", error);
      toast.error("Failed to disable push notifications");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Show a local notification (for testing or fallback)
  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (state.permission !== "granted") {
        console.log("Notification permission not granted");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...options,
        });
      } catch (error) {
        console.error("Error showing notification:", error);
        // Fallback to regular notification
        if ("Notification" in window) {
          new Notification(title, options);
        }
      }
    },
    [state.permission]
  );

  return {
    ...state,
    loading,
    subscribe,
    unsubscribe,
    showNotification,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}
