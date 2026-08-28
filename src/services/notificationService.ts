import { supabase } from "@/integrations/supabase/client";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "order_update" | "payment" | "profile_update" | "address_update" | "security" | "seller_status" | "product_status" | "general";
  orderId?: string | null;
}

export const createNotification = async ({
  userId,
  title,
  message,
  type = "general",
  orderId = null,
}: CreateNotificationParams) => {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      order_id: orderId,
      is_read: false,
    });

    if (error) {
      console.warn("Failed to create notification:", error);
    }
  } catch (e) {
    console.error("Error creating notification:", e);
  }
};
