import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { Heart, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { ProductCard } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const Favorites = () => {
  const { favorites, loading } = useFavorites();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!user) {
      toast.error(t("pleaseSignInWishlist"));
      return;
    }
    setSharing(true);
    try {
      // Check if user already has a share token
      const { data: existing } = await supabase
        .from("shared_wishlists")
        .select("share_token")
        .eq("user_id", user.id)
        .single();

      let token = existing?.share_token;
      if (!token) {
        const { data: created, error } = await supabase
          .from("shared_wishlists")
          .insert({ user_id: user.id })
          .select("share_token")
          .single();
        if (error) throw error;
        token = created?.share_token;
      }

      const url = `${window.location.origin}/wishlist/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("wishlistLinkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error(t("failedGenerateLink"));
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">{t("loadingFavorites")}</p>
        </main>
        <BottomNav />
      </>
    );
  }

  if (favorites.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20">
          <div className="container mx-auto px-4 py-8">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-semibold mb-8"
            >
              {t("favorites")}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center justify-center min-h-[50vh]"
            >
              <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Heart className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("noFavoritesYet")}</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-sm">
                {t("startAddingFavorites")}
              </p>
              <Link to="/products">
                <Button size="lg" className="rounded-full">
                  {t("browseProducts")}
                </Button>
              </Link>
            </motion.div>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-semibold"
              >
                {t("favorites")}
              </motion.h1>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-2"
                onClick={handleShare}
                disabled={sharing}
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? t("copied") : t("share")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
            {favorites.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ProductCard
                  id={item.products.id}
                  name={item.products.name}
                  price={item.products.price}
                  image={item.products.image}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Favorites;
