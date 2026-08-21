import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  selected_color: { name: string; hex: string; image: string | null } | null;
  selected_size: string | null;
  products: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  };
}

export const useCart = () => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    if (!user) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    try {
      // First try selecting with selected_color and selected_size
      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          product_id,
          quantity,
          selected_color,
          selected_size,
          products (
            id,
            name,
            price,
            image,
            category
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.warn("Cart fetch with color/size failed, trying basic fetch:", error.message);
        // Fallback for when selected_color/selected_size columns don't exist yet in remote schema
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("cart_items")
          .select(`
            id,
            product_id,
            quantity,
            products (
              id,
              name,
              price,
              image,
              category
            )
          `)
          .eq("user_id", user.id);

        if (fallbackError) throw fallbackError;
        setCartItems((fallbackData as any) || []);
      } else {
        setCartItems((data as any) || []);
      }
    } catch (error: any) {
      console.error("Error fetching cart:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (
    productId: string, 
    quantity: number = 1, 
    selectedColor: { name: string; hex: string; image: string | null } | null = null,
    selectedSize: string | null = null
  ) => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      return;
    }

    try {
      // Check if item already exists in cart with the same color and size
      const { data: existingItems } = await supabase
        .from("cart_items")
        .select("id, quantity, selected_color, selected_size")
        .eq("user_id", user.id)
        .eq("product_id", productId);

      const existing = existingItems?.find((item) => {
        const itemColor = item.selected_color as any;
        const sameColor = (!selectedColor && !itemColor) || 
                          (selectedColor && itemColor && selectedColor.name === itemColor.name);
        const sameSize = item.selected_size === selectedSize;
        return sameColor && sameSize;
      });

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from("cart_items")
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity,
            selected_color: selectedColor || null,
            selected_size: selectedSize,
          });

        if (error) {
          console.warn("Insert with color/size failed, retrying basic insert:", error.message);
          const { error: fallbackError } = await supabase
            .from("cart_items")
            .insert({
              user_id: user.id,
              product_id: productId,
              quantity,
            });
          if (fallbackError) throw fallbackError;
        }
      }

      await fetchCart();
      toast.success("Added to cart!");
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      const msg = error?.message || "";
      if (/failed to fetch|load failed|networkerror/i.test(msg)) {
        toast.error("Network connection issue. Please check your internet connection.");
      } else {
        toast.error("Failed to add to cart: " + (msg || "Unknown error"));
      }
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(cartItemId);
      return;
    }

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("id", cartItemId);

      if (error) throw error;
      await fetchCart();
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Failed to update quantity");
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", cartItemId);

      if (error) throw error;
      await fetchCart();
      toast.success("Removed from cart");
    } catch (error) {
      console.error("Error removing from cart:", error);
      toast.error("Failed to remove from cart");
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      await fetchCart();
      toast.success("Cart cleared");
    } catch (error) {
      console.error("Error clearing cart:", error);
      toast.error("Failed to clear cart");
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + item.products.price * item.quantity,
    0
  );

  return {
    cartItems,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    total,
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
  };
};
