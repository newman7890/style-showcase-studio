import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Package, CreditCard, CheckCircle2, ShieldCheck, Bell, User, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playNotificationSound } from "@/utils/audio";

export const RealtimeNotificationListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Listen for new realtime notifications inserted for this user
    const channel = supabase
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
            type: string;
            order_id?: string | null;
          };

          if (!newNotif) return;

          // 1. Play chime audio sound
          playNotificationSound();

          // 2. Determine icon based on notification type
          const getIcon = (type: string) => {
            switch (type) {
              case "order_update":
              case "order":
                return <Package className="w-5 h-5 text-emerald-500 shrink-0" />;
              case "payment":
              case "payment_status":
                return <CreditCard className="w-5 h-5 text-blue-500 shrink-0" />;
              case "profile_update":
              case "user":
                return <User className="w-5 h-5 text-purple-500 shrink-0" />;
              case "address_update":
                return <MapPin className="w-5 h-5 text-amber-500 shrink-0" />;
              case "security":
                return <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />;
              case "seller_status":
              case "product_status":
                return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
              default:
                return <Bell className="w-5 h-5 text-primary shrink-0" />;
            }
          };

          // 3. Show rich toast notification
          toast(newNotif.title, {
            description: newNotif.message,
            icon: getIcon(newNotif.type),
            action: {
              label: newNotif.order_id ? "View Order" : "View Inbox",
              onClick: () => {
                if (newNotif.order_id) {
                  navigate("/orders");
                } else {
                  navigate("/profile/notifications");
                }
              },
            },
            duration: 6000,
          });

          // 4. Native Browser Push Notification (if permitted)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(newNotif.title, {
                body: newNotif.message,
                icon: "/favicon.ico",
              });
            } catch (e) {
              console.warn("Could not trigger native browser notification:", e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
};
