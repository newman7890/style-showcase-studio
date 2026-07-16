import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";

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

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { markAllAsRead } = useNotifications();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("notification_settings")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data?.notification_settings) {
          setSettings({ ...defaultSettings, ...(data.notification_settings as unknown as NotificationSettings) });
        }
      } catch (error) {
        console.error("Error fetching notification settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    // Mark all notifications as read when visiting this page
    markAllAsRead();
  }, [user]);

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
      // Revert on error
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
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background max-w-2xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("notifications")}</h1>
          <div className="w-10 h-10 flex items-center justify-center">
            {saving && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 max-w-2xl mx-auto"
        >
          <div className="space-y-1">
            {notificationItems.map((item, index) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between py-4 border-b border-border last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={() => toggleSetting(item.key)}
                  disabled={saving}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default Notifications;
