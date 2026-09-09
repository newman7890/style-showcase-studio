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
    sale_price?: number | null;
    sale_ends_at?: string | null;
    image: string;
    images?: string[] | null;
    colors?: any[] | null;
    category: string;
    stock?: number | null;
  };
}

export const getCartItemImage = (item: CartItem | any): string => {
  if (!item) return "/placeholder.svg";

  // 1. If item has selected_color with an explicit image
  if (item.selected_color && typeof item.selected_color === "object" && item.selected_color.image) {
    return item.selected_color.image;
  }

  // 2. If item.selected_color has a name, find matching color image in products.colors
  const colorName = typeof item.selected_color === "string" ? item.selected_color : item.selected_color?.name;
  if (colorName && item.products?.colors && Array.isArray(item.products.colors)) {
    const matched = item.products.colors.find(
      (c: any) =>
        (typeof c === "string" && c.toLowerCase().trim() === colorName.toLowerCase().trim()) ||
        (typeof c === "object" && c?.name?.toLowerCase().trim() === colorName.toLowerCase().trim())
    );
    if (matched && typeof matched === "object" && matched.image) {
      return matched.image;
    }
  }

  // 3. Fallback to product primary image or first gallery image
  return item.products?.image || item.products?.images?.[0] || "/placeholder.svg";
};

export const getCartItemAvailableStock = (item: CartItem | any): number => {
  if (!item || !item.products) return 9999;
  if ((item.selected_color as any)?.isGiftCard) return 9999;

  const product = item.products;
  const colorName = typeof item.selected_color === "string" ? item.selected_color : item.selected_color?.name;

  if (colorName && product.colors && Array.isArray(product.colors)) {
    const matched = product.colors.find(
      (c: any) =>
        (typeof c === "string" && c.toLowerCase().trim() === colorName.toLowerCase().trim()) ||
        (typeof c === "object" && c?.name?.toLowerCase().trim() === colorName.toLowerCase().trim())
    );
    if (matched && typeof matched === "object" && typeof matched.stock === "number") {
      return Math.max(0, matched.stock);
    }
  }

  if (typeof product.stock === "number") {
    return Math.max(0, product.stock);
  }

  return 9999;
};

