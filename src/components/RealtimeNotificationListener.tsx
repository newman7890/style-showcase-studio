import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Package, CreditCard, CheckCircle2, ShieldCheck, Bell, 
  User, MapPin, Truck, Sparkles, Tag, Store, AlertCircle 
} from "lucide-react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playNotificationSound } from "@/utils/audio";

export const RealtimeNotificationListener: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const knownOrderStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;

    // Request native notification permission unobtrusively if supported
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    // 1. Channel for User Notifications Table
    const notifChannel = supabase
      .channel(`user-realtime-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as {
            id: string;
            title: string;
            message: string;
            type?: string;
            order_id?: string | null;
          };

          if (!newNotif) return;

          // 1. Sound & Vibration Chime
          playNotificationSound();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([100, 50, 100]);
          }

          // 2. Determine Icon
          const getIcon = (type?: string) => {
            switch (type) {
              case "order_update":
              case "order":
                return React.createElement(Package, { className: "w-5 h-5 text-emerald-500 shrink-0" });
              case "payment":
              case "payment_status":
                return React.createElement(CreditCard, { className: "w-5 h-5 text-blue-500 shrink-0" });
              case "profile_update":
              case "user":
                return React.createElement(User, { className: "w-5 h-5 text-purple-500 shrink-0" });
              case "address_update":
                return React.createElement(MapPin, { className: "w-5 h-5 text-amber-500 shrink-0" });
              case "security":
                return React.createElement(ShieldCheck, { className: "w-5 h-5 text-rose-500 shrink-0" });
              case "seller_status":
                return React.createElement(Store, { className: "w-5 h-5 text-indigo-500 shrink-0" });
              case "product_status":
                return React.createElement(CheckCircle2, { className: "w-5 h-5 text-emerald-400 shrink-0" });
              case "promo":
              case "promotion":
                return React.createElement(Tag, { className: "w-5 h-5 text-pink-500 shrink-0" });
              default:
                return React.createElement(Bell, { className: "w-5 h-5 text-primary shrink-0" });
            }
          };

          // 3. Rich Toast Notification
          toast(newNotif.title, {
            description: newNotif.message,
            icon: getIcon(newNotif.type),
            action: {
              label: newNotif.order_id ? "View Order" : "View Inbox",
              onClick: () => {
                if (newNotif.order_id) {
                  navigate(`/order-confirmation/${newNotif.order_id}`);
                } else {
                  navigate("/profile/notifications");
                }
              },
            },
            duration: 7000,
          });

          // 4. Native Browser Push Notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(newNotif.title, {
                body: newNotif.message,
                icon: "/favicon.ico",
              });
            } catch (e) {
              console.warn("Could not trigger browser notification:", e);
            }
          }
        }
      )
      .subscribe();

    // 2. Channel for Realtime Order Status Updates for Customer
    const ordersChannel = supabase
      .channel(`user-realtime-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldOrder = payload.old as { id: string; status?: string };
          const newOrder = payload.new as {
            id: string;
            status: string;
            tracking_code?: string | null;
            shipping_name?: string;
          };

          if (!newOrder || !newOrder.status) return;

          // Only notify if status actually changed
          const prevStatus = oldOrder?.status || knownOrderStatuses.current.get(newOrder.id);
          if (prevStatus === newOrder.status) return;
          knownOrderStatuses.current.set(newOrder.id, newOrder.status);

          const shortId = (newOrder.id || "").substring(0, 8).toUpperCase();
          let title = "Order Status Update";
          let message = `Order #${shortId} status changed to ${newOrder.status}.`;
          let icon = React.createElement(Package, { className: "w-5 h-5 text-primary shrink-0" });

          switch (newOrder.status.toLowerCase()) {
            case "confirmed":
              title = "Order Confirmed! 🎉";
              message = `Your payment for order #${shortId} was confirmed and is now being processed.`;
              icon = React.createElement(CheckCircle2, { className: "w-5 h-5 text-emerald-500 shrink-0" });
              break;
            case "processing":
              title = "Order Processing 📦";
              message = `We are packing your items for order #${shortId}.`;
              icon = React.createElement(Package, { className: "w-5 h-5 text-blue-500 shrink-0" });
              break;
            case "shipped":
            case "in_transit":
              title = "Order In Transit 🚚";
              message = `Order #${shortId} has been picked up by our courier and is moving to your area.`;
              icon = React.createElement(Truck, { className: "w-5 h-5 text-amber-500 shrink-0" });
              break;
            case "out_for_delivery":
              title = "Out For Delivery 🚴";
              message = `Your rider is on the way to your delivery address with order #${shortId}!`;
              icon = React.createElement(Truck, { className: "w-5 h-5 text-emerald-500 shrink-0" });
              break;
            case "delivered":
              title = "Order Delivered! 🎊";
              message = `Order #${shortId} was delivered successfully. Enjoy your purchase!`;
              icon = React.createElement(CheckCircle2, { className: "w-5 h-5 text-emerald-600 shrink-0" });
              break;
            case "cancelled":
              title = "Order Cancelled ⚠️";
              message = `Order #${shortId} has been cancelled.`;
              icon = React.createElement(AlertCircle, { className: "w-5 h-5 text-rose-500 shrink-0" });
              break;
          }

          // Sound & vibration
          playNotificationSound();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([100, 50, 100]);
          }

          toast(title, {
            description: message,
            icon,
            action: {
              label: newOrder.tracking_code ? "Track Live" : "View Order",
              onClick: () => {
                if (newOrder.tracking_code) {
                  navigate(`/track?code=${newOrder.tracking_code}`);
                } else {
                  navigate(`/order-confirmation/${newOrder.id}`);
                }
              },
            },
            duration: 8000,
          });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(title, {
                body: message,
                icon: "/favicon.ico",
              });
            } catch (e) {}
          }
        }
      )
      .subscribe();

    // 3. Channel for Seller Updates (Account status)
    const sellerChannel = supabase
      .channel(`user-realtime-seller-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seller_profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as { status?: string; business_name?: string };
          if (!updated?.status) return;

          playNotificationSound();
          if (updated.status === "approved") {
            toast.success("Seller Account Approved! 🏪", {
              description: `Congratulations! Your seller store "${updated.business_name || "Store"}" has been approved. You can now sell items!`,
              action: {
                label: "Seller Hub",
                onClick: () => navigate("/seller"),
              },
              duration: 9000,
            });
          } else if (updated.status === "rejected") {
            toast.error("Seller Application Update", {
              description: "Your seller application was not approved. Check your dashboard for details.",
              action: {
                label: "View Status",
                onClick: () => navigate("/sell"),
              },
            });
          }
        }
      )
      .subscribe();

    // 4. Channel for Seller New Order Sales Alerts
    const sellerSalesChannel = supabase
      .channel(`seller-realtime-sales-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_items",
          filter: `seller_id=eq.${user.id}`,
        },
        async (payload) => {
          const newItem = payload.new as {
            id: string;
            order_id: string;
            product_id: string;
            quantity: number;
            seller_earnings?: number | null;
          };
          if (!newItem) return;

          playNotificationSound();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([150, 80, 150]);
          }

          toast.success("New Sale Received! 💰", {
            description: `You have a new order for ${newItem.quantity} item(s). Open Seller Dashboard to view pickup details.`,
            icon: React.createElement(Store, { className: "w-5 h-5 text-emerald-500 shrink-0" }),
            action: {
              label: "View Sale",
              onClick: () => navigate("/seller"),
            },
            duration: 10000,
          });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("New Sale Received! 💰", {
                body: `You received a new order on Trades Point.`,
                icon: "/favicon.ico",
              });
            } catch (e) {}
          }
        }
      )
      .subscribe();

    // 5. Channel for Rider Delivery Assignments
    const riderDeliveryChannel = supabase
      .channel(`rider-realtime-deliveries-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `assigned_rider_id=eq.${user.id}`,
        },
        (payload) => {
          const oldOrder = payload.old as { assigned_rider_id?: string | null; status?: string };
          const newOrder = payload.new as {
            id: string;
            assigned_rider_id?: string | null;
            status: string;
            shipping_city?: string;
            shipping_town?: string;
            tracking_code?: string;
          };
          if (!newOrder) return;

          // If newly assigned or dispatch status updated
          const isNewlyAssigned = oldOrder?.assigned_rider_id !== user.id && newOrder.assigned_rider_id === user.id;

          if (isNewlyAssigned) {
            playNotificationSound();
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate([200, 100, 200]);
            }

            const destination = [newOrder.shipping_town, newOrder.shipping_city].filter(Boolean).join(", ");
            toast("New Delivery Assigned! 🚴", {
              description: `You've been assigned order #${(newOrder.tracking_code || newOrder.id.substring(0, 8)).toUpperCase()}${destination ? ` to ${destination}` : ""}.`,
              icon: React.createElement(Truck, { className: "w-5 h-5 text-emerald-500 shrink-0" }),
              action: {
                label: "Open Task",
                onClick: () => navigate(`/rider/order/${newOrder.id}`),
              },
              duration: 12000,
            });
          }
        }
      )
      .subscribe();

    // 6. Channel for Product Review Updates for Sellers
    const productStatusChannel = supabase
      .channel(`seller-product-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `seller_id=eq.${user.id}`,
        },
        (payload) => {
          const oldProd = payload.old as { status?: string };
          const newProd = payload.new as { id: string; name: string; status: string; rejection_reason?: string };
          if (!newProd || oldProd?.status === newProd.status) return;

          playNotificationSound();
          if (newProd.status === "approved") {
            toast.success("Product Approved! ✨", {
              description: `"${newProd.name}" was approved and is now live on the storefront.`,
              action: {
                label: "View in Store",
                onClick: () => navigate(`/product/${newProd.id}`),
              },
              duration: 8000,
            });
          } else if (newProd.status === "rejected") {
            toast.error("Product Not Approved", {
              description: `"${newProd.name}" was rejected${newProd.rejection_reason ? `: ${newProd.rejection_reason}` : "."}`,
              action: {
                label: "Fix in Dashboard",
                onClick: () => navigate("/seller"),
              },
              duration: 9000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(sellerChannel);
      supabase.removeChannel(sellerSalesChannel);
      supabase.removeChannel(riderDeliveryChannel);
      supabase.removeChannel(productStatusChannel);
    };
  }, [user, navigate]);

  return null;
};
