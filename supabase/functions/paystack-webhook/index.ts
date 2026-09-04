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
      user_id?: string;
      checkout_details?: any;
      payment_method?: string;
    };
    customer?: {
      email?: string;
    };
  };
}

/**
 * Decrement product stock for each purchased item.
 */
async function decrementStock(
  supabase: any,
  items: Array<{ product_id: string; quantity: number; selected_color?: any }>
) {
  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const productId = item.product_id;
    if (!productId) continue;

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = getPaystackSecretKey();
    const body = await req.text();
    
    // Verify Paystack signature using HMAC SHA-512
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderId = event.data.metadata?.order_id;
    const checkoutDetails = event.data.metadata?.checkout_details;
    const userId = event.data.metadata?.user_id;
    const reference = event.data.reference;
    const eventAmountPesewas = Number(event.data.amount);

    switch (event.event) {
      case "charge.success": {
        // Idempotency check: if order is already marked paid with this reference, do nothing
        if (reference) {
          const { data: existing } = await supabase
            .from("orders")
            .select("id, payment_status")
            .eq("payment_reference", reference)
            .maybeSingle();

          if (existing && existing.payment_status === "paid") {
            console.log(`Webhook: Order ${existing.id} already paid for reference ${reference}`);
            break;
          }
        }

        // 1. Existing order case
        if (orderId) {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("id, total_amount, payment_status")
            .eq("id", orderId)
            .maybeSingle();

          if (!dbOrder) {
            console.error(`Webhook: Order ${orderId} not found in database.`);
            break;
          }

          const expectedPesewas = Math.round(Number(dbOrder.total_amount) * 100);

          // CRITICAL: Amount Validation
          if (eventAmountPesewas < expectedPesewas) {
            console.error(`CRITICAL SECURITY ALERT in Webhook: Paid ${eventAmountPesewas} pesewas < required ${expectedPesewas} pesewas for order ${orderId}`);
            await supabase
              .from("orders")
              .update({
                payment_status: "failed",
                notes: `Security Warning: Underpayment detected via Webhook. Paid ${eventAmountPesewas / 100} GHS vs Required ${expectedPesewas / 100} GHS.`,
                updated_at: new Date().toISOString()
              })
              .eq("id", orderId);
            break;
          }

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
            console.error("Error updating order status in webhook:", error);
          } else {
            console.log(`Order ${orderId} payment confirmed by webhook`);

            // Decrement stock
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("product_id, quantity, selected_color")
              .eq("order_id", orderId);
            if (orderItems && orderItems.length > 0) {
              await decrementStock(supabase, orderItems);
            }

            // Record seller earnings
            try {
              await supabase.rpc("record_order_seller_earnings", { _order_id: orderId });
            } catch (earnErr) {
              console.warn("Seller earnings trigger notice:", earnErr);
            }

            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId, status: "confirmed" },
                headers: { Authorization: `Bearer ${supabaseServiceKey}` },
              });
            } catch (notifErr) {
              console.error("Error sending order notification from webhook:", notifErr);
            }
          }
        } else if (checkoutDetails && userId) {
          // 2. Direct checkout case: Verify amount against server-authoritative catalog prices
          const items = checkoutDetails.items || [];
          const productIds = items.map((i: any) => i.product_id);
          const { data: dbProducts } = await supabase
            .from("products")
            .select("id, price, stock")
            .in("id", productIds);

          const productMap = new Map((dbProducts || []).map((p: any) => [p.id, p]));
          let expectedItemsTotal = 0;
          for (const item of items) {
            const prod = productMap.get(item.product_id);
            const authoritativePrice = prod ? Number(prod.price) : Number(item.price);
            expectedItemsTotal += authoritativePrice * Number(item.quantity);
          }

          const deliveryFee = Number(checkoutDetails.delivery_fee) || 0;
          const discountAmount = Number(checkoutDetails.discount_amount) || 0;
          const expectedTotalGhs = Math.max(0.1, expectedItemsTotal + deliveryFee - discountAmount);
          const expectedPesewas = Math.round(expectedTotalGhs * 100);

          if (eventAmountPesewas < expectedPesewas) {
            console.error(`SECURITY ALERT in Webhook: Underpayment (${eventAmountPesewas} < ${expectedPesewas})`);
            break;
          }

          const paidAmountGhs = eventAmountPesewas / 100;
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
              delivery_fee: deliveryFee,
              discount_code: checkoutDetails.discount_code || null,
              discount_amount: discountAmount,
              payment_method: event.data.metadata?.payment_method || "bank_card",
              payment_reference: reference,
              status: "confirmed",
              payment_status: "paid",
            })
            .select()
            .single();

          if (!createErr && newOrder && checkoutDetails.items && Array.isArray(checkoutDetails.items)) {
            const itemsToInsert = checkoutDetails.items.map((item: any) => {
              const prod = productMap.get(item.product_id);
              return {
                order_id: newOrder.id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: prod ? Number(prod.price) : Number(item.price),
                selected_color: item.selected_color || null,
                selected_size: item.selected_size || null,
              };
            });
            await supabase.from("order_items").insert(itemsToInsert);
            await supabase.from("cart_items").delete().eq("user_id", userId);
            await decrementStock(supabase, checkoutDetails.items);

            try {
              await supabase.rpc("record_order_seller_earnings", { _order_id: newOrder.id });
            } catch (earnErr) {
              console.warn("Seller earnings trigger notice:", earnErr);
            }

            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId: newOrder.id, status: "confirmed" },
                headers: { Authorization: `Bearer ${supabaseServiceKey}` },
              });
            } catch (notifErr) {
              console.error("Error sending order notification from webhook:", notifErr);
            }
          }
        }
        break;
      }

      case "charge.failed": {
        if (orderId) {
          await supabase
            .from("orders")
            .update({ 
              status: "cancelled",
              payment_status: "failed",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing Paystack webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook handling error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
