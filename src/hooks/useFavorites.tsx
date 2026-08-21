import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Favorite {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  };
}

export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          product_id,
          products (
            id,
            name,
            price,
            image,
            category
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setFavorites(data || []);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      if (error?.message && !error.message.includes("Failed to fetch")) {
        toast.error("Failed to load favorites: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const isFavorite = (productId: string | { id: string }) => {
    const targetId = typeof productId === "object" ? productId?.id : productId;
    if (!targetId) return false;
    return favorites.some((fav) => fav.product_id === targetId);
  };

  const toggleFavorite = async (productId: string | { id: string }) => {
    if (!user) {
      toast.error("Please sign in to add favorites");
      return;
    }

    const targetId = typeof productId === "object" ? productId?.id : productId;
    if (!targetId) {
      toast.error("Invalid product reference");
      return;
    }

    try {
      const existing = favorites.find((fav) => fav.product_id === targetId);

      if (existing) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            product_id: targetId,
          });

        if (error) throw error;
        toast.success("Added to favorites");
      }

      await fetchFavorites();
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    }
  };

  return {
    favorites,
    loading,
    isFavorite,
    toggleFavorite,
  };
};
