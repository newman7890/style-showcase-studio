import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, Loader2, Bell, Package, Tag, CheckCheck, 
  Trash2, ShieldCheck, Sparkles, SlidersHorizontal, ArrowRight 
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  order_id: string | null;
  created_at: string;
}

interface NotificationSettings {
  orderUpdates: boolean;
  promotions: boolean;
  newArrivals: boolean;
  priceDrops: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

const defaultSettings: NotificationSettings = {
  orderUpdates: true,
  promotions: false,
  newArrivals: true,
  priceDrops: true,
  emailNotifications: true,
  pushNotifications: false,
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { markAllAsRead, unreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<"inbox" | "settings">("inbox");
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch user notifications feed
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotificationsList((data as NotificationItem[]) || []);

      // Fetch notification settings from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("notification_settings")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.notification_settings) {
        setSettings({ ...defaultSettings, ...(profileData.notification_settings as unknown as NotificationSettings) });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Realtime listener for new notifications
    const channel = supabase
      .channel("user-notifications-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      // Mark single notification as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      setNotificationsList((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }

    // Navigate to order details if linked to an order
    if (notification.order_id) {
      navigate(`/orders`);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
      setNotificationsList((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification removed");
    } catch (error) {
      toast.error("Failed to delete notification");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSetting = async (key: keyof NotificationSettings) => {
    if (!user) {
      toast.error("Please sign in to change notification settings");
      return;
    }

    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_settings: newSettings })
        .eq("id", user.id);

      if (error) throw error;
      toast.success(`${key.replace(/([A-Z])/g, ' $1').trim()} ${newSettings[key] ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Failed to save settings");
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const notificationItems = [
    { key: "orderUpdates" as const, label: "Order Updates", description: "Get notified about your order status" },
    { key: "promotions" as const, label: "Promotions", description: "Receive promotional offers and deals" },
    { key: "newArrivals" as const, label: "New Arrivals", description: "Be the first to know about new products" },
    { key: "priceDrops" as const, label: "Price Drops", description: "Get alerts when prices drop on favorites" },
    { key: "emailNotifications" as const, label: "Email Notifications", description: "Receive updates via email" },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_status":
      case "order":
        return <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "promotion":
      case "promo":
        return <Tag className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">{t("notifications")}</h1>
            <div className="w-10 h-10 flex items-center justify-center">
              {saving && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border max-w-2xl mx-auto mt-3">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === "inbox"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Inbox</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 min-w-[20px] text-[10px] rounded-full">
                  {unreadCount}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Preferences</span>
            </button>
          </div>
        </div>

        {/* Content Container */}
        <main className="px-4 max-w-2xl mx-auto pt-4">
          {activeTab === "inbox" ? (
            <div className="space-y-4">
              {/* Actions Header */}
              {notificationsList.length > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground font-medium">
                    {notificationsList.length} notification{notificationsList.length > 1 ? "s" : ""}
                  </span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:text-primary/80 h-8 gap-1.5 px-2"
                    >
                      <CheckCheck className="w-4 h-4" /> Mark all read
                    </Button>
                  )}
                </div>
              )}

              {/* Notifications Feed */}
              {notificationsList.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
                    <Bell className="w-8 h-8 opacity-60" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">No notifications yet</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    When you place orders or receive updates on deals, your notification messages will appear right here.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {notificationsList.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                          !notification.is_read
                            ? "bg-primary/5 border-primary/20 shadow-sm"
                            : "bg-card border-border hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Type Icon */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            !notification.is_read ? "bg-background shadow-xs" : "bg-secondary"
                          }`}>
                            {getNotificationIcon(notification.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {formatTimeAgo(notification.created_at)}
                              </span>
                              {notification.order_id && (
                                <span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                                  View Order <ArrowRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delete Action Button */}
                          <button
                            onClick={(e) => handleDeleteNotification(notification.id, e)}
                            disabled={deletingId === notification.id}
                            className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete notification"
                          >
                            {deletingId === notification.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            /* Preferences Tab */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1 bg-card border border-border rounded-2xl p-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Alert Preferences
              </h3>
              {notificationItems.map((item, index) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3.5 border-b border-border/60 last:border-0"
                >
                  <div className="flex-1 pr-4">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={settings[item.key]}
                    onCheckedChange={() => toggleSetting(item.key)}
                    disabled={saving}
                  />
                </div>
              ))}
            </motion.div>
          )}
        </main>
      </div>
      <BottomNav />
    </>
  );
};

export default Notifications;

