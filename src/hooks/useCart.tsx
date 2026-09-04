import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CartItem {
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

interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  addToCart: (
    productId: string,
    quantity?: number,
    selectedColor?: { name: string; hex: string; image: string | null } | null,
    selectedSize?: string | null
  ) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  fetchCart: () => Promise<void>;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Synchronous ref to prevent stale closures in callbacks & debounced timers
  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;

  // Track debounced update timers keyed by cartItemId
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track original baseline quantities for rollback on network failure
  const rollbackQuantities = useRef<Map<string, number>>(new Map());

  const fetchCart = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Clean up any pending debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
      debounceTimers.current.clear();
      rollbackQuantities.current.clear();
    };
  }, []);

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
      // Check if item already exists in cart with the same user and product
      const { data: existingItems } = await supabase
        .from("cart_items")
        .select("id, quantity, selected_color, selected_size")
        .eq("user_id", user.id)
        .eq("product_id", productId);

      const existing = existingItems && existingItems.length > 0 ? existingItems[0] : null;

      if (existing) {
        const newQty = existing.quantity + quantity;
        const { error } = await supabase
          .from("cart_items")
          .update({
            quantity: newQty,
            ...(selectedColor ? { selected_color: selectedColor } : {}),
            ...(selectedSize ? { selected_size: selectedSize } : {}),
          })
          .eq("id", existing.id);

        if (error) {
          const { error: fallbackError } = await supabase
            .from("cart_items")
            .update({ quantity: newQty })
            .eq("id", existing.id);

          if (fallbackError) throw fallbackError;
        }
      } else {
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
      if (/duplicate key|unique constraint/i.test(msg)) {
        toast.success("Item updated in your cart!");
        fetchCart();
      } else if (/failed to fetch|load failed|networkerror/i.test(msg)) {
        toast.error("Network connection issue. Please check your connection and try again.");
      } else {
        toast.error("Could not add item to cart. Please try again.");
      }
    }
  };

  /**
   * updateQuantity:
   * Instantaneous Optimistic Update (0ms response).
   * React state updates immediately so numbers and totals change on tap.
   * Supabase network sync is debounced (350ms) to coalesce rapid clicks.
   */
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(cartItemId);
      return;
    }

    const currentItem = cartItemsRef.current.find((item) => item.id === cartItemId);
    if (!currentItem) return;

    // Record original quantity once per series of rapid clicks for rollback
    if (!rollbackQuantities.current.has(cartItemId)) {
      rollbackQuantities.current.set(cartItemId, currentItem.quantity);
    }

    // 1. OPTIMISTIC UPDATE: Immediate 0ms local state change
    setCartItems((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, quantity } : item))
    );

    // 2. Clear any pending debounce timer for this item
    if (debounceTimers.current.has(cartItemId)) {
      clearTimeout(debounceTimers.current.get(cartItemId)!);
    }

    // 3. Debounced network sync to Supabase
    const timer = setTimeout(async () => {
      debounceTimers.current.delete(cartItemId);
      const original = rollbackQuantities.current.get(cartItemId);
      rollbackQuantities.current.delete(cartItemId);

      try {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity })
          .eq("id", cartItemId);

        if (error) throw error;
        // Success: state already has latest quantity, no refetch required
      } catch (error) {
        console.error("Error syncing cart quantity to server:", error);
        // Roll back to previous quantity on error
        if (original !== undefined) {
          setCartItems((prev) =>
            prev.map((item) =>
              item.id === cartItemId ? { ...item, quantity: original } : item
            )
          );
        }
        toast.error("Could not update quantity. Please check your connection.");
      }
    }, 350);

    debounceTimers.current.set(cartItemId, timer);
  };

  /**
   * removeFromCart:
   * Instantaneous Optimistic Removal.
   * Removes from state immediately (0ms) and persists to Supabase in background.
   */
  const removeFromCart = async (cartItemId: string) => {
    // Cancel any pending debounced updates for this item
    if (debounceTimers.current.has(cartItemId)) {
      clearTimeout(debounceTimers.current.get(cartItemId)!);
      debounceTimers.current.delete(cartItemId);
    }
    rollbackQuantities.current.delete(cartItemId);

    const previousItems = cartItemsRef.current;
    // 1. OPTIMISTIC: remove immediately
    setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));

    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", cartItemId);

      if (error) throw error;
      toast.success("Removed from cart");
    } catch (error) {
      console.error("Error removing from cart:", error);
      // Roll back
      setCartItems(previousItems);
      toast.error("Failed to remove from cart");
    }
  };

  /**
   * clearCart:
   * Instantaneous Optimistic Cart Reset.
   */
  const clearCart = async () => {
    if (!user) return;

    debounceTimers.current.forEach((timer) => clearTimeout(timer));
    debounceTimers.current.clear();
    rollbackQuantities.current.clear();

    const previousItems = cartItemsRef.current;
    setCartItems([]);

    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Cart cleared");
    } catch (error) {
      console.error("Error clearing cart:", error);
      setCartItems(previousItems);
      toast.error("Failed to clear cart");
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + (item.products?.price || 0) * item.quantity,
    0
  );

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const value: CartContextType = {
    cartItems,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    fetchCart,
    total,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
