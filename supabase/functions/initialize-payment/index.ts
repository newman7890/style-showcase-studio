import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getAllPaystackSecretKeysAsync, getPaystackPublicKey, PaystackKeyConfig } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID").optional().nullable(),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive("Amount must be positive").finite().max(10_000_000, "Amount too large"),
  paymentMethod: z.string().optional().nullable(),
  mobileNumber: z.union([z.string().min(7).max(20), z.literal(""), z.null()]).optional(),
  callbackUrl: z.string().url("Invalid callback URL").max(500),
  checkoutDetails: z.object({
    shipping_name: z.string(),
    shipping_email: z.string(),
    shipping_phone: z.string(),
    shipping_address: z.string(),
    shipping_city: z.string(),
    shipping_region: z.string(),
    shipping_town: z.string().optional().nullable(),
    delivery_fee: z.number().default(0),
    discount_code: z.string().optional().nullable(),
    discount_amount: z.number().optional().nullable(),
    items: z.array(z.object({
      product_id: z.string(),
      quantity: z.number(),
      price: z.number(),
      selected_color: z.any().optional().nullable(),
      selected_size: z.any().optional().nullable(),
    })),
  }).optional().nullable(),
});

const handler = async (req: Request): Promise<Response> => {
  console.log("initialize-payment function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    const userId = auth?.userId || null;

    const rawBody = await req.json();
    const parsed = PaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { orderId, email, amount, paymentMethod, callbackUrl, checkoutDetails } = parsed.data;

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let serverAmount = amount;

    // 1. If orderId is supplied, strictly verify against database order total and ownership
    if (orderId) {
      const { data: orderRow, error: orderErr } = await adminClient
        .from("orders")
        .select("id, total_amount, status, user_id, shipping_email, payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr || !orderRow) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Authorization check: order must belong to caller if authenticated, or email must match if guest
      if (userId && orderRow.user_id && orderRow.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Access denied: You do not own this order." }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!userId && orderRow.shipping_email && orderRow.shipping_email.toLowerCase() !== email.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "Access denied: Email does not match order record." }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Ensure order is payable
      if (orderRow.payment_status === "paid" || orderRow.status === "confirmed" || orderRow.status === "delivered" || orderRow.status === "cancelled" || orderRow.status === "refunded") {
        return new Response(
          JSON.stringify({ error: `Order is not payable (Current status: ${orderRow.status}, payment: ${orderRow.payment_status})` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // CRITICAL: Always use database total_amount, overriding any client-supplied amount
      serverAmount = Number(orderRow.total_amount);
    } else if (checkoutDetails && checkoutDetails.items && checkoutDetails.items.length > 0) {
      // 2. Direct checkout flow without existing order: Verify item prices against authoritative database records
      const productIds = checkoutDetails.items.map((i) => i.product_id);
      const { data: dbProducts, error: prodErr } = await adminClient
        .from("products")
        .select("id, price, stock, name")
        .in("id", productIds);

      if (prodErr || !dbProducts) {
        return new Response(
          JSON.stringify({ error: "Failed to verify product prices against catalog." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));
      let calculatedItemsTotal = 0;

      for (const item of checkoutDetails.items) {
        const prod = productMap.get(item.product_id);
        if (!prod) {
          return new Response(
            JSON.stringify({ error: `Product ID ${item.product_id} no longer exists in catalog.` }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        const authoritativePrice = Number(prod.price);
        calculatedItemsTotal += authoritativePrice * item.quantity;
      }

      const deliveryFee = Number(checkoutDetails.delivery_fee) || 0;
      const discountAmount = Number(checkoutDetails.discount_amount) || 0;
      const computedTotal = Math.max(0.1, calculatedItemsTotal + deliveryFee - discountAmount);

      serverAmount = computedTotal;
    }

    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid order amount" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Initializing payment, verified server amount: ${serverAmount}, orderId: ${orderId || "new_checkout"}`);

    const amountInPesewas = Math.round(serverAmount * 100);
    const channels = ["card", "mobile_money"];
    const refCode = orderId ? `ORDER_${orderId}_${Date.now()}` : `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const paystackPayload: Record<string, unknown> = {
      email,
      amount: amountInPesewas,
      currency: "GHS",
      reference: refCode,
      callback_url: callbackUrl,
      channels,
      metadata: {
        order_id: orderId || null,
        user_id: userId,
        payment_method: paymentMethod || "bank_card",
        verified_amount_pesewas: amountInPesewas,
        checkout_details: checkoutDetails || null,
        custom_fields: [
          {
            display_name: "Customer Email",
            variable_name: "customer_email",
            value: email,
          },
        ],
      },
    };

    const allKeys = await getAllPaystackSecretKeysAsync();
    let paystackData: any = null;
    let successfulKeyConfig: PaystackKeyConfig | null = allKeys[0] || null;
    let lastPaystackError = "";

    if (allKeys.length > 0) {
      for (const keyConfig of allKeys) {
        try {
          console.log(`Attempting Paystack initialize with key from ${keyConfig.sourceName}...`);
          const response = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${keyConfig.secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paystackPayload),
          });

          const resData = await response.json();
          console.log("Paystack response:", JSON.stringify(resData));
          if (resData.status && resData.data?.authorization_url) {
            paystackData = resData;
            successfulKeyConfig = keyConfig;
            break;
          } else {
            lastPaystackError = resData.message || "Failed to initialize Paystack payment.";
          }
        } catch (err: any) {
          console.error(`Fetch error with key ${keyConfig.sourceName}:`, err);
          lastPaystackError = err?.message || "Network error contacting Paystack API.";
        }
      }
    } else {
      const errMsg = "No valid Paystack Secret Key found. Paystack Secret Keys must start with 'sk_live_' or 'sk_test_'.";
      console.error(errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!paystackData || !paystackData.status || !paystackData.data?.authorization_url) {
      const errMsg = lastPaystackError || "Failed to connect to Paystack. Please check your API key in Admin Settings.";
      console.error("Paystack initialization failed:", errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: paystackData.data.authorization_url,
        authorization_url: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: successfulKeyConfig?.publicKey || getPaystackPublicKey() || "",
        channels,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in initialize-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
