import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, User, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const PersonalInformation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    avatar_url: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setFormData({
          full_name: data.full_name || "",
          email: data.email || user.email || "",
          avatar_url: data.avatar_url || "",
        });
      }
    };

    fetchProfile();
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting parameter
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrlWithCacheBust })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setFormData({ ...formData, avatar_url: publicUrl });
      toast({
        title: t("success"),
        description: "Profile picture updated successfully",
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: t("error"),
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      toast({
        title: t("error"),
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("success"),
        description: "Profile updated successfully",
      });
    }
  };

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
          <h1 className="text-lg font-semibold">{t("myProfile")}</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 max-w-2xl mx-auto"
        >
          {/* Avatar Section */}
          <div className="flex flex-col items-center py-6">
            <div 
              onClick={handleAvatarClick}
              className="relative w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4 cursor-pointer overflow-hidden group"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : formData.avatar_url ? (
                <img 
                  src={formData.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button 
              onClick={handleAvatarClick}
              className="text-sm text-primary font-medium"
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? t("loading") : "Change Photo"}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t("fullName")}</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : t("save")}
            </Button>
          </form>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default PersonalInformation;
