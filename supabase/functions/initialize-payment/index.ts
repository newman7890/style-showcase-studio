import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getAllPaystackSecretKeysAsync, getPaystackPublicKey, PaystackKeyConfig } from "../_shared/paystack.ts";
import { calculateAuthoritativeCheckoutTotal } from "../_shared/pricing.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

const PaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID").optional().nullable(),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive("Amount must be positive").finite().max(10_000_000, "Amount too large"),
  paymentMethod: z.string().optional().nullable(),
  mobileNumber: z.union([z.string().min(7).max(20), z.literal(""), z.null()]).optional(),
  callbackUrl: z.string().url("Invalid callback URL").max(500),
  checkoutDetails: z.object({
    shipping_name: z.string().min(1, "Shipping name is required"),
    shipping_email: z.string().email("Valid shipping email required"),
    shipping_phone: z.string().min(5, "Shipping phone required"),
    shipping_address: z.string().min(1, "Shipping address required"),
    shipping_city: z.string().min(1, "Shipping city required"),
    shipping_region: z.string().min(1, "Shipping region required"),
    shipping_town: z.string().optional().nullable(),
    delivery_fee: z.number().optional().nullable(),
    discount_code: z.string().optional().nullable(),
    discount_amount: z.number().optional().nullable(),
    items: z.array(z.object({
      product_id: z.string().min(1, "Product ID required"),
      quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(100, "Maximum 100 per item"),
      price: z.number().optional().nullable(),
      selected_color: z.any().optional().nullable(),
      selected_size: z.any().optional().nullable(),
    })).min(1, "At least one item is required"),
  }).optional().nullable(),
});

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const auth = await authenticate(req);
    const userId = auth?.userId || null;
    const clientId = getClientIdentifier(req, userId);

    // Rate Limiting (20 payment inits per 5 minutes)
    const rateCheck = await checkGlobalRateLimitAsync(adminClient, "initialize-payment", clientId, { maxRequests: 20, windowMs: 5 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many payment initialization attempts. Please wait a few minutes before trying again." }),
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

    let serverAmount = amount;
    let authoritativeDetails = checkoutDetails;

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
      // 2. Direct checkout flow: compute server-authoritative item prices, delivery fees, and discount codes
      try {
        const pricing = await calculateAuthoritativeCheckoutTotal(adminClient, checkoutDetails);
        serverAmount = pricing.totalAmount;
        authoritativeDetails = {
          ...checkoutDetails,
          delivery_fee: pricing.deliveryFee,
          discount_amount: pricing.discountAmount,
          items: pricing.items,
        };
      } catch (priceErr: any) {
        return new Response(
          JSON.stringify({ error: priceErr?.message || "Failed to calculate authoritative order total." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
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
        checkout_details: authoritativeDetails || null,
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
