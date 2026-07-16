import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  payment_method: string;
  tracking_code: string | null;
  created_at: string;
  updated_at: string;
}

type OrderUpdateCallback = (order: Order) => void;

// Helper function to show push notification
const showPushNotification = async (title: string, body: string, data?: any) => {
  if ("serviceWorker" in navigator && "Notification" in window) {
    const permission = Notification.permission;
    if (permission === "granted") {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "order-update",
          data,
          requireInteraction: true,
        } as NotificationOptions);
      } catch (error) {
        console.log("Push notification failed, falling back to toast:", error);
      }
    }
  }
};

export const useRealtimeOrders = (
  userId: string | undefined,
  onOrderUpdate?: OrderUpdateCallback
) => {
  const handleOrderUpdate = useCallback(
    async (payload: any) => {
      const updatedOrder = payload.new as Order;
      
      // Only process updates for the current user's orders
      if (userId && updatedOrder.user_id === userId) {
        console.log("Realtime order update received:", updatedOrder);
        
        // Show toast notification for status changes
        if (payload.old && payload.old.status !== updatedOrder.status) {
          const statusMessages: Record<string, { title: string; message: string }> = {
            processing: { title: "Order Processing 📦", message: "Your order is now being processed!" },
            shipped: { title: "Order Shipped 🚚", message: "Great news! Your order has been shipped!" },
            delivered: { title: "Order Delivered ✅", message: "Your order has been delivered!" },
            cancelled: { title: "Order Cancelled ❌", message: "Your order has been cancelled." },
            payment_failed: { title: "Payment Failed 💳", message: "Payment failed for your order." },
            refunded: { title: "Order Refunded 💰", message: "Your order has been refunded." },
            refund_pending: { title: "Refund Processing ⏳", message: "Your refund is being processed." },
          };
          
          const statusInfo = statusMessages[updatedOrder.status];
          if (statusInfo) {
            // Show in-app toast
            toast.info(statusInfo.message, {
              description: `Order #${updatedOrder.id.slice(0, 8).toUpperCase()}`,
            });
            
            // Also show push notification if enabled
            await showPushNotification(
              statusInfo.title,
              statusInfo.message,
              { orderId: updatedOrder.id, trackingCode: updatedOrder.tracking_code }
            );
          }
        }
        
        onOrderUpdate?.(updatedOrder);
      }
    },
    [userId, onOrderUpdate]
  );

  useEffect(() => {
    if (!userId) return;

    console.log("Setting up realtime subscription for user:", userId);

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${userId}`,
        },
        handleOrderUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("New order created:", payload.new);
          onOrderUpdate?.(payload.new as Order);
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      console.log("Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [userId, handleOrderUpdate, onOrderUpdate]);
};

// Hook for tracking page to get realtime updates for a specific order
export const useRealtimeOrderTracking = (
  trackingCode: string | undefined,
  onOrderUpdate?: (order: Order) => void
) => {
  useEffect(() => {
    if (!trackingCode) return;

    console.log("Setting up realtime tracking for:", trackingCode);

    const channel = supabase
      .channel(`order-tracking-${trackingCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `tracking_code=eq.${trackingCode}`,
        },
        (payload) => {
          console.log("Order tracking update received:", payload.new);
          const updatedOrder = payload.new as Order;
          
          toast.info("Order status updated!", {
            description: `Your order is now: ${updatedOrder.status.replace(/_/g, " ")}`,
          });
          
          onOrderUpdate?.(updatedOrder);
        }
      )
      .subscribe((status) => {
        console.log("Tracking subscription status:", status);
      });

    return () => {
      console.log("Cleaning up tracking subscription");
      supabase.removeChannel(channel);
    };
  }, [trackingCode, onOrderUpdate]);
};
