import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getAllPaystackSecretKeysAsync } from "../_shared/paystack.ts";
import { calculateAuthoritativeCheckoutTotal } from "../_shared/pricing.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

const VerifySchema = z.object({
  reference: z
    .string()
    .min(1)
    .max(100, "Reference too long")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid reference format"),
});

const generateTrackingCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TRK";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

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
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const auth = await authenticate(req);
  const clientId = getClientIdentifier(req, auth?.userId);

  // Rate Limiting (30 verification checks per 5 minutes)
  const rateCheck = await checkGlobalRateLimitAsync(auth?.client || supabase, "verify-payment", clientId, { maxRequests: 30, windowMs: 5 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many payment verification attempts. Please wait a moment." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateCheck.resetInSec.toString(),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    if (auth) {
      console.log(`verify-payment authenticated user: ${auth.userId}`);
    }

    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { reference } = parsed.data;
    console.log(`Verifying payment with reference: ${reference}`);

    // Idempotency check: if order with this payment_reference is already marked paid, return success
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (existingOrder && existingOrder.payment_status === "paid") {
      console.log(`Order ${existingOrder.id} already paid for reference ${reference}`);
      return new Response(
        JSON.stringify({
          success: true,
          status: "success",
          orderId: existingOrder.id,
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Contact Paystack API directly
    const allKeys = await getAllPaystackSecretKeysAsync();
    let paystackData: any = null;
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        console.log(`Retrying Paystack verification attempt ${attempt + 1}...`);
      }

      for (const keyConfig of allKeys) {
        try {
          console.log(`Trying verify with secret key from ${keyConfig.sourceName}...`);
          const response = await fetch(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
              headers: {
                Authorization: `Bearer ${keyConfig.secretKey}`,
              },
            }
          );
          const resData = await response.json();
          if (resData.status) {
            paystackData = resData;
            break;
          } else {
            if (resData.message && !resData.message.toLowerCase().includes("invalid key")) {
              lastError = resData.message;
            }
          }
        } catch (e) {
          console.error(`Error verifying with key ${keyConfig.sourceName}:`, e);
        }
      }

      if (paystackData?.status) break;
    }

    if (!paystackData || !paystackData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          friendlyError: lastError || "Failed to verify transaction with payment provider.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const transaction = paystackData.data;
    const isSuccessful = transaction.status === "success";
    const metadata = transaction.metadata || {};
    let orderId = metadata.order_id;
    const checkoutDetails = metadata.checkout_details;
    const userId = metadata.user_id || auth?.userId;
    const actualPaidAmountPesewas = Number(transaction.amount);

    console.log("Transaction details:", JSON.stringify({
      status: transaction.status,
      gateway_response: transaction.gateway_response,
      amount: transaction.amount,
      reference: transaction.reference,
      orderId,
      userId,
    }));

    if (!isSuccessful) {
      const gw = (transaction.gateway_response || "").toLowerCase();
      let friendlyError = `Payment failed (${transaction.gateway_response || transaction.status}). Please try again.`;
      if (gw.includes("insufficient")) {
        friendlyError = "Insufficient funds. Please top up and try again.";
      } else if (gw.includes("declined") || gw.includes("do not honor")) {
        friendlyError = "Transaction was declined by your provider. Please try a different payment method.";
      } else if (gw.includes("abandoned") || transaction.status === "abandoned") {
        friendlyError = "Payment was not completed. Please approve the prompt on your phone and try again.";
      } else if (gw.includes("timeout") || gw.includes("timed out")) {
        friendlyError = "Payment timed out. Please try again and approve the prompt quickly.";
      }

      if (orderId) {
        await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: transaction.status,
          friendlyError,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 1. Existing order case: Verify exact amount matches DB order total
    if (orderId) {
      const { data: dbOrder, error: dbOrderErr } = await supabase
        .from("orders")
        .select("id, total_amount, status, payment_status, user_id, shipping_email")
        .eq("id", orderId)
        .maybeSingle();

      if (dbOrderErr || !dbOrder) {
        return new Response(
          JSON.stringify({ success: false, friendlyError: "Order attached to transaction not found." }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const expectedPesewas = Math.round(Number(dbOrder.total_amount) * 100);

      // CRITICAL: Amount Validation
      if (actualPaidAmountPesewas < expectedPesewas) {
        console.error(`CRITICAL SECURITY ALERT: Paid amount (${actualPaidAmountPesewas} pesewas) is less than required order total (${expectedPesewas} pesewas)!`);
        await supabase
          .from("orders")
          .update({ 
            payment_status: "failed", 
            notes: `Security Warning: Underpayment detected. Paid ${actualPaidAmountPesewas / 100} GHS vs Required ${expectedPesewas / 100} GHS.`,
            updated_at: new Date().toISOString() 
          })
          .eq("id", orderId);

        return new Response(
          JSON.stringify({
            success: false,
            friendlyError: "Payment amount does not match the order total. Please contact support.",
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update order to paid and confirmed
      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          status: "confirmed", 
          payment_status: "paid", 
          payment_reference: reference,
          updated_at: new Date().toISOString() 
        })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order status:", updateError);
        return new Response(
          JSON.stringify({ success: false, friendlyError: "Database error updating order status." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Decrement stock
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, selected_color")
        .eq("order_id", orderId);
      if (orderItems && orderItems.length > 0) {
        await decrementStock(supabase, orderItems);
      }

      // Record seller earnings via service role
      try {
        await supabase.rpc("record_order_seller_earnings", { _order_id: orderId });
      } catch (earnErr) {
        console.warn("Seller earnings trigger notice:", earnErr);
      }

      // Send order notification
      try {
        await supabase.functions.invoke("send-order-notification", {
          body: { orderId, status: "confirmed" },
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
      } catch (notifErr) {
        console.error("Error invoking order notification:", notifErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "success",
          orderId,
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else if (checkoutDetails) {
      // 2. Direct checkout case: Verify amount against server-authoritative catalog prices, delivery fee, and coupons
      let pricing;
      try {
        pricing = await calculateAuthoritativeCheckoutTotal(supabase, checkoutDetails);
      } catch (calcErr: any) {
        return new Response(
          JSON.stringify({ success: false, friendlyError: calcErr?.message || "Failed to calculate authoritative prices." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const expectedPesewas = Math.round(pricing.totalAmount * 100);

      if (actualPaidAmountPesewas < expectedPesewas) {
        console.error(`SECURITY ALERT: Checkout payment underpaid (${actualPaidAmountPesewas} < ${expectedPesewas})`);
        return new Response(
          JSON.stringify({ success: false, friendlyError: "Payment amount does not match required catalog total." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const paidAmountGhs = actualPaidAmountPesewas / 100;
      const trackingCode = generateTrackingCode();

      const insertPayload: Record<string, any> = {
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
        delivery_fee: pricing.deliveryFee,
        discount_code: checkoutDetails.discount_code || null,
        discount_amount: pricing.discountAmount,
        payment_method: metadata.payment_method || "bank_card",
        payment_reference: reference,
        status: "confirmed",
        payment_status: "paid",
      };

      const { data: newOrder, error: createErr } = await supabase
        .from("orders")
        .insert(insertPayload)
        .select()
        .single();

      if (createErr || !newOrder) {
        console.error("Error creating order after payment:", createErr);
        return new Response(
          JSON.stringify({
            success: false,
            friendlyError: `Failed to record order: ${createErr?.message || "Unknown database error"}`,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Insert validated order items
      if (pricing.items.length > 0) {
        const orderItemsPayload = pricing.items.map((item: any) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          selected_color: item.selected_color || null,
          selected_size: item.selected_size || null,
        }));

        await supabase.from("order_items").insert(orderItemsPayload);
        await decrementStock(supabase, pricing.items);
      }

      // Record seller earnings
      try {
        await supabase.rpc("record_order_seller_earnings", { _order_id: newOrder.id });
      } catch (earnErr) {
        console.warn("Seller earnings trigger notice:", earnErr);
      }

      // Send order confirmation
      try {
        await supabase.functions.invoke("send-order-notification", {
          body: { orderId: newOrder.id, status: "confirmed" },
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
      } catch (notifErr) {
        console.error("Error sending order confirmation notification:", notifErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "success",
          orderId: newOrder.id,
          trackingCode: newOrder.tracking_code,
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, friendlyError: "No matching order or checkout metadata found." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in verify-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
