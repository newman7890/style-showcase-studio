import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import {
  User,
  ChevronRight,
  ChevronLeft,
  Bell,
  MapPin,
  Settings,
  Package,
  Store,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";

const Profile = () => {
  const { user, isAdmin, isSeller, sellerStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  }>({ full_name: null, avatar_url: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setProfile({
            full_name: data.full_name,
            avatar_url: data.avatar_url,
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Subscribe to profile changes
    if (user) {
      const channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            setProfile({
              full_name: payload.new.full_name,
              avatar_url: payload.new.avatar_url,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: t("success"),
      description: "You've been successfully logged out.",
    });
    navigate("/");
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const sellerLabel = isSeller
    ? "Seller Dashboard"
    : sellerStatus === "pending"
    ? "Seller application (pending)"
    : "Become a seller";
  const sellerPath = isSeller ? "/seller" : "/sell";

  const menuItems = [
    { icon: User, label: t("myProfile"), path: "/profile/personal", badge: 0 },
    { icon: Package, label: t("orders"), path: "/orders", badge: 0 },
    { icon: Store, label: sellerLabel, path: sellerPath, badge: 0 },
    { icon: Bell, label: t("notifications"), path: "/profile/notifications", badge: unreadCount },
    { icon: MapPin, label: "Address", path: "/profile/address", badge: 0 },
    { icon: Settings, label: t("settings"), path: "/settings", badge: 0 },
  ];

  const displayName = profile.full_name || user?.email?.split('@')[0] || 'User';

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
          <h1 className="text-lg font-semibold">{t("profile")}</h1>
          <div className="w-10 h-10" />
        </div>

        {user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 max-w-2xl mx-auto"
          >
            {/* User Info */}
            <div className="flex items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {displayName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? 'Administrator' : 'Member'}
                </p>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-2">
              {menuItems.map((item, index) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between py-4 hover:bg-secondary/50 rounded-lg px-2 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge > 0 && (
                      <span className="w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Logout Button */}
            <div className="mt-8">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                {t("logout")}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] px-4 max-w-2xl mx-auto"
          >
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sign in to continue</h2>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Create an account or sign in to save your preferences
            </p>
            <Button onClick={handleLogin}>{t("signIn")}</Button>
          </motion.div>
        )}
      </div>
      <BottomNav />
    </>
  );
};

export default Profile;
