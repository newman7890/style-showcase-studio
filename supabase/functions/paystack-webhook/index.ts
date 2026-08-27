import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/crypto.ts";
import { getPaystackSecretKey } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: {
      order_id?: string;
    };
    customer?: {
      email?: string;
    };
  };
}

/**
 * Decrement product stock for each purchased item.
 * Reduces both the top-level `stock` integer and the per-color stock
 * inside the `colors` JSONB array (if the customer selected a color).
 */
async function decrementStock(
  supabase: any,
  items: Array<{ product_id: string; quantity: number; selected_color?: any }>
) {
  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const productId = item.product_id;
    if (!productId) continue;

    // 1. Decrement main product stock (never below 0)
    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("stock, colors")
      .eq("id", productId)
      .single();

    if (fetchErr || !product) {
      console.error(`Stock decrement: could not fetch product ${productId}`, fetchErr);
      continue;
    }

    const newStock = Math.max(0, (Number(product.stock) || 0) - qty);
    const updatePayload: Record<string, any> = { stock: newStock };

    // 2. If customer selected a color, decrement that color's stock in the JSONB array
    if (item.selected_color && Array.isArray(product.colors)) {
      const colorName =
        typeof item.selected_color === "string"
          ? item.selected_color
          : item.selected_color?.name || null;

      if (colorName) {
        const updatedColors = product.colors.map((c: any) => {
          if (c && c.name === colorName) {
            return { ...c, stock: Math.max(0, (Number(c.stock) || 0) - qty) };
          }
          return c;
        });
        updatePayload.colors = updatedColors;
      }
    }

    const { error: updErr } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", productId);

    if (updErr) {
      console.error(`Stock decrement failed for product ${productId}:`, updErr);
    } else {
      console.log(`Stock decremented for product ${productId}: ${product.stock} → ${newStock}`);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = getPaystackSecretKey();

    // Get the request body
    const body = await req.text();
    
    // Verify Paystack signature using Web Crypto API — REQUIRED
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.log("Missing x-paystack-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(paystackSecretKey),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      console.log("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: PaystackEvent = JSON.parse(body);
    console.log("Paystack webhook event received:", event.event);
    console.log("Event data:", JSON.stringify(event.data));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderId = (event.data.metadata as any)?.order_id;
    const checkoutDetails = (event.data.metadata as any)?.checkout_details;
    const userId = (event.data.metadata as any)?.user_id;
    const reference = event.data.reference;

    switch (event.event) {
      case "charge.success": {
        // Idempotency check: if order with this reference already exists, do nothing
        if (reference) {
          const { data: existing } = await supabase
            .from("orders")
            .select("id")
            .eq("payment_reference", reference)
            .maybeSingle();

          if (existing) {
            console.log(`Webhook: Order ${existing.id} already exists for reference ${reference}`);
            break;
          }
        }

        // Payment confirmed - mark existing order as confirmed OR create new order from checkoutDetails
        if (orderId) {
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: "confirmed",
              payment_status: "paid",
              payment_reference: reference,
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error updating order status:", error);
          } else {
            console.log(`Order ${orderId} payment confirmed`);

            // Decrement stock for each item in this order
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("product_id, quantity, selected_color")
              .eq("order_id", orderId);
            if (orderItems && orderItems.length > 0) {
              await decrementStock(supabase, orderItems);
            }

            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId, status: "confirmed" },
              });
            } catch (notifErr) {
              console.error("Error sending order notification from webhook:", notifErr);
            }
          }
        } else if (checkoutDetails && userId) {
          const paidAmountGhs = event.data.amount / 100;
          const trackingCode = "TRK" + Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 30)]).join("");
          const { data: newOrder, error: createErr } = await supabase
            .from("orders")
            .insert({
              user_id: userId,
              tracking_code: trackingCode,
              total_amount: paidAmountGhs,
              shipping_name: checkoutDetails.shipping_name,
              shipping_email: checkoutDetails.shipping_email,
              shipping_phone: checkoutDetails.shipping_phone,
              shipping_address: checkoutDetails.shipping_address,
              shipping_city: checkoutDetails.shipping_city,
              shipping_region: checkoutDetails.shipping_region,
              shipping_town: checkoutDetails.shipping_town || null,
              delivery_fee: checkoutDetails.delivery_fee || 0,
              discount_code: checkoutDetails.discount_code || null,
              discount_amount: checkoutDetails.discount_amount || null,
              payment_method: (event.data.metadata as any)?.payment_method || "bank_card",
              payment_reference: reference,
              status: "confirmed",
              payment_status: "paid",
            })
            .select()
            .single();

          if (!createErr && newOrder && checkoutDetails.items && Array.isArray(checkoutDetails.items)) {
            const itemsToInsert = checkoutDetails.items.map((item: any) => ({
              order_id: newOrder.id,
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.price,
              selected_color: item.selected_color || null,
              selected_size: item.selected_size || null,
            }));
            await supabase.from("order_items").insert(itemsToInsert);
            await supabase.from("cart_items").delete().eq("user_id", userId);

            // Decrement stock for each purchased item
            await decrementStock(supabase, checkoutDetails.items);

            console.log(`Webhook created confirmed order ${newOrder.id} for user ${userId}`);

            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId: newOrder.id, status: "confirmed" },
              });
            } catch (notifErr) {
              console.error("Error sending order notification from webhook:", notifErr);
            }
          }
        }
        break;
      }

      case "charge.failed": {
        // Payment failed - cancel/reverse the order
        if (orderId) {
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: "cancelled",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error cancelling order:", error);
          } else {
            console.log(`Order ${orderId} cancelled due to failed payment`);
          }
        }
        break;
      }

      case "refund.processed":
      case "refund.pending": {
        // Refund was processed or is pending
        if (orderId) {
          const refundStatus = event.event === "refund.processed" ? "refunded" : "refund_pending";
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: refundStatus,
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error updating order status:", error);
          } else {
            console.log(`Order ${orderId} marked as ${refundStatus}`);
            
            // Trigger notification
            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId, status: refundStatus },
              });
            } catch (notifError) {
              console.error("Error sending notification:", notifError);
            }
          }
        }
        break;
      }

      case "refund.failed": {
        // Refund failed
        console.log(`Refund failed for order ${orderId}`);
        break;
      }

      case "transfer.success":
      case "transfer.failed":
      case "transfer.reversed": {
        // Handle transfer events (for payouts)
        console.log(`Transfer event: ${event.event}`, event.data);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
