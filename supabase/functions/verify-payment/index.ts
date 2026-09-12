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
 * Decrement product stock atomically using database-level locking.
 */
async function decrementStock(
  supabase: any,
  items: Array<{ product_id: string; quantity: number; selected_color?: any }>
) {
  if (!items || items.length === 0) return;

  try {
    const formattedItems = items.map((i) => ({
      product_id: i.product_id,
      quantity: Number(i.quantity) || 1,
      selected_color: i.selected_color || null,
    }));

    const { error: rpcErr } = await supabase.rpc("decrement_product_stock", {
      _items: formattedItems,
    });

    if (rpcErr) {
      console.error("Atomic decrement_product_stock RPC error:", rpcErr);
      // Fallback to sequential update if RPC fails
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const productId = item.product_id;
        if (!productId) continue;

        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", productId)
          .single();

        if (product) {
          const newStock = Math.max(0, (Number(product.stock) || 0) - qty);
          await supabase.from("products").update({ stock: newStock }).eq("id", productId);
        }
      }
    } else {
      console.log("Product stock decremented atomically for", items.length, "items");
    }
  } catch (err) {
    console.error("Error in decrementStock:", err);
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

    let metadata: Record<string, any> = {};
    if (typeof transaction.metadata === "string") {
      try {
        metadata = JSON.parse(transaction.metadata);
      } catch {}
    } else if (transaction.metadata && typeof transaction.metadata === "object") {
      metadata = transaction.metadata;
    }

    const orderId = metadata.order_id || null;
    const checkoutDetails = metadata.checkout_details || null;
    const userId = metadata.user_id || auth?.userId || null;
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

    // 1. Look up existing order by payment_reference or order_id
    const metaRef = metadata.payment_reference || null;
    const trxRef = transaction.reference || null;
    const refCandidates = Array.from(new Set([reference, trxRef, metaRef].filter(Boolean)));

    let dbOrder: any = null;
    for (const ref of refCandidates) {
      const { data: byRef } = await supabase
        .from("orders")
        .select("id, total_amount, status, payment_status, user_id, shipping_email, tracking_code, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_region, shipping_town")
        .eq("payment_reference", ref)
        .maybeSingle();
      if (byRef) {
        dbOrder = byRef;
        break;
      }
    }

    if (!dbOrder && orderId) {
      const { data: byId } = await supabase
        .from("orders")
        .select("id, total_amount, status, payment_status, user_id, shipping_email, tracking_code, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_region, shipping_town")
        .eq("id", orderId)
        .maybeSingle();
      if (byId) dbOrder = byId;
    }

    if (dbOrder) {
      // If order was already marked paid / confirmed, return success immediately (idempotency)
      if (dbOrder.payment_status === "paid" || dbOrder.status === "confirmed") {
        return new Response(
          JSON.stringify({
            success: true,
            status: "success",
            orderId: dbOrder.id,
            trackingCode: dbOrder.tracking_code,
            reference,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const expectedPesewas = Math.round(Number(dbOrder.total_amount) * 100);

      // Amount validation
      if (actualPaidAmountPesewas < expectedPesewas) {
        console.error(`Paid amount (${actualPaidAmountPesewas}) < Required (${expectedPesewas})`);
        await supabase
          .from("orders")
          .update({
            payment_status: "failed",
            notes: `Underpayment: Paid ${actualPaidAmountPesewas / 100} GHS vs Required ${expectedPesewas / 100} GHS.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbOrder.id);

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
          updated_at: new Date().toISOString(),
        })
        .eq("id", dbOrder.id);

      if (updateError) {
        console.error("Error updating order status:", updateError);
      }

      // Decrement stock
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, selected_color")
        .eq("order_id", dbOrder.id);
      if (orderItems && orderItems.length > 0) {
        await decrementStock(supabase, orderItems);
      }

      // Record seller earnings
      try {
        await supabase.rpc("record_order_seller_earnings", { _order_id: dbOrder.id });
      } catch (earnErr) {
        console.warn("Seller earnings trigger notice:", earnErr);
      }

      // Send order notification
      try {
        await supabase.functions.invoke("send-order-notification", {
          body: { orderId: dbOrder.id, status: "confirmed" },
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
      } catch (notifErr) {
        console.error("Error invoking order notification:", notifErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "success",
          orderId: dbOrder.id,
          trackingCode: dbOrder.tracking_code,
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2. Direct checkout case with checkout_details
    if (checkoutDetails && checkoutDetails.items && checkoutDetails.items.length > 0) {
      let pricing;
      try {
        pricing = await calculateAuthoritativeCheckoutTotal(supabase, checkoutDetails);
      } catch (priceErr: any) {
        console.error("Authoritative pricing calculation error:", priceErr);
        return new Response(
          JSON.stringify({
            success: false,
            friendlyError: `Validation error: ${priceErr?.message || "Invalid checkout pricing calculation"}. Reference: ${reference}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const expectedPesewas = Math.round(pricing.totalAmount * 100);

      // Strict underpayment check
      if (actualPaidAmountPesewas < expectedPesewas) {
        console.error(`SECURITY ALERT in verify-payment: Underpayment detected (${actualPaidAmountPesewas} < ${expectedPesewas}) for reference ${reference}`);
        return new Response(
          JSON.stringify({
            success: false,
            friendlyError: `Payment amount (${(actualPaidAmountPesewas / 100).toFixed(2)} GHS) is less than required order total (${pricing.totalAmount.toFixed(2)} GHS). Please contact support.`,
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const paidAmountGhs = actualPaidAmountPesewas / 100;
      const trackingCode = generateTrackingCode();

      const insertPayload: Record<string, any> = {
        user_id: userId,
        tracking_code: trackingCode,
        total_amount: paidAmountGhs,
        shipping_name: checkoutDetails.shipping_name || transaction.customer?.email || "Customer",
        shipping_email: checkoutDetails.shipping_email || transaction.customer?.email || "customer@example.com",
        shipping_phone: checkoutDetails.shipping_phone || transaction.customer?.phone || "N/A",
        shipping_address: checkoutDetails.shipping_address || "Paystack Checkout",
        shipping_city: checkoutDetails.shipping_city || "Accra",
        shipping_region: checkoutDetails.shipping_region || "Greater Accra",
        shipping_town: checkoutDetails.shipping_town || null,
        delivery_fee: pricing.deliveryFee,
        discount_code: checkoutDetails.discount_code || null,
        discount_amount: pricing.discountAmount,
        payment_method: metadata.payment_method || "mobile_money",
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

      if (pricing.items && pricing.items.length > 0) {
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

      try {
        await supabase.rpc("record_order_seller_earnings", { _order_id: newOrder.id });
      } catch (earnErr) {
        console.warn("Seller earnings trigger notice:", earnErr);
      }

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

    // 3. Universal recovery: Successful Paystack payment without prior DB record
    const paidAmountGhs = actualPaidAmountPesewas / 100;
    const trackingCode = generateTrackingCode();
    const customerEmail = transaction.customer?.email || "customer@example.com";
    const customerName = transaction.customer?.first_name 
      ? `${transaction.customer.first_name} ${transaction.customer.last_name || ""}`.trim() 
      : customerEmail;

    let fallbackAddress = "Accra, Greater Accra";
    let fallbackCity = "Accra";
    let fallbackRegion = "Greater Accra";
    let fallbackTown: string | null = null;
    let fallbackPhone = transaction.customer?.phone || "N/A";
    let fallbackName = customerName;

    if (userId) {
      const { data: pastOrders } = await supabase
        .from("orders")
        .select("shipping_name, shipping_phone, shipping_address, shipping_city, shipping_region, shipping_town")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      const authenticPastOrder = (pastOrders || []).find((o: any) => {
        const addr = (o?.shipping_address || "").toLowerCase();
        return addr && !addr.includes("paystack") && addr !== "123 main street";
      });

      if (authenticPastOrder) {
        fallbackAddress = authenticPastOrder.shipping_address;
        fallbackCity = authenticPastOrder.shipping_city || "Accra";
        fallbackRegion = authenticPastOrder.shipping_region || "Greater Accra";
        fallbackTown = authenticPastOrder.shipping_town || null;
        if (authenticPastOrder.shipping_phone) fallbackPhone = authenticPastOrder.shipping_phone;
        if (authenticPastOrder.shipping_name) fallbackName = authenticPastOrder.shipping_name;
      }
    }

    const insertPayload: Record<string, any> = {
      user_id: userId,
      tracking_code: trackingCode,
      total_amount: paidAmountGhs,
      shipping_name: fallbackName,
      shipping_email: customerEmail,
      shipping_phone: fallbackPhone,
      shipping_address: fallbackAddress,
      shipping_city: fallbackCity,
      shipping_region: fallbackRegion,
      shipping_town: fallbackTown,
      delivery_fee: 0,
      payment_method: metadata.payment_method || "mobile_money",
      payment_reference: reference,
      status: "confirmed",
      payment_status: "paid",
    };

    const { data: recoveredOrder, error: recoverErr } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select()
      .single();

    if (!recoverErr && recoveredOrder) {
      if (userId) {
        const { data: userCartItems } = await supabase
          .from("cart_items")
          .select("product_id, quantity, selected_color, selected_size, products(price, sale_price)")
          .eq("user_id", userId);

        if (userCartItems && userCartItems.length > 0) {
          const itemsPayload = userCartItems.map((ci: any) => ({
            order_id: recoveredOrder.id,
            product_id: ci.product_id,
            quantity: ci.quantity,
            price: ci.products?.sale_price || ci.products?.price || 0,
            selected_color: ci.selected_color || null,
            selected_size: ci.selected_size || null,
          }));
          await supabase.from("order_items").insert(itemsPayload);
          await decrementStock(supabase, userCartItems);
          await supabase.from("cart_items").delete().eq("user_id", userId);
        }
      }

      try {
        await supabase.rpc("record_order_seller_earnings", { _order_id: recoveredOrder.id });
      } catch {}

      try {
        await supabase.functions.invoke("send-order-notification", {
          body: { orderId: recoveredOrder.id, status: "confirmed" },
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
      } catch {}

      return new Response(
        JSON.stringify({
          success: true,
          status: "success",
          orderId: recoveredOrder.id,
          trackingCode: recoveredOrder.tracking_code,
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, friendlyError: "Could not create order record for verified transaction." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
