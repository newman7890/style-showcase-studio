import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  payment_method: string;
  tracking_code: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export const useOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            price
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const createOrder = async (
    orderData: {
      total_amount: number;
      shipping_name: string;
      shipping_email: string;
      shipping_phone: string;
      shipping_address: string;
      shipping_city: string;
      shipping_region: string;
      payment_method: string;
      discount_code?: string | null;
      discount_amount?: number | null;
      delivery_fee?: number | null;
    },
    cartItems: Array<{
      product_id: string;
      quantity: number;
      price: number;
    }>
  ) => {
    if (!user) {
      toast.error("Please sign in to place an order");
      return null;
    }

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          currency: "GHS",
          ...orderData,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success("Order placed successfully!");
      await fetchOrders();
      return order.id;
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to place order");
      return null;
    }
  };

  return {
    orders,
    loading,
    createOrder,
    refetchOrders: fetchOrders,
  };
};