export const getCartItemUnitPrice = (item: CartItem): number => {
  if (!item.products) return 0;
  const p = item.products;
  const isSaleExpired = Boolean(
    p.sale_ends_at && new Date(p.sale_ends_at).getTime() <= Date.now()
  );
  const isSaleActive =
    p.sale_price != null &&
    Number(p.sale_price) > 0 &&
    Number(p.sale_price) < Number(p.price) &&
    !isSaleExpired;
  return isSaleActive ? Number(p.sale_price) : Number(p.price);
};

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
  clearCart: (showToast?: boolean) => Promise<void>;
  fetchCart: () => Promise<void>;
  total: number;
  originalTotal: number;
  savingsTotal: number;
  itemCount: number;
  getItemUnitPrice: (item: CartItem) => number;
  getItemAvailableStock: (item: CartItem) => number;
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
            sale_price,
            sale_ends_at,
            image,
            images,
            colors,
            category,
            stock
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
              sale_price,
              sale_ends_at,
              image,
              images,
              colors,
              category,
              stock
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

  const addToCart = useCallback(async (
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
      // 1. Fetch current product and variant stock info
      const { data: productData } = await supabase
        .from("products")
        .select("id, name, stock, colors")
        .eq("id", productId)
        .maybeSingle();

      let availableStock = 9999;
      if (productData) {
        if ((selectedColor as any)?.isGiftCard) {
          availableStock = 9999;
        } else if (selectedColor?.name && productData.colors && Array.isArray(productData.colors)) {
          const matched = productData.colors.find(
            (c: any) =>
              (typeof c === "string" && c.toLowerCase().trim() === selectedColor.name.toLowerCase().trim()) ||
              (typeof c === "object" && c?.name?.toLowerCase().trim() === selectedColor.name.toLowerCase().trim())
          );
          if (matched && typeof matched === "object" && typeof matched.stock === "number") {
            availableStock = Math.max(0, matched.stock);
          } else if (typeof productData.stock === "number") {
            availableStock = Math.max(0, productData.stock);
          }
        } else if (typeof productData.stock === "number") {
          availableStock = Math.max(0, productData.stock);
        }
      }

      // Check if item already exists in cart with the exact same user, product, color, and size
      const { data: existingItems } = await supabase
        .from("cart_items")
        .select("id, quantity, selected_color, selected_size")
        .eq("user_id", user.id)
        .eq("product_id", productId);

      const incomingColorName = selectedColor?.name?.trim() || "";
      const incomingSize = selectedSize?.trim() || "";

      // Find an item with the EXACT same color and size variant
      const exactMatch = (existingItems || []).find((item: any) => {
        const itemColorName = (typeof item.selected_color === "object" && item.selected_color?.name)
          ? item.selected_color.name.trim()
          : (typeof item.selected_color === "string" ? item.selected_color.trim() : "");
        const itemSize = item.selected_size?.trim() || "";
        return itemColorName === incomingColorName && itemSize === incomingSize;
      });

      const currentQty = exactMatch ? exactMatch.quantity : 0;
      if (currentQty + quantity > availableStock) {
        if (currentQty >= availableStock) {
          toast.error(`You already have all ${availableStock} available in your cart.`);
          return;
        } else {
          toast.error(`Cannot add ${quantity} more. Only ${availableStock - currentQty} left in stock.`);
          return;
        }
      }

      if (exactMatch) {
        const newQty = exactMatch.quantity + quantity;
        const { error } = await supabase
          .from("cart_items")
          .update({
            quantity: newQty,
            ...(selectedColor ? { selected_color: selectedColor } : {}),
            ...(selectedSize ? { selected_size: selectedSize } : {}),
          })
          .eq("id", exactMatch.id);

        if (error) {
          const { error: fallbackError } = await supabase
            .from("cart_items")
            .update({ quantity: newQty })
            .eq("id", exactMatch.id);

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
            selected_size: selectedSize || null,
          });

        if (error) {
          console.warn("Insert with color/size failed, checking constraint fallback:", error.message);
          if (/duplicate key|unique constraint/i.test(error.message) && existingItems && existingItems.length > 0) {
            const first = existingItems[0];
            await supabase
              .from("cart_items")
              .update({
                quantity: first.quantity + quantity,
                selected_color: selectedColor || null,
                selected_size: selectedSize || null,
              })
              .eq("id", first.id);
          } else {
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
  }, [user, fetchCart]);

  /**
   * updateQuantity:
   * Instantaneous Optimistic Update (0ms response).
   * React state updates immediately so numbers and totals change on tap.
   * Supabase network sync is debounced (350ms) to coalesce rapid clicks.
   */
  const updateQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(cartItemId);
      return;
    }

    const currentItem = cartItemsRef.current.find((item) => item.id === cartItemId);
    if (!currentItem) return;

    // Check stock limit
    const maxStock = getCartItemAvailableStock(currentItem);
    if (quantity > maxStock) {
      toast.error(`Cannot add more. Only ${maxStock} left in stock.`);
      return;
    }

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
  }, []);

  /**
   * removeFromCart:
   * Instantaneous Optimistic Removal.
   * Removes from state immediately (0ms) and persists to Supabase in background.
   */
  const removeFromCart = useCallback(async (cartItemId: string) => {
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
  }, []);

  /**
   * clearCart:
   * Instantaneous Optimistic Cart Reset.
   */
  const clearCart = useCallback(async (showToast: boolean = false) => {
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
      if (showToast) {
        toast.success("Cart cleared");
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
      setCartItems(previousItems);
      if (showToast) {
        toast.error("Failed to clear cart");
      }
    }
  }, [user]);

  const total = cartItems.reduce(
    (sum, item) => sum + getCartItemUnitPrice(item) * item.quantity,
    0
  );

  const originalTotal = cartItems.reduce(
    (sum, item) => sum + (Number(item.products?.price) || 0) * item.quantity,
    0
  );

  const savingsTotal = Math.max(0, originalTotal - total);

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
    originalTotal,
    savingsTotal,
    itemCount,
    getItemUnitPrice: getCartItemUnitPrice,
    getItemAvailableStock: getCartItemAvailableStock,
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
